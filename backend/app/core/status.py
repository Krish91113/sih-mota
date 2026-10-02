"""Shared application status transition helper with prerequisite enforcement.

Every router path that moves an application from one state to another should
call :func:`move_application_status` so the transition is validated against the
scheme workflow (when one is configured for the version), prerequisite checks are
satisfied, recorded in ``ApplicationStatusHistory``, audited with hash chain, and
decision-traced where appropriate.
"""
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.errors import Conflict, InvalidTransition
from app.domain.models import Application, Document
from app.domain.relational_models import (
    ApplicationStatusHistory,
    Approval,
    DecisionStep,
    DecisionTrace,
    Deficiency,
    SchemeDocument,
    SchemeWorkflow,
    SelectionCandidate,
    SelectionRound,
    VerificationCase,
)


def resolve_transitions(db: Session, application: Application) -> list[dict]:
    flow = db.scalar(select(SchemeWorkflow).where(SchemeWorkflow.scheme_version_id == application.scheme_version_id))
    definition = flow.definition if flow else {}
    return definition.get("transitions", [])


def assert_transition_allowed(db: Session, application: Application, to_status: str) -> None:
    """Raise ``InvalidTransition`` when the configured workflow covers the
    application's current state but does not allow the requested target.
    """
    transitions = resolve_transitions(db, application)
    if not transitions:
        return
    froms = {t.get("from") for t in transitions}
    if application.status not in froms:
        return
    allowed = {t.get("to") for t in transitions if t.get("from") == application.status}
    if to_status not in allowed:
        raise InvalidTransition(f"Cannot transition from {application.status} to {to_status}")


def validate_prerequisites(db: Session, application: Application, to_status: str) -> None:
    """Validate prerequisites before allowing a transition to sensitive states."""
    if to_status == "ELIGIBILITY_CONFIRMED":
        # 1. Verification case check (if one is open or in-progress)
        case = db.scalar(select(VerificationCase).where(VerificationCase.application_id == application.id))
        if case and case.status in ("OPEN", "IN_PROGRESS", "RETURNED"):
            raise Conflict(f"Prerequisite not satisfied: Verification case is {case.status}")

        # 2. Deficiencies must be resolved
        open_defs = db.scalars(
            select(Deficiency).where(
                Deficiency.application_id == application.id,
                Deficiency.status.in_(["OPEN", "RESPONDED", "UNDER_REVIEW", "REOPENED"]),
            )
        ).all()
        if open_defs:
            raise Conflict(
                f"Prerequisite not satisfied: Application has {len(open_defs)} unresolved deficiency(s)"
            )

        # 3. Required documents must be present and verified
        req_docs = db.scalars(
            select(SchemeDocument).where(
                SchemeDocument.scheme_version_id == application.scheme_version_id,
                SchemeDocument.required.is_(True),
                SchemeDocument.status == "ACTIVE",
            )
        ).all()
        for req in req_docs:
            doc = db.scalar(
                select(Document).where(
                    Document.application_id == application.id,
                    Document.document_type == req.document_code,
                    Document.status.in_(["READY", "VERIFIED", "HUMAN_VERIFIED"]),
                )
            )
            if not doc:
                raise Conflict(f"Prerequisite not satisfied: Required document '{req.label}' is missing or unverified")

    elif to_status == "FINAL_APPROVAL":
        # Selection candidate must exist and round must be finalized
        candidate = db.scalar(select(SelectionCandidate).where(SelectionCandidate.application_id == application.id))
        if not candidate:
            raise Conflict("Prerequisite not satisfied: Application is not enrolled in a selection round")
        round_ = db.get(SelectionRound, candidate.round_id) if candidate else None
        if not round_ or not round_.finalized_at:
            raise Conflict("Prerequisite not satisfied: Selection round is not finalized")

    elif to_status == "AWARDED":
        # Approval decision must be APPROVED
        approval = db.scalar(
            select(Approval).where(
                Approval.application_id == application.id,
                Approval.decision == "APPROVED",
            )
        )
        if not approval:
            raise Conflict("Prerequisite not satisfied: Application does not have an APPROVED decision")

    elif to_status == "COMPLETED":
        award = db.scalar(select(Award).where(Award.application_id == application.id))
        if not award:
            raise Conflict("Prerequisite not satisfied: Application must be awarded before completion")


def move_application_status(
    db: Session,
    application: Application,
    to_status: str,
    actor_id: str,
    reason: str,
    event: str = "STATUS_TRANSITION",
    skip_prerequisites: bool = False,
) -> Application:
    assert_transition_allowed(db, application, to_status)
    if not skip_prerequisites:
        validate_prerequisites(db, application, to_status)

    old_status = application.status
    application.status = to_status
    application.version += 1
    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            from_status=old_status,
            to_status=to_status,
            actor_id=actor_id,
            reason=reason,
        )
    )
    audit(
        db,
        event,
        actor_id,
        "APPLICATION",
        application.id,
        {"from": old_status, "to": to_status, "reason": reason},
    )

    # Automatically create decision trace for key terminal or milestone transitions
    if to_status in ("ELIGIBILITY_CONFIRMED", "FINAL_APPROVAL", "AWARDED", "REJECTED", "WITHDRAWN"):
        trace = DecisionTrace(
            application_id=application.id,
            decision_type="STATUS_TRANSITION",
            decision_status=to_status,
            scheme_version_id=application.scheme_version_id,
            policy_version="1.0",
            input_snapshot={"previous_status": old_status, "new_status": to_status},
            reason=reason,
            actor_id=actor_id,
        )
        db.add(trace)
        db.flush()
        db.add(
            DecisionStep(
                decision_trace_id=trace.id,
                step_order=1,
                step_type="STATUS_CHANGE",
                description=f"Transitioned from {old_status} to {to_status}: {reason}",
                result=to_status,
                actor_id=actor_id,
            )
        )

    return application