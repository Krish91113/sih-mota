"""Verification, Evidence, Finding, and Decision Trace APIs."""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from app.core.access import application_for_actor, get_or_404
from app.core.audit import audit
from app.core.database import get_db
from app.core.errors import Conflict, Forbidden, NotFound
from app.core.permissions import current_user, require_roles
from app.domain.models import Applicant, Application, Document, User
from app.domain.relational_models import (
    DecisionStep,
    DecisionTrace,
    Evidence,
    VerificationCase,
    VerificationFinding,
)

router = APIRouter(tags=["Verification and Trust"])

VERIFICATION_ROLES = (
    "VERIFICATION_OFFICER",
    "SCRUTINY_OFFICER",
    "SCHEME_MANAGER",
    "SUPER_ADMIN",
)
STAFF_READ_ROLES = (
    "VERIFICATION_OFFICER",
    "SCRUTINY_OFFICER",
    "SCHEME_MANAGER",
    "APPROVING_AUTHORITY",
    "FINANCE_OFFICER",
    "AUDITOR",
    "MONITORING_ANALYST",
    "SUPER_ADMIN",
)


def public(obj: Any) -> dict[str, Any]:
    return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class EvidenceIn(BaseModel):
    evidence_type: str = Field(min_length=1, max_length=80)
    field_name: str = Field(min_length=1, max_length=100)
    observed_value: Any
    normalized_value: Any = None
    source: str = "MANUAL"
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    document_id: str | None = None


class FindingIn(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    severity: str = "MEDIUM"
    description: str = Field(min_length=1)
    evidence_id: str | None = None
    expected_value: Any = None
    observed_value: Any = None


class FindingResolveIn(BaseModel):
    reason: str | None = None


class CaseCreateIn(BaseModel):
    application_id: str | None = None
    priority: str = "MEDIUM"
    assigned_to: str | None = None


class CaseAssignIn(BaseModel):
    assignee_id: str


class CaseReturnIn(BaseModel):
    reason: str | None = None


class DecisionStepIn(BaseModel):
    step_type: str = "RULE_EVALUATION"
    description: str = ""
    result: str = "PASSED"
    evidence_id: str | None = None
    rule_result_id: str | None = None
    actor_id: str | None = None


class DecisionTraceIn(BaseModel):
    decision_type: str = Field(min_length=1, max_length=60)
    decision_status: str = Field(min_length=1, max_length=40)
    scheme_version_id: str | None = None
    policy_version: str | None = None
    input_snapshot: dict[str, Any] = Field(default_factory=dict)
    reason: str | None = None
    steps: list[DecisionStepIn] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Decision Trace Helper
# ---------------------------------------------------------------------------
def create_decision_trace(
    db: Session,
    application_id: str,
    decision_type: str,
    decision_status: str,
    scheme_version_id: str | None = None,
    policy_version: str | None = None,
    input_snapshot: dict | None = None,
    reason: str | None = None,
    actor_id: str | None = None,
    steps: list[dict[str, Any]] | None = None,
) -> DecisionTrace:
    trace = DecisionTrace(
        application_id=application_id,
        decision_type=decision_type,
        decision_status=decision_status,
        scheme_version_id=scheme_version_id,
        policy_version=policy_version,
        input_snapshot=input_snapshot or {},
        reason=reason,
        actor_id=actor_id,
    )
    db.add(trace)
    db.flush()

    if steps:
        for idx, s in enumerate(steps, 1):
            step = DecisionStep(
                decision_trace_id=trace.id,
                step_order=s.get("step_order", idx),
                step_type=s.get("step_type", "RULE_EVALUATION"),
                description=s.get("description", ""),
                result=s.get("result", "PASSED"),
                evidence_id=s.get("evidence_id"),
                rule_result_id=s.get("rule_result_id"),
                actor_id=s.get("actor_id", actor_id),
            )
            db.add(step)
        db.flush()

    audit(
        db,
        "DECISION_TRACE_CREATED",
        actor_id,
        "APPLICATION",
        application_id,
        {"trace_id": trace.id, "type": decision_type, "status": decision_status},
    )
    return trace


# ---------------------------------------------------------------------------
# Evidence Endpoints
# ---------------------------------------------------------------------------
@router.post("/applications/{id}/evidence", status_code=201)
def add_evidence(
    id: str,
    body: EvidenceIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*VERIFICATION_ROLES)),
):
    application_for_actor(db, id, user)
    if body.observed_value is None or body.observed_value == "":
        raise Conflict("observed_value cannot be empty")
    if body.document_id:
        doc = db.get(Document, body.document_id)
        if not doc or doc.application_id != id:
            raise NotFound("Document does not belong to this application")

    evidence = Evidence(
        application_id=id,
        document_id=body.document_id,
        evidence_type=body.evidence_type,
        field_name=body.field_name,
        observed_value=body.observed_value,
        normalized_value=body.normalized_value,
        source=body.source,
        confidence=body.confidence,
        verified=False,
    )
    db.add(evidence)
    db.flush()
    audit(
        db,
        "EVIDENCE_RECORDED",
        user.id,
        "EVIDENCE",
        evidence.id,
        {"field_name": body.field_name, "evidence_type": body.evidence_type},
    )
    db.commit()
    return {"success": True, "data": public(evidence)}


