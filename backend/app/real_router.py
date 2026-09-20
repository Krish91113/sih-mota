"""Relational-backed API slices replacing legacy generic-record handlers incrementally."""
from datetime import datetime, timezone
from hashlib import sha256
import os, uuid
from typing import Any
from fastapi import APIRouter, Depends, Header, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.permissions import current_user, require_roles
from app.core.errors import Conflict, Forbidden, Immutable, NotFound, InvalidTransition, RequiredDocumentsMissing
from app.core.audit import audit
from app.core.security import hash_password
from app.domain.models import User, Applicant, Scheme, SchemeVersion, SchemeRule, Application, Document
from app.domain.relational_models import (ApplicantProfile, SchemeForm, SchemeSourceDocument, ApplicationVersion, ApplicationAnswer, ApplicationStatusHistory, IdempotencyRecord, Institution, InstitutionUser, InstitutionVerificationRecord, Deficiency, DeficiencyResponse, ScrutinyReview, SchemeDocument, DocumentVersion, DocumentVerification, DocumentAccessLog, Workflow)
from app.rbac.models import Role, Permission, UserRole, RolePermission, UserScope
from app.rbac.constants import PERMISSIONS, PermissionSpec
from app.core.constants import RULE_OPERATORS
from app.rbac.service import seed_permissions
from app.core.access import application_for_actor, document_for_actor, get_or_404
from app.core.status import move_application_status
router=APIRouter(tags=["Relational Core"])
def public(obj): return {k:v for k,v in obj.__dict__.items() if not k.startswith("_")}

def role_guard(*roles): return Depends(require_roles(*roles))
class RoleIn(BaseModel): name:str; description:str|None=None; is_active:bool=True
class PermissionsIn(BaseModel): permissions:list[str]
class RoleAssignIn(BaseModel): role_id:str
class ScopeIn(BaseModel): scope_type:str; scope_value:str; resource:str|None=None
class UserIn(BaseModel): email:str; full_name:str; role:str="APPLICANT"; password:str="ChangeMe123!"
class WorkflowIn(BaseModel): name:str; version:int=1; definition:dict[str,Any]={}
class SchemeUpdate(BaseModel): name:str|None=None; description:str|None=None; active:bool|None=None
class VersionCreate(BaseModel): version:str; configuration:dict[str,Any]={}
class FormIn(BaseModel): fields:list[dict[str,Any]]=Field(default_factory=list); sections:list[dict[str,Any]]=Field(default_factory=list); conditional_rules:list[dict[str,Any]]=Field(default_factory=list)
class SchemeDocumentIn(BaseModel): document_code:str; label:str; required:bool=True; status:str="ACTIVE"
class RuleCreate(BaseModel): rule_id:str; name:str; field:str; operator:str; value:Any=None; source_reference:str; effective_from:datetime|None=None
class SourceIn(BaseModel): title:str; document_type:str|None=None; document_reference:str; section_reference:str|None=None; page_reference:str|None=None; source_url:str|None=None; effective_from:datetime|None=None; effective_to:datetime|None=None; uploaded_document_id:str|None=None; source_reference:str; status:str="ACTIVE"
class AppCreate(BaseModel):
    scheme_id: str
    scheme_version_id: str
    cycle: str = "2026-2027"
    answers: dict[str, Any] = Field(default_factory=dict)
    form_data: dict[str, Any] = Field(default_factory=dict)
    institution_id: str | None = None
class AnswerPatch(BaseModel): answers:dict[str,Any]; reason:str|None=None; expected_version:int|None=None
class InstitutionIn(BaseModel): code:str; name:str; institution_type:str|None=None; state:str|None=None; district:str|None=None
class VerificationIn(BaseModel): result:str; fields:dict[str,Any]={}; note:str|None=None
class DeficiencyIn(BaseModel): type:str; description:str; document_id:str|None=None; severity:str="MEDIUM"; deadline:datetime|None=None; required_action:str
class ResponseIn(BaseModel): response:str; supporting_documents:dict[str,Any]={}
class ScrutinyNoteIn(BaseModel): note:str
class ProfileUpdateIn(BaseModel):
    full_name: str | None = None
    profile: dict[str, Any] = Field(default_factory=dict)

def validate_form(definition):
    allowed={"text","number","date","dropdown","multiselect","radio","checkbox","file","institution","country","university","course","dynamic_table"}; seen=set(); errors=[]
    for index,field in enumerate(definition.get("fields",[])):
        key=field.get("key") or field.get("name")
        if not key or key in seen: errors.append({"index":index,"error":"field key must be unique"})
        seen.add(key)
        if field.get("type") not in allowed: errors.append({"index":index,"error":"unsupported field type"})
        if field.get("min") is not None and field.get("max") is not None and field["min"]>field["max"]: errors.append({"index":index,"error":"min cannot exceed max"})
    return errors
