import hashlib, json
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.errors import Conflict
from app.domain.relational_models import IdempotencyRecord
def request_hash(payload:dict|None): return hashlib.sha256(json.dumps(payload or {},sort_keys=True,default=str).encode()).hexdigest()
def get_or_create(db:Session,key,user_id,route,payload):
    digest=request_hash(payload); existing=db.scalar(select(IdempotencyRecord).where(IdempotencyRecord.key==key,IdempotencyRecord.user_id==user_id,IdempotencyRecord.route==route))
    if existing:
        if existing.request_hash!=digest: raise Conflict("Idempotency key was reused with a different request")
        return existing
    record=IdempotencyRecord(key=key,user_id=user_id,route=route,request_hash=digest); db.add(record); db.flush(); return record
def complete(record,status_code,response): record.status_code=status_code; record.response=response
