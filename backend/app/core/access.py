"""Shared resource-ownership guards used across routers.

Centralizes application/document access decisions so that every read/write
path (domain router, relational router, workflow, finance) enforces the same
row-level scoping rules instead of relying on the web client to hide buttons.
"""
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db  # noqa: F401 (re-export convenience)
from app.core.errors import Forbidden, NotFound
from app.domain.models import Applicant, Application, Document, User
from app.domain.relational_models import InstitutionUser
from app.rbac.models import UserScope

# Staff roles may read any application/document within the system. Fine
# grained per-scheme or per-organization restriction is applied on top of
# this set where the resource carries a scheme/institution context.
STAFF_READ_ROLES = {
    "SUPER_ADMIN",
    "SCHEME_MANAGER",
    "VERIFICATION_OFFICER",
    "SCRUTINY_OFFICER",
    "APPROVING_AUTHORITY",
    "FINANCE_OFFICER",
    "AUDITOR",
    "MONITORING_ANALYST",
    "GRIEVANCE_OFFICER",
    "HELPDESK_AGENT",
}
FINANCE_STAFF_READ_ROLES = {"FINANCE_OFFICER", "AUDITOR", "APPROVING_AUTHORITY", "SCHEME_MANAGER", "SUPER_ADMIN"}


def get_or_404(db: Session, cls: Any, ident: str):
    row = db.get(cls, ident)
    if not row:
        raise NotFound(f"{cls.__name__} not found")
    return row


def institution_id_for(db: Session, user: User) -> str | None:
    """Resolve the institution id a nodal officer is linked to (table or scope)."""
    link = db.scalar(select(InstitutionUser).where(InstitutionUser.user_id == user.id))
    if link:
        return link.institution_id
    scope = db.scalar(
        select(UserScope).where(
            UserScope.user_id == user.id,
            UserScope.scope_type.in_(["ORGANIZATION", "ORG", "INSTITUTION"]),
        )
    )
    return scope.scope_value if scope else None


def can_read_application(db: Session, application: Application, user: User) -> bool:
    if user.role in STAFF_READ_ROLES:
        return True
    if user.role == "INSTITUTION_NODAL_OFFICER":
        user_inst_id = institution_id_for(db, user)
        if not user_inst_id:
            return False
        app_inst_id = (application.answers or {}).get("institution_id") or (application.answers or {}).get("institution")
        return app_inst_id is not None and str(user_inst_id) == str(app_inst_id)
    applicant = db.get(Applicant, application.applicant_id)
    return bool(applicant and applicant.user_id == user.id)


def application_for_actor(db: Session, ident: str, user: User) -> Application:
    row = get_or_404(db, Application, ident)
    if not can_read_application(db, row, user):
        raise Forbidden("Application is outside the user's scope")
    return row


def can_read_document(db: Session, document: Document, user: User) -> bool:
    if user.role in STAFF_READ_ROLES:
        return True
    if document.uploaded_by == user.id:
        return True
    if document.application_id:
        application = db.get(Application, document.application_id)
        if application is not None:
            return can_read_application(db, application, user)
    return False


def document_for_actor(db: Session, ident: str, user: User) -> Document:
    row = get_or_404(db, Document, ident)
    if not can_read_document(db, row, user):
        raise Forbidden("Document is outside the user's scope")
    return row