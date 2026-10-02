"""Completion workflows with persisted state, authorization, and auditability."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy import select, func as sa_func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.database import get_db
from app.core.errors import Conflict, Forbidden, Immutable, NotFound
from app.core.permissions import current_user, require_roles
from app.core.timeutils import is_past
from app.domain.models import Application, User
from app.domain.relational_models import SelectionRound, SelectionCandidate, Approval, Award, FinanceRecord
from app.domain.core_completion_models import (
    SelectionTieResolution, SelectionCorrection, ApprovalDelegation,
    FinanceInstallment, PaymentException, PaymentAttempt, PaymentStatusHistory,
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
    actual_amount: float | None = Field(default=None, ge=0)
    payment_reference: str | None = None
    provider: str | None = None


class FailureIn(BaseModel):
    failure_reason: str = Field(min_length=1)
    amount: float | None = Field(default=None, ge=0)
    provider: str | None = None


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
    if body.expires_at and is_past(body.expires_at):
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


class RetryIn(BaseModel):
    reason: str | None = "Retry failed or returned payment"


class ReturnIn(BaseModel):
    reason: str | None = None
    return_reason: str | None = None
    def resolved_reason(self) -> str:
        return self.reason or self.return_reason or "Returned by finance"


class ReconcileIn(BaseModel):
    reconciled_amount: float | None = None
    note: str | None = None


@router.post("/finance/installments/{id}/validate")
def validate_installment(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles("FINANCE_OFFICER")),
):
    installment = get(db, FinanceInstallment, id)
    if installment.status in {"PAID", "COMPLETED", "RECONCILED"}:
        raise Conflict(f"Cannot validate installment in status '{installment.status}'")
    award = get(db, Award, installment.award_id) if installment.award_id else None
    if not award:
        raise Conflict("Prerequisite not satisfied: Installment has no associated award")
    from app.domain.models import Application, Applicant
    from app.domain.relational_models import ApplicantBankDetail
    app = db.get(Application, award.application_id) if award.application_id else None
    applicant = db.get(Applicant, app.applicant_id) if app and app.applicant_id else None
    has_bank = False
    if app and app.answers and (app.answers.get("bank_account_number") or app.answers.get("account_number")):
        has_bank = True
    elif applicant and applicant.profile and (applicant.profile.get("bank_account_number") or applicant.profile.get("account_number")):
        has_bank = True
    elif applicant and db.scalar(select(ApplicantBankDetail.id).where(ApplicantBankDetail.applicant_id == applicant.id)):
        has_bank = True
    if not has_bank:
        raise Conflict("Prerequisite not satisfied: Bank details are missing or unvalidated for this application")

    old_status = installment.status
    installment.status = "VALIDATED"
    db.add(
        PaymentStatusHistory(
            installment_id=id,
            from_status=old_status,
            to_status="VALIDATED",
            actor_id=user.id,
            reason="Installment validated against award and bank details",
        )
    )
    audit(db, "INSTALLMENT_VALIDATED", user.id, "FINANCE_INSTALLMENT", id)
    db.commit()
    return {"success": True, "data": public(installment)}


@router.post("/finance/installments/{id}/queue")
def queue_installment(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles("FINANCE_OFFICER")),
):
    installment = get(db, FinanceInstallment, id)
    if installment.status in {"PAID", "COMPLETED", "RECONCILED"}:
        raise Conflict(f"Cannot queue installment in status '{installment.status}'")
    old_status = installment.status
    installment.status = "QUEUED"
    db.add(
        PaymentStatusHistory(
            installment_id=id,
            from_status=old_status,
            to_status="QUEUED",
            actor_id=user.id,
            reason="Installment queued for batch payment processing",
        )
    )
    audit(db, "INSTALLMENT_QUEUED", user.id, "FINANCE_INSTALLMENT", id)
    db.commit()
    return {"success": True, "data": public(installment)}


@router.post("/finance/installments/{id}/submit")
def submit_installment(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles("FINANCE_OFFICER")),
):
    installment = get(db, FinanceInstallment, id)
    if installment.status in {"PAID", "COMPLETED", "RECONCILED"}:
        raise Conflict(f"Cannot submit installment in status '{installment.status}'")
    old_status = installment.status
    installment.status = "SUBMITTED"
    db.add(
        PaymentStatusHistory(
            installment_id=id,
            from_status=old_status,
            to_status="SUBMITTED",
            actor_id=user.id,
            reason="Installment submitted to payment provider",
        )
    )
    audit(db, "INSTALLMENT_SUBMITTED", user.id, "FINANCE_INSTALLMENT", id)
    db.commit()
    return {"success": True, "data": public(installment)}


@router.post("/finance/installments/{id}/pay")
def pay_installment(
    id: str,
    body: PaymentIn | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles("FINANCE_OFFICER")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    body = body or PaymentIn()
    installment = get(db, FinanceInstallment, id)
    if installment.status in {"PAID", "COMPLETED", "RECONCILED"}:
        raise Conflict("Installment has already been paid or reconciled")
    from app.integrations.finance_providers import get_finance_provider
    actual_amount = body.actual_amount if body.actual_amount is not None else float(installment.expected_amount)
    if Decimal(str(actual_amount)) > Decimal(str(installment.expected_amount)):
        raise Conflict("Payment exceeds installment amount")
    payment_reference = body.payment_reference or f"PAY-{id[:8]}-{int(datetime.now(timezone.utc).timestamp())}"

    prior_attempts = db.scalar(
        select(sa_func.count(PaymentAttempt.id)).where(PaymentAttempt.installment_id == id)
    ) or 0
    attempt_no = int(prior_attempts) + 1

    provider_result = get_finance_provider().disburse(
        {
            "installment_id": id,
            "award_id": installment.award_id,
            "amount": actual_amount,
            "payment_reference": payment_reference,
            "attempt_no": attempt_no,
        }
    )
    award = get(db, Award, installment.award_id) if installment.award_id else None

    old_status = installment.status
    if not provider_result.accepted:
        installment.status = "FAILED"
        attempt = PaymentAttempt(
            installment_id=id,
            attempt_no=attempt_no,
            provider=provider_result.provider,
            amount=actual_amount,
            status="FAILED",
            provider_reference=payment_reference,
            failure_reason=provider_result.failure_reason or "Provider rejected disbursement",
        )
        db.add(attempt)
        db.add(
            PaymentStatusHistory(
                installment_id=id,
                from_status=old_status,
                to_status="FAILED",
                actor_id=user.id,
                reason=provider_result.failure_reason or "Disbursement failed",
            )
        )
        audit(db, "INSTALLMENT_PAYMENT_FAILED", user.id, "FINANCE_INSTALLMENT", id, {"attempt_no": attempt_no})
        db.commit()
        return {"success": False, "data": {**public(installment), "attempt": public(attempt)}}

    record = None
    if award is not None:
        record = FinanceRecord(
            award_id=award.id,
            record_type="INSTALLMENT_PAYMENT",
            amount=actual_amount,
            external_reference=provider_result.provider_reference or payment_reference,
            provider=provider_result.provider,
        )
        db.add(record)
        db.flush()

    installment.paid_amount = actual_amount
    installment.provider = provider_result.provider
    installment.last_attempt_at = datetime.now(timezone.utc)
    nominal = Decimal(str(installment.expected_amount))
    actual = Decimal(str(actual_amount))
    new_status = "PAID" if actual == nominal else "PARTIALLY_PAID"
    installment.status = new_status
    installment.paid_at = datetime.now(timezone.utc)

    attempt = PaymentAttempt(
        installment_id=id,
        finance_record_id=record.id if record is not None else None,
        attempt_no=attempt_no,
        provider=provider_result.provider,
        amount=actual_amount,
        status="SUCCESS",
        provider_reference=provider_result.provider_reference or payment_reference,
    )
    db.add(attempt)
    db.add(
        PaymentStatusHistory(
            installment_id=id,
            from_status=old_status,
            to_status=new_status,
            actor_id=user.id,
            reason="Disbursement processed successfully",
        )
    )

    if actual != nominal and record is not None:
        exception = PaymentException(
            finance_record_id=record.id,
            expected_amount=float(nominal),
            actual_amount=float(actual),
            difference=float(actual - nominal),
            reason="Disbursement does not match installment amount",
        )
        db.add(exception)

    from app.integrations.adapters import log_integration_call
    log_integration_call(
        db=db,
        provider=provider_result.provider,
        operation="disburse_installment",
        status="SUCCEEDED" if provider_result.accepted else "FAILED",
        external_reference=provider_result.provider_reference or payment_reference,
        request_metadata={"installment_id": id, "award_id": installment.award_id, "amount": actual_amount, "attempt_no": attempt_no},
        response_metadata={"status": provider_result.status, "accepted": provider_result.accepted, "failure_reason": provider_result.failure_reason},
        error=provider_result.failure_reason if not provider_result.accepted else None,
        retry_count=installment.retry_count or 0,
    )

    audit(
        db,
        "INSTALLMENT_PAID",
        user.id,
        "FINANCE_INSTALLMENT",
        id,
        {
            "amount": actual_amount,
            "payment_reference": payment_reference,
            "provider": provider_result.provider,
            "status": provider_result.status,
            "attempt_no": attempt_no,
        },
    )
    db.commit()
    result = {
        **public(installment),
        "provider": provider_result.provider,
        "disbursement_status": provider_result.status,
        "payment_exception_raised": actual != nominal,
        "attempt_no": attempt_no,
    }
    return {"success": True, "data": result}


@router.post("/finance/installments/{id}/fail")
def fail_installment(
    id: str,
    body: FailureIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles("FINANCE_OFFICER")),
):
    """Record a failed disbursement attempt reported by the provider/bank."""
    installment = get(db, FinanceInstallment, id)
    if installment.status in {"RECONCILED", "COMPLETED"}:
        raise Conflict("Installment has already been reconciled")
    if body.provider:
        installment.provider = body.provider
    old_status = installment.status
    installment.status = "FAILED"
    installment.last_attempt_at = datetime.now(timezone.utc)

    prior_attempts = db.scalar(
        select(sa_func.count(PaymentAttempt.id)).where(PaymentAttempt.installment_id == id)
    ) or 0
    attempt = PaymentAttempt(
        installment_id=id,
        attempt_no=int(prior_attempts) + 1,
        provider=body.provider or installment.provider or "mock",
        amount=body.amount if body.amount is not None else float(installment.expected_amount),
        status="FAILED",
        failure_reason=body.failure_reason,
    )
    db.add(attempt)
    db.add(
        PaymentStatusHistory(
            installment_id=id,
            from_status=old_status,
            to_status="FAILED",
            actor_id=user.id,
            reason=body.failure_reason,
        )
    )
    audit(
        db,
        "INSTALLMENT_PAYMENT_FAILED",
        user.id,
        "FINANCE_INSTALLMENT",
        id,
        {"failure_reason": body.failure_reason, "attempt_no": attempt.attempt_no},
    )
    db.commit()
    return {"success": True, "data": {**public(installment), "attempt": public(attempt)}}


@router.post("/finance/installments/{id}/retry")
def retry_installment(
    id: str,
    body: RetryIn | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles("FINANCE_OFFICER")),
):
    installment = get(db, FinanceInstallment, id)
    if installment.status not in {"FAILED", "RETURNED", "RETRY_PENDING"}:
        raise Conflict(f"Cannot retry installment in '{installment.status}' status")
    old_status = installment.status
    installment.status = "RETRY_PENDING"
    installment.retry_count = (installment.retry_count or 0) + 1
    reason = body.reason if body else "Payment retry initiated"
    db.add(
        PaymentStatusHistory(
            installment_id=id,
            from_status=old_status,
            to_status="RETRY_PENDING",
            actor_id=user.id,
            reason=reason,
        )
    )
    audit(db, "INSTALLMENT_RETRY_INITIATED", user.id, "FINANCE_INSTALLMENT", id, {"retry_count": installment.retry_count, "reason": reason})
    db.commit()
    return {"success": True, "data": public(installment)}


@router.post("/finance/installments/{id}/return")
def return_installment(
    id: str,
    body: ReturnIn | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles("FINANCE_OFFICER")),
):
    installment = get(db, FinanceInstallment, id)
    if installment.status in {"COMPLETED", "RECONCILED"}:
        raise Conflict("Installment has already been reconciled")
    old_status = installment.status
    reason = body.resolved_reason() if body else "Returned by finance"
    installment.status = "RETURNED"
    installment.return_reason = reason
    db.add(
        PaymentStatusHistory(
            installment_id=id,
            from_status=old_status,
            to_status="RETURNED",
            actor_id=user.id,
            reason=reason,
        )
    )
    audit(db, "INSTALLMENT_RETURNED", user.id, "FINANCE_INSTALLMENT", id, {"reason": reason})
    db.commit()
    return {"success": True, "data": public(installment)}


@router.post("/finance/installments/{id}/reconcile")
def reconcile_installment(
    id: str,
    body: ReconcileIn | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles("FINANCE_OFFICER")),
):
    installment = get(db, FinanceInstallment, id)
    old_status = installment.status
    installment.status = "RECONCILED"
    expected = float(installment.expected_amount)
    actual = body.reconciled_amount if (body and body.reconciled_amount is not None) else float(installment.paid_amount or 0)
    difference = actual - expected

    # Create reconciliation record
    rec = None
    if installment.award_id:
        rec = FinanceRecord(
            award_id=installment.award_id,
            record_type="RECONCILIATION",
            amount=actual,
            data={"expected_amount": expected, "difference": difference, "installment_id": id, "note": body.note if body else None},
            status="RECONCILED",
            provider="mock",
        )
        db.add(rec)
        db.flush()

    if difference != 0 and rec is not None:
        ex = PaymentException(
            finance_record_id=rec.id,
            expected_amount=expected,
            actual_amount=actual,
            difference=difference,
            reason=body.note or "Reconciliation mismatch",
            status="OPEN",
        )
        db.add(ex)

    db.add(
        PaymentStatusHistory(
            installment_id=id,
            from_status=old_status,
            to_status="RECONCILED",
            actor_id=user.id,
            reason=body.note if body else "Reconciliation completed",
        )
    )
    audit(db, "INSTALLMENT_RECONCILED", user.id, "FINANCE_INSTALLMENT", id, {"expected": expected, "actual": actual, "difference": difference})
    db.commit()
    return {"success": True, "data": {**public(installment), "difference": difference}}


@router.get("/finance/installments/{id}/history")
def installment_history(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    installment = get(db, FinanceInstallment, id)
    attempts = db.scalars(
        select(PaymentAttempt).where(PaymentAttempt.installment_id == id).order_by(PaymentAttempt.created_at)
    ).all()
    history = db.scalars(
        select(PaymentStatusHistory).where(PaymentStatusHistory.installment_id == id).order_by(PaymentStatusHistory.created_at)
    ).all()
    return {
        "success": True,
        "data": {
            "installment": public(installment),
            "attempts": [public(a) for a in attempts],
            "status_history": [public(h) for h in history],
        },
    }



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


@router.get("/integration-logs")
def list_integration_logs(
    provider: str | None = None,
    operation: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles("SUPER_ADMIN", "AUDITOR", "MONITORING_ANALYST", "FINANCE_OFFICER")),
):
    from app.domain.relational_models import IntegrationLog
    q = select(IntegrationLog)
    if provider:
        q = q.where(IntegrationLog.provider == provider)
    if operation:
        q = q.where(IntegrationLog.operation == operation)
    if status:
        q = q.where(IntegrationLog.status == status)
    rows = db.scalars(q.order_by(IntegrationLog.created_at.desc()).limit(200)).all()
    return {"success": True, "data": [public(r) for r in rows]}
