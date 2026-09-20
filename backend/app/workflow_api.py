from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.permissions import current_user, require_roles
from app.core.errors import Conflict, InvalidTransition, NotFound
from app.core.audit import audit
from app.domain.models import Application, User
from app.domain.relational_models import SchemeWorkflow, ApplicationStatusHistory, WorkingCalendar, Holiday, IdempotencyRecord
from app.domain.core_completion_models import WorkflowAssignment, WorkflowSLAEvent
from app.core.access import application_for_actor
router=APIRouter(tags=["Workflow and SLA"])
def public(o): return {column.key: getattr(o, column.key) for column in o.__table__.columns}
def get(db,c,i):
    x=db.get(c,i)
    if not x: raise NotFound(f"{c.__name__} not found")
    return x
class TransitionIn(BaseModel):
    to_state:str
    reason:str|None=None
    expected_version:int|None=None
class CalendarIn(BaseModel): name:str; timezone:str="Asia/Kolkata"; working_weekdays:list[int]=Field(default_factory=lambda:[0,1,2,3,4])
class HolidayIn(BaseModel): calendar_id:str; date:datetime; name:str
class AssignmentIn(BaseModel):
    stage: str
    assignee_id: str | None = None
    due_days: int = Field(default=5, ge=0)
class SLAActionIn(BaseModel):
    reason: str
class EscalationIn(BaseModel):
    reason: str
    to_user_id: str | None = None
def _active_assignment(db, application_id, stage=None):
    query = select(WorkflowAssignment).where(WorkflowAssignment.application_id == application_id, WorkflowAssignment.status == "ACTIVE")
    if stage:
        query = query.where(WorkflowAssignment.stage == stage)
    return db.scalar(query.order_by(WorkflowAssignment.assigned_at.desc()))


def _due_date(db, start, days):
    calendar = db.scalar(select(WorkingCalendar).order_by(WorkingCalendar.created_at))
    if not calendar or days <= 0:
        return start + timedelta(days=days)
    holidays = {h.date.date() for h in db.scalars(select(Holiday).where(Holiday.calendar_id == calendar.id)).all()}
    current, remaining = start, days
    while remaining:
        current += timedelta(days=1)
        if current.weekday() in (calendar.working_weekdays or []) and current.date() not in holidays:
            remaining -= 1
    return current


