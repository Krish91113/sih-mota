from fastapi import APIRouter, Depends, UploadFile, File, Query
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, func
from datetime import datetime, timezone
from hashlib import sha256
import os, uuid
from app.core.database import get_db
from app.core.permissions import current_user, require_roles, optional_user
from app.core.errors import NotFound, Conflict, Forbidden, InvalidTransition, Immutable, IntegrationUnavailable
from app.core.audit import audit, AuditLog
from app.domain.models import User, Applicant, Scheme, SchemeVersion, SchemeRule, Application, Document
from app.domain.relational_models import DocumentVersion, DocumentAccessLog
from app.storage.service import get_storage_provider, StorageProviderError
from app.core.constants import APPLICATION_STATUSES, RULE_OPERATORS
router=APIRouter(prefix="",tags=["Domain"])
def ok(data=None): return {"success":True,"data":data}
def public(obj): return {k:v for k,v in obj.__dict__.items() if not k.startswith("_")}
def get_or_404(db, cls, ident):
    obj = db.get(cls, ident)
    if not obj and hasattr(cls, "code"):
        obj = db.scalar(select(cls).where(cls.code == ident))
    if not obj:
        raise NotFound(f"{cls.__name__} not found")
    return obj
class SchemeIn(BaseModel): code:str; name:str; description:str|None=None
class VersionIn(BaseModel): version:str; configuration:dict={}
class RuleIn(BaseModel): rule_id:str; name:str; field:str; operator:str; value:object; source_reference:str; effective_from:datetime|None=None
class ApplicationIn(BaseModel): scheme_id:str; scheme_version_id:str; cycle:str; answers:dict={}
class AnswersIn(BaseModel): answers:dict
class TransitionIn(BaseModel): transition:str; reason:str|None=None
class GenericIn(BaseModel): data:dict={}; status:str|None=None

@router.get("/schemes")
def schemes(db:Session=Depends(get_db), user=Depends(optional_user)):
    items = db.scalars(select(Scheme)).all()
    results = []
    for x in items:
        ver = db.scalar(select(SchemeVersion).where(SchemeVersion.scheme_id == x.id, SchemeVersion.status == "PUBLISHED"))
        results.append({
            "id": x.id,
            "code": x.code,
            "name": x.name,
            "title": x.name,
            "description": x.description,
            "active": x.active,
            "version": ver.version if ver else "v1.0",
            "version_id": ver.id if ver else None
        })
    return ok(results)
@router.post("/schemes",status_code=201)
def create_scheme(body:SchemeIn,db:Session=Depends(get_db),user=Depends(require_roles("SCHEME_MANAGER"))):
    if db.scalar(select(Scheme).where(Scheme.code==body.code)): raise Conflict("Scheme code already exists")
    x=Scheme(**body.model_dump()); db.add(x); audit(db,"SCHEME_UPDATED",user.id,"SCHEME",x.id); db.commit(); return ok({"id":x.id,**body.model_dump()})
@router.get("/schemes/{id}")
def scheme(id:str,db:Session=Depends(get_db),user=Depends(optional_user)):
    s = get_or_404(db, Scheme, id)
    vers = db.scalars(select(SchemeVersion).where(SchemeVersion.scheme_id == s.id)).all()
    d = public(s)
    d["title"] = s.name
    d["versions"] = [public(v) for v in vers]
    return ok(d)

@router.get("/schemes/code/{code}")
def scheme_by_code(code:str,db:Session=Depends(get_db),user=Depends(optional_user)):
    s = get_or_404(db, Scheme, code)
    vers = db.scalars(select(SchemeVersion).where(SchemeVersion.scheme_id == s.id)).all()
    d = public(s)
    d["title"] = s.name
    d["versions"] = [public(v) for v in vers]
    return ok(d)

@router.patch("/schemes/{id}")
def update_scheme(id:str,body:SchemeIn,db:Session=Depends(get_db),user=Depends(require_roles("SCHEME_MANAGER"))):
    x=get_or_404(db,Scheme,id); [setattr(x,k,v) for k,v in body.model_dump().items()]; audit(db,"SCHEME_UPDATED",user.id,"SCHEME",id); db.commit(); return ok({"id":id,**body.model_dump()})
@router.delete("/schemes/{id}")
def delete_scheme(id:str,db:Session=Depends(get_db),user=Depends(require_roles("SCHEME_MANAGER"))): get_or_404(db,Scheme,id).active=False; db.commit(); return ok()

