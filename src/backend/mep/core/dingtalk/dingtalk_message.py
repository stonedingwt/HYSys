"""
钉钉企业消息发送模块

通过钉钉企业内部应用向指定用户发送工作通知（一对一消息）。
参考文档: https://open.dingtalk.com/document/development/asynchronous-sending-of-enterprise-session-messages
"""
import traceback
from datetime import datetime
from typing import Optional, List

import httpx
from loguru import logger

from mep.common.services.config_service import settings as mep_settings


def _get_dingtalk_config() -> dict:
    """从系统配置中读取钉钉应用凭据。"""
    login_cfg = mep_settings.get_system_login_method()
    dt_cfg = login_cfg.dingtalk or {}
    return {
        'app_key': dt_cfg.get('app_key', ''),
        'app_secret': dt_cfg.get('app_secret', ''),
        'agent_id': dt_cfg.get('agent_id', ''),
    }


def task_message(title: str, message_content: str) -> str:
    return (
        f"**{title}**"
        f"<br/>"
        f"{message_content}"
        f"<br/>"
        f"📅 时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}<br/>"
        f"🔔 请及时处理！"
    )


def tp_message(title: str, message_content: str) -> str:
    return (
        f"**{title}**"
        f"<br/>"
        f"{message_content}"
        f"<br/>"
        f"📅 时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}<br/>"
    )


MESSAGE_TEMPLATES = {
    "task": task_message,
    "tp": tp_message,
}


async def async_send_dingtalk_message(
    user_list: List[str],
    link: str,
    title: Optional[str] = None,
    message_content: Optional[str] = None,
    message_type: Optional[str] = "task",
) -> Optional[dict]:
    """
    发送钉钉企业消息（工作通知）到指定用户。

    Args:
        user_list: 钉钉 userId 列表
        link: 点击消息跳转的链接
        title: 消息标题
        message_content: 消息正文
        message_type: 消息模板类型 ("task" / "tp")

    Returns:
        钉钉 API 响应 dict，如 {'errcode': 0, 'errmsg': 'ok', 'task_id': ...}
    """
    cfg = _get_dingtalk_config()
    app_key = cfg['app_key']
    app_secret = cfg['app_secret']
    agent_id = cfg['agent_id']

    if not app_key or not app_secret or not agent_id:
        logger.warning('DingTalk corp message config incomplete, skipping')
        return None

    template_fn = MESSAGE_TEMPLATES.get(message_type)
    if not template_fn:
        logger.error('Invalid DingTalk message_type: %s', message_type)
        return {'errmsg': 'error', 'message': f'无效的消息类型: {message_type}'}

    title = title or '系统通知'
    message_content = message_content or '您有一条新的通知'
    markdown_content = template_fn(title, message_content)

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            token_resp = await client.get(
                'https://oapi.dingtalk.com/gettoken',
                params={'appkey': app_key, 'appsecret': app_secret},
            )
            token_data = token_resp.json()
            if token_data.get('errcode') != 0:
                logger.error('DingTalk gettoken failed: %s', token_data)
                return token_data

            access_token = token_data['access_token']

            if message_type == 'task':
                msg_payload = {
                    'msgtype': 'action_card',
                    'action_card': {
                        'title': title,
                        'markdown': markdown_content,
                        'single_title': '查看详情',
                        'single_url': link,
                    },
                }
            else:
                msg_payload = {
                    'msgtype': 'text',
                    'text': {'content': message_content},
                }

            send_data = {
                'agent_id': agent_id,
                'userid_list': ','.join(user_list),
                'msg': msg_payload,
            }

            send_resp = await client.post(
                f'https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token={access_token}',
                json=send_data,
            )
            result = send_resp.json()
            if result.get('errcode') == 0:
                logger.info('DingTalk corp message sent OK: task_id=%s', result.get('task_id'))
            else:
                logger.warning('DingTalk corp message failed: %s', result)
            return result

        except Exception:
            logger.exception('DingTalk corp message exception')
            return {'errmsg': 'error', 'message': traceback.format_exc()[:500]}
