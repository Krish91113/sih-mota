from datetime import datetime, timedelta, timezone
from hashlib import sha256
import hmac as hmac_mod
import secrets
import uuid

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, EmailStr
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import Conflict, Unauthorized
from app.core.permissions import current_user
from app.core.security import create_token, hash_password, verify_password
from app.domain.models import Applicant, User
from app.domain.relational_models import EmailOtpChallenge
from app.rbac.models import Role, SessionRecord, RolePermission, Permission, UserRole
from app.integrations.notification_providers import get_email_provider

router = APIRouter(prefix="/auth", tags=["Authentication"])

class Register(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class Login(BaseModel):
    email: EmailStr
    password: str

class Refresh(BaseModel):
    refresh_token: str

class OtpRequest(BaseModel):
    email: EmailStr
    purpose: str = "login"

class OtpVerify(BaseModel):
    email: EmailStr
    otp: str
    purpose: str = "login"

class ChangePassword(BaseModel):
    new_password: str

OTP_TTL = timedelta(minutes=5)
OTP_PURPOSES = {"registration", "login", "password_reset"}
OTP_RESEND_COOLDOWN = timedelta(seconds=60)
OTP_MAX_ATTEMPTS = 5


def _normal_email(value: str) -> str:
    return value.strip().lower()


def _hmac_otp(code: str) -> str:
    secret = get_settings().jwt_secret.encode()
    return hmac_mod.new(secret, code.encode(), sha256).hexdigest()


def _check_rate_limit(db: Session, email: str, purpose: str) -> None:
    recent = db.scalar(
        select(EmailOtpChallenge)
        .where(EmailOtpChallenge.email == email, EmailOtpChallenge.purpose == purpose)
        .order_by(desc(EmailOtpChallenge.created_at))
    )
    if recent:
        age = datetime.now(timezone.utc) - recent.created_at.replace(tzinfo=timezone.utc)
        if age < OTP_RESEND_COOLDOWN:
            remaining = int((OTP_RESEND_COOLDOWN - age).total_seconds())
            raise Conflict(f"Please wait {remaining} seconds before requesting another code")


def _invalidate_old_challenges(db: Session, email: str, purpose: str) -> None:
    from sqlalchemy import update
    db.execute(
        update(EmailOtpChallenge)
        .where(
            EmailOtpChallenge.email == email,
            EmailOtpChallenge.purpose == purpose,
            EmailOtpChallenge.used_at.is_(None),
        )
        .values(used_at=datetime.now(timezone.utc))
    )


def _new_otp(db: Session, email: str, purpose: str, payload: dict) -> str:
    _check_rate_limit(db, email, purpose)
    _invalidate_old_challenges(db, email, purpose)
    code = f"{secrets.randbelow(1_000_000):06d}"
    row = EmailOtpChallenge(
        email=_normal_email(email),
        purpose=purpose,
        code_hash=_hmac_otp(code),
        expires_at=datetime.now(timezone.utc) + OTP_TTL,
        payload=payload,
    )
    db.add(row)
    db.flush()
    return code


async def _send_otp(email: str, code: str, purpose: str) -> None:
    labels = {"registration": "complete your registration", "login": "sign in", "password_reset": "reset your password"}
    subject = "MoTA Scholarship Portal verification code"
    body = (
        f"Your MoTA Scholarship Portal OTP is {code}.\n\n"
        f"Use this code to {labels.get(purpose, 'verify your account')}. "
        "It expires in 5 minutes. Do not share this code with anyone."
    )
    result = await get_email_provider().send(email, subject, body)
    if not result.accepted:
        raise Conflict("Unable to send the verification email")


async def _issue_otp(db: Session, email: str, purpose: str, payload: dict) -> None:
    code = _new_otp(db, email, purpose, payload)
    db.commit()
    await _send_otp(email, code, purpose)


@router.post("/register", status_code=202)
async def register(body: Register, db: Session = Depends(get_db)):
    email = _normal_email(body.email)
    if db.scalar(select(User).where(User.email == email)):
        raise Conflict("Email is already registered")
    await _issue_otp(db, email, "registration", {"full_name": body.full_name, "password_hash": hash_password(body.password)})
    return {"success": True, "data": {"email": email, "otp_required": True}}


@router.post("/request-otp", status_code=202)
async def request_otp(body: OtpRequest, db: Session = Depends(get_db)):
    purpose = body.purpose if body.purpose in OTP_PURPOSES else "login"
    email = _normal_email(body.email)
    user = db.scalar(select(User).where(User.email == email))
    if purpose == "registration" and user:
        raise Conflict("Email is already registered")
    if purpose in {"login", "password_reset"} and not user:
        raise Unauthorized("If an account with this email exists, a verification code has been sent.")
    await _issue_otp(db, email, purpose, {"user_id": user.id} if user else {})
    return {"success": True, "data": {"email": email, "otp_sent": True, "expires_in": 300}}


@router.post("/login")
def login(body: Login, db: Session = Depends(get_db)):
    email = _normal_email(body.email)
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(body.password, user.password_hash):
        raise Unauthorized("Invalid credentials")
    return _create_session(db, user)


def _create_session(db: Session, user: User):
    session_id = str(uuid.uuid4())
    refresh = create_token(user.id, user.role, "refresh", session_id)
    db.add(SessionRecord(id=session_id, user_id=user.id, refresh_token_hash=sha256(refresh.encode()).hexdigest(), expires_at=datetime.now(timezone.utc) + timedelta(days=14)))
    audit(db, "LOGIN", user.id, "USER", user.id)
    db.commit()
    return {"success": True, "data": {"access_token": create_token(user.id, user.role, "access", session_id), "refresh_token": refresh, "session_id": session_id, "token_type": "bearer"}}


@router.post("/verify-otp")
def verify_otp(body: OtpVerify, db: Session = Depends(get_db)):
    email = _normal_email(body.email)
    challenge = db.scalar(select(EmailOtpChallenge).where(EmailOtpChallenge.email == email, EmailOtpChallenge.purpose == body.purpose, EmailOtpChallenge.used_at.is_(None)).order_by(desc(EmailOtpChallenge.created_at)))
    now = datetime.now(timezone.utc)
    if not challenge or challenge.expires_at < now or challenge.attempts >= OTP_MAX_ATTEMPTS or _hmac_otp(body.otp) != challenge.code_hash:
        if challenge:
            challenge.attempts += 1
            db.commit()
        raise Unauthorized("Invalid or expired verification code")
    challenge.used_at = now
    if body.purpose == "registration":
        if db.scalar(select(User).where(User.email == email)):
            raise Conflict("Email is already registered")
        user = User(email=email, full_name=challenge.payload["full_name"], password_hash=challenge.payload["password_hash"])
        db.add(user)
        db.flush()
        db.add(Applicant(user_id=user.id))
    else:
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            raise Unauthorized("Invalid or expired verification code")
    return _create_session(db, user)


@router.post("/resend-otp", status_code=202)
async def resend_otp(body: OtpRequest, db: Session = Depends(get_db)):
    return await request_otp(body, db)


@router.get("/me")
def me(user=Depends(current_user), db: Session = Depends(get_db)):
    roles = [r.name for r in db.scalars(select(Role).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == user.id)).all()]
    if user.role and user.role not in roles:
        roles.insert(0, user.role)
    permissions = list({f"{p.resource}:{p.action}:{p.scope}" for p in db.scalars(select(Permission).join(RolePermission, RolePermission.permission_id == Permission.id).join(UserRole, UserRole.role_id == RolePermission.role_id).where(UserRole.user_id == user.id)).all()})
    return {"success": True, "data": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "roles": roles, "permissions": permissions}}


