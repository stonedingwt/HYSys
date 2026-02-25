"""
SSO User Sync – pull all users from DingTalk / WeCom / Feishu / Azure AD
and create them locally (skip duplicates).
"""

import hashlib
from typing import List, Dict, Any

import httpx
from fastapi import APIRouter, Depends
from loguru import logger

from mep.api.v1.schemas import resp_200
from mep.common.dependencies.user_deps import UserPayload
from mep.common.services.config_service import settings as mep_settings
from mep.database.models.user_group import UserGroupDao
from mep.user.domain.models.user import User, UserDao

router = APIRouter(prefix='/sso', tags=['SSO Sync'])

_DEFAULT_PWD = hashlib.md5('sso_sync_no_password'.encode()).hexdigest()


async def _ensure_user(user_name: str, user_type: str, phone: str = None,
                       email: str = None, dept_id: str = None) -> dict:
    if not user_name or not user_name.strip():
        return {'user_name': user_name, 'status': 'skipped', 'reason': 'empty name'}

    user_name = user_name.strip()
    existing = await UserDao.aget_user_by_username(user_name)
    if existing:
        return {'user_name': user_name, 'status': 'exists'}

    new_user = User(
        user_name=user_name,
        password=_DEFAULT_PWD,
        user_type=user_type,
        phone_number=phone,
        email=email,
        dept_id=dept_id,
    )
    admin_username = mep_settings.get_system_login_method().admin_username
    if admin_username and admin_username == user_name:
        new_user = await UserDao.add_user_and_admin_role(new_user)
    else:
        new_user = await UserDao.add_user_and_default_role(new_user)
    await UserGroupDao.add_default_user_group(new_user.user_id)
    return {'user_name': user_name, 'status': 'created'}


# ──────────────────────────────────────────────
#  DingTalk
# ──────────────────────────────────────────────

async def _dingtalk_get_enterprise_token(app_key: str, app_secret: str) -> str:
    """Get DingTalk enterprise access token (old oapi)."""
    async with httpx.AsyncClient(timeout=15) as c:
        resp = await c.get(
            'https://oapi.dingtalk.com/gettoken',
            params={'appkey': app_key, 'appsecret': app_secret},
        )
        data = resp.json()
        if data.get('errcode', 0) != 0:
            raise Exception(f'钉钉 Token 获取失败: {data.get("errmsg", "")}')
        return data.get('access_token', '')


async def _dingtalk_get_app_token(app_key: str, app_secret: str) -> str:
    """Get DingTalk app access token (new API)."""
    async with httpx.AsyncClient(timeout=15) as c:
        resp = await c.post(
            'https://api.dingtalk.com/v1.0/oauth2/accessToken',
            json={'appKey': app_key, 'appSecret': app_secret},
        )
        data = resp.json()
        token = data.get('accessToken', '')
        if not token:
            raise Exception(f'钉钉 App Token 获取失败: {data}')
        return token


