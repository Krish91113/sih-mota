from abc import ABC, abstractmethod
from dataclasses import dataclass

class IdentityAdapter(ABC):
    @abstractmethod
    def verify(self, subject: str, proof: dict) -> dict: ...
class DigiLockerAdapter(ABC):
    @abstractmethod
    def fetch_document(self, reference: str) -> dict: ...
class FinanceAdapter(ABC):
    @abstractmethod
    def sanction(self, payload: dict) -> dict: ...
    @abstractmethod
    def disburse(self, payload: dict) -> dict: ...
class UniversityAdapter(ABC):
    @abstractmethod
    def verify(self, payload: dict) -> dict: ...
class MessageAdapter(ABC):
    @abstractmethod
    def send(self, recipient: str, message: str) -> dict: ...
class MockIdentityClient(IdentityAdapter):
    def verify(self, subject, proof): return {"verified": True, "provider": "mock"}
class MockDigiLockerClient(DigiLockerAdapter):
    def fetch_document(self, reference): return {"reference": reference, "available": False, "provider": "mock"}
class MockFinanceClient(FinanceAdapter):
    def sanction(self, payload): return {"status": "QUEUED", "provider": "mock"}
    def disburse(self, payload): return {"status": "QUEUED", "provider": "mock"}
class MockUniversityClient(UniversityAdapter):
    def verify(self, payload): return {"result": "UNABLE_TO_VERIFY", "provider": "mock"}
class MockEmailClient(MessageAdapter):
    def send(self, recipient, message): return {"status": "SENT", "provider": "mock"}
class MockSMSClient(MessageAdapter):
    def send(self, recipient, message): return {"status": "SENT", "provider": "mock"}


def log_integration_call(
    db,
    provider: str,
    operation: str,
    status: str,
    request_metadata: dict | None = None,
    response_metadata: dict | None = None,
    error: str | None = None,
    external_reference: str | None = None,
    request_id: str | None = None,
    retry_count: int = 0,
):
    from datetime import datetime, timezone
    import uuid
    from app.domain.relational_models import IntegrationLog
    log = IntegrationLog(
        provider=provider,
        operation=operation,
        status=status,
        external_reference=external_reference,
        request_metadata=request_metadata or {},
        response_metadata=response_metadata or {},
        request_id=request_id or str(uuid.uuid4()),
        error=error,
        retry_count=retry_count,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(log)
    return log


def execute_with_retry(fn, max_retries: int = 3):
    attempts = 0
    last_err = None
    while attempts < max_retries:
        try:
            res = fn()
            return res, attempts, None
        except Exception as e:
            last_err = e
            attempts += 1
    return None, attempts, last_err