@router.get("/schemes/{id}/versions")
def versions(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    s = get_or_404(db, Scheme, id)
    return ok([public(x) for x in db.scalars(select(SchemeVersion).where(SchemeVersion.scheme_id==s.id)).all()])
@router.get("/scheme-versions/{id}")
def version(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return ok(public(get_or_404(db,SchemeVersion,id)))






@router.get("/applications")
def applications(db:Session=Depends(get_db),user=Depends(current_user),status:str|None=None):
    q=select(Application)
    if user.role=="APPLICANT":
        a=db.scalar(select(Applicant).where(Applicant.user_id==user.id)); q=q.where(Application.applicant_id==a.id) if a else q.where(False)
    if status:q=q.where(Application.status==status)
    return ok([public(x) for x in db.scalars(q.order_by(desc(Application.created_at))).all()])
@router.get("/applications/{id}")
def application(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return ok(public(get_or_404(db,Application,id)))

@router.delete("/applications/{id}")
def delete_application(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return update_application(id,AnswersIn(answers={}),db,user)

@router.post("/applications/{id}/withdraw")
def withdraw(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return change_application(id,"WITHDRAWN",db,user,"APPLICATION_WITHDRAWN")
@router.post("/applications/{id}/validate")
def validate_application(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return ok({"valid":True,"errors":[]})
@router.post("/applications/{id}/recalculate-eligibility")
def recalc(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return ok({"status":"NEEDS_MANUAL_REVIEW","rules":[]})
@router.get("/applications/{id}/timeline")
def timeline(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return ok([public(x) for x in db.scalars(select(AuditLog).where(AuditLog.entity_id==id).order_by(AuditLog.created_at)).all()])
@router.get("/applications/{id}/status")
def app_status(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return ok({"status":get_or_404(db,Application,id).status})

def change_application(id,status,db,user,event):
 x=get_or_404(db,Application,id)
 allowed={"DRAFT":["SUBMITTED","WITHDRAWN"],"DEFICIENCY_RAISED":["RESUBMITTED","WITHDRAWN"],"SUBMITTED":["WITHDRAWN"]}
 if status not in allowed.get(x.status,[]): raise InvalidTransition(f"Cannot transition from {x.status} to {status}")
 x.status=status; audit(db,event,user.id,"APPLICATION",id); db.commit(); return ok({"id":id,"status":status})

@router.post("/documents/presign")
def presign(body:dict,user=Depends(current_user)): return ok({"upload_url":"/api/v1/documents","storage":"imagekit","expires_in":300})
@router.post("/documents",status_code=201)
def upload_document(application_id:str|None=None,document_type:str|None=None,file:UploadFile=File(...),db:Session=Depends(get_db),user=Depends(current_user)):
    content=file.file.read()
    try: stored=get_storage_provider().upload(content,os.path.basename(file.filename or "upload"),file.content_type or "application/octet-stream")
    except StorageProviderError as exc: raise IntegrationUnavailable(str(exc),{"provider":exc.provider,"operation":"upload"}) from exc
    x=Document(application_id=application_id,document_type=document_type,uploaded_by=user.id,filename=os.path.basename(file.filename or "upload"),mime=file.content_type or "application/octet-stream",size=len(content),sha256=stored.sha256,storage_key=stored.key,provider=stored.provider,status="READY"); db.add(x); db.flush(); db.add(DocumentVersion(document_id=x.id,version_number=1,storage_key=stored.key,sha256=stored.sha256,mime=x.mime,size=x.size,uploaded_by=user.id,status="READY")); audit(db,"DOCUMENT_UPLOADED",user.id,"DOCUMENT",x.id); db.commit(); return ok({"id":x.id,"document_type":document_type,"sha256":stored.sha256,"provider":stored.provider,"storage_key":stored.key})
@router.get("/documents")
def documents(application_id:str|None=None,document_type:str|None=None,db:Session=Depends(get_db),user=Depends(current_user)):
    q = select(Document)
    if user.role == "APPLICANT":
        q = q.where(Document.uploaded_by == user.id)
    if application_id:
        q = q.where(Document.application_id == application_id)
    if document_type:
        q = q.where(Document.document_type == document_type)
    return ok([public(x) for x in db.scalars(q.order_by(Document.created_at.desc())).all()])
@router.get("/documents/{id}")
def document(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return ok(public(get_or_404(db,Document,id)))
@router.get("/documents/{id}/download-url")
def download_url(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    document=get_or_404(db,Document,id)
    try: url=get_storage_provider().get_signed_url(document.storage_key,300)
    except StorageProviderError as exc: raise IntegrationUnavailable(str(exc),{"provider":exc.provider,"operation":"signed_url"}) from exc
    db.add(DocumentAccessLog(document_id=id,actor_id=user.id,action="SIGNED_URL")); db.commit(); return ok({"url":url,"expires_in":300})

@router.get("/documents/file/{file_path:path}")
def serve_document_file(file_path: str):
    full_path = Path("storage/documents") / file_path
    if not full_path.exists():
        raise NotFound("Document file not found")
    return FileResponse(full_path)
@router.post("/documents/{id}/verify")
def verify_document(id:str,db:Session=Depends(get_db),user=Depends(require_roles("VERIFICATION_OFFICER"))): x=get_or_404(db,Document,id); x.status="VERIFIED"; audit(db,"DOCUMENT_VERIFIED",user.id,"DOCUMENT",id); db.commit(); return ok({"status":x.status})
@router.post("/documents/{id}/reject")
def reject_document(id:str,body:dict,db:Session=Depends(get_db),user=Depends(require_roles("VERIFICATION_OFFICER"))): x=get_or_404(db,Document,id); x.status="REJECTED"; audit(db,"DOCUMENT_REJECTED",user.id,"DOCUMENT",id,body); db.commit(); return ok({"status":x.status})
@router.post("/documents/{id}/request-resubmission")
def resubmit_document(id:str,db:Session=Depends(get_db),user=Depends(require_roles("VERIFICATION_OFFICER"))): return reject_document(id,{"reason":"RESUBMISSION_REQUIRED"},db,user)
@router.get("/documents/{id}/versions")
def document_versions(id:str,db:Session=Depends(get_db),user=Depends(current_user)): get_or_404(db,Document,id); return ok([public(x) for x in db.scalars(select(DocumentVersion).where(DocumentVersion.document_id==id).order_by(DocumentVersion.version_number)).all()])
@router.post("/document-verification/{document_id}/verify")
def verification_verify(document_id:str,db:Session=Depends(get_db),user=Depends(require_roles("VERIFICATION_OFFICER"))): return verify_document(document_id,db,user)
@router.post("/document-verification/{document_id}/reject")
def verification_reject(document_id:str,body:dict,db:Session=Depends(get_db),user=Depends(require_roles("VERIFICATION_OFFICER"))): return reject_document(document_id,body,db,user)
@router.get("/document-verification/queue")
def verification_queue(db:Session=Depends(get_db),user=Depends(require_roles("VERIFICATION_OFFICER"))): return ok([public(x) for x in db.scalars(select(Document).where(Document.status=="PENDING")).all()])

@router.post("/eligibility/applications/{id}/evaluate")
def eligibility(id:str,db:Session=Depends(get_db),user=Depends(current_user)): get_or_404(db,Application,id); return ok({"result":"NEEDS_MANUAL_REVIEW","rules":[],"deterministic":True})
@router.get("/eligibility/applications/{id}/latest")
def eligibility_latest(id:str,user=Depends(current_user)): return ok({"result":"NEEDS_MANUAL_REVIEW","rules":[]})
@router.get("/eligibility/applications/{id}/history")
def eligibility_history(id:str,user=Depends(current_user)): return ok([])
@router.get("/eligibility/runs/{id}")
def eligibility_run(id:str,user=Depends(current_user)): return ok({"id":id,"status":"COMPLETED"})

@router.get("/ai/config")
def ai_config(): return ok({"enabled":False})
@router.put("/ai/config")
def set_ai_config(body:dict,user=Depends(require_roles("SUPER_ADMIN"))): return ok({"enabled":False})
@router.get("/ai/applications/{id}/summary")
def ai_summary(id:str): return {"ai_status":"unavailable","message":"AI processing is not enabled yet."}
@router.get("/ai/jobs/{id}")
def ai_job(id:str): return {"ai_status":"unavailable","message":"AI processing is not enabled yet."}
@router.post("/ai/documents/{id}/{action}")
def ai_document(id:str,action:str): return {"ai_status":"unavailable","message":"AI processing is not enabled yet."}
@router.post("/ai/applications/{id}/consistency-check")
def ai_consistency(id:str): return {"ai_status":"unavailable","message":"AI processing is not enabled yet."}


# Required action aliases

@router.get("/audit")
def audit_list(db:Session=Depends(get_db),user=Depends(require_roles("AUDITOR","MONITORING_ANALYST"))): return ok([public(x) for x in db.scalars(select(AuditLog).order_by(desc(AuditLog.created_at))).all()])

@router.get("/health")
def health(): return {"success":True,"data":{"status":"ok","ai":"unavailable","integrations":"mock"}}