@router.get("/applications/{id}/evidence")
def list_evidence(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    application_for_actor(db, id, user)
    rows = db.scalars(
        select(Evidence)
        .where(Evidence.application_id == id)
        .order_by(Evidence.created_at)
    ).all()
    return {"success": True, "data": [public(r) for r in rows]}


@router.get("/evidence/{id}")
def get_evidence(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    evidence = get_or_404(db, Evidence, id)
    application_for_actor(db, evidence.application_id, user)
    return {"success": True, "data": public(evidence)}


@router.post("/evidence/{id}/verify")
def verify_evidence(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*VERIFICATION_ROLES)),
):
    evidence = get_or_404(db, Evidence, id)
    application_for_actor(db, evidence.application_id, user)
    evidence.verified = True
    evidence.verified_by = user.id
    evidence.verified_at = datetime.now(timezone.utc)
    audit(db, "EVIDENCE_VERIFIED", user.id, "EVIDENCE", id)
    db.commit()
    return {"success": True, "data": public(evidence)}


# ---------------------------------------------------------------------------
# Verification Findings Endpoints
# ---------------------------------------------------------------------------
@router.post("/applications/{id}/findings", status_code=201)
def add_finding(
    id: str,
    body: FindingIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*VERIFICATION_ROLES)),
):
    application_for_actor(db, id, user)
    if body.evidence_id:
        ev = db.get(Evidence, body.evidence_id)
        if not ev or ev.application_id != id:
            raise NotFound("Evidence does not belong to this application")

    finding = VerificationFinding(
        application_id=id,
        evidence_id=body.evidence_id,
        category=body.category,
        severity=body.severity,
        status="OPEN",
        description=body.description,
        expected_value=body.expected_value,
        observed_value=body.observed_value,
        created_by=user.id,
    )
    db.add(finding)
    db.flush()
    audit(
        db,
        "VERIFICATION_FINDING_RECORDED",
        user.id,
        "VERIFICATION_FINDING",
        finding.id,
        {"category": body.category, "severity": body.severity},
    )
    db.commit()
    return {"success": True, "data": public(finding)}


@router.get("/applications/{id}/findings")
def list_findings(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    application_for_actor(db, id, user)
    rows = db.scalars(
        select(VerificationFinding)
        .where(VerificationFinding.application_id == id)
        .order_by(VerificationFinding.created_at)
    ).all()
    return {"success": True, "data": [public(r) for r in rows]}


@router.post("/findings/{id}/resolve")
def resolve_finding(
    id: str,
    body: FindingResolveIn | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*VERIFICATION_ROLES)),
):
    finding = get_or_404(db, VerificationFinding, id)
    application_for_actor(db, finding.application_id, user)
    if finding.status == "RESOLVED":
        raise Conflict("Verification finding is already resolved")
    finding.status = "RESOLVED"
    finding.resolved_by = user.id
    finding.resolved_at = datetime.now(timezone.utc)
    audit(
        db,
        "VERIFICATION_FINDING_RESOLVED",
        user.id,
        "VERIFICATION_FINDING",
        id,
        {"reason": body.reason if body else None},
    )
    db.commit()
    return {"success": True, "data": public(finding)}


