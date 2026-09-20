"""Completion workflows with persisted state, authorization, and auditability."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.database import get_db
from app.core.errors import Conflict, Forbidden, Immutable, NotFound
from app.core.permissions import current_user, require_roles
from app.domain.models import Application, User
from app.domain.relational_models import SelectionRound, SelectionCandidate, Approval, Award, FinanceRecord
from app.domain.core_completion_models import (
    SelectionTieResolution, SelectionCorrection, ApprovalDelegation,
    FinanceInstallment, PaymentException,
)

router = APIRouter(tags=["Completion Workflows"])


def public(value):
    return {column.key: getattr(value, column.key) for column in value.__table__.columns}


def get(db, model, ident):
    row = db.get(model, ident)
    if not row:
        raise NotFound(f"{model.__name__} not found")
    return row


class TieIn(BaseModel):
    strategy: str
    candidate_ids: list[str] = Field(min_length=2)
    reason: str = Field(min_length=1)


class CorrectionIn(BaseModel):
    old_value: dict[str, Any]
    new_value: dict[str, Any]
    reason: str = Field(min_length=1)


class DelegationIn(BaseModel):
    to_user_id: str
    reason: str = Field(min_length=1)
    expires_at: datetime | None = None


class HoldIn(BaseModel):
    reason: str = Field(min_length=1)


class InstallmentIn(BaseModel):
    installment_no: int = Field(gt=0)
    expected_amount: float = Field(gt=0)
    due_at: datetime | None = None


class PaymentIn(BaseModel):
    actual_amount: float = Field(ge=0)
    payment_reference: str = Field(min_length=1)


class ExceptionIn(BaseModel):
    expected_amount: float
    actual_amount: float
    reason: str = Field(min_length=1)


@router.post("/selection-rounds/{id}/ties/resolve", status_code=201)
def resolve_tie(id: str, body: TieIn, db: Session = Depends(get_db), user=Depends(require_roles("SCHEME_MANAGER", "SELECTION_COMMITTEE_MEMBER")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    row = get(db, SelectionRound, id)
    if row.finalized_at:
        raise Immutable("Selection round is finalized")
    candidates = db.scalars(select(SelectionCandidate).where(SelectionCandidate.round_id == id, SelectionCandidate.id.in_(body.candidate_ids))).all()
    if len(candidates) != len(set(body.candidate_ids)):
        raise Conflict("Tie contains a candidate outside this selection round")
    if user.role == "SELECTION_COMMITTEE_MEMBER":
        from app.domain.relational_models import ApplicationAssignment
        for candidate in candidates:
            assigned = db.scalar(
                select(ApplicationAssignment.id).where(
                    ApplicationAssignment.application_id == candidate.application_id,
                    ApplicationAssignment.assignee_id == user.id,
                    ApplicationAssignment.assignment_type == "SELECTION_COMMITTEE",
                )
            )
            if not assigned:
                raise Forbidden("Tie contains a candidate outside the committee member's assignment scope")
    existing = db.scalar(select(SelectionTieResolution).where(SelectionTieResolution.round_id == id))
    if existing:
        raise Conflict("Selection round already has a tie resolution")
    resolution = SelectionTieResolution(round_id=id, candidate_ids=body.candidate_ids, strategy=body.strategy, resolved_by=user.id, reason=body.reason)
    db.add(resolution)
    audit(db, "SELECTION_TIE_RESOLVED", user.id, "SELECTION_ROUND", id, body.model_dump())
    db.commit()
    return {"success": True, "data": public(resolution)}


@router.post("/selection-candidates/{id}/corrections", status_code=201)
def request_correction(id: str, body: CorrectionIn, db: Session = Depends(get_db), user=Depends(require_roles("SELECTION_COMMITTEE_MEMBER", "SCHEME_MANAGER"))):
    candidate = get(db, SelectionCandidate, id)
    round_ = get(db, SelectionRound, candidate.round_id)
    if not round_.finalized_at:
        raise Conflict("Correction workflow applies only after finalization")
    if user.role == "SELECTION_COMMITTEE_MEMBER":
        from app.domain.relational_models import ApplicationAssignment
        assigned = db.scalar(
            select(ApplicationAssignment.id).where(
                ApplicationAssignment.application_id == candidate.application_id,
                ApplicationAssignment.assignee_id == user.id,
                ApplicationAssignment.assignment_type == "SELECTION_COMMITTEE",
            )
        )
        if not assigned:
            raise Forbidden("Candidate is outside the committee member's assignment scope")
    if body.old_value.get("total_score") is not None and Decimal(str(body.old_value["total_score"])) != Decimal(str(candidate.total_score or 0)):
        raise Conflict("Correction old value does not match the finalized candidate")
    row = SelectionCorrection(candidate_id=id, requested_by=user.id, old_value=body.old_value, new_value=body.new_value, reason=body.reason)
    db.add(row)
    audit(db, "SELECTION_CORRECTION_REQUESTED", user.id, "SELECTION_CANDIDATE", id, body.model_dump())
    db.commit()
    return {"success": True, "data": public(row)}


@router.post("/selection-corrections/{id}/approve")
def approve_correction(id: str, db: Session = Depends(get_db), user=Depends(require_roles("SCHEME_MANAGER"))):
    row = get(db, SelectionCorrection, id)
    if row.status != "REQUESTED":
        raise Conflict("Correction is not pending")
    candidate = get(db, SelectionCandidate, row.candidate_id)
    changed = {}
    if "total_score" in row.new_value:
        candidate.total_score = Decimal(str(row.new_value["total_score"]))
        changed["total_score"] = str(candidate.total_score)
    if "rank" in row.new_value:
        candidate.rank = int(row.new_value["rank"])
        changed["rank"] = candidate.rank
    if "data" in row.new_value:
        candidate.data = row.new_value["data"]
        changed["data"] = candidate.data
    row.status = "APPROVED"
    row.approved_by = user.id
    row.approved_at = datetime.now(timezone.utc)
    audit(db, "SELECTION_CORRECTION_APPROVED", user.id, "SELECTION_CORRECTION", id, {"before": row.old_value, "after": changed})
    db.commit()
    return {"success": True, "data": public(row)}


@router.post("/applications/{id}/approval-hold", status_code=201)
def approval_hold(id: str, body: HoldIn, db: Session = Depends(get_db), user=Depends(require_roles("APPROVING_AUTHORITY")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    application = get(db, Application, id)
    pending = db.scalar(select(Approval).where(Approval.application_id == id, Approval.decision.in_(["PENDING", "HOLD"])))
    if pending:
        if pending.decision == "HOLD" and pending.approver_id == user.id and pending.note == body.reason:
            return {"success": True, "data": public(pending)}
        raise Conflict("Application already has an active approval decision")
    row = Approval(application_id=id, approver_id=user.id, decision="HOLD", note=body.reason, packet_snapshot={})
    db.add(row)
    old_status = application.status
    application.status = "APPROVAL_HOLD"
    application.version += 1
    from app.domain.relational_models import ApplicationStatusHistory
    db.add(ApplicationStatusHistory(application_id=id, from_status=old_status, to_status=application.status, actor_id=user.id, reason=body.reason))
    audit(db, "APPROVAL_HOLD", user.id, "APPLICATION", id, {"reason": body.reason})
    db.commit()
    return {"success": True, "data": {**public(row), "application_status": application.status}}


@router.post("/applications/{id}/approval-delegation", status_code=201)
def delegate_approval(id: str, body: DelegationIn, db: Session = Depends(get_db), user=Depends(require_roles("APPROVING_AUTHORITY"))):
    get(db, Application, id)
    target = get(db, User, body.to_user_id)
    if not target.is_active or target.role not in {"APPROVING_AUTHORITY", "SUPER_ADMIN"}:
        raise Forbidden("Delegation target is not an active approving authority")
    if body.expires_at and body.expires_at <= datetime.now(timezone.utc):
        raise Conflict("Delegation expiry must be in the future")
    active = db.scalar(select(ApprovalDelegation).where(ApprovalDelegation.application_id == id, ApprovalDelegation.status == "ACTIVE"))
    if active:
        raise Conflict("Application already has an active delegation")
    row = ApprovalDelegation(from_user_id=user.id, to_user_id=target.id, application_id=id, reason=body.reason, expires_at=body.expires_at)
    db.add(row)
    audit(db, "APPROVAL_DELEGATED", user.id, "APPLICATION", id, {"to_user_id": target.id, "reason": body.reason})
    db.commit()
    return {"success": True, "data": public(row)}


@router.get("/applications/{id}/approval-delegation")
def get_delegation(id: str, db: Session = Depends(get_db), user=Depends(current_user)):
    get(db, Application, id)
    row = db.scalar(select(ApprovalDelegation).where(ApprovalDelegation.application_id == id, ApprovalDelegation.status == "ACTIVE"))
    return {"success": True, "data": public(row) if row else None}


@router.post("/awards/{id}/installments", status_code=201)
def create_installment(id: str, body: InstallmentIn, db: Session = Depends(get_db), user=Depends(require_roles("FINANCE_OFFICER", "APPROVING_AUTHORITY"))):
    get(db, Award, id)
    if db.scalar(select(FinanceInstallment).where(FinanceInstallment.award_id == id, FinanceInstallment.installment_no == body.installment_no)):
        raise Conflict("Installment number already exists for this award")
    row = FinanceInstallment(award_id=id, installment_no=body.installment_no, expected_amount=body.expected_amount, due_at=body.due_at)
    db.add(row)
    audit(db, "INSTALLMENT_CREATED", user.id, "AWARD", id, body.model_dump())
    db.commit()
    return {"success": True, "data": public(row)}


@router.get("/awards/{id}/installments")
def list_installments(id: str, db: Session = Depends(get_db), user=Depends(current_user)):
    get(db, Award, id)
    rows = db.scalars(select(FinanceInstallment).where(FinanceInstallment.award_id == id).order_by(FinanceInstallment.installment_no)).all()
    return {"success": True, "data": [public(x) for x in rows]}


@router.post("/finance/installments/{id}/pay")
def pay_installment(id: str, body: PaymentIn, db: Session = Depends(get_db), user=Depends(require_roles("FINANCE_OFFICER")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    installment = get(db, FinanceInstallment, id)
    if installment.status in {"PAID", "COMPLETED"}:
        raise Conflict("Installment has already been paid")
    from app.integrations.finance_providers import get_finance_provider
    if Decimal(str(body.actual_amount)) > Decimal(str(installment.expected_amount)):
        raise Conflict("Payment exceeds installment amount")
    provider_result = get_finance_provider().disburse(
        {
            "installment_id": id,
            "award_id": installment.award_id,
            "amount": body.actual_amount,
            "payment_reference": body.payment_reference,
        }
    )
    award = get(db, Award, installment.award_id)
    record = FinanceRecord(
        award_id=award.id, record_type="INSTALLMENT_PAYMENT", amount=body.actual_amount,
        external_reference=provider_result.provider_reference or body.payment_reference,
        provider=provider_result.provider,
    )
    db.add(record)
    db.flush()
    installment.paid_amount = body.actual_amount
    nominal = Decimal(str(installment.expected_amount))
    actual = Decimal(str(body.actual_amount))
    if actual == nominal:
        installment.status = "PAID"
    elif actual < nominal:
        installment.status = "PARTIALLY_PAID"
    installment.paid_at = datetime.now(timezone.utc)
    if actual != nominal:
        exception = PaymentException(
            finance_record_id=record.id,
            expected_amount=float(nominal),
            actual_amount=float(actual),
            difference=float(actual - nominal),
            reason="Disbursement does not match installment amount",
        )
        db.add(exception)
    audit(db, "INSTALLMENT_PAID", user.id, "FINANCE_INSTALLMENT", id, {"amount": body.actual_amount, "payment_reference": body.payment_reference, "provider": provider_result.provider, "status": provider_result.status})
    db.commit()
    result = {**public(installment), "provider": provider_result.provider, "disbursement_status": provider_result.status, "payment_exception_raised": actual != nominal}
    return {"success": True, "data": result}


@router.post("/finance/records/{id}/exceptions", status_code=201)
def create_payment_exception(id: str, body: ExceptionIn, db: Session = Depends(get_db), user=Depends(require_roles("FINANCE_OFFICER"))):
    get(db, FinanceRecord, id)
    existing = db.scalar(select(PaymentException).where(PaymentException.finance_record_id == id, PaymentException.status == "OPEN"))
    if existing:
        raise Conflict("Finance record already has an open payment exception")
    difference = body.actual_amount - body.expected_amount
    row = PaymentException(finance_record_id=id, expected_amount=body.expected_amount, actual_amount=body.actual_amount, difference=difference, reason=body.reason)
    db.add(row)
    audit(db, "PAYMENT_EXCEPTION_CREATED", user.id, "FINANCE_RECORD", id, body.model_dump())
    db.commit()
    return {"success": True, "data": public(row)}


@router.post("/payment-exceptions/{id}/resolve")
def resolve_payment_exception(id: str, db: Session = Depends(get_db), user=Depends(require_roles("FINANCE_OFFICER"))):
    row = get(db, PaymentException, id)
    if row.status == "RESOLVED":
        raise Conflict("Payment exception is already resolved")
    row.status = "RESOLVED"
    row.resolved_by = user.id
    row.resolved_at = datetime.now(timezone.utc)
    audit(db, "PAYMENT_EXCEPTION_RESOLVED", user.id, "PAYMENT_EXCEPTION", id)
    db.commit()
    return {"success": True, "data": public(row)}
