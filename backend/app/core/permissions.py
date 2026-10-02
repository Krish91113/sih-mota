from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timezone
from .database import get_db
from .security import decode_token
from .errors import Forbidden,Unauthorized
oauth2_scheme=OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
oauth2_optional_scheme=OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
def optional_user(token:str|None=Depends(oauth2_optional_scheme),db:Session=Depends(get_db)):
    if not token: return None
    try:
        from app.domain.models import User
        claims=decode_token(token); user=db.get(User,claims.get("sub"))
        if not user or not user.is_active: return None
        return user
    except Exception:
        return None
def current_user(token:str=Depends(oauth2_scheme),db:Session=Depends(get_db)):
    from app.domain.models import User
    claims=decode_token(token); user=db.get(User,claims.get("sub"))
    if not user or not user.is_active: raise Unauthorized("User is inactive or does not exist")
    if claims.get("sid"):
        from app.rbac.models import SessionRecord
        session=db.get(SessionRecord,claims["sid"])
        expiry=session.expires_at if session else None
        if expiry and expiry.tzinfo is None: expiry=expiry.replace(tzinfo=timezone.utc)
        if not session or session.revoked_at or (expiry and expiry < datetime.now(timezone.utc)): raise Unauthorized("Session is revoked or expired")
    return user
def require_roles(*roles):
    def dependency(user=Depends(current_user)):
        if user.role not in roles and user.role!="SUPER_ADMIN": raise Forbidden("Insufficient permission")
        return user
    return dependency