@router.post("/refresh")
def refresh(body: Refresh, db: Session = Depends(get_db)):
    from app.core.security import decode_token
    claims = decode_token(body.refresh_token)
    if claims.get("type") != "refresh":
        raise Unauthorized("Refresh token required")
    user = db.get(User, claims.get("sub"))
    if not user or not user.is_active:
        raise Unauthorized("User does not exist or is inactive")
    session_id = claims.get("sid")
    if not session_id:
        raise Unauthorized("Invalid refresh token: missing session")
    session = db.get(SessionRecord, session_id)
    if not session:
        raise Unauthorized("Session not found")
    if session.revoked_at:
        raise Unauthorized("Session has been revoked")
    expires = session.expires_at
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires < datetime.now(timezone.utc):
        raise Unauthorized("Session has expired")
    presented_hash = sha256(body.refresh_token.encode()).hexdigest()
    if session.refresh_token_hash != presented_hash:
        raise Unauthorized("Invalid refresh token")
    new_refresh = create_token(user.id, user.role, "refresh", session_id)
    session.refresh_token_hash = sha256(new_refresh.encode()).hexdigest()
    audit(db, "TOKEN_REFRESHED", user.id, "SESSION", session_id)
    db.commit()
    return {"success": True, "data": {"access_token": create_token(user.id, user.role, "access", session_id), "refresh_token": new_refresh, "token_type": "bearer"}}