@router.get("/users")
def list_users(db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN","AUDITOR")):
    return {"success":True,"data":[public(x) for x in db.scalars(select(User)).all()]}
@router.post("/users",status_code=201)
def create_user(body:UserIn,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN")):
    if db.scalar(select(User).where(User.email==body.email)): raise Conflict("User email already exists")
    row=User(email=body.email,full_name=body.full_name,role=body.role,password_hash=hash_password(body.password)); db.add(row); audit(db,"USER_CREATED",user.id,"USER",row.id); db.commit(); return {"success":True,"data":public(row)}
@router.get("/users/{id}")
def get_user(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return {"success":True,"data":public(get_or_404(db,User,id))}
@router.patch("/users/{id}")
def patch_user(id:str,body:UserIn,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN")):
    row=get_or_404(db,User,id); row.email=body.email; row.full_name=body.full_name; row.role=body.role; row.password_hash=hash_password(body.password) if body.password else row.password_hash; audit(db,"USER_UPDATED",user.id,"USER",id); db.commit(); return {"success":True,"data":public(row)}
@router.get("/workflows/{id}")
def get_workflow(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return {"success":True,"data":public(get_or_404(db,Workflow,id))}
@router.put("/workflows/{id}")
def put_workflow(id:str,body:WorkflowIn,db:Session=Depends(get_db),user=role_guard("SCHEME_MANAGER")):
    row=get_or_404(db,Workflow,id); row.name=body.name; row.version=body.version; row.definition=body.definition; audit(db,"WORKFLOW_UPDATED",user.id,"WORKFLOW",id); db.commit(); return {"success":True,"data":public(row)}
@router.post("/workflows/{id}/validate")
def validate_workflow(id:str,db:Session=Depends(get_db),user=role_guard("SCHEME_MANAGER")):
    row=get_or_404(db,Workflow,id); states={x.get("from") for x in row.definition.get("transitions",[])}|{x.get("to") for x in row.definition.get("transitions",[])}; errors=[]
    for item in row.definition.get("transitions",[]):
        if not item.get("from") or not item.get("to"): errors.append("transition requires from and to")
    return {"success":True,"data":{"valid":not errors,"states":sorted(x for x in states if x),"errors":errors}}
@router.get("/roles")
def list_roles(db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN")): return {"success":True,"data":[public(x) for x in db.scalars(select(Role)).all()]}
@router.post("/roles",status_code=201)
def create_role(body:RoleIn,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN")):
    if db.scalar(select(Role).where(Role.name==body.name)): raise Conflict("Role already exists")
    role=Role(**body.model_dump()); db.add(role); audit(db,"ROLE_CHANGED",user.id,"ROLE",role.id,body.model_dump()); db.commit(); return {"success":True,"data":public(role)}
@router.get("/roles/{id}")
def get_role(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return {"success":True,"data":public(get_or_404(db,Role,id))}
@router.patch("/roles/{id}")
def patch_role(id:str,body:RoleIn,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN")):
    role=get_or_404(db,Role,id)
    if role.is_system and body.name!=role.name: raise Conflict("System role name cannot change")
    for key,value in body.model_dump().items(): setattr(role,key,value)
    audit(db,"ROLE_CHANGED",user.id,"ROLE",id,body.model_dump()); db.commit(); return {"success":True,"data":public(role)}
@router.get("/permissions")
def list_permissions(db:Session=Depends(get_db),user=Depends(current_user)):
    seed_permissions(db,PERMISSIONS); db.commit(); return {"success":True,"data":[public(x) for x in db.scalars(select(Permission)).all()]}
@router.get("/roles/{id}/permissions")
def role_permissions(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    get_or_404(db,Role,id); rows=db.scalars(select(Permission).join(RolePermission,RolePermission.permission_id==Permission.id).where(RolePermission.role_id==id)).all(); return {"success":True,"data":[public(x) for x in rows]}
@router.put("/roles/{id}/permissions")
def set_role_permissions(id:str,body:PermissionsIn,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN")):
    role=get_or_404(db,Role,id); seed_permissions(db,PERMISSIONS)
    wanted=[]
    for key in body.permissions:
        parts=key.split(":")
        if len(parts)!=3: raise Conflict(f"Invalid permission: {key}")
        permission=db.scalar(select(Permission).where(Permission.resource==parts[0],Permission.action==parts[1],Permission.scope==parts[2]))
        if not permission: raise NotFound(f"Permission not found: {key}")
        wanted.append(permission)
    db.execute(delete(RolePermission).where(RolePermission.role_id==role.id))
    for permission in wanted: db.add(RolePermission(role_id=role.id,permission_id=permission.id,granted_by=user.id))
    audit(db,"ROLE_CHANGED",user.id,"ROLE",id,{"permissions":body.permissions}); db.commit(); return {"success":True,"data":{"role_id":id,"permissions":body.permissions}}
@router.get("/users/{id}/roles")
def user_roles(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    get_or_404(db,User,id); rows=db.scalars(select(Role).join(UserRole,UserRole.role_id==Role.id).where(UserRole.user_id==id)).all(); return {"success":True,"data":[public(x) for x in rows]}
@router.post("/users/{id}/roles",status_code=201)
def assign_role(id:str,body:RoleAssignIn,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN")):
    get_or_404(db,User,id); get_or_404(db,Role,body.role_id)
    if db.scalar(select(UserRole).where(UserRole.user_id==id,UserRole.role_id==body.role_id)): raise Conflict("Role already assigned")
    db.add(UserRole(user_id=id,role_id=body.role_id,assigned_by=user.id)); audit(db,"ROLE_CHANGED",user.id,"USER",id,{"role_id":body.role_id}); db.commit(); return {"success":True,"data":{"assigned":True}}
@router.delete("/users/{id}/roles/{role_id}")
def remove_role(id:str,role_id:str,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN")):
    row=db.scalar(select(UserRole).where(UserRole.user_id==id,UserRole.role_id==role_id))
    if not row: raise NotFound("Role assignment not found")
    db.delete(row); audit(db,"ROLE_CHANGED",user.id,"USER",id,{"removed_role_id":role_id}); db.commit(); return {"success":True,"data":{"removed":True}}
@router.get("/users/{id}/scopes")
def user_scopes(id:str,db:Session=Depends(get_db),user=Depends(current_user)): get_or_404(db,User,id); return {"success":True,"data":[public(x) for x in db.scalars(select(UserScope).where(UserScope.user_id==id)).all()]}
@router.post("/users/{id}/scopes",status_code=201)
def add_scope(id:str,body:ScopeIn,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN")):
    allowed={"OWN","ASSIGNED","SCHEME","ORGANIZATION","GEOGRAPHIC","ALL"}
    if body.scope_type not in allowed: raise Conflict("Unsupported scope type")
    get_or_404(db,User,id); row=UserScope(user_id=id,scope_type=body.scope_type,scope_value=body.scope_value,resource=body.resource,granted_by=user.id); db.add(row); audit(db,"SCOPE_CHANGED",user.id,"USER",id,body.model_dump()); db.commit(); return {"success":True,"data":public(row)}
@router.patch("/users/{id}/scopes/{scope_id}")
def patch_scope(id:str,scope_id:str,body:ScopeIn,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN")):
    row=get_or_404(db,UserScope,scope_id)
    if row.user_id!=id: raise Forbidden("Scope does not belong to user")
    for key,value in body.model_dump().items(): setattr(row,key,value)
    audit(db,"SCOPE_CHANGED",user.id,"USER",id,body.model_dump()); db.commit(); return {"success":True,"data":public(row)}
@router.delete("/users/{id}/scopes/{scope_id}")
def delete_scope(id:str,scope_id:str,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN")):
    row=get_or_404(db,UserScope,scope_id)
    if row.user_id!=id: raise Forbidden("Scope does not belong to user")
    db.delete(row); audit(db,"SCOPE_CHANGED",user.id,"USER",id,{"deleted_scope":scope_id}); db.commit(); return {"success":True,"data":{"deleted":True}}

@router.post("/schemes/{id}/versions",status_code=201)
def real_create_version(id:str,body:VersionCreate,db:Session=Depends(get_db),user=role_guard("SCHEME_MANAGER")):
    get_or_404(db,Scheme,id)
    if db.scalar(select(SchemeVersion).where(SchemeVersion.scheme_id==id,SchemeVersion.version==body.version)): raise Conflict("Version already exists")
    row=SchemeVersion(scheme_id=id,version=body.version,configuration=body.configuration,status="DRAFT"); db.add(row); db.flush(); db.add(SchemeForm(scheme_version_id=row.id,definition=body.configuration.get("form_definition",{}))); audit(db,"SCHEME_UPDATED",user.id,"SCHEME_VERSION",row.id); db.commit(); return {"success":True,"data":public(row)}
@router.patch("/scheme-versions/{id}")
def real_patch_version(id:str,body:VersionCreate,db:Session=Depends(get_db),user=role_guard("SCHEME_MANAGER")):
    row=get_or_404(db,SchemeVersion,id)
    if row.status=="PUBLISHED": raise Immutable("Published scheme versions are immutable")
    row.version=body.version; row.configuration=body.configuration; audit(db,"SCHEME_UPDATED",user.id,"SCHEME_VERSION",id); db.commit(); return {"success":True,"data":public(row)}
@router.post("/scheme-versions/{id}/clone")
def real_clone_version(id:str,db:Session=Depends(get_db),user=role_guard("SCHEME_MANAGER")):
    old=get_or_404(db,SchemeVersion,id); clone=SchemeVersion(scheme_id=old.scheme_id,version=f"{old.version}-copy",configuration=dict(old.configuration),status="DRAFT"); db.add(clone); db.flush(); db.add(SchemeForm(scheme_version_id=clone.id,definition=old.configuration.get("form_definition",{}))); db.commit(); return {"success":True,"data":public(clone)}
def change_version(id,action,db,user):
    row=get_or_404(db,SchemeVersion,id)
    transitions={"submit-review":("DRAFT","IN_REVIEW"),"approve":("IN_REVIEW","APPROVED"),"publish":("APPROVED","PUBLISHED"),"archive":("PUBLISHED","ARCHIVED")}
    expected,target=transitions[action]
    if row.status!=expected: raise InvalidTransition(f"Cannot {action} a {row.status} version")
    row.status=target
    if target=="PUBLISHED": row.published_at=datetime.now(timezone.utc)
    audit(db,"SCHEME_UPDATED",user.id,"SCHEME_VERSION",id,{"action":action}); db.commit(); return {"success":True,"data":public(row)}
for _action in ("submit-review","approve","publish","archive"):
    router.add_api_route(f"/scheme-versions/{{id}}/{_action}",lambda id,_a=_action,db=Depends(get_db),user=role_guard("SCHEME_MANAGER"):change_version(id,_a,db,user),methods=["POST"],name=f"real_{_action}")

@router.get("/scheme-versions/{id}/form-definition")
def real_get_form(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    form=db.scalar(select(SchemeForm).where(SchemeForm.scheme_version_id==id)); return {"success":True,"data":form.definition if form else {"fields":[]}}
@router.put("/scheme-versions/{id}/form-definition")
def real_put_form(id:str,body:FormIn,db:Session=Depends(get_db),user=role_guard("SCHEME_MANAGER")):
    version=get_or_404(db,SchemeVersion,id)
    if version.status=="PUBLISHED": raise Immutable("Published scheme versions are immutable")
    errors=validate_form(body.model_dump())
    if errors: raise Conflict("Invalid form definition",{"errors":errors})
    form=db.scalar(select(SchemeForm).where(SchemeForm.scheme_version_id==id))
    if not form: form=SchemeForm(scheme_version_id=id); db.add(form)
    form.definition=body.model_dump(); version.configuration={**version.configuration,"form_definition":body.model_dump()}; audit(db,"SCHEME_UPDATED",user.id,"SCHEME_FORM",id); db.commit(); return {"success":True,"data":form.definition}
@router.post("/scheme-versions/{id}/form-definition/validate")
def real_validate_form(id:str,body:FormIn): return {"success":True,"data":{"valid":not validate_form(body.model_dump()),"errors":validate_form(body.model_dump())}}
@router.post("/scheme-versions/{id}/form-definition/preview")
def real_preview_form(id:str,body:FormIn):
    errors=validate_form(body.model_dump())
    if errors: raise Conflict("Invalid form definition",{"errors":errors})
    return {"success":True,"data":{"form":body.model_dump(),"preview":True}}
@router.get("/scheme-versions/{id}/rules")
def real_rules(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    get_or_404(db,SchemeVersion,id); return {"success":True,"data":[public(x) for x in db.scalars(select(SchemeRule).where(SchemeRule.scheme_version_id==id)).all()]}
@router.post("/scheme-versions/{id}/rules",status_code=201)
def real_add_rule(id:str,body:RuleCreate,db:Session=Depends(get_db),user=role_guard("SCHEME_MANAGER")):
    version=get_or_404(db,SchemeVersion,id)
    if version.status=="PUBLISHED": raise Immutable("Published scheme versions are immutable")
    if body.operator not in RULE_OPERATORS: raise Conflict("Unsupported rule operator")
    row=SchemeRule(scheme_version_id=id,**body.model_dump()); db.add(row); audit(db,"RULE_PUBLISHED",user.id,"SCHEME_RULE",row.id); db.commit(); return {"success":True,"data":public(row)}
@router.get("/scheme-rules/{id}")
def real_rule(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return {"success":True,"data":public(get_or_404(db,SchemeRule,id))}
@router.patch("/scheme-rules/{id}")
def real_patch_rule(id:str,body:RuleCreate,db:Session=Depends(get_db),user=role_guard("SCHEME_MANAGER")):
    row=get_or_404(db,SchemeRule,id); version=get_or_404(db,SchemeVersion,row.scheme_version_id)
    if version.status=="PUBLISHED": raise Immutable("Published scheme versions are immutable")
    if body.operator not in RULE_OPERATORS: raise Conflict("Unsupported rule operator")
    for key,value in body.model_dump().items(): setattr(row,key,value)
    audit(db,"SCHEME_UPDATED",user.id,"SCHEME_RULE",id); db.commit(); return {"success":True,"data":public(row)}
@router.delete("/scheme-rules/{id}")
def real_delete_rule(id:str,db:Session=Depends(get_db),user=role_guard("SCHEME_MANAGER")):
    row=get_or_404(db,SchemeRule,id); version=get_or_404(db,SchemeVersion,row.scheme_version_id)
    if version.status=="PUBLISHED": raise Immutable("Published scheme versions are immutable")
    db.delete(row); audit(db,"SCHEME_UPDATED",user.id,"SCHEME_RULE",id,{"deleted":True}); db.commit(); return {"success":True,"data":{"deleted":True}}
@router.post("/scheme-versions/{id}/rules/test")
def real_test_rules(id:str,body:dict,db:Session=Depends(get_db),user=Depends(current_user)):
    from app.scheme_engine import evaluate_rules
    rules=[x for x in body.get("rules",[])]; return {"success":True,"data":evaluate_rules(rules,body.get("payload",{}))}
@router.post("/scheme-versions/{id}/rules/validate")
def real_validate_rules(id:str,body:dict,db:Session=Depends(get_db),user=Depends(current_user)):
    errors=[]
    for index,rule in enumerate(body.get("rules",[])):
        if rule.get("operator") not in RULE_OPERATORS: errors.append({"index":index,"error":"unsupported operator"})
        if not rule.get("field") and rule.get("operator") not in ("AND","OR","NOT"): errors.append({"index":index,"error":"field is required"})
    return {"success":True,"data":{"valid":not errors,"errors":errors}}
@router.post("/scheme-versions/{id}/sources",status_code=201)
def add_source(id:str,body:SourceIn,db:Session=Depends(get_db),user=role_guard("SCHEME_MANAGER")):
    version=get_or_404(db,SchemeVersion,id)
    if version.status=="PUBLISHED": raise Immutable("Published scheme versions are immutable")
    row=SchemeSourceDocument(scheme_version_id=id,**body.model_dump()); db.add(row); audit(db,"SCHEME_UPDATED",user.id,"SCHEME_SOURCE",row.id); db.commit(); return {"success":True,"data":public(row)}
@router.get("/scheme-versions/{id}/sources")
def list_sources(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return {"success":True,"data":[public(x) for x in db.scalars(select(SchemeSourceDocument).where(SchemeSourceDocument.scheme_version_id==id)).all()]}

@router.get("/scheme-versions/{id}/documents")
def get_scheme_version_documents(id: str, db: Session = Depends(get_db), user = Depends(current_user)):
    get_or_404(db, SchemeVersion, id)
    docs = db.scalars(select(SchemeDocument).where(SchemeDocument.scheme_version_id == id)).all()
    return {"success": True, "data": [public(d) for d in docs]}

@router.post("/scheme-versions/{id}/documents", status_code=201)
def add_scheme_version_document(id: str, body: SchemeDocumentIn, db: Session = Depends(get_db), user = role_guard("SCHEME_MANAGER")):
    version = get_or_404(db, SchemeVersion, id)
    if version.status == "PUBLISHED":
        raise Immutable("Published scheme versions are immutable")
    existing = db.scalar(select(SchemeDocument).where(SchemeDocument.scheme_version_id == id, SchemeDocument.document_code == body.document_code))
    if existing:
        existing.label = body.label
        existing.required = body.required
        existing.status = body.status
        row = existing
    else:
        row = SchemeDocument(scheme_version_id=id, document_code=body.document_code, label=body.label, required=body.required, status=body.status)
        db.add(row)
    audit(db, "SCHEME_DOCUMENT_CONFIGURED", user.id, "SCHEME_DOCUMENT", row.id, body.model_dump())
    db.commit()
    return {"success": True, "data": public(row)}

@router.delete("/scheme-documents/{doc_id}")
def delete_scheme_version_document(doc_id: str, db: Session = Depends(get_db), user = role_guard("SCHEME_MANAGER")):
    row = get_or_404(db, SchemeDocument, doc_id)
    version = get_or_404(db, SchemeVersion, row.scheme_version_id)
    if version.status == "PUBLISHED":
        raise Immutable("Published scheme versions are immutable")
    db.delete(row)
    audit(db, "SCHEME_DOCUMENT_DELETED", user.id, "SCHEME_DOCUMENT", doc_id)
    db.commit()
    return {"success": True, "data": {"deleted": True}}

@router.get("/applicant/profile")
def get_applicant_profile(db: Session = Depends(get_db), user = Depends(current_user)):
    applicant = db.scalar(select(Applicant).where(Applicant.user_id == user.id))
    if not applicant:
        applicant = Applicant(user_id=user.id, profile={})
        db.add(applicant)
        db.commit()
    return {
        "success": True,
        "data": {
            "id": applicant.id,
            "user_id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "profile": applicant.profile or {}
        }
    }

@router.put("/applicant/profile")
@router.patch("/applicant/profile")
def update_applicant_profile(body: ProfileUpdateIn, db: Session = Depends(get_db), user = Depends(current_user)):
    applicant = db.scalar(select(Applicant).where(Applicant.user_id == user.id))
    if not applicant:
        applicant = Applicant(user_id=user.id, profile={})
        db.add(applicant)
        db.flush()
    if body.full_name:
        user_row = db.get(User, user.id)
        if user_row:
            user_row.full_name = body.full_name
    current_prof = dict(applicant.profile or {})
    current_prof.update(body.profile)
    applicant.profile = current_prof
    audit(db, "PROFILE_UPDATED", user.id, "APPLICANT", applicant.id, {"profile": current_prof})
    db.commit()
    return {
        "success": True,
        "data": {
            "id": applicant.id,
            "user_id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "profile": applicant.profile
        }
    }

@router.post("/applications",status_code=201)
def real_create_application(body:AppCreate,db:Session=Depends(get_db),user=Depends(current_user)):
    applicant=db.scalar(select(Applicant).where(Applicant.user_id==user.id))
    if not applicant: applicant=Applicant(user_id=user.id,profile={}); db.add(applicant); db.flush()
    version=get_or_404(db,SchemeVersion,body.scheme_version_id)
    if version.scheme_id!=body.scheme_id or version.status!="PUBLISHED": raise Conflict("Application must use a published version belonging to the scheme")
    existing=db.scalar(select(Application).where(Application.applicant_id==applicant.id,Application.scheme_id==body.scheme_id,Application.cycle==body.cycle))
    if existing:
        if existing.scheme_version_id != body.scheme_version_id:
            raise Conflict("An application for this scheme and cycle already exists with a different version. Please contact support if you need to change versions.")
        row = existing
    else:
        row=Application(application_number=f"APP-{datetime.now().year}-{uuid4_short()}",applicant_id=applicant.id,scheme_id=body.scheme_id,scheme_version_id=body.scheme_version_id,cycle=body.cycle,status="DRAFT",answers={}); db.add(row); db.flush()
    
    combined_answers = dict(row.answers or {})
    if body.answers:
        combined_answers.update(body.answers)
    if body.form_data:
        combined_answers.update(body.form_data)
    if body.institution_id:
        combined_answers["institution_id"] = body.institution_id

    # Auto-link institution details from applicant's persistent profile if not set in answers
    if applicant and applicant.profile and isinstance(applicant.profile, dict):
        inst_prof = applicant.profile.get("institution", {})
        if isinstance(inst_prof, dict):
            if "institution_id" not in combined_answers and inst_prof.get("institution_id"):
                combined_answers["institution_id"] = inst_prof.get("institution_id")
            if "institution" not in combined_answers and inst_prof.get("name"):
                combined_answers["institution"] = inst_prof.get("name")

    row.answers = combined_answers
    
    db.add(ApplicationVersion(application_id=row.id,version_number=row.version,actor_id=user.id,reason="CREATED",snapshot=row.answers))
    audit(db,"APPLICATION_CREATED",user.id,"APPLICATION",row.id)
    db.commit()
    return {"success":True,"data":public(row)}
def uuid4_short():
    import uuid; return str(uuid.uuid4())[:8].upper()
@router.patch("/applications/{id}")
def real_patch_application(id:str,body:AnswerPatch,db:Session=Depends(get_db),user=Depends(current_user)):
    row=application_for_actor(db,id,user)
    if row.status not in ("DRAFT","DEFICIENCY_RAISED","RESUBMITTED"):
        raise Conflict("Application is not editable in its current status")
    if body.expected_version is not None and body.expected_version!=row.version: raise Conflict("Stale application version")
    old=dict(row.answers); row.answers={**row.answers,**body.answers}; row.version+=1; db.add(ApplicationVersion(application_id=id,version_number=row.version,actor_id=user.id,reason=body.reason or "UPDATED",snapshot=row.answers,supporting_evidence={"old":old,"new":body.answers}));
    for key,value in body.answers.items(): db.add(ApplicationAnswer(application_id=id,field_key=key,value=value,version_number=row.version))
    audit(db,"APPLICATION_UPDATED",user.id,"APPLICATION",id,{"old":old,"new":body.answers}); db.commit(); return {"success":True,"data":public(row)}
@router.delete("/applications/{id}")
def real_delete_application(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    row=application_for_actor(db,id,user)
    if row.status!="DRAFT": raise Conflict("Only draft applications can be closed")
    row.status="CLOSED"; audit(db,"APPLICATION_UPDATED",user.id,"APPLICATION",id,{"status":"CLOSED"}); db.commit(); return {"success":True,"data":{"closed":True}}
@router.post("/documents/{id}/replace",status_code=201)
def replace_document(id:str,file:UploadFile=File(...),db:Session=Depends(get_db),user=Depends(current_user),idempotency_key:str|None=Header(default=None,alias="Idempotency-Key")):
    from app.storage.service import get_storage_provider, StorageProviderError
    from app.core.errors import IntegrationUnavailable
    old=document_for_actor(db,id,user); content=file.file.read()
    try:
        stored=get_storage_provider().upload(content,os.path.basename(file.filename or "replacement"),file.content_type or "application/octet-stream")
    except StorageProviderError as exc:
        raise IntegrationUnavailable(str(exc),{"provider":exc.provider,"operation":"upload"}) from exc
    digest=stored.sha256; key=stored.key
    if idempotency_key:
        prior=db.scalar(select(IdempotencyRecord).where(IdempotencyRecord.key==idempotency_key,IdempotencyRecord.user_id==user.id,IdempotencyRecord.route==f"replace-document:{id}"))
        if prior and prior.response is not None:return prior.response
        if prior: raise Conflict("Request already in progress")
        prior=IdempotencyRecord(key=idempotency_key,user_id=user.id,route=f"replace-document:{id}",request_hash=digest,status_code=201); db.add(prior)
    old.status="REPLACED"; version_no=(db.scalar(select(DocumentVersion.version_number).where(DocumentVersion.document_id==id).order_by(DocumentVersion.version_number.desc())) or 0)+1
    replacement=Document(application_id=old.application_id,document_type=old.document_type,uploaded_by=user.id,filename=os.path.basename(file.filename or 'replacement'),mime=file.content_type or 'application/octet-stream',size=len(content),sha256=digest,storage_key=key,provider=stored.provider,status="READY"); db.add(replacement); db.flush(); db.add(DocumentVersion(document_id=replacement.id,version_number=version_no,storage_key=key,sha256=digest,mime=replacement.mime,size=replacement.size,uploaded_by=user.id,status="READY")); audit(db,"DOCUMENT_REPLACED",user.id,"DOCUMENT",replacement.id,{"replaced_document_id":id}); result={"success":True,"data":public(replacement)}
    if idempotency_key: prior.response=result
    db.commit(); return result
@router.get("/documents/{id}/access-log")
def document_access_log(id:str,db:Session=Depends(get_db),user=Depends(current_user)): document_for_actor(db,id,user); return {"success":True,"data":[public(x) for x in db.scalars(select(DocumentAccessLog).where(DocumentAccessLog.document_id==id)).all()]}
@router.get("/institutions")
def real_institutions(db:Session=Depends(get_db),user=Depends(current_user)): return {"success":True,"data":[public(x) for x in db.scalars(select(Institution)).all()]}
@router.post("/institutions",status_code=201)
def real_create_institution(body:InstitutionIn,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN","SCHEME_MANAGER")):
    if db.scalar(select(Institution).where(Institution.code==body.code)): raise Conflict("Institution code already exists")
    row=Institution(**body.model_dump()); db.add(row); audit(db,"INSTITUTION_CREATED",user.id,"INSTITUTION",row.id); db.commit(); return {"success":True,"data":public(row)}
@router.get("/institutions/{id}")
def real_institution(id:str,db:Session=Depends(get_db),user=Depends(current_user)): return {"success":True,"data":public(get_or_404(db,Institution,id))}
@router.patch("/institutions/{id}")
def real_patch_institution(id:str,body:InstitutionIn,db:Session=Depends(get_db),user=role_guard("SUPER_ADMIN","SCHEME_MANAGER")):
    row=get_or_404(db,Institution,id); [setattr(row,k,v) for k,v in body.model_dump().items()]; audit(db,"INSTITUTION_UPDATED",user.id,"INSTITUTION",id); db.commit(); return {"success":True,"data":public(row)}
@router.get("/institutions/{id}/users")
def real_institution_users(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    get_or_404(db,Institution,id); rows=db.scalars(select(User).join(InstitutionUser,InstitutionUser.user_id==User.id).where(InstitutionUser.institution_id==id)).all(); return {"success":True,"data":[public(x) for x in rows]}
@router.get("/deficiencies")
def real_deficiencies(db:Session=Depends(get_db),user=Depends(current_user),status:str|None=None):
    query=select(Deficiency)
    if user.role=="APPLICANT":
        a=db.scalar(select(Applicant).where(Applicant.user_id==user.id))
        if not a: return {"success":True,"data":[]}
        app_ids=db.scalars(select(Application.id).where(Application.applicant_id==a.id)).all()
        query=query.where(Deficiency.application_id.in_(app_ids))
    elif user.role=="INSTITUTION_NODAL_OFFICER":
        inst_id=institution_id_for(db,user)
        def _ids(inst):
            rows=db.scalars(select(Application).where(Application.answers["institution"].as_string()==str(inst))).all()
            return [r.id for r in rows]
        app_ids=_ids(inst_id) if inst_id else []
        query=query.where(Deficiency.application_id.in_(app_ids))
    query=query.where(Deficiency.status==status) if status else query; return {"success":True,"data":[public(x) for x in db.scalars(query).all()]}
@router.get("/applications/{id}/deficiencies")
def application_deficiencies(id:str,db:Session=Depends(get_db),user=Depends(current_user)): application_for_actor(db,id,user); return {"success":True,"data":[public(x) for x in db.scalars(select(Deficiency).where(Deficiency.application_id==id)).all()]}
@router.post("/applications/{id}/deficiencies",status_code=201)
def raise_deficiency(id:str,body:DeficiencyIn,db:Session=Depends(get_db),user=role_guard("SCRUTINY_OFFICER","VERIFICATION_OFFICER")):
    application_for_actor(db,id,user); row=Deficiency(application_id=id,raised_by=user.id,status="OPEN",**body.model_dump()); db.add(row); audit(db,"DEFICIENCY_RAISED",user.id,"DEFICIENCY",row.id); db.commit(); return {"success":True,"data":public(row)}
@router.get("/deficiencies/{id}")
def get_deficiency(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    row=get_or_404(db,Deficiency,id); application_for_actor(db,row.application_id,user); return {"success":True,"data":public(row)}
@router.post("/deficiencies/{id}/respond")
def respond_deficiency(id:str,body:ResponseIn,db:Session=Depends(get_db),user=Depends(current_user)):
    row=get_or_404(db,Deficiency,id); application_for_actor(db,row.application_id,user)
    if row.status not in ("OPEN","REOPENED"): raise InvalidTransition(f"Cannot respond from {row.status}")
    row.status="RESPONDED"; db.add(DeficiencyResponse(deficiency_id=id,responded_by=user.id,response=body.response,supporting_documents=body.supporting_documents)); audit(db,"DEFICIENCY_RESPONDED",user.id,"DEFICIENCY",id); db.commit(); return {"success":True,"data":public(row)}
@router.post("/deficiencies/{id}/review")
def review_deficiency(id:str,db:Session=Depends(get_db),user=role_guard("SCRUTINY_OFFICER","VERIFICATION_OFFICER")):
    row=get_or_404(db,Deficiency,id); application_for_actor(db,row.application_id,user)
    if row.status!="RESPONDED": raise InvalidTransition(f"Cannot review from {row.status}")
    row.status="UNDER_REVIEW"; db.commit(); return {"success":True,"data":public(row)}
@router.post("/deficiencies/{id}/resolve")
def resolve_deficiency(id:str,db:Session=Depends(get_db),user=role_guard("SCRUTINY_OFFICER","VERIFICATION_OFFICER")):
    row=get_or_404(db,Deficiency,id); application_for_actor(db,row.application_id,user)
    if row.status!="UNDER_REVIEW": raise InvalidTransition(f"Cannot resolve from {row.status}")
    row.status="RESOLVED"; audit(db,"DEFICIENCY_RESOLVED",user.id,"DEFICIENCY",id); db.commit(); return {"success":True,"data":public(row)}
@router.post("/deficiencies/{id}/reopen")
def reopen_deficiency(id:str,db:Session=Depends(get_db),user=role_guard("SCRUTINY_OFFICER","VERIFICATION_OFFICER")):
    row=get_or_404(db,Deficiency,id); application_for_actor(db,row.application_id,user); row.status="REOPENED"; audit(db,"DEFICIENCY_REOPENED",user.id,"DEFICIENCY",id); db.commit(); return {"success":True,"data":public(row)}
@router.get("/scrutiny/queue")
def scrutiny_queue(db:Session=Depends(get_db),user=role_guard("SCRUTINY_OFFICER"),status:str|None=None):
    query=select(ScrutinyReview); query=query.where(ScrutinyReview.status==status) if status else query; return {"success":True,"data":[public(x) for x in db.scalars(query).all()]}


OFFICER_QUEUE_STAGES = {
    "SCRUTINY_OFFICER": ("INSTITUTION_VERIFIED", "RESUBMITTED"),
    "VERIFICATION_OFFICER": ("SUBMITTED",),
    "INSTITUTION_NODAL_OFFICER": ("SUBMITTED",),
}


def enriched_application_rows(db: Session, applications) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    rows = []
    for app in applications:
        applicant = db.get(Applicant, app.applicant_id)
        applicant_user = db.get(User, applicant.user_id) if applicant else None
        scheme = db.get(Scheme, app.scheme_id)
        created = app.created_at
        if created and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        days = (now - created).days if created else 0
        rows.append({
            "id": app.id,
            "application_number": app.application_number,
            "applicant": applicant_user.full_name if applicant_user else None,
            "applicant_id": app.applicant_id,
            "scheme": scheme.name if scheme else None,
            "scheme_code": scheme.code if scheme else None,
            "scheme_id": app.scheme_id,
            "stage": app.status,
            "status": app.status,
            "priority": "High" if days >= 14 else "Medium" if days >= 7 else "Low",
            "sla_days": days,
            "created_at": app.created_at,
        })
    return rows


@router.get("/officer/queue")
def officer_queue(db:Session=Depends(get_db),user=Depends(require_roles("SCRUTINY_OFFICER","VERIFICATION_OFFICER","INSTITUTION_NODAL_OFFICER","SUPER_ADMIN"))):
    query = select(Application).where(Application.status != "DRAFT")
    if user.role == "INSTITUTION_NODAL_OFFICER":
        from app.core.access import institution_id_for
        inst_id = institution_id_for(db, user)
        if not inst_id:
            return {"success": True, "data": []}
        inst_row = db.get(Institution, inst_id)
        inst_code = inst_row.code if inst_row else None
        inst_name = inst_row.name if inst_row else None
        apps = db.scalars(query).all()
        matched = []
        for x in apps:
            ans = x.answers or {}
            app_inst = str(ans.get("institution_id") or ans.get("institution") or ans.get("institutionName") or "")
            if app_inst in (str(inst_id), str(inst_code), str(inst_name)) or (inst_name and inst_name.lower() in app_inst.lower()):
                matched.append(x)
        apps = matched
    else:
        stages = OFFICER_QUEUE_STAGES.get(user.role)
        if stages:
            query = query.where(Application.status.in_(stages))
        apps = db.scalars(query.order_by(Application.created_at)).all()
    return {"success": True, "data": enriched_application_rows(db, apps)}
@router.get("/scrutiny/applications/{id}")
def scrutiny_application(id:str,db:Session=Depends(get_db),user=role_guard("SCRUTINY_OFFICER","VERIFICATION_OFFICER","SUPER_ADMIN")): application_for_actor(db,id,user); return {"success":True,"data":[public(x) for x in db.scalars(select(ScrutinyReview).where(ScrutinyReview.application_id==id)).all()]}
@router.post("/scrutiny/applications/{id}/start")
def start_scrutiny(id:str,db:Session=Depends(get_db),user=role_guard("SCRUTINY_OFFICER")):
    get_or_404(db,Application,id); row=ScrutinyReview(application_id=id,officer_id=user.id,status="IN_PROGRESS",started_at=datetime.now(timezone.utc)); db.add(row); audit(db,"SCRUTINY_STARTED",user.id,"APPLICATION",id); db.commit(); return {"success":True,"data":public(row)}
@router.post("/scrutiny/applications/{id}/notes")
def scrutiny_notes(id:str,body:ScrutinyNoteIn,db:Session=Depends(get_db),user=role_guard("SCRUTINY_OFFICER")):
    row=db.scalar(select(ScrutinyReview).where(ScrutinyReview.application_id==id,ScrutinyReview.officer_id==user.id).order_by(ScrutinyReview.created_at.desc()));
    if not row: raise NotFound("Scrutiny review not found")
    row.notes=(row.notes or "")+"\n"+body.note; db.commit(); return {"success":True,"data":public(row)}
@router.post("/scrutiny/applications/{id}/complete")
def complete_scrutiny(id:str,db:Session=Depends(get_db),user=role_guard("SCRUTINY_OFFICER")):
    application = get_or_404(db, Application, id)
    if application.status not in ("INSTITUTION_VERIFIED", "RESUBMITTED"):
        raise InvalidTransition(f"Scrutiny cannot be completed from {application.status}")
    row=db.scalar(select(ScrutinyReview).where(ScrutinyReview.application_id==id,ScrutinyReview.officer_id==user.id).order_by(ScrutinyReview.created_at.desc()))
    if not row:
        row = ScrutinyReview(application_id=id, officer_id=user.id, status="IN_PROGRESS")
        db.add(row)
        db.flush()
    row.status="COMPLETED"; row.completed_at=datetime.now(timezone.utc); row.decision="COMPLETE"
    move_application_status(db, application, "ELIGIBILITY_CONFIRMED", user.id, "Scrutiny completed", "SCRUTINY_COMPLETED")
    db.commit()
    return {"success":True,"data":public(row)}
@router.post("/scrutiny/applications/{id}/return")
def return_scrutiny(id:str,db:Session=Depends(get_db),user=role_guard("SCRUTINY_OFFICER")):
    application = get_or_404(db, Application, id)
    if application.status not in ("INSTITUTION_VERIFIED", "RESUBMITTED"):
        raise InvalidTransition(f"Scrutiny cannot be returned from {application.status}")
    row=db.scalar(select(ScrutinyReview).where(ScrutinyReview.application_id==id,ScrutinyReview.officer_id==user.id).order_by(ScrutinyReview.created_at.desc()))
    if not row:
        row = ScrutinyReview(application_id=id, officer_id=user.id, status="IN_PROGRESS")
        db.add(row)
        db.flush()
    row.status="RETURNED"; row.completed_at=datetime.now(timezone.utc); row.decision="RETURN"
    move_application_status(db, application, "DEFICIENCY_RAISED", user.id, "Scrutiny returned for clarification", "SCRUTINY_RETURNED")
    db.commit()
    return {"success":True,"data":public(row)}
@router.post("/scrutiny/applications/{id}/reject")
def reject_scrutiny(id:str,body:ScrutinyNoteIn,db:Session=Depends(get_db),user=role_guard("SCRUTINY_OFFICER")):
    application = get_or_404(db, Application, id)
    if application.status not in ("INSTITUTION_VERIFIED", "RESUBMITTED"):
        raise InvalidTransition(f"Scrutiny cannot be rejected from {application.status}")
    row=db.scalar(select(ScrutinyReview).where(ScrutinyReview.application_id==id,ScrutinyReview.officer_id==user.id).order_by(ScrutinyReview.created_at.desc()))
    if not row:
        row = ScrutinyReview(application_id=id, officer_id=user.id, status="IN_PROGRESS")
        db.add(row)
        db.flush()
    row.status="REJECTED"; row.completed_at=datetime.now(timezone.utc); row.decision="REJECT"; row.notes=(row.notes or "")+"\n"+body.note
    move_application_status(db, application, "REJECTED", user.id, body.note or "Rejected during scrutiny", "SCRUTINY_REJECTED")
    db.commit()
    return {"success":True,"data":public(row)}
@router.post("/institutions/applications/{id}/verify")
def verify_institution_application(id:str,body:VerificationIn,db:Session=Depends(get_db),user=role_guard("INSTITUTION_NODAL_OFFICER","VERIFICATION_OFFICER")):
    application=application_for_actor(db,id,user)
    institution_id=body.fields.get("institution_id")
    if not institution_id:
        link = db.scalar(select(InstitutionUser).where(InstitutionUser.user_id==user.id))
        if link:
            institution_id = link.institution_id
        else:
            raise Forbidden("INSTITUTION_SCOPE_REQUIRED: Officer is not linked to an institution")
    if user.role == "INSTITUTION_NODAL_OFFICER":
        app_inst = (application.answers or {}).get("institution_id") or (application.answers or {}).get("institution")
        if app_inst and str(app_inst) != str(institution_id):
            raise Forbidden("Application does not belong to your institution")
    row=InstitutionVerificationRecord(application_id=id,institution_id=institution_id,verifier_id=user.id,result=body.result,fields=body.fields,note=body.note)
    db.add(row)
    if body.result == "VERIFIED":
        move_application_status(db, application, "INSTITUTION_VERIFIED", user.id, "Institution verified", "INSTITUTION_VERIFICATION")
    elif body.result in ("REJECTED", "NEED_CLARIFICATION"):
        target = "DEFICIENCY_RAISED" if body.result == "NEED_CLARIFICATION" else "REJECTED"
        move_application_status(db, application, target, user.id, body.note or f"Institution result: {body.result}", "INSTITUTION_VERIFICATION")
    audit(db,"INSTITUTION_VERIFICATION",user.id,"APPLICATION",id,{"result":body.result})
    db.commit()
    return {"success":True,"data":public(row)}
@router.post("/institutions/applications/{id}/request-clarification")
def request_institution_clarification(id:str,body:VerificationIn,db:Session=Depends(get_db),user=role_guard("INSTITUTION_NODAL_OFFICER","VERIFICATION_OFFICER")):
    body.result="NEED_CLARIFICATION"; return verify_institution_application(id,body,db,user)
@router.post("/applications/{id}/submit")
def real_submit_application(id:str,db:Session=Depends(get_db),user=Depends(current_user),idempotency_key:str|None=Header(default=None,alias="Idempotency-Key")):
    row=application_for_actor(db,id,user)
    if idempotency_key:
        existing=db.scalar(select(IdempotencyRecord).where(IdempotencyRecord.key==idempotency_key,IdempotencyRecord.user_id==user.id,IdempotencyRecord.route==f"submit:{id}"))
        if existing:
            if existing.response is not None: return existing.response
            raise Conflict("Request is already in progress")
        idem=IdempotencyRecord(key=idempotency_key,user_id=user.id,route=f"submit:{id}",request_hash="submit",status_code=200); db.add(idem)
    if row.status!="DRAFT": raise InvalidTransition(f"Cannot submit from {row.status}")
    if not row.answers: raise Conflict("Application has no answers")
    required=db.scalars(select(SchemeDocument).where(SchemeDocument.scheme_version_id==row.scheme_version_id,SchemeDocument.required.is_(True),SchemeDocument.status=="ACTIVE")).all()
    missing=[]
    for requirement in required:
        matching=db.scalar(select(Document).where(Document.application_id==id,Document.document_type==requirement.document_code,Document.status.in_(["READY","VERIFIED","HUMAN_VERIFIED"])))
        if not matching: missing.append({"document_type":requirement.document_code,"reason":"Required for this scheme version"})
    if missing: raise RequiredDocumentsMissing("Required documents are missing",{"details":missing})
    old=row.status; row.status="SUBMITTED"; row.version+=1; db.add(ApplicationVersion(application_id=id,version_number=row.version,actor_id=user.id,reason="SUBMITTED",snapshot=row.answers)); db.add(ApplicationStatusHistory(application_id=id,from_status=old,to_status=row.status,actor_id=user.id,reason="Applicant submission")); audit(db,"APPLICATION_SUBMITTED",user.id,"APPLICATION",id); result={"success":True,"data":{"id":id,"status":row.status}}
    if idempotency_key: idem.response=result
    db.commit(); return result
@router.get("/applications/{id}/versions")
def real_application_versions(id:str,db:Session=Depends(get_db),user=Depends(current_user)): application_for_actor(db,id,user); return {"success":True,"data":[public(x) for x in db.scalars(select(ApplicationVersion).where(ApplicationVersion.application_id==id).order_by(ApplicationVersion.version_number)).all()]}
@router.get("/applications/{id}/answers")
def real_application_answers(id:str,db:Session=Depends(get_db),user=Depends(current_user)): application_for_actor(db,id,user); return {"success":True,"data":[public(x) for x in db.scalars(select(ApplicationAnswer).where(ApplicationAnswer.application_id==id)).all()]}
