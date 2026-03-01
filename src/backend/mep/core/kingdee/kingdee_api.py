"""Kingdee K3Cloud Web API client.

Uses the standard K3Cloud REST endpoints:
  - AuthService.ValidateUser  (login)
  - Kingdee.BOS.WebApi.ServicesStub.*  (save/submit/view/draft/delete)
  - ExecuteBillQuery  (query)
  - UploadAttachment  (file upload)

Config is loaded from the database ``config`` table (key='kingdee_config')
or falls back to DEFAULT_KINGDEE_CONFIG defined in the RPA worker.
"""

import json
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

DEFAULT_CONFIG = {
    'base_url': 'http://122.195.141.186:1188/k3cloud',
    'acct_id': '赛乐测试账套',
    'username': 'test',
    'password': '123456',
    'lcid': 2052,
}


def _load_config() -> dict:
    """Load Kingdee config from DB, fallback to defaults."""
    try:
        from mep.core.database.manager import get_sync_db_session
        from sqlmodel import text as sa_text

        with get_sync_db_session() as session:
            row = session.execute(
                sa_text("SELECT value FROM config WHERE `key` = 'kingdee_config' LIMIT 1")
            ).first()
            if row:
                cfg = json.loads(row[0])
                return {
                    'base_url': cfg.get('url') or cfg.get('base_url', DEFAULT_CONFIG['base_url']),
                    'acct_id': cfg.get('acct_id') or cfg.get('account_set', DEFAULT_CONFIG['acct_id']),
                    'username': cfg.get('username', DEFAULT_CONFIG['username']),
                    'password': cfg.get('password', DEFAULT_CONFIG['password']),
                    'lcid': cfg.get('lcid', DEFAULT_CONFIG['lcid']),
                }
    except Exception:
        logger.warning('Failed to load kingdee_config from DB, using defaults')
    return DEFAULT_CONFIG.copy()