async def sync_dingtalk_users() -> Dict[str, Any]:
    """Fetch all DingTalk users. Tries old API first (most compatible), then new API."""
    cfg = (mep_settings.get_system_login_method().dingtalk or {})
    app_key = cfg.get('app_key', '')
    app_secret = cfg.get('app_secret', '')
    if not app_key or not app_secret:
        return {'error': '钉钉 App Key / App Secret 未配置'}

    raw_users = []
    perm_errors = []

    # ── Try old API (oapi.dingtalk.com) ──
    try:
        old_token = await _dingtalk_get_enterprise_token(app_key, app_secret)

        # Get departments
        dept_ids = [1]
        async with httpx.AsyncClient(timeout=20) as c:
            resp = await c.post(
                'https://oapi.dingtalk.com/topapi/v2/department/listsub',
                params={'access_token': old_token},
                json={'dept_id': 1},
            )
            data = resp.json()
            if data.get('errcode') == 0:
                for dept in data.get('result', []):
                    dept_ids.append(dept['dept_id'])
            elif data.get('errcode') == 88:
                perm_errors.append(f'qyapi_get_department_list')
                logger.warning(f'DingTalk dept permission missing: {data.get("sub_msg", "")}')

            logger.info(f'DingTalk sync: {len(dept_ids)} departments')

            # Get users per department
            seen = set()
            for did in dept_ids:
                cursor = 0
                while True:
                    resp = await c.post(
                        'https://oapi.dingtalk.com/topapi/v2/user/list',
                        params={'access_token': old_token},
                        json={'dept_id': did, 'cursor': cursor, 'size': 100},
                    )
                    data = resp.json()
                    if data.get('errcode') == 88:
                        if 'qyapi_get_department_member' not in perm_errors:
                            perm_errors.append('qyapi_get_department_member')
                        break
                    if data.get('errcode') != 0:
                        break
                    result = data.get('result', {})
                    for u in result.get('list', []):
                        uid = u.get('userid', '')
                        if uid and uid not in seen:
                            seen.add(uid)
                            raw_users.append(u)
                    if not result.get('has_more'):
                        break
                    cursor = result.get('next_cursor', 0)

    except Exception as e:
        logger.warning(f'DingTalk old API sync error: {e}')

    # ── Try new API if old API got no users ──
    if not raw_users:
        try:
            app_token = await _dingtalk_get_app_token(app_key, app_secret)
            headers = {'x-acs-dingtalk-access-token': app_token}

            async with httpx.AsyncClient(timeout=20) as c:
                dept_ids_new = [1]
                queue = [1]
                while queue:
                    did = queue.pop(0)
                    resp = await c.get(
                        f'https://api.dingtalk.com/v1.0/contact/departments/{did}/listSubDepartmentId',
                        headers=headers,
                    )
                    data = resp.json()
                    if 'result' in data:
                        sub_ids = data.get('result', [])
                        dept_ids_new.extend(sub_ids)
                        queue.extend(sub_ids)
                    elif data.get('code'):
                        break

                seen = set()
                for did in dept_ids_new:
                    cursor = 0
                    while True:
                        resp = await c.post(
                            f'https://api.dingtalk.com/v1.0/contact/departments/{did}/users',
                            headers=headers,
                            json={'maxResults': 100, 'nextToken': str(cursor) if cursor else '0'},
                        )
                        data = resp.json()
                        if data.get('code'):
                            break
                        for u in data.get('result', {}).get('list', []):
                            uid = u.get('userId', '')
                            if uid and uid not in seen:
                                seen.add(uid)
                                raw_users.append(u)
                        nt = data.get('result', {}).get('nextToken')
                        if not nt:
                            break
                        cursor = nt
        except Exception as e:
            logger.warning(f'DingTalk new API sync error: {e}')

    if not raw_users:
        missing = ', '.join(perm_errors) if perm_errors else '未知'
        return {
            'error': f'未获取到钉钉用户。缺少权限: {missing}',
            'help': '请在钉钉开发者后台 → 应用 → 权限管理中开通：'
                    'qyapi_get_department_list、qyapi_get_department_member、Contact.User.Read',
            'total': 0, 'created': 0, 'existed': 0,
        }

    results = []
    for u in raw_users:
        name = u.get('mobile') or u.get('name') or u.get('userid') or u.get('userId', '')
        r = await _ensure_user(
            user_name=name,
            user_type='dingtalk',
            phone=u.get('mobile', ''),
            email=u.get('email', ''),
        )
        results.append(r)

    created = sum(1 for r in results if r['status'] == 'created')
    existed = sum(1 for r in results if r['status'] == 'exists')
    skipped = sum(1 for r in results if r['status'] == 'skipped')
    return {'total': len(results), 'created': created, 'existed': existed, 'skipped': skipped}


# ──────────────────────────────────────────────
#  WeCom (企业微信)
# ──────────────────────────────────────────────