@router.get("/findings/{id}")
def get_finding(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    finding = get_or_404(db, VerificationFinding, id)
    application_for_actor(db, finding.application_id, user)
    return {"success": True, "data": public(finding)}


# ---------------------------------------------------------------------------
# Verification Case Endpoints
# ---------------------------------------------------------------------------
@router.post("/verification-cases", status_code=201)
@router.post("/applications/{id}/verification-case", status_code=201)
@router.post("/applications/{id}/verification-cases", status_code=201)
def open_verification_case(
    id: str | None = None,
    body: CaseCreateIn | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*VERIFICATION_ROLES)),
):
    app_id = id or (body.application_id if body else None)
    if not app_id:
        raise Conflict("application_id is required")
    app = application_for_actor(db, app_id, user)

    case = db.scalar(
        select(VerificationCase).where(VerificationCase.application_id == app_id)
    )
    if case:
        if case.status == "COMPLETED":
            case.status = "OPEN"
            case.completed_at = None
            case.opened_at = datetime.now(timezone.utc)
        if body and body.priority:
            case.priority = body.priority
        if body and body.assigned_to:
            case.assigned_to = body.assigned_to
        db.commit()
        return {"success": True, "data": public(case)}

    priority = body.priority if body else "MEDIUM"
    assigned_to = body.assigned_to if body else None
    case = VerificationCase(
        application_id=app_id,
        assigned_to=assigned_to,
        status="OPEN",
        priority=priority,
        opened_at=datetime.now(timezone.utc),
    )
    db.add(case)
    db.flush()
    audit(
        db,
        "VERIFICATION_CASE_OPENED",
        user.id,
        "VERIFICATION_CASE",
        case.id,
        {"application_id": app_id, "priority": priority},
    )
    db.commit()
    return {"success": True, "data": public(case)}


@router.get("/verification-cases")
def list_verification_queue(
    status: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*VERIFICATION_ROLES)),
):
    query = select(VerificationCase)
    if status:
        query = query.where(VerificationCase.status == status)
    cases = db.scalars(query.order_by(VerificationCase.opened_at.desc())).all()
    results = []
    for c in cases:
        app = db.get(Application, c.application_id)
        assignee = db.get(User, c.assigned_to) if c.assigned_to else None
        d = public(c)
        d["application_number"] = app.application_number if app else None
        d["assignee_name"] = assignee.full_name if assignee else None
        results.append(d)
    return {"success": True, "data": results}


@router.get("/verification-cases/{id}")
def get_verification_case(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*VERIFICATION_ROLES)),
):
    case = get_or_404(db, VerificationCase, id)
    return {"success": True, "data": public(case)}


@router.get("/applications/{id}/verification-case")
def get_application_verification_case(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    application_for_actor(db, id, user)
    case = db.scalar(
        select(VerificationCase).where(VerificationCase.application_id == id)
    )
    return {"success": True, "data": public(case) if case else None}


@router.post("/verification-cases/{id}/assign")
def assign_verification_case(
    id: str,
    body: CaseAssignIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*VERIFICATION_ROLES)),
):
    case = get_or_404(db, VerificationCase, id)
    assignee = get_or_404(db, User, body.assignee_id)
    case.assigned_to = assignee.id
    if case.status == "OPEN":
        case.status = "IN_PROGRESS"
    audit(
        db,
        "VERIFICATION_CASE_ASSIGNED",
        user.id,
        "VERIFICATION_CASE",
        id,
        {"assigned_to": assignee.id},
    )
    db.commit()
    return {"success": True, "data": public(case)}


@router.post("/verification-cases/{id}/complete")
def complete_verification_case(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*VERIFICATION_ROLES)),
):
    case = get_or_404(db, VerificationCase, id)
    if case.status == "COMPLETED":
        raise Conflict("Verification case is already completed")
    case.status = "COMPLETED"
    case.completed_at = datetime.now(timezone.utc)
    audit(db, "VERIFICATION_CASE_COMPLETED", user.id, "VERIFICATION_CASE", id)
    db.commit()
    return {"success": True, "data": public(case)}