@router.post("/applications/{id}/assign", status_code=201)
def assign_application(id: str, body: AssignmentIn, db: Session = Depends(get_db), user=Depends(require_roles("SUPER_ADMIN", "SCHEME_MANAGER", "VERIFICATION_OFFICER", "SCRUTINY_OFFICER")), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    application = get(db, Application, id)
    assignee = get(db, User, body.assignee_id) if body.assignee_id else None
    active = _active_assignment(db, id, body.stage)
    if active and active.assignee_id == body.assignee_id:
        return {"success": True, "data": public(active)}
    if active:
        active.status = "REASSIGNED"
        active.completed_at = datetime.now(timezone.utc)
        db.add(WorkflowSLAEvent(assignment_id=active.id, event_type="REASSIGNED", reason="Reassigned"))
    now = datetime.now(timezone.utc)
    row = WorkflowAssignment(application_id=application.id, stage=body.stage, assignee_id=assignee.id if assignee else None, assigned_by=user.id, assigned_at=now, due_at=_due_date(db, now, body.due_days))
    db.add(row); db.flush(); db.add(WorkflowSLAEvent(assignment_id=row.id, event_type="ASSIGNED", reason="Initial assignment"))
    audit(db, "APPLICATION_ASSIGNED", user.id, "APPLICATION", id, {"stage": body.stage, "assignee_id": body.assignee_id})
    db.commit()
    return {"success": True, "data": public(row)}


@router.post("/applications/{id}/reassign", status_code=201)
def reassign_application(id: str, body: AssignmentIn, db: Session = Depends(get_db), user=Depends(require_roles("SUPER_ADMIN", "SCHEME_MANAGER"))):
    return assign_application(id, body, db, user, None)


@router.get("/applications/{id}/sla")
def application_sla(id: str, db: Session = Depends(get_db), user=Depends(current_user)):
    get(db, Application, id)
    rows = db.scalars(select(WorkflowAssignment).where(WorkflowAssignment.application_id == id).order_by(WorkflowAssignment.assigned_at)).all()
    return {"success": True, "data": [{**public(x), "events": [public(e) for e in db.scalars(select(WorkflowSLAEvent).where(WorkflowSLAEvent.assignment_id == x.id).order_by(WorkflowSLAEvent.at)).all()]} for x in rows]}


def _sla_action(id, action, reason, db, user):
    assignment = get(db, WorkflowAssignment, id)
    if action == "PAUSE":
        if assignment.status != "ACTIVE" or assignment.paused_at:
            raise Conflict("Assignment is not active or is already paused")
        assignment.paused_at = datetime.now(timezone.utc); assignment.sla_status = "PAUSED"
    elif action == "RESUME":
        if not assignment.paused_at or assignment.status != "ACTIVE":
            raise Conflict("Assignment is not paused")
        assignment.resumed_at = datetime.now(timezone.utc); assignment.paused_at = None; assignment.sla_status = "ON_TRACK"
    elif action == "BREACH":
        if assignment.status != "ACTIVE": raise Conflict("Only active assignments can breach")
        assignment.sla_status = "BREACHED"
    elif action == "COMPLETE":
        if assignment.status != "ACTIVE": raise Conflict("Assignment is not active")
        assignment.status = "COMPLETED"; assignment.completed_at = datetime.now(timezone.utc); assignment.sla_status = "COMPLETED"
    event = WorkflowSLAEvent(assignment_id=assignment.id, event_type=action, reason=reason); db.add(event)
    audit(db, f"SLA_{action}", user.id, "WORKFLOW_ASSIGNMENT", assignment.id, {"reason": reason})
    db.commit()
    return {"success": True, "data": public(assignment)}


@router.post("/workflow-assignments/{id}/pause")
def pause_assignment(id: str, body: SLAActionIn, db: Session = Depends(get_db), user=Depends(require_roles("SUPER_ADMIN", "SCHEME_MANAGER", "VERIFICATION_OFFICER", "SCRUTINY_OFFICER"))):
    return _sla_action(id, "PAUSE", body.reason, db, user)


@router.post("/workflow-assignments/{id}/resume")
def resume_assignment(id: str, body: SLAActionIn, db: Session = Depends(get_db), user=Depends(require_roles("SUPER_ADMIN", "SCHEME_MANAGER", "VERIFICATION_OFFICER", "SCRUTINY_OFFICER"))):
    return _sla_action(id, "RESUME", body.reason, db, user)


@router.post("/workflow-assignments/{id}/breach")
def breach_assignment(id: str, body: SLAActionIn, db: Session = Depends(get_db), user=Depends(require_roles("SUPER_ADMIN", "SCHEME_MANAGER"))):
    return _sla_action(id, "BREACH", body.reason, db, user)


@router.post("/workflow-assignments/{id}/complete")
def complete_assignment(id: str, body: SLAActionIn, db: Session = Depends(get_db), user=Depends(require_roles("SUPER_ADMIN", "SCHEME_MANAGER", "VERIFICATION_OFFICER", "SCRUTINY_OFFICER"))):
    return _sla_action(id, "COMPLETE", body.reason, db, user)


@router.post("/workflow-assignments/{id}/escalate")
def escalate_assignment(id: str, body: EscalationIn, db: Session = Depends(get_db), user=Depends(require_roles("SUPER_ADMIN", "SCHEME_MANAGER"))):
    assignment = get(db, WorkflowAssignment, id)
    if assignment.status != "ACTIVE": raise Conflict("Only active assignments can be escalated")
    assignment.escalated_at = datetime.now(timezone.utc); assignment.sla_status = "BREACHED" if assignment.due_at and assignment.due_at < assignment.escalated_at else assignment.sla_status
    if body.to_user_id: get(db, User, body.to_user_id); assignment.assignee_id = body.to_user_id
    db.add(WorkflowSLAEvent(assignment_id=id, event_type="ESCALATED", reason=body.reason)); audit(db, "SLA_ESCALATED", user.id, "WORKFLOW_ASSIGNMENT", id, {"to_user_id": body.to_user_id, "reason": body.reason}); db.commit()
    return {"success": True, "data": public(assignment)}


@router.get("/applications/{id}/available-transitions")
def available(id:str,db:Session=Depends(get_db),user=Depends(current_user)):
    app=application_for_actor(db,id,user); flow=db.scalar(select(SchemeWorkflow).where(SchemeWorkflow.scheme_version_id==app.scheme_version_id)); definition=flow.definition if flow else {}
    return {"success":True,"data":[x for x in definition.get("transitions",[]) if x.get("from")==app.status]}
@router.post("/applications/{id}/transition")
def transition(id:str,body:TransitionIn,db:Session=Depends(get_db),user=Depends(current_user),idempotency_key:str|None=Header(default=None,alias="Idempotency-Key")):
    app=application_for_actor(db,id,user)
    if idempotency_key:
        old=db.scalar(select(IdempotencyRecord).where(IdempotencyRecord.key==idempotency_key,IdempotencyRecord.user_id==user.id,IdempotencyRecord.route==f"transition:{id}"))
        if old:
            if old.response is not None:return old.response
            raise Conflict("Request already in progress")
        old=IdempotencyRecord(key=idempotency_key,user_id=user.id,route=f"transition:{id}",request_hash=body.model_dump_json(),status_code=200); db.add(old)
    if body.expected_version is not None and body.expected_version!=app.version: raise Conflict("Stale application version",{"expected":body.expected_version,"actual":app.version})
    flow=db.scalar(select(SchemeWorkflow).where(SchemeWorkflow.scheme_version_id==app.scheme_version_id)); transitions=(flow.definition if flow else {}).get("transitions",[])
    match=next((x for x in transitions if x.get("from")==app.status and x.get("to")==body.to_state),None)
    if not match: raise InvalidTransition(f"Cannot transition from {app.status} to {body.to_state}")
    old_status=app.status; app.status=body.to_state; app.version+=1; db.add(ApplicationStatusHistory(application_id=id,from_status=old_status,to_status=app.status,actor_id=user.id,reason=body.reason)); audit(db,"WORKFLOW_TRANSITION",user.id,"APPLICATION",id,{"from":old_status,"to":app.status,"reason":body.reason}); result={"success":True,"data":{"id":id,"status":app.status,"version":app.version}}
    if idempotency_key: old.response=result
    db.commit(); return result
@router.get("/admin/calendars")
def calendars(db:Session=Depends(get_db),user=Depends(require_roles("SUPER_ADMIN","SCHEME_MANAGER"))): return {"success":True,"data":[public(x) for x in db.scalars(select(WorkingCalendar)).all()]}
@router.post("/admin/calendars",status_code=201)
def create_calendar(body:CalendarIn,db:Session=Depends(get_db),user=Depends(require_roles("SUPER_ADMIN"))):
    row=WorkingCalendar(**body.model_dump()); db.add(row); audit(db,"CONFIG_CHANGED",user.id,"WORKING_CALENDAR",row.id); db.commit(); return {"success":True,"data":public(row)}
@router.patch("/admin/calendars/{id}")
def patch_calendar(id:str,body:CalendarIn,db:Session=Depends(get_db),user=Depends(require_roles("SUPER_ADMIN"))):
    row=get(db,WorkingCalendar,id); [setattr(row,k,v) for k,v in body.model_dump().items()]; audit(db,"CONFIG_CHANGED",user.id,"WORKING_CALENDAR",id); db.commit(); return {"success":True,"data":public(row)}
@router.get("/admin/holidays")
def holidays(calendar_id:str|None=None,db:Session=Depends(get_db),user=Depends(require_roles("SUPER_ADMIN","SCHEME_MANAGER"))):
    q=select(Holiday).where(Holiday.calendar_id==calendar_id) if calendar_id else select(Holiday); return {"success":True,"data":[public(x) for x in db.scalars(q).all()]}
@router.post("/admin/holidays",status_code=201)
def create_holiday(body:HolidayIn,db:Session=Depends(get_db),user=Depends(require_roles("SUPER_ADMIN"))):
    get(db,WorkingCalendar,body.calendar_id); row=Holiday(**body.model_dump()); db.add(row); audit(db,"CONFIG_CHANGED",user.id,"HOLIDAY",row.id); db.commit(); return {"success":True,"data":public(row)}
@router.patch("/admin/holidays/{id}")
def patch_holiday(id:str,body:HolidayIn,db:Session=Depends(get_db),user=Depends(require_roles("SUPER_ADMIN"))):
    row=get(db,Holiday,id); [setattr(row,k,v) for k,v in body.model_dump().items()]; audit(db,"CONFIG_CHANGED",user.id,"HOLIDAY",id); db.commit(); return {"success":True,"data":public(row)}
@router.delete("/admin/holidays/{id}")
def delete_holiday(id:str,db:Session=Depends(get_db),user=Depends(require_roles("SUPER_ADMIN"))):
    row=get(db,Holiday,id); db.delete(row); audit(db,"CONFIG_CHANGED",user.id,"HOLIDAY",id,{"deleted":True}); db.commit(); return {"success":True,"data":{"deleted":True}}
