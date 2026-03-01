"""钉钉企业消息工具 - 通过企业内部应用向指定用户发送工作通知"""
import asyncio
from typing import Any

from pydantic import BaseModel, Field


class CorpMessageInputArgs(BaseModel):
    user_ids: str = Field(description="接收消息的钉钉userId，多个用逗号分隔")
    title: str = Field(description="消息标题")
    message: str = Field(description="消息正文内容")
    link: str = Field(default="", description="点击消息跳转的链接URL")


class DingtalkCorpMessageTool(BaseModel):

    def send_corp_message(self, user_ids: str, title: str, message: str, link: str = "") -> str:
        """
        发送钉钉企业消息（工作通知）

        通过钉钉企业内部应用，向指定用户发送一对一的工作通知消息。
        支持 action_card 类型，可包含跳转链接。

        Args:
            user_ids: 接收消息的钉钉userId，多个用逗号分隔
            title: 消息标题
            message: 消息正文内容
            link: 点击消息跳转的链接URL
        """
        from mep.core.dingtalk.dingtalk_message import async_send_dingtalk_message

        user_list = [uid.strip() for uid in user_ids.split(',') if uid.strip()]
        if not user_list:
            return "错误: 未指定接收用户"

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    result = pool.submit(
                        asyncio.run,
                        async_send_dingtalk_message(
                            user_list=user_list,
                            link=link or "https://ai.noooyi.com/workspace/task-center",
                            title=title,
                            message_content=message,
                            message_type="task",
                        ),
                    ).result()
            else:
                result = loop.run_until_complete(
                    async_send_dingtalk_message(
                        user_list=user_list,
                        link=link or "https://ai.noooyi.com/workspace/task-center",
                        title=title,
                        message_content=message,
                        message_type="task",
                    )
                )
            return str(result)
        except Exception as e:
            return f"发送企业消息失败: {str(e)}"

    @classmethod
    def get_api_tool(cls, name: str, **kwargs: Any):
        from mep_langchain.gpts.tools.api_tools.base import MultArgsSchemaTool

        c = DingtalkCorpMessageTool(**kwargs)
        return MultArgsSchemaTool(
            name=name,
            description=c.send_corp_message.__doc__,
            func=c.send_corp_message,
            args_schema=CorpMessageInputArgs,
        )