@router.post("/logout")
def logout(user=Depends(current_user), db: Session = Depends(get_db), refresh_token: str | None = None):
    if refresh_token:
        from app.core.security import decode_token
        try:
            claims = decode_token(refresh_token)
            sid = claims.get("sid")
            if sid:
                session = db.get(SessionRecord, sid)
                if session and session.user_id == user.id:
                    session.revoked_at = datetime.now(timezone.utc)
        except Exception:
            pass
    else:
        sessions_to_revoke = db.scalars(
            select(SessionRecord).where(SessionRecord.user_id == user.id, SessionRecord.revoked_at.is_(None))
        ).all()
        for s in sessions_to_revoke:
            s.revoked_at = datetime.now(timezone.utc)
    audit(db, "LOGOUT", user.id)
    db.commit()
    return {"success": True, "data": None}


@router.post("/forgot-password", status_code=202)
async def forgot_password(body: OtpRequest, db: Session = Depends(get_db)):
    body.purpose = "password_reset"
    return await request_otp(body, db)


@router.post("/reset-password")
def reset_password():
    raise Conflict("Reset password requires OTP verification; use /auth/verify-otp with purpose password_reset")


@router.post("/change-password")
def change_password(body: ChangePassword, user=Depends(current_user), db: Session = Depends(get_db), authorization: str | None = Header(default=None)):
    if len(body.new_password) < 8:
        raise Conflict("Password must be at least 8 characters long")
    user.password_hash = hash_password(body.new_password)
    audit(db, "PASSWORD_CHANGED", user.id, "USER", user.id)
    keep_session_id = None
    if authorization and authorization.lower().startswith("bearer "):
        from app.core.security import decode_token
        try:
            keep_session_id = decode_token(authorization[7:].strip()).get("sid")
        except Exception:
            keep_session_id = None
    active = db.scalars(
        select(SessionRecord).where(SessionRecord.user_id == user.id, SessionRecord.revoked_at.is_(None))
    ).all()
    revoked = 0
    for s in active:
        if s.id != keep_session_id:
            s.revoked_at = datetime.now(timezone.utc)
            revoked += 1
    db.commit()
    return {"success": True, "data": {"changed": True, "other_sessions_revoked": revoked}}


@router.get("/sessions")
def sessions(user=Depends(current_user), db: Session = Depends(get_db)):
    return {"success": True, "data": [{"id": x.id, "created_at": x.created_at, "expires_at": x.expires_at, "revoked_at": x.revoked_at} for x in db.scalars(select(SessionRecord).where(SessionRecord.user_id == user.id)).all()]}


@router.post("/sessions/{session_id}/revoke")
def revoke_session(session_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(SessionRecord).where(SessionRecord.id == session_id, SessionRecord.user_id == user.id))
    if not row:
        raise Unauthorized("Session not found")
    row.revoked_at = datetime.now(timezone.utc)
    audit(db, "SESSION_REVOKED", user.id, "SESSION", session_id)
    db.commit()
    return {"success": True, "data": {"revoked": session_id}}