class KingdeeApiClient:
    """Async client for Kingdee K3Cloud Web API."""

    SVC_PREFIX = 'Kingdee.BOS.WebApi.ServicesStub'

    def __init__(self, config: Optional[dict] = None):
        cfg = config or _load_config()
        self.base_url = cfg['base_url'].rstrip('/')
        self.acct_id = cfg['acct_id']
        self.username = cfg['username']
        self.password = cfg['password']
        self.lcid = cfg.get('lcid', 2052)
        self._cookies: dict = {}
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30, verify=False)
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    async def login(self) -> dict:
        """Authenticate and cache session cookies.

        Returns the raw K3Cloud login result dict.
        """
        url = f'{self.base_url}/{self.SVC_PREFIX}.AuthService.ValidateUser.common.kdsvc'
        payload = {
            'acctID': self.acct_id,
            'username': self.username,
            'password': self.password,
            'lcid': int(self.lcid),
        }
        client = await self._get_client()
        resp = await client.post(url, json=payload)
        raw = resp.text

        if raw.startswith('response_error:'):
            raise RuntimeError(f'Kingdee login error: {raw[:300]}')

        result = resp.json()
        login_type = result.get('LoginResultType')
        if login_type != 1:
            msg = result.get('Message', json.dumps(result, ensure_ascii=False)[:200])
            raise RuntimeError(f'Kingdee login failed (type={login_type}): {msg}')

        self._cookies = dict(resp.cookies)
        logger.info('Kingdee login success: %s', result.get('Context', {}).get('UserName', ''))
        return result

    async def _ensure_login(self):
        if not self._cookies:
            await self.login()

    async def _post_svc(self, service_name: str, data: Any) -> dict:
        """Post to a K3Cloud service endpoint, auto-login if needed."""
        await self._ensure_login()
        url = f'{self.base_url}/{self.SVC_PREFIX}.{service_name}.common.kdsvc'
        client = await self._get_client()
        resp = await client.post(url, json=data, cookies=self._cookies)

        if resp.status_code == 401 or 'login' in resp.text.lower()[:200]:
            await self.login()
            resp = await client.post(url, json=data, cookies=self._cookies)

        raw = resp.text
        if raw.startswith('response_error:'):
            raise RuntimeError(f'Kingdee API error ({service_name}): {raw[:300]}')

        return resp.json()

    # ------------------------------------------------------------------
    # CRUD operations
    # ------------------------------------------------------------------

    async def save(self, form_id: str, data: dict) -> dict:
        """Save (create or update) a bill.

        Args:
            form_id: K3Cloud form identifier.
            data: The Model dict expected by K3Cloud Save API.
        """
        payload = {'formid': form_id, 'data': data}
        return await self._post_svc('DynamicFormService.Save', payload)

    async def submit(self, form_id: str, data: dict) -> dict:
        """Submit a bill for approval."""
        payload = {'formid': form_id, 'data': data}
        return await self._post_svc('DynamicFormService.Submit', payload)

    async def view(self, form_id: str, data: dict) -> dict:
        """View (query single record) a bill."""
        payload = {'formid': form_id, 'data': data}
        return await self._post_svc('DynamicFormService.View', payload)

    async def draft(self, form_id: str, data: dict) -> dict:
        """Save a bill as draft."""
        payload = {'formid': form_id, 'data': data}
        return await self._post_svc('DynamicFormService.Draft', payload)

    async def delete(self, form_id: str, data: dict) -> dict:
        """Delete a bill."""
        payload = {'formid': form_id, 'data': data}
        return await self._post_svc('DynamicFormService.Delete', payload)

    async def audit(self, form_id: str, data: dict) -> dict:
        """Audit (approve) a bill."""
        payload = {'formid': form_id, 'data': data}
        return await self._post_svc('DynamicFormService.Audit', payload)

    async def unaudit(self, form_id: str, data: dict) -> dict:
        """Reverse audit of a bill."""
        payload = {'formid': form_id, 'data': data}
        return await self._post_svc('DynamicFormService.UnAudit', payload)

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    async def execute_bill_query(
        self,
        form_id: str,
        field_keys: str,
        filter_string: str = '',
        order_string: str = '',
        top_row_count: int = 0,
        start_row: int = 0,
        limit: int = 2000,
    ) -> List[list]:
        """Execute a bill query (ExecuteBillQuery).

        Args:
            form_id: K3Cloud form identifier.
            field_keys: Comma-separated field keys.
            filter_string: Optional filter expression.
            order_string: Optional order expression.
            top_row_count: Limit returned rows (0=all).
            start_row: Starting row offset.
            limit: Page size.

        Returns:
            List of row arrays.
        """
        payload = {
            'FormId': form_id,
            'FieldKeys': field_keys,
            'FilterString': filter_string,
            'OrderString': order_string,
            'TopRowCount': top_row_count,
            'StartRow': start_row,
            'Limit': limit,
        }
        return await self._post_svc('DynamicFormService.ExecuteBillQuery', payload)

    # ------------------------------------------------------------------
    # Attachment upload
    # ------------------------------------------------------------------

    async def upload_attachment(
        self,
        form_id: str,
        bill_id: str,
        file_bytes: bytes,
        filename: str,
        *,
        entry_key: str = '',
    ) -> dict:
        """Upload an attachment to a K3Cloud bill.

        Uses the attachment upload API to bind a file to a specific bill.

        Args:
            form_id: The bill form ID.
            bill_id: The inter-id (primary key) of the target bill.
            file_bytes: Raw file content.
            filename: Display filename.
            entry_key: Optional entry key for sub-entry attachments.
        """
        await self._ensure_login()
        import base64

        url = f'{self.base_url}/{self.SVC_PREFIX}.DynamicFormService.AttachmentUpLoad.common.kdsvc'
        payload = {
            'formid': form_id,
            'data': {
                'FileName': filename,
                'FileData': base64.b64encode(file_bytes).decode('ascii'),
                'InterId': bill_id,
                'BillNo': '',
                'EntryKey': entry_key,
                'AdjustSize': 100,
            },
        }
        client = await self._get_client()
        resp = await client.post(url, json=payload, cookies=self._cookies)

        if resp.status_code == 401:
            await self.login()
            resp = await client.post(url, json=payload, cookies=self._cookies)

        raw = resp.text
        if raw.startswith('response_error:'):
            raise RuntimeError(f'Kingdee attachment upload error: {raw[:300]}')

        return resp.json()


async def get_kingdee_api_client(config: Optional[dict] = None) -> KingdeeApiClient:
    """Factory helper to create and login a KingdeeApiClient."""
    client = KingdeeApiClient(config)
    await client.login()
    return client
