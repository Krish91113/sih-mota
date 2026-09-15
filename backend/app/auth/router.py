from datetime import datetime, timedelta, timezone
from hashlib import sha256
import secrets
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.database import get_db
from app.core.errors import Conflict, Unauthorized
from app.core.permissions import current_user
from app.core.security import create_token, hash_password, verify_password
from app.domain.models import Applicant, User
from app.domain.relational_models import EmailOtpChallenge
from app.rbac.models import SessionRecord
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


def _normal_email(value: str) -> str:
    return value.strip().lower()


def _new_otp(db: Session, email: str, purpose: str, payload: dict) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    row = EmailOtpChallenge(
        email=_normal_email(email),
        purpose=purpose,
        code_hash=sha256(code.encode()).hexdigest(),
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
        raise Unauthorized("No account exists for this email")
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
    if not challenge or challenge.expires_at < now or challenge.attempts >= 5 or sha256(body.otp.encode()).hexdigest() != challenge.code_hash:
        if challenge:
            challenge.attempts += 1
            db.commit()
        raise Unauthorized("Invalid or expired OTP")
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
            raise Unauthorized("Account does not exist")
    return _create_session(db, user)


@router.post("/resend-otp", status_code=202)
async def resend_otp(body: OtpRequest, db: Session = Depends(get_db)):
    return await request_otp(body, db)


@router.get("/me")
def me(user=Depends(current_user)):
    return {"success": True, "data": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role}}


@router.post("/refresh")
def refresh(body: Refresh, db: Session = Depends(get_db)):
    claims = __import__("app.core.security", fromlist=["decode_token"]).decode_token(body.refresh_token)
    if claims.get("type") != "refresh":
        raise Unauthorized("Refresh token required")
    user = db.get(User, claims["sub"])
    if not user:
        raise Unauthorized("User does not exist")
    return {"success": True, "data": {"access_token": create_token(user.id, user.role, "access", claims.get("sid")), "token_type": "bearer"}}


@router.post("/logout")
def logout(user=Depends(current_user), db: Session = Depends(get_db)):
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
def change_password(body: ChangePassword, user=Depends(current_user), db: Session = Depends(get_db)):
    if len(body.new_password) < 8:
        raise Conflict("Password must be at least 8 characters long")
    user.password_hash = hash_password(body.new_password)
    audit(db, "PASSWORD_CHANGED", user.id, "USER", user.id)
    db.commit()
    return {"success": True, "data": {"changed": True}}


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
