from datetime import datetime,timedelta,timezone
import jwt
from pwdlib import PasswordHash
from .config import get_settings
from .errors import Unauthorized
password_hash=PasswordHash.recommended()
def hash_password(value): return password_hash.hash(value)
def verify_password(value,hashed): return password_hash.verify(value,hashed)
def create_token(subject,role,token_type="access",session_id=None):
    s=get_settings(); expiry=timedelta(minutes=s.access_token_minutes) if token_type=="access" else timedelta(days=s.refresh_token_days)
    claims={"sub":subject,"role":role,"type":token_type,"exp":datetime.now(timezone.utc)+expiry}
    if session_id: claims["sid"]=session_id
    return jwt.encode(claims,s.jwt_secret,algorithm=s.jwt_algorithm)
def decode_token(token):
    try: return jwt.decode(token,get_settings().jwt_secret,algorithms=[get_settings().jwt_algorithm])
    except jwt.PyJWTError as exc: raise Unauthorized("Invalid or expired token") from exc
