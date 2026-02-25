from typing import Optional, List

from mep.api.v1.schema.chat_schema import ChatMessageHistoryResponse
from mep.common.errcode.http_error import NotFoundError
from mep.database.models.message import ChatMessageDao
from mep.database.models.session import MessageSessionDao
from mep.user.domain.models.user import UserDao


class ChatSessionService:
    """Chat related services."""

    @staticmethod
    async def get_chat_history(chat_id: str, flow_id: str, message_id: Optional[str] = None,
                               page_size: Optional[int] = 20) -> List[ChatMessageHistoryResponse]:
        """Retrieve chat history for a user."""
        if not chat_id or not flow_id:
            raise NotFoundError()
        session_info = await MessageSessionDao.async_get_one(chat_id=chat_id)
        if not session_info or session_info.flow_id != flow_id:
            raise NotFoundError()

        history = await ChatMessageDao.afilter_message_by_chat_id(chat_id=chat_id, flow_id=flow_id,
                                                                  message_id=message_id, page_size=page_size)
        if history:
            user_info = await UserDao.aget_user(user_id=session_info.user_id)
            history = ChatMessageHistoryResponse.from_chat_message_objs(history, user_info, session_info)
        # Placeholder implementation
        return history
