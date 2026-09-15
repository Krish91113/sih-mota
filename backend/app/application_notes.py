"""Persistent application notes with ownership, assignment, and visibility checks."""
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.database import get_db
from app.core.errors import Forbidden, NotFound
from app.core.permissions import current_user
from app.domain.models import Applicant, Application
from app.domain.relational_models import ApplicationAssignment, ApplicationNote
from app.rbac.models import UserScope
from app.rbac.service import ResourceContext, has_permission

router = APIRouter(tags=["Application Notes"])

# These roles may inspect internal workflow notes. Applicants are deliberately
# excluded; their access is handled only through ownership and public notes.
_INTERNAL_NOTE_ROLES = {
    "SUPER_ADMIN",
    "SCRUTINY_OFFICER",
    "VERIFICATION_OFFICER",
    "APPROVING_AUTHORITY",
    "AUDITOR",
    "MONITORING_ANALYST",
    "GRIEVANCE_OFFICER",
}
_MANAGE_ALL_ROLES = {"SUPER_ADMIN", "AUDITOR"}


class NoteIn(BaseModel):
    note: str | None = Field(default=None, min_length=1, max_length=10000)
    content: str | None = Field(default=None, min_length=1, max_length=10000)
    internal: bool = False

    @model_validator(mode="after")
    def require_note(self):
        if not (self.note or self.content):
            raise ValueError("note is required")
        return self

    @property
    def text(self) -> str:
        return self.note or self.content  # type: ignore[return-value]


def _application(db: Session, application_id: str) -> Application:
    row = db.get(Application, application_id)
    if row is None:
        raise NotFound("Application not found")
    return row


def _assigned(db: Session, application_id: str, user_id: str) -> bool:
    return bool(
        db.scalar(
            select(ApplicationAssignment.id).where(
                ApplicationAssignment.application_id == application_id,
                ApplicationAssignment.assignee_id == user_id,
                or_(
                    ApplicationAssignment.status.is_(None),
                    ApplicationAssignment.status == "ACTIVE",
                ),
            )
        )
        or db.scalar(
            select(UserScope.id).where(
                UserScope.user_id == user_id,
                UserScope.scope_type == "ASSIGNED",
                UserScope.scope_value == application_id,
            )
        )
    )


def _can_access(db: Session, application: Application, user: Any) -> bool:
    applicant = db.get(Applicant, application.applicant_id)
    if applicant and applicant.user_id == user.id:
        return True
    if user.role == "SUPER_ADMIN":
        return True
    context = ResourceContext(
        owner_id=applicant.user_id if applicant else None,
        scheme_id=application.scheme_id,
    )
    if has_permission(db, user.id, "APPLICATION:MANAGE:ANY", context):
        return True
    if has_permission(db, user.id, "APPLICATION:READ:SCHEME", context):
        return True
    if _assigned(db, application.id, user.id) and (
        user.role in _INTERNAL_NOTE_ROLES
        or has_permission(
            db,
            user.id,
            "APPLICATION:READ:ASSIGNED",
            {"assignment_id": application.id},
        )
        or has_permission(
            db,
            user.id,
            "APPLICATION:REVIEW:ASSIGNED",
            {"assignment_id": application.id},
        )
    ):
        return True
    return False


def _can_write(db: Session, application: Application, user: Any) -> bool:
    if user.role in _MANAGE_ALL_ROLES:
        return True
    if user.role == "SUPER_ADMIN":
        return True
    applicant = db.get(Applicant, application.applicant_id)
    if applicant and applicant.user_id == user.id:
        return has_permission(
            db, user.id, "APPLICATION:WRITE:OWN", ResourceContext(owner_id=user.id)
        ) or user.role == "APPLICANT"
    return _can_access(db, application, user) and (
        user.role in _INTERNAL_NOTE_ROLES
        or has_permission(db, user.id, "APPLICATION:REVIEW:ASSIGNED", {"assignment_id": application.id})
    )


def _visible(note: ApplicationNote, user: Any) -> bool:
    return not note.internal or user.role in _INTERNAL_NOTE_ROLES or user.role == "SUPER_ADMIN"


def _data(note: ApplicationNote) -> dict[str, Any]:
    return {
        "id": note.id,
        "application_id": note.application_id,
        "author_id": note.author_id,
        "note": note.note,
        "content": note.note,
        "internal": note.internal,
        "created_at": note.created_at,
        "updated_at": note.updated_at,
    }


@router.get("/applications/{id}/notes")
def list_notes(id: str, db: Session = Depends(get_db), user=Depends(current_user)):
    application = _application(db, id)
    if not _can_access(db, application, user):
        raise Forbidden("Application is outside the user's scope")
    query = select(ApplicationNote).where(ApplicationNote.application_id == id)
    if user.role not in _INTERNAL_NOTE_ROLES and user.role != "SUPER_ADMIN":
        query = query.where(ApplicationNote.internal.is_(False))
    notes = db.scalars(query.order_by(ApplicationNote.created_at)).all()
    return {"success": True, "data": [_data(note) for note in notes]}


@router.post("/applications/{id}/notes", status_code=201)
def create_note(id: str, body: NoteIn, db: Session = Depends(get_db), user=Depends(current_user)):
    application = _application(db, id)
    if not _can_write(db, application, user):
        raise Forbidden("Application is outside the user's scope")
    if user.role == "APPLICANT" and body.internal:
        raise Forbidden("Applicants cannot create internal notes")
    note = ApplicationNote(
        application_id=id,
        author_id=user.id,
        note=body.text,
        internal=body.internal,
    )
    db.add(note)
    db.flush()
    audit(db, "APPLICATION_NOTE_CREATED", user.id, "APPLICATION_NOTE", note.id, {"internal": body.internal})
    db.commit()
    return {"success": True, "data": _data(note)}


@router.patch("/application-notes/{id}")
def update_note(id: str, body: NoteIn, db: Session = Depends(get_db), user=Depends(current_user)):
    note = db.get(ApplicationNote, id)
    if note is None:
        raise NotFound("Application note not found")
    application = _application(db, note.application_id)
    if not _can_write(db, application, user) or (note.author_id != user.id and user.role not in _MANAGE_ALL_ROLES and user.role != "SUPER_ADMIN"):
        raise Forbidden("Application note is outside the user's scope")
    if user.role == "APPLICANT" and body.internal:
        raise Forbidden("Applicants cannot create internal notes")
    note.note = body.text
    note.internal = body.internal
    audit(db, "APPLICATION_NOTE_UPDATED", user.id, "APPLICATION_NOTE", id, {"internal": body.internal})
    db.commit()
    return {"success": True, "data": _data(note)}


@router.delete("/application-notes/{id}")
def delete_note(id: str, db: Session = Depends(get_db), user=Depends(current_user)):
    note = db.get(ApplicationNote, id)
    if note is None:
        raise NotFound("Application note not found")
    application = _application(db, note.application_id)
    if not _can_write(db, application, user) or (note.author_id != user.id and user.role not in _MANAGE_ALL_ROLES and user.role != "SUPER_ADMIN"):
        raise Forbidden("Application note is outside the user's scope")
    db.delete(note)
    audit(db, "APPLICATION_NOTE_DELETED", user.id, "APPLICATION_NOTE", id)
    db.commit()
    return {"success": True, "data": {"deleted": True}}
