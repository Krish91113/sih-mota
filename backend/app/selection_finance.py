"""Selection, approval, award, and finance APIs backed by relational tables."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.database import get_db
from app.core.errors import Conflict, Forbidden, Immutable, NotFound
from app.core.permissions import current_user, require_roles
from app.domain.models import Application, SchemeVersion, User
from app.domain.relational_models import (
    Approval, Award, FinanceRecord, SchemeSelectionCriterion, SelectionCandidate,
    SelectionReview, SelectionRound, SelectionScore,
)
from app.domain.selection_finance_models import CommitteeComment, CommitteeDecision
from app.domain.core_completion_models import SelectionTieResolution, SelectionCorrection, ApprovalDelegation, FinanceInstallment, PaymentException
from app.idempotency import complete, get_or_create

router = APIRouter(tags=["Selection and Finance"])


def public(obj):
    return {column.key: getattr(obj, column.key) for column in obj.__table__.columns}


def get_or_404(db, model, ident):
    row = db.get(model, ident)
    if not row:
        raise NotFound(f"{model.__name__} not found")
    return row


def mutation(db, key, user_id, route, payload) -> Any:
    if not key:
        return None
    record = get_or_create(db, key, user_id, route, payload)
    if record.response is not None:
        return record.response
    return record


def finish(db, record, result):
    if record is not None:
        complete(record, 200, result)
    db.commit()
    return result


def locked(round_: SelectionRound):
    if round_.finalized_at is not None:
        raise Immutable("Selection round is finalized and locked")


def candidate_round(db, candidate_id):
    candidate = get_or_404(db, SelectionCandidate, candidate_id)
    return candidate, get_or_404(db, SelectionRound, candidate.round_id)


def committee_candidate(db, candidate_id, user):
    candidate, round_ = candidate_round(db, candidate_id)
    return candidate, round_


def declared_conflict(db, candidate_id, member_id):
    return db.scalar(select(CommitteeDecision).where(
        CommitteeDecision.candidate_id == candidate_id,
        CommitteeDecision.member_id == member_id,
        CommitteeDecision.conflict.is_(True),
    ))


def require_unconflicted(db, candidate_id, member_id):
    if declared_conflict(db, candidate_id, member_id):
        raise Forbidden("A member who declared a conflict may not score, review, or decide")


def candidate_data(db, candidate, user=None):
    application = get_or_404(db, Application, candidate.application_id)
    scores = db.scalars(select(SelectionScore).where(SelectionScore.candidate_id == candidate.id)).all()
    reviews = db.scalars(select(SelectionReview).where(SelectionReview.candidate_id == candidate.id)).all()
    decisions = db.scalars(select(CommitteeDecision).where(CommitteeDecision.candidate_id == candidate.id)).all()
    comments = db.scalars(select(CommitteeComment).where(CommitteeComment.candidate_id == candidate.id).order_by(CommitteeComment.created_at)).all()
    result = {
        "candidate": public(candidate),
        "application": public(application),
        "scores": [public(row) for row in scores],
        "reviews": [public(row) for row in reviews],
        "decisions": [public(row) for row in decisions],
        "comments": [public(row) for row in comments],
    }
    if user is not None:
        own = next((row for row in decisions if row.member_id == user.id), None)
        result["my_decision"] = public(own) if own else None
        result["my_conflict"] = bool(own and own.conflict)
    return result


def packet(db: Session, application_id: str) -> dict[str, Any]:
    application = get_or_404(db, Application, application_id)
    candidate = db.scalar(select(SelectionCandidate).where(SelectionCandidate.application_id == application_id))
    round_ = get_or_404(db, SelectionRound, candidate.round_id) if candidate else None
    scores = db.scalars(select(SelectionScore).where(SelectionScore.candidate_id == candidate.id)).all() if candidate else []
    reviews = db.scalars(select(SelectionReview).where(SelectionReview.candidate_id == candidate.id)).all() if candidate else []
    decisions = db.scalars(select(CommitteeDecision).where(CommitteeDecision.candidate_id == candidate.id)).all() if candidate else []
    approvals = db.scalars(select(Approval).where(Approval.application_id == application_id)).all()
    prerequisites = {
        "candidate_present": candidate is not None,
        "selection_finalized": round_ is not None and round_.finalized_at is not None,
        "scores_present": bool(scores),
        "committee_decision_present": bool(decisions),
        "committee_approved": any(x.decision == "APPROVE" and not x.conflict for x in decisions),
        "approval_not_already_granted": not any(x.decision == "APPROVED" for x in approvals),
    }
    return {
        "application": public(application),
        "candidate": public(candidate) if candidate else None,
        "round": public(round_) if round_ else None,
        "scores": [public(x) for x in scores],
        "reviews": [public(x) for x in reviews],
        "committee_decisions": [public(x) for x in decisions],
        "approvals": [public(x) for x in approvals],
        "prerequisites": prerequisites,
        "ready": all(prerequisites.values()),
    }


class RoundIn(BaseModel):
    scheme_version_id: str
    name: str
    status: str = "OPEN"
    data: dict[str, Any] = Field(default_factory=dict)


class CandidateIn(BaseModel):
    application_id: str
    data: dict[str, Any] = Field(default_factory=dict)


class ScoreIn(BaseModel):
    criterion_code: str
    raw_value: Any = None
    normalized_value: float | None = None
    weight: float = 1
    weighted_score: float | None = None


class ReviewIn(BaseModel):
    decision: str
    note: str | None = None
    conflict: bool = False


class CommitteeDecisionIn(BaseModel):
    decision: str
    rationale: str | None = None
    conflict: bool = False
    evidence: dict[str, Any] = Field(default_factory=dict)


class RecommendIn(BaseModel):
    decision: str = "RECOMMEND"
    rationale: str | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)


class CommentIn(BaseModel):
    comment: str | None = Field(default=None, min_length=1, max_length=10000)
    note: str | None = Field(default=None, min_length=1, max_length=10000)


class ApprovalIn(BaseModel):
    decision: str
    reason_code: str | None = None
    note: str | None = None


class AwardIn(BaseModel):
    amount: float = Field(gt=0)
    award_date: datetime | None = None


class FinanceIn(BaseModel):
    record_type: str
    amount: float = Field(ge=0)
    award_id: str | None = None
    external_reference: str | None = None
    provider: str = "mock"
    data: dict[str, Any] = Field(default_factory=dict)
class TieIn(BaseModel): strategy:str; candidate_ids:list[str]; reason:str
class CorrectionIn(BaseModel): old_value:dict[str,Any]; new_value:dict[str,Any]; reason:str
class DelegationIn(BaseModel): to_user_id:str; reason:str; application_id:str|None=None; expires_at:datetime|None=None
class InstallmentIn(BaseModel): installment_no:int; expected_amount:float=Field(gt=0); due_at:datetime|None=None
class ExceptionIn(BaseModel): expected_amount:float; actual_amount:float; reason:str


COMMITTEE_ROLES = ("SELECTION_COMMITTEE_MEMBER", "SCHEME_MANAGER")


@router.get("/committee/candidates")
def list_committee_candidates(db: Session = Depends(get_db), user=Depends(require_roles(*COMMITTEE_ROLES))):
    candidates = db.scalars(select(SelectionCandidate).join(SelectionRound).where(
        SelectionRound.finalized_at.is_(None)
    ).order_by(SelectionCandidate.rank.is_(None), SelectionCandidate.rank, SelectionCandidate.id)).all()
    return {"success": True, "data": [candidate_data(db, candidate, user) for candidate in candidates]}


@router.get("/committee/candidates/{candidate_id}")
def get_committee_candidate(candidate_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*COMMITTEE_ROLES))):
    candidate, _ = committee_candidate(db, candidate_id, user)
    return {"success": True, "data": candidate_data(db, candidate, user)}


@router.get("/selection-candidates/{candidate_id}")
def get_selection_candidate(candidate_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*COMMITTEE_ROLES))):
    candidate, _ = committee_candidate(db, candidate_id, user)
    return {"success": True, "data": candidate_data(db, candidate, user)}


@router.get("/selection-candidates/{candidate_id}/scores")
def list_scores(candidate_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*COMMITTEE_ROLES))):
    candidate, _ = committee_candidate(db, candidate_id, user)
    rows = db.scalars(select(SelectionScore).where(SelectionScore.candidate_id == candidate.id)).all()
    return {"success": True, "data": [public(row) for row in rows]}


@router.get("/selection-candidates/{candidate_id}/reviews")
def list_reviews(candidate_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*COMMITTEE_ROLES))):
    candidate, _ = committee_candidate(db, candidate_id, user)
    rows = db.scalars(select(SelectionReview).where(SelectionReview.candidate_id == candidate.id)).all()
    return {"success": True, "data": [public(row) for row in rows]}


@router.post("/selection-candidates/{candidate_id}/conflict", status_code=201)
def declare_conflict(candidate_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*COMMITTEE_ROLES)), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    candidate, round_ = committee_candidate(db, candidate_id, user)
    locked(round_)
    record = mutation(db, idempotency_key, user.id, f"selection-candidates:{candidate_id}:conflict", {})
    if record is not None and record.response is not None:
        return record.response
    existing = db.scalar(select(CommitteeDecision).where(CommitteeDecision.candidate_id == candidate_id, CommitteeDecision.member_id == user.id))
    if existing and not existing.conflict:
        raise Conflict("A committee decision already exists and cannot be changed to a conflict declaration")
    if existing:
        result = {"success": True, "data": public(existing)}
        return finish(db, record, result)
    row = CommitteeDecision(candidate_id=candidate_id, member_id=user.id, decision="ABSTAIN", conflict=True, evidence={"declared_via": "conflict"})
    db.add(row); db.flush()
    audit(db, "COMMITTEE_CONFLICT_DECLARED", user.id, "SELECTION_CANDIDATE", candidate_id)
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.post("/committee/candidates/{candidate_id}/conflict", status_code=201)
def declare_committee_conflict(candidate_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*COMMITTEE_ROLES)), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    return declare_conflict(candidate_id, db, user, idempotency_key)


@router.post("/selection-candidates/{candidate_id}/abstain", status_code=201)
def abstain(candidate_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*COMMITTEE_ROLES)), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    candidate, round_ = committee_candidate(db, candidate_id, user)
    locked(round_)
    record = mutation(db, idempotency_key, user.id, f"selection-candidates:{candidate_id}:abstain", {})
    if record is not None and record.response is not None:
        return record.response
    existing = db.scalar(select(CommitteeDecision).where(CommitteeDecision.candidate_id == candidate_id, CommitteeDecision.member_id == user.id))
    if existing:
        if existing.decision == "ABSTAIN":
            result = {"success": True, "data": public(existing)}
            return finish(db, record, result)
        raise Conflict("Committee member has already recorded a decision")
    row = CommitteeDecision(candidate_id=candidate_id, member_id=user.id, decision="ABSTAIN", conflict=False, evidence={})
    db.add(row); db.flush(); audit(db, "COMMITTEE_ABSTAINED", user.id, "SELECTION_CANDIDATE", candidate_id)
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.post("/selection-candidates/{candidate_id}/recommend", status_code=201)
def recommend(candidate_id: str, body: RecommendIn | None = None, db: Session = Depends(get_db), user=Depends(require_roles(*COMMITTEE_ROLES)), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    body = body or RecommendIn()
    decision = "APPROVE" if body.decision in {"RECOMMEND", "APPROVE"} else "REJECT" if body.decision in {"NOT_RECOMMEND", "REJECT"} else None
    if decision is None:
        raise Conflict("Recommendation must be RECOMMEND or NOT_RECOMMEND")
    candidate, round_ = committee_candidate(db, candidate_id, user)
    locked(round_); require_unconflicted(db, candidate_id, user.id)
    record = mutation(db, idempotency_key, user.id, f"selection-candidates:{candidate_id}:recommend", body.model_dump())
    if record is not None and record.response is not None:
        return record.response
    existing = db.scalar(select(CommitteeDecision).where(CommitteeDecision.candidate_id == candidate_id, CommitteeDecision.member_id == user.id))
    if existing:
        if existing.decision == decision and not existing.conflict:
            result = {"success": True, "data": public(existing)}
            return finish(db, record, result)
        raise Conflict("Committee member has already recorded a decision")
    row = CommitteeDecision(candidate_id=candidate_id, member_id=user.id, decision=decision, rationale=body.rationale, evidence=body.evidence)
    db.add(row); db.flush(); audit(db, "COMMITTEE_RECOMMENDATION_RECORDED", user.id, "SELECTION_CANDIDATE", candidate_id, {"decision": decision})
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.post("/selection-candidates/{candidate_id}/comments", status_code=201)
def add_comment(candidate_id: str, body: CommentIn, db: Session = Depends(get_db), user=Depends(require_roles(*COMMITTEE_ROLES)), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    candidate, round_ = committee_candidate(db, candidate_id, user)
    locked(round_)
    record = mutation(db, idempotency_key, user.id, f"selection-candidates:{candidate_id}:comments", body.model_dump())
    if record is not None and record.response is not None:
        return record.response
    text = body.comment or body.note
    if not text:
        raise Conflict("A committee comment is required")
    row = CommitteeComment(candidate_id=candidate.id, member_id=user.id, comment=text)
    db.add(row); db.flush(); audit(db, "COMMITTEE_COMMENT_ADDED", user.id, "SELECTION_CANDIDATE", candidate_id)
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.get("/selection-candidates/{candidate_id}/comments")
def list_comments(candidate_id: str, db: Session = Depends(get_db), user=Depends(require_roles(*COMMITTEE_ROLES))):
    candidate, _ = committee_candidate(db, candidate_id, user)
    rows = db.scalars(select(CommitteeComment).where(CommitteeComment.candidate_id == candidate.id).order_by(CommitteeComment.created_at)).all()
    return {"success": True, "data": [public(row) for row in rows]}


@router.post("/selection-rounds", status_code=201)
def create_round(body: RoundIn, db: Session = Depends(get_db), user=Depends(require_roles("SCHEME_MANAGER", "SELECTION_COMMITTEE_MEMBER")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    version = get_or_404(db, SchemeVersion, body.scheme_version_id)
    record = mutation(db, idempotency_key, user.id, "selection-rounds", body.model_dump())
    if record is not None and record.response is not None:
        return record.response
    row = SelectionRound(scheme_version_id=version.id, name=body.name, status=body.status, data=body.data)
    db.add(row); db.flush(); audit(db, "SELECTION_ROUND_CREATED", user.id, "SELECTION_ROUND", row.id, body.model_dump())
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.get("/selection-rounds/{round_id}")
def get_round(round_id: str, db: Session = Depends(get_db), user=Depends(current_user)):
    row = get_or_404(db, SelectionRound, round_id)
    candidates = db.scalars(select(SelectionCandidate).where(SelectionCandidate.round_id == round_id)).all()
    return {"success": True, "data": {**public(row), "candidates": [public(x) for x in candidates]}}


@router.post("/selection-rounds/{round_id}/candidates", status_code=201)
def add_candidate(round_id: str, body: CandidateIn, db: Session = Depends(get_db), user=Depends(require_roles("SELECTION_COMMITTEE_MEMBER", "SCHEME_MANAGER")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    round_ = get_or_404(db, SelectionRound, round_id); locked(round_)
    get_or_404(db, Application, body.application_id)
    record = mutation(db, idempotency_key, user.id, f"selection-rounds:{round_id}:candidates", body.model_dump())
    if record is not None and record.response is not None: return record.response
    if db.scalar(select(SelectionCandidate).where(SelectionCandidate.round_id == round_id, SelectionCandidate.application_id == body.application_id)):
        raise Conflict("Application is already a candidate in this round")
    row = SelectionCandidate(round_id=round_id, application_id=body.application_id, data=body.data)
    db.add(row); db.flush(); audit(db, "SELECTION_CANDIDATE_ADDED", user.id, "SELECTION_CANDIDATE", row.id)
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.post("/selection-candidates/{candidate_id}/scores", status_code=201)
def add_score(candidate_id: str, body: ScoreIn, db: Session = Depends(get_db), user=Depends(require_roles("SELECTION_COMMITTEE_MEMBER", "SCHEME_MANAGER")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    candidate, round_ = candidate_round(db, candidate_id); locked(round_); require_unconflicted(db, candidate_id, user.id)
    record = mutation(db, idempotency_key, user.id, f"selection-candidates:{candidate_id}:scores", body.model_dump())
    if record is not None and record.response is not None: return record.response
    existing = db.scalar(select(SelectionScore).where(SelectionScore.candidate_id == candidate_id, SelectionScore.criterion_code == body.criterion_code))
    if existing: raise Conflict("Score for this criterion already exists")
    normalized = body.normalized_value if body.normalized_value is not None else float(body.raw_value) if isinstance(body.raw_value, (int, float)) else None
    weighted = body.weighted_score if body.weighted_score is not None else (normalized * body.weight if normalized is not None else None)
    row = SelectionScore(candidate_id=candidate_id, criterion_code=body.criterion_code, raw_value=body.raw_value, normalized_value=normalized, weight=body.weight, weighted_score=weighted)
    db.add(row); db.flush()
    if weighted is not None:
        candidate.total_score = sum((x.weighted_score or Decimal("0")) for x in db.scalars(select(SelectionScore).where(SelectionScore.candidate_id == candidate_id)).all())
    audit(db, "SELECTION_SCORE_RECORDED", user.id, "SELECTION_CANDIDATE", candidate_id, {"criterion_code": body.criterion_code})
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.post("/selection-candidates/{candidate_id}/reviews", status_code=201)
def add_review(candidate_id: str, body: ReviewIn, db: Session = Depends(get_db), user=Depends(require_roles("SELECTION_COMMITTEE_MEMBER", "SCHEME_MANAGER")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    candidate, round_ = candidate_round(db, candidate_id); locked(round_); require_unconflicted(db, candidate_id, user.id)
    if body.conflict:
        raise Conflict("Declare conflict through the conflict endpoint before abstaining")
    record = mutation(db, idempotency_key, user.id, f"selection-candidates:{candidate_id}:reviews", body.model_dump())
    if record is not None and record.response is not None: return record.response
    if db.scalar(select(SelectionReview).where(SelectionReview.candidate_id == candidate_id, SelectionReview.member_id == user.id)):
        raise Conflict("Committee member has already reviewed this candidate")
    row = SelectionReview(candidate_id=candidate_id, member_id=user.id, **body.model_dump())
    db.add(row); db.flush(); audit(db, "SELECTION_REVIEW_RECORDED", user.id, "SELECTION_CANDIDATE", candidate_id)
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.post("/selection-candidates/{candidate_id}/decisions", status_code=201)
def add_decision(candidate_id: str, body: CommitteeDecisionIn, db: Session = Depends(get_db), user=Depends(require_roles("SELECTION_COMMITTEE_MEMBER", "SCHEME_MANAGER")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    candidate, round_ = candidate_round(db, candidate_id); locked(round_)
    if body.conflict:
        raise Conflict("Conflict declarations must use the conflict endpoint")
    if body.decision not in {"APPROVE", "REJECT", "ABSTAIN"}: raise Conflict("Unsupported committee decision")
    if body.decision != "ABSTAIN":
        require_unconflicted(db, candidate_id, user.id)
    record = mutation(db, idempotency_key, user.id, f"selection-candidates:{candidate_id}:decisions", body.model_dump())
    if record is not None and record.response is not None: return record.response
    if db.scalar(select(CommitteeDecision).where(CommitteeDecision.candidate_id == candidate_id, CommitteeDecision.member_id == user.id)):
        raise Conflict("Committee member has already decided for this candidate")
    row = CommitteeDecision(candidate_id=candidate_id, member_id=user.id, **body.model_dump())
    db.add(row); db.flush(); audit(db, "COMMITTEE_DECISION_RECORDED", user.id, "SELECTION_CANDIDATE", candidate_id)
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.post("/selection-rounds/{round_id}/finalize")
def finalize_round(round_id: str, db: Session = Depends(get_db), user=Depends(require_roles("SCHEME_MANAGER", "SELECTION_COMMITTEE_MEMBER")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    round_ = get_or_404(db, SelectionRound, round_id)
    if round_.finalized_at is not None:
        raise Conflict("Selection round is already finalized")
    candidates = db.scalars(select(SelectionCandidate).where(SelectionCandidate.round_id == round_id)).all()
    if not candidates: raise Conflict("Selection round has no candidates")
    record = mutation(db, idempotency_key, user.id, f"selection-rounds:{round_id}:finalize", {})
    if record is not None and record.response is not None: return record.response
    ordered = sorted(candidates, key=lambda x: (x.total_score or 0, x.id), reverse=True)
    score_groups = {}
    for candidate in ordered:
        score_groups.setdefault(str(candidate.total_score or 0), []).append(candidate)
    ties = [group for group in score_groups.values() if len(group) > 1]
    resolution = db.scalar(select(SelectionTieResolution).where(SelectionTieResolution.round_id == round_id))
    if ties and resolution is None:
        raise Conflict("Selection ties must be resolved before finalization", {"candidate_ids": [[c.id for c in group] for group in ties]})
    if resolution:
        order = {candidate_id: index for index, candidate_id in enumerate(resolution.candidate_ids)}
        ordered = sorted(ordered, key=lambda x: (-(x.total_score or 0), order.get(x.id, len(order)), x.id))
    for rank, candidate in enumerate(ordered, 1): candidate.rank = rank
    round_.status = "FINALIZED"; round_.finalized_at = datetime.now(timezone.utc); round_.finalized_by = user.id
    audit(db, "SELECTION_ROUND_FINALIZED", user.id, "SELECTION_ROUND", round_id, {"candidate_count": len(candidates)})
    result = {"success": True, "data": public(round_)}
    return finish(db, record, result)


@router.get("/applications/{application_id}/approval-packet")
def get_packet(application_id: str, db: Session = Depends(get_db), user=Depends(current_user)):
    return {"success": True, "data": packet(db, application_id)}


@router.post("/applications/{application_id}/approvals", status_code=201)
def decide_approval(application_id: str, body: ApprovalIn, db: Session = Depends(get_db), user=Depends(require_roles("APPROVING_AUTHORITY")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    details = packet(db, application_id)
    if body.decision == "APPROVED" and not details["ready"]:
        raise Conflict("Approval prerequisites are not satisfied", {"prerequisites": details["prerequisites"]})
    record = mutation(db, idempotency_key, user.id, f"applications:{application_id}:approvals", body.model_dump())
    if record is not None and record.response is not None: return record.response
    if body.decision == "APPROVED":
        delegation = db.scalar(select(ApprovalDelegation).where(ApprovalDelegation.application_id == application_id, ApprovalDelegation.to_user_id == user.id, ApprovalDelegation.status == "ACTIVE"))
        if delegation and delegation.expires_at and delegation.expires_at <= datetime.now(timezone.utc):
            delegation.status = "EXPIRED"
            db.flush()
        elif user.role != "SUPER_ADMIN" and not delegation and user.role != "APPROVING_AUTHORITY":
            raise Forbidden("No active approval delegation")
    if db.scalar(select(Approval).where(Approval.application_id == application_id, Approval.decision == "APPROVED")):
        raise Conflict("Application is already approved")
    row = Approval(application_id=application_id, approver_id=user.id, decision=body.decision, reason_code=body.reason_code, note=body.note, packet_snapshot=details)
    db.add(row); db.flush(); audit(db, "APPROVAL_DECIDED", user.id, "APPLICATION", application_id, {"decision": body.decision})
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.post("/applications/{application_id}/awards", status_code=201)
def create_award(application_id: str, body: AwardIn, db: Session = Depends(get_db), user=Depends(require_roles("APPROVING_AUTHORITY")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    application = get_or_404(db, Application, application_id)
    record = mutation(db, idempotency_key, user.id, f"applications:{application_id}:awards", body.model_dump())
    if record is not None and record.response is not None: return record.response
    if db.scalar(select(Award).where(Award.application_id == application_id)): raise Conflict("Application already has an award")
    if not db.scalar(select(Approval).where(Approval.application_id == application_id, Approval.decision == "APPROVED")):
        raise Conflict("An approved decision is required before awarding")
    row = Award(application_id=application_id, scheme_version_id=application.scheme_version_id, amount=body.amount, awarded_by=user.id, award_date=body.award_date or datetime.now(timezone.utc), status="ACTIVE")
    db.add(row); application.status = "AWARDED"; db.flush(); audit(db, "AWARD_CREATED", user.id, "AWARD", row.id, {"application_id": application_id, "amount": body.amount})
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.post("/awards/{award_id}/finance-records", status_code=201)
def add_finance_record(award_id: str, body: FinanceIn, db: Session = Depends(get_db), user=Depends(require_roles("FINANCE_OFFICER")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    award = get_or_404(db, Award, award_id)
    record = mutation(db, idempotency_key, user.id, f"awards:{award_id}:finance-records", body.model_dump())
    if record is not None and record.response is not None: return record.response
    if body.record_type in {"SANCTION", "DISBURSEMENT"} and db.scalar(select(FinanceRecord).where(FinanceRecord.award_id == award.id, FinanceRecord.record_type == body.record_type, FinanceRecord.external_reference == body.external_reference if body.external_reference else FinanceRecord.external_reference.is_(None))):
        raise Conflict(f"Duplicate {body.record_type.lower()} for award")
    row = FinanceRecord(award_id=award.id, record_type=body.record_type, amount=body.amount, external_reference=body.external_reference, provider=body.provider, data=body.data, status="RECORDED")
    db.add(row); db.flush(); audit(db, "FINANCE_RECORD_CREATED", user.id, "AWARD", award_id, {"record_type": body.record_type, "provider": body.provider})
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.get("/approvals/queue")
def approval_queue(db: Session = Depends(get_db), user=Depends(require_roles("APPROVING_AUTHORITY"))):
    rows=db.scalars(select(Approval).where(Approval.decision=="PENDING")).all()
    return {"success":True,"data":[public(x) for x in rows]}
@router.get("/applications/{application_id}/decision-packet")
def decision_packet(application_id:str,db:Session=Depends(get_db),user=Depends(current_user)): return {"success":True,"data":packet(db,application_id)}
@router.post("/applications/{application_id}/approve")
def approve_application(application_id:str,body:ApprovalIn|None=None,db:Session=Depends(get_db),user=Depends(require_roles("APPROVING_AUTHORITY")),idempotency_key:str|None=Header(default=None,alias="Idempotency-Key")):
    return decide_approval(application_id,body or ApprovalIn(decision="APPROVED"),db,user,idempotency_key)
@router.post("/applications/{application_id}/reject")
def reject_application(application_id:str,body:ApprovalIn,db:Session=Depends(get_db),user=Depends(require_roles("APPROVING_AUTHORITY")),idempotency_key:str|None=Header(default=None,alias="Idempotency-Key")):
    if body.decision!="REJECTED" or not body.reason_code or not body.note: raise Conflict("Reject requires reason_code and note")
    return decide_approval(application_id,body,db,user,idempotency_key)
@router.post("/applications/{application_id}/return")
def return_application(application_id:str,body:ApprovalIn,db:Session=Depends(get_db),user=Depends(require_roles("APPROVING_AUTHORITY")),idempotency_key:str|None=Header(default=None,alias="Idempotency-Key")):
    if body.decision!="RETURNED" or not body.note: raise Conflict("Return requires note")
    return decide_approval(application_id,body,db,user,idempotency_key)
@router.get("/awards")
def awards(db:Session=Depends(get_db),user=Depends(current_user)): return {"success":True,"data":[public(x) for x in db.scalars(select(Award)).all()]}
@router.get("/awards/{award_id}")
def award(award_id:str,db:Session=Depends(get_db),user=Depends(current_user)): return {"success":True,"data":public(get_or_404(db,Award,award_id))}
@router.post("/applications/{application_id}/award")
def award_application(application_id:str,body:AwardIn,db:Session=Depends(get_db),user=Depends(require_roles("APPROVING_AUTHORITY")),idempotency_key:str|None=Header(default=None,alias="Idempotency-Key")):
    return create_award(application_id,body,db,user,idempotency_key)
@router.get("/finance/records")
def finance_records(db:Session=Depends(get_db),user=Depends(require_roles("FINANCE_OFFICER","AUDITOR"))): return {"success":True,"data":[public(x) for x in db.scalars(select(FinanceRecord)).all()]}
@router.get("/finance/records/{record_id}")
def finance_record(record_id:str,db:Session=Depends(get_db),user=Depends(require_roles("FINANCE_OFFICER","AUDITOR"))): return {"success":True,"data":public(get_or_404(db,FinanceRecord,record_id))}
@router.post("/finance/sanctions",status_code=201)
def sanction(body:FinanceIn,db:Session=Depends(get_db),user=Depends(require_roles("FINANCE_OFFICER")),idempotency_key:str|None=Header(default=None,alias="Idempotency-Key")):
    if not body.award_id: raise Conflict("award_id is required")
    body.record_type="SANCTION"; return add_finance_record(body.award_id,body,db,user,idempotency_key)
@router.post("/finance/disbursements",status_code=201)
def disbursement(body:FinanceIn,db:Session=Depends(get_db),user=Depends(require_roles("FINANCE_OFFICER")),idempotency_key:str|None=Header(default=None,alias="Idempotency-Key")):
    if not body.award_id: raise Conflict("award_id is required")
    body.record_type="DISBURSEMENT"; return add_finance_record(body.award_id,body,db,user,idempotency_key)

@router.get("/awards/{award_id}/finance-records")
def list_finance_records(award_id: str, db: Session = Depends(get_db), user=Depends(current_user)):
    get_or_404(db, Award, award_id)
    rows = db.scalars(select(FinanceRecord).where(FinanceRecord.award_id == award_id)).all()
    return {"success": True, "data": [public(x) for x in rows]}