@router.post("/verification-cases/{id}/return")
def return_verification_case(
    id: str,
    body: CaseReturnIn | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*VERIFICATION_ROLES)),
):
    case = get_or_404(db, VerificationCase, id)
    case.status = "RETURNED"
    audit(
        db,
        "VERIFICATION_CASE_RETURNED",
        user.id,
        "VERIFICATION_CASE",
        id,
        {"reason": body.reason if body else None},
    )
    db.commit()
    return {"success": True, "data": public(case)}


# ---------------------------------------------------------------------------
# Decision Trace Endpoints
# ---------------------------------------------------------------------------
@router.post("/applications/{id}/decision-traces", status_code=201)
@router.post("/decision-traces", status_code=201)
def create_trace_endpoint(
    id: str | None = None,
    body: DecisionTraceIn | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*VERIFICATION_ROLES)),
):
    if body is None:
        raise Conflict("Decision trace payload is required")
    application_id = id or body.input_snapshot.get("application_id")
    if not application_id:
        raise Conflict("application_id is required")
    application_for_actor(db, application_id, user)

    if body.scheme_version_id is None:
        application = db.get(Application, application_id)
        body.scheme_version_id = application.scheme_version_id if application else None

    trace = create_decision_trace(
        db,
        application_id=application_id,
        decision_type=body.decision_type,
        decision_status=body.decision_status,
        scheme_version_id=body.scheme_version_id,
        policy_version=body.policy_version,
        input_snapshot=body.input_snapshot,
        reason=body.reason,
        actor_id=user.id,
        steps=[s.model_dump() for s in body.steps],
    )
    db.commit()
    result = public(trace)
    result["steps"] = [
        public(s)
        for s in db.scalars(
            select(DecisionStep)
            .where(DecisionStep.decision_trace_id == trace.id)
            .order_by(DecisionStep.step_order)
        ).all()
    ]
    return {"success": True, "data": result}


