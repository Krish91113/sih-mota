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
