"""
SSO Authentication callback endpoints (DingTalk, WeCom, Feishu, AAD).
Handles the OAuth2 callback after third-party authorization.
"""

import hashlib
import httpx
from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from loguru import logger

from mep.common.services.config_service import settings as mep_settings
from mep.core.cache.redis_manager import get_redis_client
from mep.database.models.user_group import UserGroupDao
from mep.user.domain.models.user import User, UserDao
from mep.user.domain.services.auth import AuthJwt, LoginUser
from mep.utils.constants import USER_CURRENT_SESSION

router = APIRouter(prefix='/auth', tags=['SSO Auth'])


# ──────────── Shared helpers ────────────

async def _find_or_create_user(user_name: str, user_type: str = 'dingtalk') -> User:
    """Find existing user or create a new one with default role."""
    user_exist = await UserDao.aget_user_by_username(user_name)
    if user_exist:
        if user_exist.delete == 1:
            raise Exception('用户已被禁用')
        return user_exist

    new_user = User(
        user_name=user_name,
        password=hashlib.md5('sso_default_no_password'.encode()).hexdigest(),
        user_type=user_type,
    )

    admin_username = mep_settings.get_system_login_method().admin_username
    if admin_username and admin_username == user_name:
        new_user = await UserDao.add_user_and_admin_role(new_user)
    else:
        new_user = await UserDao.add_user_and_default_role(new_user)

    await UserGroupDao.add_default_user_group(new_user.user_id)
    logger.info(f'SSO auto-created user: {user_name} (type={user_type})')
    return new_user


