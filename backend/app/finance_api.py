"""Finance exception and reconciliation contracts."""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.database import get_db
from app.core.errors import Conflict, NotFound
from app.core.permissions import require_roles
from app.domain.core_completion_models import PaymentException
from app.domain.relational_models import Award, FinanceRecord
from app.idempotency import complete, get_or_create

router = APIRouter(prefix="/finance", tags=["Finance"])
FINANCE_READ_ROLES = ("FINANCE_OFFICER", "AUDITOR")
FINANCE_WRITE_ROLES = ("FINANCE_OFFICER",)


def public(row: Any) -> dict[str, Any]:
    return jsonable_encoder({column.key: getattr(row, column.key) for column in row.__table__.columns})


def get_or_404(db: Session, model: Any, ident: str):
    row = db.get(model, ident)
    if not row:
        raise NotFound(f"{model.__name__} not found")
    return row


def mutation(db: Session, key: str | None, user_id: str, route: str, payload: dict[str, Any]):
    if not key:
        return None
    record = get_or_create(db, key, user_id, route, payload)
    if record.response is not None:
        return record.response
    return record


def finish(db: Session, record, result: dict[str, Any], status_code: int = 200):
    if record is not None:
        complete(record, status_code, result)
    db.commit()
    return result


class ExceptionIn(BaseModel):
    finance_record_id: str
    expected_amount: float
    actual_amount: float
    reason: str = Field(min_length=1)


class ReconciliationIn(BaseModel):
    award_id: str
    amount: float = Field(ge=0)
    external_reference: str | None = None
    provider: str = "mock"
    data: dict[str, Any] = Field(default_factory=dict)


@router.get("/exceptions")
def list_exceptions(
    db: Session = Depends(get_db),
    user=Depends(require_roles(*FINANCE_READ_ROLES)),
):
    rows = db.scalars(select(PaymentException).order_by(PaymentException.id)).all()
    return {"success": True, "data": [public(row) for row in rows]}


@router.post("/exceptions", status_code=201)
def create_exception(
    body: ExceptionIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*FINANCE_WRITE_ROLES)),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    finance_record = get_or_404(db, FinanceRecord, body.finance_record_id)
    record = mutation(db, idempotency_key, user.id, "finance:exceptions", body.model_dump())
    if isinstance(record, dict):
        return record
    if record is not None and record.response is not None:
        return record.response
    row = PaymentException(
        finance_record_id=finance_record.id,
        expected_amount=body.expected_amount,
        actual_amount=body.actual_amount,
        difference=body.actual_amount - body.expected_amount,
        reason=body.reason,
    )
    db.add(row)
    db.flush()
    audit(db, "PAYMENT_EXCEPTION_CREATED", user.id, "FINANCE_RECORD", finance_record.id, body.model_dump())
    result = {"success": True, "data": public(row)}
    return finish(db, record, result, 201)


@router.get("/exceptions/{exception_id}")
def get_exception(
    exception_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*FINANCE_READ_ROLES)),
):
    return {"success": True, "data": public(get_or_404(db, PaymentException, exception_id))}


def change_exception_status(
    exception_id: str,
    status: str,
    action: str,
    db: Session,
    user,
    idempotency_key: str | None,
):
    row = get_or_404(db, PaymentException, exception_id)
    if status == "RESOLVED" and row.status == "RESOLVED":
        raise Conflict("Payment exception is already resolved")
    if status == "OPEN" and row.status == "OPEN":
        raise Conflict("Payment exception is already open")
    record = mutation(db, idempotency_key, user.id, f"finance:exceptions:{exception_id}:{action}", {})
    if isinstance(record, dict):
        return record
    if record is not None and record.response is not None:
        return record.response
    row.status = status
    if status == "RESOLVED":
        row.resolved_by = user.id
        row.resolved_at = datetime.now(timezone.utc)
    else:
        row.resolved_by = None
        row.resolved_at = None
    audit(db, f"PAYMENT_EXCEPTION_{action.upper()}", user.id, "PAYMENT_EXCEPTION", exception_id)
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.post("/exceptions/{exception_id}/resolve")
def resolve_exception(
    exception_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*FINANCE_WRITE_ROLES)),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    return change_exception_status(exception_id, "RESOLVED", "resolve", db, user, idempotency_key)


@router.post("/exceptions/{exception_id}/reopen")
def reopen_exception(
    exception_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*FINANCE_WRITE_ROLES)),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    return change_exception_status(exception_id, "OPEN", "reopen", db, user, idempotency_key)


@router.get("/reconciliation")
def list_reconciliation(
    db: Session = Depends(get_db),
    user=Depends(require_roles(*FINANCE_READ_ROLES)),
):
    rows = db.scalars(
        select(FinanceRecord)
        .where(FinanceRecord.record_type == "RECONCILIATION")
        .order_by(FinanceRecord.id)
    ).all()
    return {"success": True, "data": [public(row) for row in rows]}


@router.post("/reconciliation", status_code=201)
def create_reconciliation(
    body: ReconciliationIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*FINANCE_WRITE_ROLES)),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    award = get_or_404(db, Award, body.award_id)
    record = mutation(db, idempotency_key, user.id, "finance:reconciliation", body.model_dump())
    if isinstance(record, dict):
        return record
    if record is not None and record.response is not None:
        return record.response
    row = FinanceRecord(
        award_id=award.id,
        record_type="RECONCILIATION",
        amount=body.amount,
        external_reference=body.external_reference,
        provider=body.provider,
        data=body.data,
        status="RECORDED",
    )
    db.add(row)
    db.flush()
    audit(db, "FINANCE_RECONCILIATION_CREATED", user.id, "AWARD", award.id, body.model_dump())
    result = {"success": True, "data": public(row)}
    return finish(db, record, result, 201)


@router.get("/reconciliation/{reconciliation_id}")
def get_reconciliation(
    reconciliation_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*FINANCE_READ_ROLES)),
):
    row = get_or_404(db, FinanceRecord, reconciliation_id)
    if row.record_type != "RECONCILIATION":
        raise NotFound("Reconciliation not found")
    return {"success": True, "data": public(row)}
