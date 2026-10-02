"""Consent management APIs ensuring data privacy compliance and auditability."""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.access import get_or_404
from app.core.audit import audit
from app.core.database import get_db
from app.core.errors import Conflict, Forbidden
from app.core.permissions import current_user, require_roles
from app.domain.models import Application, User
from app.domain.relational_models import Consent

router = APIRouter(prefix="/consent", tags=["Consent"])


def public(obj: Any) -> dict[str, Any]:
    return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}


class ConsentCreateIn(BaseModel):
    consent_type: str = Field(min_length=1, max_length=80)
    purpose: str = Field(min_length=1, max_length=255)
    policy_version: str = Field(default="1.0", max_length=40)
    scope: str = Field(default="DATA_VERIFICATION", max_length=100)
    granted: bool = True
    application_id: str | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)


class ConsentRevokeIn(BaseModel):
    reason: str | None = None


@router.post("", status_code=201)
def create_consent(
    body: ConsentCreateIn,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    if body.application_id:
        app = db.get(Application, body.application_id)
        if not app:
            raise Conflict("Application not found")

    consent = Consent(
        user_id=user.id,
        application_id=body.application_id,
        consent_type=body.consent_type,
        purpose=body.purpose,
        policy_version=body.policy_version,
        scope=body.scope,
        granted=body.granted,
        evidence=body.evidence,
        version=body.policy_version,
        actor_id=user.id,
        granted_at=datetime.now(timezone.utc),
    )
    db.add(consent)
    db.flush()
    audit(
        db,
        "CONSENT_GRANTED",
        user.id,
        "CONSENT",
        consent.id,
        {
            "consent_type": body.consent_type,
            "purpose": body.purpose,
            "scope": body.scope,
            "policy_version": body.policy_version,
        },
    )
    db.commit()
    return {"success": True, "data": public(consent)}


@router.get("/current")
def get_current_consent(
    consent_type: str | None = None,
    application_id: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    query = select(Consent).where(
        Consent.user_id == user.id,
        Consent.granted.is_(True),
        Consent.revoked_at.is_(None),
    )
    if consent_type:
        query = query.where(Consent.consent_type == consent_type)
    if application_id:
        query = query.where(Consent.application_id == application_id)
    rows = db.scalars(query.order_by(desc(Consent.granted_at))).all()
    return {"success": True, "data": [public(r) for r in rows]}


@router.get("/history")
def get_consent_history(
    user_id: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    target_id = user.id
    if user_id and user_id != user.id:
        if user.role not in ("SUPER_ADMIN", "AUDITOR"):
            raise Forbidden("Cannot view consent history for other users")
        target_id = user_id

    rows = db.scalars(
        select(Consent).where(Consent.user_id == target_id).order_by(desc(Consent.created_at))
    ).all()
    return {"success": True, "data": [public(r) for r in rows]}


@router.get("/{id}")
def get_consent(
    id: str,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    consent = get_or_404(db, Consent, id)
    if consent.user_id != user.id and user.role not in ("SUPER_ADMIN", "AUDITOR"):
        raise Forbidden("Cannot view consent belonging to another user")
    return {"success": True, "data": public(consent)}


@router.post("/{id}/revoke")
def revoke_consent(
    id: str,
    body: ConsentRevokeIn | None = None,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    consent = get_or_404(db, Consent, id)
    if consent.user_id != user.id and user.role != "SUPER_ADMIN":
        raise Forbidden("Cannot revoke consent belonging to another user")
    if consent.revoked_at is not None or not consent.granted:
        raise Conflict("Consent is already revoked")

    consent.granted = False
    consent.revoked_at = datetime.now(timezone.utc)
    reason = body.reason if body else "User requested revocation"
    audit(
        db,
        "CONSENT_REVOKED",
        user.id,
        "CONSENT",
        id,
        {"reason": reason},
    )
    db.commit()
    return {"success": True, "data": public(consent)}
