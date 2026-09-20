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
from app.domain.models import User, Applicant, Scheme, SchemeVersion, SchemeRule, Application, Document, GenericRecord
from app.domain.relational_models import DocumentVersion, DocumentAccessLog
from app.storage.service import get_storage_provider, StorageProviderError
from app.core.access import application_for_actor, document_for_actor, institution_id_for
from app.core.constants import APPLICATION_STATUSES, RULE_OPERATORS
from app.domain.relational_models import EligibilityRun, EligibilityResult, EligibilityRuleResult
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
    elif user.role=="INSTITUTION_NODAL_OFFICER":
        from app.core.access import institution_id_for
        inst_id=institution_id_for(db,user)
        apps=db.scalars(select(Application).where(Application.status!="DRAFT")).all()
        visible=[x.id for x in apps if str(x.answers.get("institution_id") or x.answers.get("institution") or "")==str(inst_id)]
        q=q.where(Application.id.in_(visible)) if inst_id else q.where(False)
    if status:q=q.where(Application.status==status)
    return ok([public(x) for x in db.scalars(q.order_by(desc(Application.created_at))).all()])
@router.get("/applications/{id}")
def application(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return ok(public(application_for_actor(db,id,user)))

@router.delete("/applications/{id}")
def delete_application(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return update_application(id,AnswersIn(answers={}),db,user)

@router.post("/applications/{id}/withdraw")
def withdraw(id:str,db:Session=Depends(get_db),user=Depends(current_user)): application_for_actor(db,id,user); return change_application(id,"WITHDRAWN",db,user,"APPLICATION_WITHDRAWN")
@router.post("/applications/{id}/validate")
def validate_application(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    app=application_for_actor(db,id,user)
    errors=[]
    if not app.answers: errors.append({"code":"NO_ANSWERS","field":"answers","message":"Application has no answers"})
    if not app.scheme_version_id: errors.append({"code":"NO_SCHEME_VERSION","field":"scheme_version_id","message":"Application is not linked to a scheme version"})
    version=db.get(SchemeVersion,app.scheme_version_id)
    if version:
        from app.domain.relational_models import SchemeDocument
        required_docs=db.scalars(select(SchemeDocument).where(SchemeDocument.scheme_version_id==version.id,SchemeDocument.required.is_(True),SchemeDocument.status=="ACTIVE")).all()
        for req in required_docs:
            matching=db.scalar(select(Document).where(Document.application_id==id,Document.document_type==req.document_code,Document.status.in_(["READY","VERIFIED","HUMAN_VERIFIED"])))
            if not matching: errors.append({"code":"REQUIRED_DOCUMENT","field":req.document_code,"message":f"Required document '{req.label}' is missing"})
        from app.domain.relational_models import SchemeForm
        form = db.scalar(select(SchemeForm).where(SchemeForm.scheme_version_id==version.id))
        if form:
            for fe in _required_form_field_errors(form.definition or {}, app.answers or {}):
                errors.append(fe)
    if app.status not in ("DRAFT","DEFICIENCY_RAISED","RESUBMITTED"): errors.append({"code":"INVALID_STATUS","field":"status", "message":f"Application cannot be validated in '{app.status}' status"})
    return ok({"valid":len(errors)==0,"errors":errors})


def _required_form_field_errors(definition: dict, answers: dict) -> list[dict]:
    """Return validation errors for required form fields not yet answered.

    Supports both the nested ({sections: [{fields}]}) and flat ({fields: []})
    definition shapes. Conditional fields (``when``) are only required when
    their trigger field matches.
    """
    errors: list[dict] = []
    fields: list[dict] = list(definition.get("fields") or [])
    for section in definition.get("sections") or []:
        fields.extend(section.get("fields") or [])
    for index, field in enumerate(fields):
        if not isinstance(field, dict):
            continue
        if not field.get("required"):
            continue
        key = field.get("key") or field.get("id") or field.get("name")
        if not key:
            continue
        trigger = field.get("when")
        if trigger:
            trigger_field = trigger.get("field") if isinstance(trigger, dict) else None
            expected = trigger.get("equals") if isinstance(trigger, dict) else None
            observed = answers.get(trigger_field) if trigger_field else None
            if isinstance(observed, list):
                if expected not in observed:
                    continue
            elif str(observed if observed is not None else "") != str(expected if expected is not None else ""):
                continue
        value = answers.get(key)
        present = value not in (None, "") if not isinstance(value, list) else len(value) > 0
        if not present:
            errors.append({
                "code": "REQUIRED_FIELD",
                "field": key,
                "message": f"Required field '{field.get('label') or key}' is missing",
            })
    return errors
@router.post("/applications/{id}/recalculate-eligibility")
def recalc(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    app=application_for_actor(db,id,user)
    from app.scheme_engine import evaluate_rules
    rules=db.scalars(select(SchemeRule).where(SchemeRule.scheme_version_id==app.scheme_version_id)).all()
    rule_dicts=[public(r) for r in rules]
    if not rule_dicts: return ok({"status":"NO_RULES_CONFIGURED","rules":[]})
    result=evaluate_rules(rule_dicts,app.answers or {})
    return ok(result)
@router.get("/applications/{id}/timeline")
def timeline(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    app=application_for_actor(db,id,user)
    return ok([public(x) for x in db.scalars(select(AuditLog).where(AuditLog.entity_id==id).order_by(AuditLog.created_at)).all()])
@router.get("/applications/{id}/status")
def app_status(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    application_for_actor(db,id,user)
    return ok({"status":get_or_404(db,Application,id).status})

def change_application(id,status,db,user,event):
 x=get_or_404(db,Application,id)
 allowed={"DRAFT":["SUBMITTED","WITHDRAWN"],"DEFICIENCY_RAISED":["RESUBMITTED","WITHDRAWN"],"SUBMITTED":["WITHDRAWN"]}
 if status not in allowed.get(x.status,[]): raise InvalidTransition(f"Cannot transition from {x.status} to {status}")
 x.status=status; audit(db,event,user.id,"APPLICATION",id); db.commit(); return ok({"id":id,"status":status})

@router.post("/documents/presign")
def presign(body:dict,user=Depends(current_user)):
    from app.core.config import get_settings
    return ok({"upload_url":"/api/v1/documents","storage":get_settings().storage_provider,"expires_in":300})
@router.post("/documents",status_code=201)
def upload_document(application_id:str|None=None,document_type:str|None=None,file:UploadFile=File(...),db:Session=Depends(get_db),user=Depends(current_user)):
    if application_id:
        application_for_actor(db,application_id,user)
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
def document(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return ok(public(document_for_actor(db,id,user)))
@router.get("/documents/{id}/download-url")
def download_url(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    document=document_for_actor(db,id,user)
    try: url=get_storage_provider().get_signed_url(document.storage_key,300)
    except StorageProviderError as exc: raise IntegrationUnavailable(str(exc),{"provider":exc.provider,"operation":"signed_url"}) from exc
    db.add(DocumentAccessLog(document_id=id,actor_id=user.id,action="SIGNED_URL")); db.commit(); return ok({"url":url,"expires_in":300})

@router.get("/documents/file/{file_path:path}")
def serve_document_file(file_path: str, user=Depends(current_user)):
    from app.core.config import get_settings
    settings=get_settings()
    if settings.environment == "production":
        raise Forbidden("Direct file serving is not available in production. Use /documents/{id}/download-url instead.")
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
def document_versions(id:str,db:Session=Depends(get_db),user=Depends(current_user)): document_for_actor(db,id,user); return ok([public(x) for x in db.scalars(select(DocumentVersion).where(DocumentVersion.document_id==id).order_by(DocumentVersion.version_number)).all()])
@router.post("/document-verification/{document_id}/verify")
def verification_verify(document_id:str,db:Session=Depends(get_db),user=Depends(require_roles("VERIFICATION_OFFICER"))): return verify_document(document_id,db,user)
@router.post("/document-verification/{document_id}/reject")
def verification_reject(document_id:str,body:dict,db:Session=Depends(get_db),user=Depends(require_roles("VERIFICATION_OFFICER"))): return reject_document(document_id,body,db,user)
@router.get("/document-verification/queue")
def verification_queue(db:Session=Depends(get_db),user=Depends(require_roles("VERIFICATION_OFFICER"))): return ok([public(x) for x in db.scalars(select(Document).where(Document.status=="PENDING")).all()])

@router.post("/eligibility/applications/{id}/evaluate")
def eligibility(id:str,db:Session=Depends(get_db),user=Depends(require_roles("SCRUTINY_OFFICER","VERIFICATION_OFFICER","SCHEME_MANAGER","SUPER_ADMIN"))):
    app = application_for_actor(db, id, user)
    from app.scheme_engine import evaluate_rules
    rules = db.scalars(select(SchemeRule).where(SchemeRule.scheme_version_id == app.scheme_version_id)).all()
    rule_dicts = [public(r) for r in rules]
    result = evaluate_rules(rule_dicts, app.answers or {})
    run = EligibilityRun(
        application_id=id,
        scheme_version_id=app.scheme_version_id,
        result=result["result"],
        engine_version="1.0",
        input_snapshot=app.answers or {},
    )
    db.add(run); db.flush()
    db.add(EligibilityResult(run_id=run.id, result=result["result"], explanation=result))
    for r in result["rules"]:
        db.add(EligibilityRuleResult(
            run_id=run.id,
            rule_id=r.get("rule_id"),
            rule_name=r.get("rule_name"),
            operator=r.get("operator"),
            observed_value=r.get("observed_value"),
            expected_value=r.get("expected_value"),
            passed=r.get("passed", False),
            source_reference=r.get("source_reference", ""),
        ))
    audit(db, "ELIGIBILITY_EVALUATED", user.id, "APPLICATION", id, {"result": result["result"]})
    db.commit()
    return ok({**result, "run_id": run.id, "deterministic": True})
@router.get("/eligibility/applications/{id}/latest")
def eligibility_latest(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    application_for_actor(db,id,user)
    run=db.scalar(select(EligibilityRun).where(EligibilityRun.application_id==id).order_by(EligibilityRun.created_at.desc()))
    if not run: return ok({"result":"NOT_EVALUATED","rules":[]})
    res=db.scalar(select(EligibilityResult).where(EligibilityResult.run_id==run.id))
    return ok({"result":run.result,"rules":(res.explanation or {}).get("rules",[]),"run_id":run.id})
@router.get("/eligibility/applications/{id}/history")
def eligibility_history(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    application_for_actor(db,id,user)
    rows=db.scalars(select(EligibilityRun).where(EligibilityRun.application_id==id).order_by(EligibilityRun.created_at.desc())).all()
    return ok([{"id":r.id,"result":r.result,"engine_version":r.engine_version,"created_at":r.created_at} for r in rows])
@router.get("/eligibility/runs/{id}")
def eligibility_run(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    run=get_or_404(db,EligibilityRun,id)
    application_for_actor(db,run.application_id,user)
    res=db.scalar(select(EligibilityResult).where(EligibilityResult.run_id==run.id))
    return ok({"id":run.id,"status":"COMPLETED","result":run.result,"explanation":res.explanation if res else {}, "rules_detail":[public(x) for x in db.scalars(select(EligibilityRuleResult).where(EligibilityRuleResult.run_id==run.id)).all()]})

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

class EnquiryIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    phone: str | None = Field(default=None, max_length=20)
    topic: str | None = Field(default=None, max_length=80)
    message: str = Field(min_length=1, max_length=5000)


@router.post("/public/enquiries", status_code=201)
def create_enquiry(body: EnquiryIn, db: Session = Depends(get_db)):
    row = GenericRecord(
        module="public",
        record_type="contact_enquiry",
        status="OPEN",
        data=body.model_dump(),
    )
    db.add(row)
    db.flush()
    audit(db, "ENQUIRY_CREATED", None, "ENQUIRY", row.id, {"topic": body.topic})
    db.commit()
    return ok({"id": row.id, "reference": row.id, "status": row.status})


@router.get("/health")
def health():
    from app.core.config import get_settings
    settings=get_settings()
    storage_configured = bool(settings.imagekit_private_key and settings.imagekit_public_key and settings.imagekit_endpoint) if settings.storage_provider=="imagekit" else True
    email_configured = bool(settings.smtp_username and settings.smtp_password) if settings.email_provider=="smtp" else True
    integrations={
        "storage":{"mode":settings.storage_provider,"configured":storage_configured},
        "email":{"mode":settings.email_provider,"configured":email_configured},
        "finance":{"mode":settings.finance_provider,"configured":True},
        "database":{"mode":"postgresql","configured":True},
        "ai":{"mode":"unavailable","configured":False},
    }
    status="ok" if all(item["configured"] for item in integrations.values()) else "degraded"
    return {"success":True,"data":{"status":status,"ai":integrations["ai"]["mode"],"integrations":integrations,"environment":settings.environment}}