async def sync_wecom_users() -> Dict[str, Any]:
    cfg = (mep_settings.get_system_login_method().wecom or {})
    corp_id = cfg.get('corp_id', '')
    secret = cfg.get('secret', '')
    if not corp_id or not secret:
        return {'error': '企业微信 Corp ID / Secret 未配置'}

    try:
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(
                'https://qyapi.weixin.qq.com/cgi-bin/gettoken',
                params={'corpid': corp_id, 'corpsecret': secret},
            )
            token = resp.json().get('access_token', '')
            if not token:
                return {'error': f'企业微信 Token 获取失败: {resp.json().get("errmsg", "")}'}

            # Get departments
            dept_ids = [1]
            resp = await c.get(
                'https://qyapi.weixin.qq.com/cgi-bin/department/list',
                params={'access_token': token, 'id': 1},
            )
            for dept in resp.json().get('department', []):
                if dept['id'] != 1:
                    dept_ids.append(dept['id'])

            # Get users
            seen = set()
            results = []
            for did in dept_ids:
                resp = await c.get(
                    'https://qyapi.weixin.qq.com/cgi-bin/user/list',
                    params={'access_token': token, 'department_id': did},
                )
                for u in resp.json().get('userlist', []):
                    uid = u.get('userid', '')
                    if uid in seen:
                        continue
                    seen.add(uid)
                    name = u.get('mobile') or u.get('name') or uid
                    r = await _ensure_user(name, 'wecom', u.get('mobile'), u.get('email'), str(did))
                    results.append(r)

        created = sum(1 for r in results if r['status'] == 'created')
        existed = sum(1 for r in results if r['status'] == 'exists')
        return {'total': len(results), 'created': created, 'existed': existed}
    except Exception as e:
        return {'error': f'企业微信同步失败: {str(e)}'}


# ──────────────────────────────────────────────
#  Feishu (飞书)
# ──────────────────────────────────────────────

async def sync_feishu_users() -> Dict[str, Any]:
    cfg = (mep_settings.get_system_login_method().feishu or {})
    app_id = cfg.get('app_id', '')
    app_secret = cfg.get('app_secret', '')
    if not app_id or not app_secret:
        return {'error': '飞书 App ID / App Secret 未配置'}

    try:
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.post(
                'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
                json={'app_id': app_id, 'app_secret': app_secret},
            )
            token = resp.json().get('tenant_access_token', '')
            if not token:
                return {'error': '飞书 Tenant Token 获取失败'}

            headers = {'Authorization': f'Bearer {token}'}

            # Get departments
            dept_ids = ['0']
            page_token = ''
            while True:
                params = {'parent_department_id': '0', 'page_size': 50}
                if page_token:
                    params['page_token'] = page_token
                resp = await c.get(
                    'https://open.feishu.cn/open-apis/contact/v3/departments',
                    params=params, headers=headers,
                )
                rdata = resp.json()
                if rdata.get('code', 0) != 0:
                    return {'error': f'飞书获取部门失败: {rdata.get("msg", "")}'}
                data = rdata.get('data', {})
                for dept in data.get('items', []):
                    dept_ids.append(dept['open_department_id'])
                if not data.get('has_more'):
                    break
                page_token = data.get('page_token', '')

            # Get users
            seen = set()
            results = []
            for did in dept_ids:
                pt = ''
                while True:
                    params = {'department_id': did, 'page_size': 50}
                    if pt:
                        params['page_token'] = pt
                    resp = await c.get(
                        'https://open.feishu.cn/open-apis/contact/v3/users',
                        params=params, headers=headers,
                    )
                    rdata = resp.json()
                    if rdata.get('code', 0) != 0:
                        break
                    data = rdata.get('data', {})
                    for u in data.get('items', []):
                        uid = u.get('user_id') or u.get('open_id', '')
                        if uid in seen:
                            continue
                        seen.add(uid)
                        name = u.get('mobile') or u.get('name') or uid
                        r = await _ensure_user(name, 'feishu', u.get('mobile'), u.get('email'), str(did))
                        results.append(r)
                    if not data.get('has_more'):
                        break
                    pt = data.get('page_token', '')

            created = sum(1 for r in results if r['status'] == 'created')
            existed = sum(1 for r in results if r['status'] == 'exists')
            return {'total': len(results), 'created': created, 'existed': existed}
    except Exception as e:
        return {'error': f'飞书同步失败: {str(e)}'}