@router.get("/applications/{id}/decision-traces")
def get_application_decision_traces(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    application_for_actor(db, id, user)
    traces = db.scalars(
        select(DecisionTrace)
        .where(DecisionTrace.application_id == id)
        .order_by(desc(DecisionTrace.created_at))
    ).all()
    results = []
    for t in traces:
        steps = db.scalars(
            select(DecisionStep)
            .where(DecisionStep.decision_trace_id == t.id)
            .order_by(DecisionStep.step_order)
        ).all()
        item = public(t)
        item["steps"] = [public(s) for s in steps]
        results.append(item)
    return {"success": True, "data": results}


@router.get("/decision-traces/{id}")
def get_decision_trace(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    trace = get_or_404(db, DecisionTrace, id)
    application_for_actor(db, trace.application_id, user)
    steps = db.scalars(
        select(DecisionStep)
        .where(DecisionStep.decision_trace_id == trace.id)
        .order_by(DecisionStep.step_order)
    ).all()
    result = public(trace)
    result["steps"] = [public(s) for s in steps]
    return {"success": True, "data": result}


# ---------------------------------------------------------------------------
# Duplicate & Fraud-Ready Checks
# ---------------------------------------------------------------------------
def run_duplicate_checks(db: Session, application_id: str, persist: bool = False, actor_id: str | None = None) -> list[dict[str, Any]]:
    application = get_or_404(db, Application, application_id)
    applicant = db.get(Applicant, application.applicant_id) if application.applicant_id else None
    findings = []

    # 1. Overlapping applications for same applicant
    if application.applicant_id:
        overlapping = db.scalars(
            select(Application).where(
                Application.applicant_id == application.applicant_id,
                Application.id != application.id,
                Application.status.notin_(["REJECTED", "WITHDRAWN"]),
            )
        ).all()
        for other in overlapping:
            if other.scheme_id == application.scheme_id or other.cycle == application.cycle:
                desc = f"Applicant has another active application ({other.application_number}) for scheme '{other.scheme_id}' in cycle '{other.cycle}'."
                findings.append({
                    "finding_type": "POTENTIAL_DUPLICATE",
                    "category": "APPLICATION_OVERLAP",
                    "severity": "HIGH",
                    "matched_field": "applicant_id",
                    "matched_value": application.applicant_id,
                    "related_application_id": other.id,
                    "reason": desc,
                    "description": desc,
                    "observed_values": {
                        "conflicting_application_id": other.id,
                        "conflicting_application_number": other.application_number,
                        "scheme_id": other.scheme_id,
                        "cycle": other.cycle,
                    },
                    "affected_applications": [other.id],
                    "affected_applicants": [application.applicant_id],
                })

    # 2. Aadhaar / Identity hash duplication across different applicants
    aadhaar_hash = applicant.profile.get("aadhaar_hash") if applicant and applicant.profile else None
    if aadhaar_hash:
        matched_applicants = db.scalars(
            select(Applicant).where(
                Applicant.id != applicant.id
            )
        ).all()
        for other_app in matched_applicants:
            if other_app.profile and other_app.profile.get("aadhaar_hash") == aadhaar_hash:
                desc = f"Identity/Aadhaar hash matches another applicant profile ({other_app.profile.get('full_name', other_app.id)})."
                findings.append({
                    "finding_type": "POTENTIAL_DUPLICATE",
                    "category": "IDENTITY_DUPLICATE",
                    "severity": "CRITICAL",
                    "matched_field": "aadhaar_hash",
                    "matched_value": aadhaar_hash,
                    "related_application_id": None,
                    "reason": desc,
                    "description": desc,
                    "observed_values": {
                        "matched_applicant_id": other_app.id,
                        "matched_applicant_name": other_app.profile.get('full_name'),
                        "aadhaar_hash": aadhaar_hash,
                    },
                    "affected_applications": [],
                    "affected_applicants": [other_app.id],
                })

    # 3. Bank account duplication across different applicants / applications
    bank_account_number = applicant.profile.get("bank_account_number") if applicant and applicant.profile else None
    if not bank_account_number and application.answers:
        bank_account_number = application.answers.get("bank_account_number")
    if bank_account_number:
        matched_bank = db.scalars(
            select(Applicant).where(
                Applicant.id != applicant.id,
            )
        ).all()
        for other_app in matched_bank:
            if other_app.profile and other_app.profile.get("bank_account_number") == bank_account_number:
                desc = f"Bank account number matches another applicant profile ({other_app.profile.get('full_name', other_app.id)})."
                findings.append({
                    "finding_type": "POTENTIAL_DUPLICATE",
                    "category": "BANK_ACCOUNT_DUPLICATE",
                    "severity": "HIGH",
                    "matched_field": "bank_account_number",
                    "matched_value": str(bank_account_number),
                    "related_application_id": None,
                    "reason": desc,
                    "description": desc,
                    "observed_values": {
                        "matched_applicant_id": other_app.id,
                        "bank_account_number": str(bank_account_number),
                        "ifsc": applicant.profile.get("bank_ifsc_code") if applicant and applicant.profile else None,
                    },
                    "affected_applications": [],
                    "affected_applicants": [other_app.id],
                })
        # Check other applications answers
        other_apps = db.scalars(
            select(Application).where(
                Application.id != application.id,
                Application.applicant_id != application.applicant_id,
                Application.status.notin_(["REJECTED", "WITHDRAWN", "CLOSED"]),
            )
        ).all()
        for oa in other_apps:
            if oa.answers and str(oa.answers.get("bank_account_number")) == str(bank_account_number):
                desc = f"Bank account number matches another application ({oa.application_number})."
                findings.append({
                    "finding_type": "POTENTIAL_DUPLICATE",
                    "category": "BANK_ACCOUNT_DUPLICATE",
                    "severity": "HIGH",
                    "matched_field": "bank_account_number",
                    "matched_value": str(bank_account_number),
                    "related_application_id": oa.id,
                    "reason": desc,
                    "description": desc,
                    "observed_values": {
                        "matched_application_id": oa.id,
                        "matched_application_number": oa.application_number,
                        "bank_account_number": str(bank_account_number),
                    },
                    "affected_applications": [oa.id],
                    "affected_applicants": [oa.applicant_id],
                })

    # 4. Duplicate document sha256 hash across different applications
    docs = db.scalars(select(Document).where(Document.application_id == application.id)).all()
    for doc in docs:
        if doc.sha256:
            matching_docs = db.scalars(
                select(Document).where(
                    Document.sha256 == doc.sha256,
                    Document.application_id.is_not(None),
                    Document.application_id != application.id,
                )
            ).all()
            for other_doc in matching_docs:
                desc = f"Uploaded document '{doc.filename}' (sha256: {doc.sha256[:12]}...) is identical to document in application {other_doc.application_id}."
                findings.append({
                    "finding_type": "POTENTIAL_DUPLICATE",
                    "category": "DOCUMENT_HASH_DUPLICATE",
                    "severity": "MEDIUM",
                    "matched_field": "sha256",
                    "matched_value": doc.sha256,
                    "related_application_id": other_doc.application_id,
                    "reason": desc,
                    "description": desc,
                    "observed_values": {
                        "document_id": doc.id,
                        "document_type": doc.document_type,
                        "conflicting_document_id": other_doc.id,
                        "conflicting_application_id": other_doc.application_id,
                        "sha256": doc.sha256,
                    },
                    "affected_applications": [other_doc.application_id],
                    "affected_applicants": [],
                })

    # 5. Shared contact info (phone/email) across different user accounts
    if applicant and getattr(applicant, "user_id", None):
        u = db.get(User, applicant.user_id)
        if u:
            phone_val = getattr(u, "phone", None)
            conditions = []
            if getattr(u, "email", None):
                conditions.append(User.email == u.email)
            if phone_val:
                conditions.append(User.phone == phone_val)
            if conditions:
                matched_users = db.scalars(
                    select(User).where(
                        or_(*conditions),
                        User.id != u.id,
                    )
                ).all()
                for other_user in matched_users:
                    desc = f"Contact information matches another registered user account ({getattr(other_user, 'email', other_user.id)})."
                    findings.append({
                        "finding_type": "POTENTIAL_DUPLICATE",
                        "category": "CONTACT_DUPLICATE",
                        "severity": "MEDIUM",
                        "matched_field": "email" if getattr(other_user, 'email', None) == getattr(u, 'email', None) else "phone",
                        "matched_value": getattr(other_user, 'email', None) or getattr(other_user, "phone", None),
                        "related_application_id": None,
                        "reason": desc,
                        "description": desc,
                        "observed_values": {
                            "matched_user_id": other_user.id,
                            "email": getattr(other_user, 'email', None),
                            "phone": getattr(other_user, "phone", None),
                        },
                        "affected_applications": [],
                        "affected_applicants": [other_user.id],
                    })

    if persist and findings:
        for f in findings:
            existing = db.scalar(
                select(VerificationFinding).where(
                    VerificationFinding.application_id == application.id,
                    VerificationFinding.category == f["category"],
                    VerificationFinding.description == f["description"],
                )
            )
            if not existing:
                vf = VerificationFinding(
                    application_id=application.id,
                    category=f["category"],
                    severity=f["severity"],
                    status="OPEN",
                    description=f["description"],
                    observed_value=f["observed_values"],
                    created_by=actor_id or "SYSTEM",
                )
                db.add(vf)
        db.commit()

    return findings


@router.post("/applications/{id}/check-duplicates")
def trigger_duplicate_check(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*STAFF_READ_ROLES)),
):
    application_for_actor(db, id, user)
    findings = run_duplicate_checks(db, id, persist=True, actor_id=user.id)
    audit(db, "DUPLICATE_CHECK_PERFORMED", user.id, "APPLICATION", id, {"total_flags": len(findings)})
    db.commit()
    return {"success": True, "data": {"total_flags": len(findings), "findings": findings}}


@router.get("/applications/{id}/duplicate-checks")
def get_duplicate_checks(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*STAFF_READ_ROLES)),
):
    application_for_actor(db, id, user)
    findings = run_duplicate_checks(db, id, persist=False, actor_id=user.id)
    return {"success": True, "data": findings}
