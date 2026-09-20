"""Shared application status transition helper.

Every router path that moves an application from one state to another should
call :func:`move_application_status` so the transition is validated against the
scheme workflow (when one is configured for the version), recorded in
``ApplicationStatusHistory``, and written to the audit log exactly once.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.errors import InvalidTransition
from app.domain.models import Application
from app.domain.relational_models import ApplicationStatusHistory, SchemeWorkflow


def resolve_transitions(db: Session, application: Application) -> list[dict]:
    flow = db.scalar(select(SchemeWorkflow).where(SchemeWorkflow.scheme_version_id == application.scheme_version_id))
    definition = flow.definition if flow else {}
    return definition.get("transitions", [])


def assert_transition_allowed(db: Session, application: Application, to_status: str) -> None:
    """Raise ``InvalidTransition`` when the configured workflow covers the
    application's current state but does not allow the requested target.

    Versions without a configured workflow, or whose current state is not
    modelled at all, are treated as free-form (backwards compatibility for
    legacy/seed data).
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


def move_application_status(
    db: Session,
    application: Application,
    to_status: str,
    actor_id: str,
    reason: str,
    event: str = "STATUS_TRANSITION",
) -> Application:
    assert_transition_allowed(db, application, to_status)
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
    audit(db, event, actor_id, "APPLICATION", application.id, {"from": old_status, "to": to_status, "reason": reason})
    return application