# ──────────────────────────────────────────────
#  Azure AD (AAD)
# ──────────────────────────────────────────────

async def sync_aad_users() -> Dict[str, Any]:
    cfg = (mep_settings.get_system_login_method().aad or {})
    tenant_id = cfg.get('tenant_id', '')
    client_id = cfg.get('client_id', '')
    client_secret = cfg.get('client_secret', '')
    if not tenant_id or not client_id or not client_secret:
        return {'error': 'Azure AD 配置不完整'}

    try:
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.post(
                f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token',
                data={
                    'client_id': client_id, 'client_secret': client_secret,
                    'scope': 'https://graph.microsoft.com/.default',
                    'grant_type': 'client_credentials',
                },
            )
            token = resp.json().get('access_token', '')
            if not token:
                return {'error': f'Azure AD Token 获取失败'}

        users_list = []
        url = 'https://graph.microsoft.com/v1.0/users?$select=displayName,mail,userPrincipalName,mobilePhone&$top=100'
        async with httpx.AsyncClient(timeout=30) as c:
            while url:
                resp = await c.get(url, headers={'Authorization': f'Bearer {token}'})
                data = resp.json()
                if 'error' in data:
                    return {'error': f'Azure AD 用户获取失败: {data["error"].get("message", "")}'}
                users_list.extend(data.get('value', []))
                url = data.get('@odata.nextLink')

        results = []
        for u in users_list:
            name = u.get('mail') or u.get('userPrincipalName') or u.get('displayName', '')
            r = await _ensure_user(name, 'aad', u.get('mobilePhone'), u.get('mail'))
            results.append(r)

        created = sum(1 for r in results if r['status'] == 'created')
        existed = sum(1 for r in results if r['status'] == 'exists')
        return {'total': len(results), 'created': created, 'existed': existed}
    except Exception as e:
        return {'error': f'Azure AD 同步失败: {str(e)}'}


# ──────────────────────────────────────────────
#  Router endpoints
# ──────────────────────────────────────────────

_SYNC_HANDLERS = {
    'dingtalk': sync_dingtalk_users,
    'wecom': sync_wecom_users,
    'feishu': sync_feishu_users,
    'aad': sync_aad_users,
}


@router.post('/sync-users', summary='同步 SSO 用户到本地系统')
async def sync_sso_users(
    admin_user: UserPayload = Depends(UserPayload.get_admin_user),
):
    login_method = mep_settings.get_system_login_method()
    sso_type = login_method.sso_type or 'none'
    if sso_type == 'none':
        return resp_200(data={'error': '未配置 SSO 登录方式'})

    handler = _SYNC_HANDLERS.get(sso_type)
    if not handler:
        return resp_200(data={'error': f'不支持的 SSO 类型: {sso_type}'})

    try:
        result = await handler()
        logger.info(f'SSO sync ({sso_type}): {result}')
        return resp_200(data=result)
    except Exception as e:
        logger.exception(f'SSO sync error: {e}')
        return resp_200(data={'error': f'同步失败: {str(e)}'})


@router.post('/sync-users/{sso_type}', summary='按类型同步 SSO 用户')
async def sync_sso_users_by_type(
    sso_type: str,
    admin_user: UserPayload = Depends(UserPayload.get_admin_user),
):
    handler = _SYNC_HANDLERS.get(sso_type)
    if not handler:
        return resp_200(data={'error': f'不支持的 SSO 类型: {sso_type}'})
    try:
        result = await handler()
        return resp_200(data=result)
    except Exception as e:
        logger.exception(f'SSO sync error ({sso_type}): {e}')
        return resp_200(data={'error': f'同步失败: {str(e)}'})
