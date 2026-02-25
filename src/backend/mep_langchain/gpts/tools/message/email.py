import os
import smtplib
import tempfile
import urllib.request
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional, List

from pydantic import BaseModel, Field

from mep_langchain.gpts.tools.api_tools.base import (APIToolBase,
                                                         MultArgsSchemaTool)


class InputArgs(BaseModel):
    receiver: str = Field(description="收件人，多个用逗号分隔")
    subject: str = Field(description="邮件主题")
    content: str = Field(description="邮件正文内容，支持HTML格式")
    attachments: Optional[str] = Field(
        default=None,
        description="附件路径列表，多个用逗号分隔。支持本地文件路径或HTTP(S) URL"
    )


class EmailMessageTool(BaseModel):

    email_account: str = Field(description="发件人邮箱")
    email_password: str = Field(description="邮箱授权码/密码")
    smtp_server: str = Field(description="SMTP服务器地址")
    encrypt_method: str = Field(description="encrypt_method")
    smtp_port: int = Field(default=465, description=" 端口号（SSL一般465，TLS用587）")

    @staticmethod
    def _resolve_attachment(file_path: str) -> tuple:
        """Resolve a file path or URL to (filename, bytes)."""
        file_path = file_path.strip()
        if file_path.startswith(("http://", "https://")):
            filename = os.path.basename(file_path.split("?")[0]) or "attachment"
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                urllib.request.urlretrieve(file_path, tmp.name)
                with open(tmp.name, "rb") as f:
                    data = f.read()
                os.unlink(tmp.name)
            return filename, data
        else:
            if not os.path.isfile(file_path):
                raise FileNotFoundError(f"附件文件不存在: {file_path}")
            with open(file_path, "rb") as f:
                data = f.read()
            return os.path.basename(file_path), data

    @staticmethod
    def _parse_receivers(receiver: str) -> list:
        """Parse receiver string, handling both ASCII and full-width commas/semicolons."""
        import re
        normalized = re.sub(r'[，；;]', ',', receiver)
        return [addr.strip() for addr in normalized.split(',') if addr.strip()]

    def send_email(
        self,
        receiver: str = None,
        subject: str = None,
        content: str = None,
        attachments: str = None,
    ):
        """
        发送电子邮件，支持HTML正文和附件。附件可以是本地文件路径或URL，多个用逗号分隔。
        """
        try:
            receiver_list = self._parse_receivers(receiver or "")
            if not receiver_list:
                raise ValueError("收件人列表为空")

            content_type = "html" if "<" in (content or "") and ">" in (content or "") else "plain"

            msg = MIMEMultipart()
            msg["From"] = self.email_account
            msg["To"] = ", ".join(receiver_list)
            msg["Subject"] = subject

            body = MIMEText(content or "", content_type, "utf-8")
            msg.attach(body)

            if attachments:
                for file_ref in attachments.split(","):
                    file_ref = file_ref.strip()
                    if not file_ref:
                        continue
                    try:
                        filename, file_data = self._resolve_attachment(file_ref)
                        part = MIMEApplication(file_data)
                        part.add_header(
                            "Content-Disposition", "attachment", filename=filename
                        )
                        msg.attach(part)
                    except Exception as e:
                        body_warning = MIMEText(f"\n[附件加载失败: {file_ref} - {e}]", "plain", "utf-8")
                        msg.attach(body_warning)

            if self.smtp_port == 465:
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port)
            else:
                server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                server.starttls()

            server.login(self.email_account, self.email_password)
            server.sendmail(self.email_account, receiver_list, msg.as_string())
            server.quit()
        except Exception as e:
            raise Exception(f"邮件发送失败：{e}")

        attachment_info = ""
        if attachments:
            count = len([a for a in attachments.split(",") if a.strip()])
            attachment_info = f"，包含{count}个附件"
        return f"发送成功{attachment_info}"

    @classmethod
    def get_api_tool(cls, name: str, **kwargs: Any) -> "EmailMessageTool":
        attr_name = name.split("_", 1)[-1]
        c = EmailMessageTool(**kwargs)
        class_method = getattr(c, attr_name)

        return MultArgsSchemaTool(
            name=name,
            description=class_method.__doc__,
            func=class_method,
            args_schema=InputArgs,
        )
