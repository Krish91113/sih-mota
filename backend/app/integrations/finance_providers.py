"""Provider-neutral finance disbursement boundary with mock implementation."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings


@dataclass
class DisbursementResult:
    provider: str
    accepted: bool
    status: str
    provider_reference: str | None = None
    failure_reason: str | None = None
    reconciled_amount: float | None = None
    at: str | None = None


class FinanceProvider(ABC):
    @abstractmethod
    def disburse(self, payload: dict[str, Any]) -> DisbursementResult: ...


class MockFinanceProvider(FinanceProvider):
    def disburse(self, payload: dict[str, Any]) -> DisbursementResult:
        reference = payload.get("payment_reference") or payload.get("external_reference")
        return DisbursementResult(
            "mock-finance",
            True,
            "DISBURSED",
            provider_reference=reference,
            reconciled_amount=payload.get("amount"),
            at=datetime.now(timezone.utc).isoformat(),
        )


def get_finance_provider() -> FinanceProvider:
    settings = get_settings()
    configured = settings.finance_provider if hasattr(settings, "finance_provider") else "mock"
    if configured.lower() in {"mock", "local", "test"}:
        return MockFinanceProvider()
    return MockFinanceProvider()