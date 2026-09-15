"""Provider-neutral email/SMS delivery with mock and Gmail SMTP implementations."""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from email.message import EmailMessage
from string import Template
from typing import Any
import aiosmtplib
from app.core.config import get_settings

@dataclass
class DeliveryResult:
    provider: str
    accepted: bool
    status: str
    provider_reference: str | None = None
    failure_reason: str | None = None
    delivered_at: str | None = None

class NotificationProvider(ABC):
    @abstractmethod
    async def send(self, recipient: str, subject: str | None, text_body: str, html_body: str | None = None) -> DeliveryResult: ...

class MockEmailProvider(NotificationProvider):
    async def send(self, recipient, subject, text_body, html_body=None):
        return DeliveryResult("mock-email",True,"SENT",delivered_at=datetime.now(timezone.utc).isoformat())

class MockSMSProvider(NotificationProvider):
    async def send(self, recipient, subject, text_body, html_body=None):
        return DeliveryResult("mock-sms",True,"SENT",delivered_at=datetime.now(timezone.utc).isoformat())

class SMTPEmailProvider(NotificationProvider):
    def __init__(self, host: str, port: int, username: str, password: str, from_email: str, from_name: str, timeout: float = 20.0):
        self.host=host; self.port=port; self.username=username; self.password=password; self.from_email=from_email or username; self.from_name=from_name; self.timeout=timeout
    async def send(self, recipient, subject, text_body, html_body=None):
        message=EmailMessage(); message["From"] = self.from_email if "<" in self.from_email else f"{self.from_name} <{self.from_email}>"; message["To"]=recipient; message["Subject"]=subject or "MoTA Scholarship System Notification"; message.set_content(text_body or "")
        if html_body: message.add_alternative(html_body,subtype="html")
        try:
            response=await aiosmtplib.send(message,hostname=self.host,port=self.port,username=self.username,password=self.password,use_tls=self.port == 465,start_tls=self.port != 465,timeout=self.timeout)
            return DeliveryResult("smtp",True,"SENT",provider_reference=str(response[0]) if isinstance(response,tuple) else None,delivered_at=datetime.now(timezone.utc).isoformat())
        except (aiosmtplib.SMTPException, TimeoutError, OSError) as exc:
            return DeliveryResult("smtp",False,"FAILED",failure_reason=type(exc).__name__)

def get_email_provider() -> NotificationProvider:
    s=get_settings()
    if s.email_provider.lower() in {"smtp","gmail","real"}:
        if not s.smtp_username or not s.smtp_password or not s.smtp_from_email:
            return MockEmailProvider()
        return SMTPEmailProvider(s.smtp_host,s.smtp_port,s.smtp_username,s.smtp_password,s.smtp_from_email,s.smtp_from_name,s.smtp_timeout_seconds)
    return MockEmailProvider()
def get_sms_provider() -> NotificationProvider: return MockSMSProvider()
def render_template(template: str, values: dict[str,Any]) -> str:
    return Template(template).safe_substitute({str(k):v for k,v in values.items()})