def _success_html(access_token: str, cookie_conf, redirect_path: str = '/workspace/') -> HTMLResponse:
    """Return HTML that sets cookie + localStorage, then redirects."""
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>登录成功</title></head>
<body>
<p style="text-align:center;margin-top:80px;font-size:18px;color:#333;">登录成功，正在跳转...</p>
<script>
try {{ localStorage.setItem('isLogin', '1'); }} catch(e) {{}}
window.location.replace('{redirect_path}');
</script>
</body></html>"""
    resp = HTMLResponse(content=html, status_code=200)
    resp.set_cookie(
        'access_token_cookie',
        access_token,
        max_age=cookie_conf.max_age,
        path=cookie_conf.path,
        domain=cookie_conf.domain,
        secure=cookie_conf.secure,
        httponly=cookie_conf.httponly,
        samesite=cookie_conf.samesite,
    )
    return resp


def _error_redirect(msg: str) -> RedirectResponse:
    """Redirect to login page with a Chinese error message in status_code param."""
    from urllib.parse import quote
    return RedirectResponse(url=f'/?status_code={quote(msg)}', status_code=302)


async def _issue_token(user: User, request: Request):
    """Create JWT token and store session. Returns (token, cookie_conf)."""
    auth_jwt = AuthJwt(req=request, res=None)
    access_token = LoginUser.create_access_token(user=user, auth_jwt=auth_jwt)

    redis_client = await get_redis_client()
    await redis_client.aset(
        USER_CURRENT_SESSION.format(user.user_id),
        access_token,
        auth_jwt.cookie_conf.jwt_token_expire_time + 3600,
    )
    return access_token, auth_jwt.cookie_conf


# ──────────── DingTalk ────────────

async def _dingtalk_get_user_info(client: httpx.AsyncClient, app_key: str,
                                  app_secret: str, auth_code: str) -> dict:
    """
    Try multiple DingTalk APIs to get user info.
    Returns dict with 'nick' or 'name', 'mobile', 'userid' etc.
    """

    # ── Method 1: New OAuth2 API ──
    # Exchange authCode for user access token, then get user info
    try:
        token_resp = await client.post(
            'https://api.dingtalk.com/v1.0/oauth2/userAccessToken',
            json={
                'clientId': app_key,
                'clientSecret': app_secret,
                'code': auth_code,
                'grantType': 'authorization_code',
            },
        )
        token_data = token_resp.json()
        user_access_token = token_data.get('accessToken')
        logger.info(f'DingTalk token exchange: status={token_resp.status_code}, has_token={bool(user_access_token)}')

        if user_access_token:
            user_resp = await client.get(
                'https://api.dingtalk.com/v1.0/contact/users/me',
                headers={'x-acs-dingtalk-access-token': user_access_token},
            )
            user_data = user_resp.json()
            logger.info(f'DingTalk contact/users/me: status={user_resp.status_code}, data_keys={list(user_data.keys())}')

            if user_resp.status_code == 200 and not user_data.get('code'):
                return user_data
            else:
                logger.warning(f'DingTalk contact/users/me failed: {user_data}')
    except Exception as e:
        logger.warning(f'DingTalk new API error: {e}')

    # ── Method 2: Old API - get enterprise token, then get user info by code ──
    try:
        # Get enterprise access token
        ent_resp = await client.get(
            'https://oapi.dingtalk.com/gettoken',
            params={'appkey': app_key, 'appsecret': app_secret},
        )
        ent_data = ent_resp.json()
        ent_token = ent_data.get('access_token', '')
        logger.info(f'DingTalk enterprise token: errcode={ent_data.get("errcode")}, has_token={bool(ent_token)}')

        if ent_token:
            # Try old v1 API: GET /user/getuserinfo
            v1_resp = await client.get(
                'https://oapi.dingtalk.com/user/getuserinfo',
                params={'access_token': ent_token, 'code': auth_code},
            )
            v1_data = v1_resp.json()
            logger.info(f'DingTalk v1 getuserinfo: errcode={v1_data.get("errcode")}, data={v1_data}')

            if v1_data.get('errcode') == 0:
                userid = v1_data.get('userid', '')
                if userid:
                    # Get full user details
                    detail_resp = await client.post(
                        'https://oapi.dingtalk.com/topapi/v2/user/get',
                        params={'access_token': ent_token},
                        json={'userid': userid},
                    )
                    detail_data = detail_resp.json()
                    if detail_data.get('errcode') == 0:
                        result = detail_data.get('result', {})
                        logger.info(f'DingTalk user detail: name={result.get("name")}, mobile={result.get("mobile")}')
                        return {
                            'nick': result.get('name', ''),
                            'mobile': result.get('mobile', ''),
                            'unionId': result.get('unionid', ''),
                            'userid': userid,
                            '_source': 'old_api_v2',
                        }
                    else:
                        logger.warning(f'DingTalk user/get failed: {detail_data}')
                        # Still return basic info from v1
                        return {
                            'nick': v1_data.get('nick', '') or userid,
                            'userid': userid,
                            '_source': 'old_api_v1',
                        }

            # Try old v2 API: POST /topapi/v2/user/getuserinfo
            v2_resp = await client.post(
                'https://oapi.dingtalk.com/topapi/v2/user/getuserinfo',
                params={'access_token': ent_token},
                json={'code': auth_code},
            )
            v2_data = v2_resp.json()
            logger.info(f'DingTalk v2 getuserinfo: errcode={v2_data.get("errcode")}, data={v2_data}')

            if v2_data.get('errcode') == 0:
                result = v2_data.get('result', {})
                userid = result.get('userid', '')
                name = result.get('name', '')
                if userid:
                    return {
                        'nick': name or userid,
                        'userid': userid,
                        'unionId': result.get('associated_unionid', '') or result.get('unionid', ''),
                        '_source': 'old_api_v2_getuserinfo',
                    }
    except Exception as e:
        logger.warning(f'DingTalk old API error: {e}')

    # ── All methods failed ──
    return {}


@router.get('/dingtalk/callback')
async def dingtalk_callback(
    request: Request,
    authCode: str = Query(None),
    code: str = Query(None),
):
    """DingTalk OAuth2 callback. Redirected here with ?authCode=xxx&code=xxx."""
    auth_code = authCode or code
    if not auth_code:
        return _error_redirect('钉钉授权码缺失')

    login_method = mep_settings.get_system_login_method()
    dt_cfg = login_method.dingtalk or {}
    app_key = dt_cfg.get('app_key', '')
    app_secret = dt_cfg.get('app_secret', '')

    if not app_key or not app_secret:
        return _error_redirect('钉钉 AppKey/AppSecret 未配置')

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            user_data = await _dingtalk_get_user_info(client, app_key, app_secret, auth_code)

        if not user_data:
            logger.error('DingTalk callback: all methods failed to get user info')
            return _error_redirect(
                '钉钉登录失败：无法获取用户信息。'
                '请在钉钉开发者后台为应用开通 Contact.User.Read 权限'
            )

        nick = user_data.get('nick', '')
        mobile = user_data.get('mobile', '')
        userid = user_data.get('userid', '')
        union_id = user_data.get('unionId', '')

        user_name = nick or mobile or userid or union_id
        if not user_name:
            logger.error(f'DingTalk callback: empty username from data={user_data}')
            return _error_redirect('钉钉登录失败：用户信息为空')

        logger.info(f'DingTalk login OK: name={user_name}, source={user_data.get("_source", "new_api")}')

        user = await _find_or_create_user(user_name, user_type='dingtalk')
        access_token, cookie_conf = await _issue_token(user, request)
        return _success_html(access_token, cookie_conf)

    except Exception as e:
        logger.exception(f'DingTalk callback error: {e}')
        return _error_redirect(f'钉钉登录异常: {str(e)[:60]}')


# ──────────── WeCom ────────────

@router.get('/wecom/callback')
async def wecom_callback(request: Request, code: str = Query(None)):
    if not code:
        return _error_redirect('企业微信授权码缺失')

    login_method = mep_settings.get_system_login_method()
    wc_cfg = login_method.wecom or {}
    corp_id = wc_cfg.get('corp_id', '')
    secret = wc_cfg.get('secret', '')
    if not corp_id or not secret:
        return _error_redirect('企业微信配置缺失')

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_resp = await client.get(
                'https://qyapi.weixin.qq.com/cgi-bin/gettoken',
                params={'corpid': corp_id, 'corpsecret': secret},
            )
            access_token = token_resp.json().get('access_token')
            if not access_token:
                return _error_redirect('企业微信 token 获取失败')

            user_resp = await client.get(
                'https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo',
                params={'access_token': access_token, 'code': code},
            )
            user_data = user_resp.json()
            user_id = user_data.get('userid') or user_data.get('UserId', '')

        if not user_id:
            return _error_redirect('无法获取企业微信用户信息')

        user = await _find_or_create_user(user_id, user_type='wecom')
        token, cookie_conf = await _issue_token(user, request)
        return _success_html(token, cookie_conf)
    except Exception as e:
        logger.exception(f'WeCom callback error: {e}')
        return _error_redirect('企业微信登录失败')


# ──────────── Feishu ────────────

@router.get('/feishu/callback')
async def feishu_callback(request: Request, code: str = Query(None)):
    if not code:
        return _error_redirect('飞书授权码缺失')

    login_method = mep_settings.get_system_login_method()
    fs_cfg = login_method.feishu or {}
    app_id = fs_cfg.get('app_id', '')
    app_secret = fs_cfg.get('app_secret', '')
    if not app_id or not app_secret:
        return _error_redirect('飞书配置缺失')

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_resp = await client.post(
                'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
                json={'app_id': app_id, 'app_secret': app_secret},
            )
            app_token = token_resp.json().get('app_access_token')

            user_token_resp = await client.post(
                'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
                headers={'Authorization': f'Bearer {app_token}'},
                json={'grant_type': 'authorization_code', 'code': code},
            )
            user_access_token = user_token_resp.json().get('data', {}).get('access_token')

            user_resp = await client.get(
                'https://open.feishu.cn/open-apis/authen/v1/user_info',
                headers={'Authorization': f'Bearer {user_access_token}'},
            )
            info = user_resp.json().get('data', {})
            user_name = info.get('mobile', '') or info.get('name', '') or info.get('en_name', '')

        if not user_name:
            return _error_redirect('无法获取飞书用户信息')

        user = await _find_or_create_user(user_name, user_type='feishu')
        token, cookie_conf = await _issue_token(user, request)
        return _success_html(token, cookie_conf)
    except Exception as e:
        logger.exception(f'Feishu callback error: {e}')
        return _error_redirect('飞书登录失败')


# ──────────── Azure AD ────────────

@router.get('/aad/callback')
async def aad_callback(request: Request, code: str = Query(None)):
    if not code:
        return _error_redirect('Azure AD 授权码缺失')

    login_method = mep_settings.get_system_login_method()
    aad_cfg = login_method.aad or {}
    client_id = aad_cfg.get('client_id', '')
    client_secret = aad_cfg.get('client_secret', '')
    tenant_id = aad_cfg.get('tenant_id', '')
    callback_url = aad_cfg.get('callback_url', '')
    if not client_id or not client_secret or not tenant_id:
        return _error_redirect('Azure AD 配置缺失')

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_resp = await client.post(
                f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token',
                data={
                    'client_id': client_id, 'client_secret': client_secret,
                    'code': code, 'redirect_uri': callback_url,
                    'grant_type': 'authorization_code', 'scope': 'openid profile email',
                },
            )
            access_token = token_resp.json().get('access_token')
            if not access_token:
                return _error_redirect('Azure AD token 获取失败')

            user_resp = await client.get(
                'https://graph.microsoft.com/v1.0/me',
                headers={'Authorization': f'Bearer {access_token}'},
            )
            ud = user_resp.json()
            user_name = ud.get('mail') or ud.get('userPrincipalName') or ud.get('displayName', '')

        if not user_name:
            return _error_redirect('无法获取 Azure AD 用户信息')

        user = await _find_or_create_user(user_name, user_type='aad')
        token, cookie_conf = await _issue_token(user, request)
        return _success_html(token, cookie_conf)
    except Exception as e:
        logger.exception(f'AAD callback error: {e}')
        return _error_redirect('Azure AD 登录失败')
