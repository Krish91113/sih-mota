"""Relational notification/provider boundary, grievances, and reporting."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.database import get_db
from app.core.errors import Conflict, Forbidden, InvalidTransition, NotFound
from app.core.timeutils import as_utc, elapsed_days, elapsed_seconds, is_past, utcnow
from app.integrations.notification_providers import DeliveryResult, get_email_provider, get_sms_provider
from app.core.permissions import current_user, require_roles
from app.domain.models import Applicant, Application, User
from app.domain.relational_models import (
    Grievance,
    GrievanceMessage,
    IntegrationLog,
    Notification,
    NotificationTemplate,
)
from app.idempotency import complete, get_or_create

router = APIRouter(tags=["Notifications, Grievances and Reports"])

GRIEVANCE_TRANSITIONS = {
    "OPEN": {"IN_PROGRESS", "CLOSED"},
    "IN_PROGRESS": {"AWAITING_APPLICANT", "RESOLVED", "CLOSED"},
    "AWAITING_APPLICANT": {"IN_PROGRESS", "RESOLVED", "CLOSED"},
    "RESOLVED": {"CLOSED", "REOPENED"},
    "REOPENED": {"IN_PROGRESS", "CLOSED"},
    "CLOSED": set(),
}
NOTIFICATION_CHANNELS = {"IN_APP", "EMAIL", "SMS"}
REPORT_ROLES = (
    "AUDITOR",
    "MONITORING_ANALYST",
    "GRIEVANCE_OFFICER",
    "SCHEME_MANAGER",
    "APPROVING_AUTHORITY",
    "FINANCE_OFFICER",
    "SUPER_ADMIN",
)


def public(obj: Any) -> dict[str, Any]:
    return {key: value for key, value in obj.__dict__.items() if not key.startswith("_")}


def get_or_404(db: Session, model: Any, ident: str) -> Any:
    row = db.get(model, ident)
    if not row:
        raise NotFound(f"{model.__name__} not found")
    return row


def finish(db: Session, record: Any, result: dict[str, Any]) -> dict[str, Any]:
    if record is not None:
        complete(record, 200, jsonable_encoder(result))
    db.commit()
    return result


def mutation(db: Session, key: str | None, user_id: str, route: str, payload: dict[str, Any]):
    if not key:
        return None
    record = get_or_create(db, key, user_id, route, payload)
    if record.response is not None:
        return record.response
    return record


def mock_deliver(channel: str, recipient: str, subject: str | None, body: str) -> dict[str, Any]:
    """Synchronous provider seam; production adapters can replace this function."""
    return {
        "provider": f"mock-{channel.lower()}",
        "accepted": True,
        "recipient": recipient,
        "subject": subject,
        "body_length": len(body),
        "delivered_at": datetime.now(timezone.utc).isoformat(),
    }


async def email_user(db: Session, recipient: User, subject: str, body: str) -> None:
    """Best-effort user email used by workflow events and explicit notifications."""
    result = await get_email_provider().send(recipient.email, subject, body)
    row = Notification(
        user_id=recipient.id,
        channel="EMAIL",
        payload={"subject": subject, "body": body, "event_email": True},
        status=result.status,
    )
    db.add(row)
    db.flush()
    if result.delivered_at:
        row.delivered_at = datetime.now(timezone.utc)
    db.add(IntegrationLog(
        provider=result.provider,
        operation="send_event_email",
        status="SUCCEEDED" if result.accepted else "FAILED",
        external_reference=row.id,
        request_metadata={"recipient": recipient.email},
        response_metadata={"status": result.status, "failure_reason": result.failure_reason},
    ))


class NotificationIn(BaseModel):
    user_id: str
    channel: str = "IN_APP"
    template_code: str | None = None
    subject: str | None = None
    body: str | None = None
    html_body: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class GrievanceIn(BaseModel):
    category: str
    subject: str
    description: str
    priority: str = "NORMAL"
    applicant_id: str | None = None


class MessageIn(BaseModel):
    message: str
    internal: bool = False


class AssignmentIn(BaseModel):
    assignee_id: str


class TransitionIn(BaseModel):
    status: str
    reason: str | None = None


def _notification_template(db: Session, code: str | None) -> NotificationTemplate | None:
    if not code:
        return None
    template = db.scalar(select(NotificationTemplate).where(NotificationTemplate.code == code))
    if not template or not template.published:
        raise NotFound("Published notification template not found")
    return template


@router.post("/notifications", status_code=201)
async def send_notification(
    body: NotificationIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles("SUPER_ADMIN", "SCHEME_MANAGER", "GRIEVANCE_OFFICER", "HELPDESK_AGENT")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    recipient = get_or_404(db, User, body.user_id)
    if body.channel not in NOTIFICATION_CHANNELS:
        raise Conflict("Unsupported notification channel")
    template = _notification_template(db, body.template_code)
    subject = body.subject if body.subject is not None else template.subject if template else None
    message = body.body if body.body is not None else template.body if template else ""
    if not message and body.channel != "IN_APP":
        raise Conflict("Notification body is required")
    payload = {**body.payload, "recipient": recipient.email}
    record = mutation(db, idempotency_key, user.id, "notifications:create", body.model_dump())
    if isinstance(record, dict):
        return record
    provider = get_email_provider() if body.channel == "EMAIL" else get_sms_provider()
    if body.channel == "IN_APP":
        provider_result=DeliveryResult("in-app",True,"SENT",delivered_at=datetime.now(timezone.utc).isoformat())
    else:
        provider_result=await provider.send(recipient.email,subject,message,body.html_body)
    row = Notification(user_id=recipient.id, template_id=template.id if template else None,
                       channel=body.channel, payload={"subject": subject, "body": message, "html_body": body.html_body, **payload},
                       status=provider_result.status)
    db.add(row); db.flush()
    if provider_result.delivered_at: row.delivered_at=datetime.now(timezone.utc)
    db.add(IntegrationLog(provider=provider_result.provider, operation="send_notification",
                          status="SUCCEEDED" if provider_result.accepted else "FAILED", external_reference=row.id,
                          request_metadata={"channel": body.channel}, response_metadata={"status":provider_result.status,"accepted":provider_result.accepted,"failure_reason":provider_result.failure_reason}))
    audit(db, "NOTIFICATION_SENT" if provider_result.accepted else "NOTIFICATION_FAILED", user.id, "NOTIFICATION", row.id,
          {"channel": body.channel, "provider": provider_result.provider, "status":provider_result.status})
    result = {"success": provider_result.accepted, "data": {**public(row), "provider": {"provider":provider_result.provider,"status":provider_result.status,"accepted":provider_result.accepted,"failure_reason":provider_result.failure_reason}}}
    return finish(db, record, result)


@router.get("/notifications")
def list_notifications(db: Session = Depends(get_db), user=Depends(current_user), unread_only: bool = False):
    query = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    rows = db.scalars(query.order_by(Notification.created_at.desc())).all()
    return {"success": True, "data": [public(row) for row in rows]}


@router.get("/notifications/sent")
def list_sent_notifications(
    status: str | None = None,
    channel: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles("SUPER_ADMIN", "SCHEME_MANAGER", "GRIEVANCE_OFFICER")),
):
    query = select(Notification)
    if status:
        query = query.where(Notification.status == status)
    if channel:
        query = query.where(Notification.channel == channel)
    rows = db.scalars(query.order_by(Notification.created_at.desc()).limit(200)).all()
    recipients = {
        row.id: row
        for row in db.scalars(select(User).where(User.id.in_({n.user_id for n in rows}))).all()
    } if rows else {}
    data = []
    for row in rows:
        recipient = recipients.get(row.user_id)
        data.append({**public(row), "recipient_email": recipient.email if recipient else None, "recipient_name": recipient.full_name if recipient else None})
    return {"success": True, "data": data}


class MarkReadIn(BaseModel):
    notification_ids: list[str] = Field(default_factory=list)
    all: bool = False


@router.post("/notifications/mark-read")
def mark_notifications_read(body: MarkReadIn, db: Session = Depends(get_db), user=Depends(current_user)):
    from sqlalchemy import update
    now = datetime.now(timezone.utc)
    if body.all:
        db.execute(
            update(Notification)
            .where(Notification.user_id == user.id, Notification.read_at.is_(None))
            .values(read_at=now)
        )
    elif body.notification_ids:
        db.execute(
            update(Notification)
            .where(Notification.user_id == user.id, Notification.id.in_(body.notification_ids))
            .values(read_at=now)
        )
    db.commit()
    return {"success": True, "data": {"marked_read": len(body.notification_ids) if not body.all else "all"}}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, db: Session = Depends(get_db), user=Depends(current_user)):
    row = get_or_404(db, Notification, notification_id)
    if row.user_id != user.id:
        raise Forbidden("Notification does not belong to this user")
    if row.read_at is None:
        row.read_at = datetime.now(timezone.utc)
        db.commit()
    return {"success": True, "data": public(row)}


class TemplateIn(BaseModel):
    code: str = Field(min_length=1)
    channel: str = "EMAIL"
    subject: str | None = None
    body: str = Field(min_length=1)
    published: bool = True


@router.get("/notification-templates")
def list_notification_templates(db: Session = Depends(get_db), user=Depends(require_roles("SUPER_ADMIN", "SCHEME_MANAGER"))):
    rows = db.scalars(select(NotificationTemplate).order_by(NotificationTemplate.code)).all()
    return {"success": True, "data": [public(row) for row in rows]}


@router.post("/notification-templates", status_code=201)
def create_notification_template(body: TemplateIn, db: Session = Depends(get_db), user=Depends(require_roles("SUPER_ADMIN"))):
    existing = db.scalar(select(NotificationTemplate).where(NotificationTemplate.code == body.code))
    if existing:
        raise Conflict("Template code already exists")
    row = NotificationTemplate(
        code=body.code,
        channel=body.channel,
        subject=body.subject,
        body=body.body,
        published=body.published,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    audit(db, "NOTIFICATION_TEMPLATE_CREATED", user.id, "NOTIFICATION_TEMPLATE", row.id)
    return {"success": True, "data": public(row)}



@router.post("/grievances", status_code=201)
async def create_grievance(
    body: GrievanceIn,
    db: Session = Depends(get_db),
    user=Depends(current_user),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    applicant_id = body.applicant_id
    if user.role == "APPLICANT":
        applicant = db.scalar(select(Applicant).where(Applicant.user_id == user.id))
        applicant_id = applicant.id if applicant else None
    record = mutation(db, idempotency_key, user.id, "grievances:create", body.model_dump())
    if isinstance(record, dict):
        return record
    row = Grievance(applicant_id=applicant_id, created_by=user.id, status="OPEN", **body.model_dump(exclude={"applicant_id"}))
    db.add(row)
    db.flush()
    audit(db, "GRIEVANCE_CREATED", user.id, "GRIEVANCE", row.id, {"category": row.category})
    recipient = user if user.role == "APPLICANT" else None
    if applicant_id and not recipient:
        applicant = db.get(Applicant, applicant_id)
        recipient = db.get(User, applicant.user_id) if applicant else None
    if recipient:
        await email_user(db, recipient, f"Grievance received: {row.subject}", f"Your grievance has been received. Reference: {row.id}.\n\nWe will update you when its status changes.")
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.get("/grievances")
def list_grievances(status: str | None = None, db: Session = Depends(get_db), user=Depends(current_user)):
    query = select(Grievance)
    if user.role == "APPLICANT":
        query = query.where(Grievance.created_by == user.id)
    if status:
        query = query.where(Grievance.status == status)
    return {"success": True, "data": [public(row) for row in db.scalars(query.order_by(Grievance.created_at.desc())).all()]}


@router.get("/grievances/{grievance_id}")
def get_grievance(grievance_id: str, db: Session = Depends(get_db), user=Depends(current_user)):
    row = get_or_404(db, Grievance, grievance_id)
    if user.role == "APPLICANT" and row.created_by != user.id:
        raise Forbidden("Grievance is not accessible to this user")
    messages = db.scalars(select(GrievanceMessage).where(GrievanceMessage.grievance_id == row.id).order_by(GrievanceMessage.created_at)).all()
    return {"success": True, "data": {**public(row), "messages": [public(message) for message in messages if not message.internal or user.role != "APPLICANT"]}}


@router.post("/grievances/{grievance_id}/messages", status_code=201)
async def add_grievance_message(
    grievance_id: str,
    body: MessageIn,
    db: Session = Depends(get_db),
    user=Depends(current_user),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    grievance = get_or_404(db, Grievance, grievance_id)
    if user.role == "APPLICANT" and grievance.created_by != user.id:
        raise Forbidden("Grievance is not accessible to this user")
    if grievance.status == "CLOSED":
        raise InvalidTransition("Closed grievances cannot receive messages")
    if body.internal and user.role not in REPORT_ROLES and user.role != "SUPER_ADMIN":
        raise Forbidden("Only grievance staff can add internal messages")
    record = mutation(db, idempotency_key, user.id, f"grievances:{grievance_id}:messages", body.model_dump())
    if isinstance(record, dict):
        return record
    row = GrievanceMessage(grievance_id=grievance_id, author_id=user.id, **body.model_dump())
    db.add(row)
    db.flush()
    audit(db, "GRIEVANCE_MESSAGE_ADDED", user.id, "GRIEVANCE", grievance_id, {"internal": body.internal})
    if not body.internal and grievance.applicant_id:
        applicant = db.get(Applicant, grievance.applicant_id)
        recipient = db.get(User, applicant.user_id) if applicant else None
        if recipient and recipient.id != user.id:
            await email_user(db, recipient, f"Update to grievance: {grievance.subject}", body.message)
    result = {"success": True, "data": public(row)}
    return finish(db, record, result)


@router.post("/grievances/{grievance_id}/assign")
def assign_grievance(
    grievance_id: str,
    body: AssignmentIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles("GRIEVANCE_OFFICER", "SUPER_ADMIN")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    grievance = get_or_404(db, Grievance, grievance_id)
    get_or_404(db, User, body.assignee_id)
    record = mutation(db, idempotency_key, user.id, f"grievances:{grievance_id}:assign", body.model_dump())
    if isinstance(record, dict):
        return record
    grievance.assigned_to = body.assignee_id
    audit(db, "GRIEVANCE_ASSIGNED", user.id, "GRIEVANCE", grievance_id, body.model_dump())
    return finish(db, record, {"success": True, "data": public(grievance)})


@router.post("/grievances/{grievance_id}/transition")
async def transition_grievance(
    grievance_id: str,
    body: TransitionIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles("GRIEVANCE_OFFICER", "SUPER_ADMIN")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    grievance = get_or_404(db, Grievance, grievance_id)
    record = mutation(db, idempotency_key, user.id, f"grievances:{grievance_id}:transition", body.model_dump())
    if isinstance(record, dict):
        return record
    if body.status not in GRIEVANCE_TRANSITIONS.get(grievance.status or "OPEN", set()):
        raise InvalidTransition(f"Cannot transition grievance from {grievance.status} to {body.status}")
    old_status = grievance.status
    grievance.status = body.status
    audit(db, "GRIEVANCE_STATUS_CHANGED", user.id, "GRIEVANCE", grievance_id,
          {"from": old_status, "to": body.status, "reason": body.reason})
    if grievance.applicant_id:
        applicant = db.get(Applicant, grievance.applicant_id)
        recipient = db.get(User, applicant.user_id) if applicant else None
        if recipient:
            await email_user(db, recipient, f"Grievance status updated: {grievance.subject}", f"Your grievance status is now {body.status}.\n\nReference: {grievance.id}")
    return finish(db, record, {"success": True, "data": public(grievance)})


def aggregate_report(db: Session, scheme_id: str | None = None, date_from: datetime | None = None, date_to: datetime | None = None) -> dict[str, Any]:
    application_query = select(Application.status, func.count(Application.id)).group_by(Application.status)
    if scheme_id: application_query = application_query.where(Application.scheme_id == scheme_id)
    if date_from: application_query = application_query.where(Application.created_at >= date_from)
    if date_to: application_query = application_query.where(Application.created_at <= date_to)
    applications = db.execute(application_query).all()
    grievances = db.execute(select(Grievance.status, func.count(Grievance.id)).group_by(Grievance.status)).all()
    notifications = db.execute(select(Notification.channel, func.count(Notification.id)).group_by(Notification.channel)).all()
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "applications_by_status": {status: count for status, count in applications},
        "grievances_by_status": {status or "OPEN": count for status, count in grievances},
        "notifications_by_channel": {channel: count for channel, count in notifications},
        "totals": {
            "applications": sum(count for _, count in applications),
            "grievances": sum(count for _, count in grievances),
            "notifications": sum(count for _, count in notifications),
        },
    }


def report_rows(report: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for group, values in report.items():
        if isinstance(values, dict):
            for key, value in values.items():
                rows.append({"group": group, "metric": key, "value": value})
        else:
            rows.append({"group": "metadata", "metric": group, "value": values})
    return rows


def calculate_dashboard_kpis(db: Session, scheme_id: str | None = None) -> dict[str, Any]:
    from app.domain.core_completion_models import WorkflowAssignment, FinanceInstallment
    from app.domain.relational_models import SelectionCandidate, SelectionRound, SelectionReview, FinanceRecord

    # 1. Application KPIs
    app_q = select(Application.status, func.count(Application.id)).group_by(Application.status)
    if scheme_id:
        app_q = app_q.where(Application.scheme_id == scheme_id)
    app_status_counts = dict(db.execute(app_q).all())

    total_apps = sum(app_status_counts.values())
    draft_apps = app_status_counts.get("DRAFT", 0)
    submitted_apps = app_status_counts.get("SUBMITTED", 0)
    under_review = sum(
        app_status_counts.get(s, 0)
        for s in ("DOCUMENT_REVIEW", "INSTITUTION_VERIFICATION", "SCRUTINY", "SCREENING", "SELECTION_REVIEW", "INSTITUTION_VERIFIED", "RESUBMITTED")
    )
    deficiency_apps = app_status_counts.get("DEFICIENCY_RAISED", 0)
    eligible_apps = sum(
        app_status_counts.get(s, 0)
        for s in ("ELIGIBILITY_CONFIRMED", "PROVISIONALLY_SELECTED", "FINAL_APPROVAL")
    )
    rejected_apps = app_status_counts.get("REJECTED", 0)
    awarded_apps = sum(app_status_counts.get(s, 0) for s in ("AWARDED", "POST_SELECTION"))
    completed_apps = app_status_counts.get("COMPLETED", 0)

    # 2. Processing KPIs
    sla_breaches = db.scalar(
        select(func.count(WorkflowAssignment.id)).where(WorkflowAssignment.sla_status == "BREACHED")
    ) or 0
    pending_apps = total_apps - (draft_apps + rejected_apps + completed_apps + app_status_counts.get("WITHDRAWN", 0) + app_status_counts.get("CLOSED", 0))

    avg_days = 0.0
    processed_apps = db.scalars(
        select(Application).where(Application.status.in_(["AWARDED", "COMPLETED", "REJECTED"]))
    ).all()
    if processed_apps:
        total_time = sum(elapsed_seconds(a.created_at, a.updated_at) for a in processed_apps if a.updated_at and a.created_at)
        avg_days = round(total_time / (len(processed_apps) * 86400), 1)

    # 3. Selection KPIs
    cand_count = db.scalar(select(func.count(SelectionCandidate.id))) or 0
    cand_selected = db.scalar(select(func.count(SelectionCandidate.id)).where(SelectionCandidate.rank.is_not(None))) or 0
    cand_rejected = db.scalar(select(func.count(SelectionReview.id)).where(SelectionReview.decision == "REJECT")) or 0
    total_rounds = db.scalar(select(func.count(SelectionRound.id))) or 0
    finalized_rounds = db.scalar(select(func.count(SelectionRound.id)).where(SelectionRound.finalized_at.is_not(None))) or 0
    completion_rate = round((finalized_rounds / total_rounds * 100), 1) if total_rounds > 0 else 0.0

    # 4. Finance KPIs
    sanctioned_amount = float(db.scalar(
        select(func.coalesce(func.sum(FinanceRecord.amount), 0)).where(FinanceRecord.record_type == "SANCTION")
    ) or 0)
    disbursed_amount = float(db.scalar(
        select(func.coalesce(func.sum(FinanceRecord.amount), 0)).where(
            FinanceRecord.record_type.in_(["DISBURSEMENT", "INSTALLMENT_PAYMENT"])
        )
    ) or 0)
    pending_payments = db.scalar(
        select(func.count(FinanceInstallment.id)).where(FinanceInstallment.status.in_(["PENDING", "CREATED"]))
    ) or 0
    successful_payments = db.scalar(
        select(func.count(FinanceInstallment.id)).where(FinanceInstallment.status.in_(["PAID", "SUCCESS", "COMPLETED"]))
    ) or 0
    failed_payments = db.scalar(
        select(func.count(FinanceInstallment.id)).where(FinanceInstallment.status == "FAILED")
    ) or 0
    returned_payments = db.scalar(
        select(func.count(FinanceInstallment.id)).where(FinanceInstallment.status == "RETURNED")
    ) or 0
    reconciled_payments = db.scalar(
        select(func.count(FinanceInstallment.id)).where(FinanceInstallment.status == "RECONCILED")
    ) or 0

    # 5. Grievance KPIs
    grievance_q = select(Grievance.status, func.count(Grievance.id)).group_by(Grievance.status)
    grievance_counts = dict(db.execute(grievance_q).all())
    open_grievances = grievance_counts.get("OPEN", 0) + grievance_counts.get("REOPENED", 0)
    in_prog_grievances = grievance_counts.get("IN_PROGRESS", 0) + grievance_counts.get("UNDER_REVIEW", 0)
    resolved_grievances = grievance_counts.get("RESOLVED", 0) + grievance_counts.get("CLOSED", 0)
    now_dt = datetime.now(timezone.utc)
    all_open_g = db.scalars(
        select(Grievance).where(Grievance.status.in_(["OPEN", "IN_PROGRESS", "REOPENED", "UNDER_REVIEW"]))
    ).all()
    overdue_grievances = sum(1 for g in all_open_g if g.created_at and elapsed_days(g.created_at, now_dt) > 14)

    return {
        "generated_at": now_dt.isoformat(),
        "application_kpis": {
            "total_applications": total_apps,
            "draft": draft_apps,
            "submitted": submitted_apps,
            "under_review": under_review,
            "deficiency": deficiency_apps,
            "eligible": eligible_apps,
            "rejected": rejected_apps,
            "awarded": awarded_apps,
            "completed": completed_apps,
        },
        "processing_kpis": {
            "average_processing_time_days": avg_days,
            "pending_applications": pending_apps,
            "sla_breaches": sla_breaches,
            "applications_by_stage": app_status_counts,
        },
        "selection_kpis": {
            "candidates_reviewed": cand_count,
            "selected": cand_selected,
            "rejected": cand_rejected,
            "selection_completion_rate": completion_rate,
            "total_rounds": total_rounds,
            "finalized_rounds": finalized_rounds,
        },
        "finance_kpis": {
            "sanctioned_amount": sanctioned_amount,
            "disbursed_amount": disbursed_amount,
            "pending_payments": pending_payments,
            "successful_payments": successful_payments,
            "failed_payments": failed_payments,
            "returned_payments": returned_payments,
            "reconciled_payments": reconciled_payments,
        },
        "grievance_kpis": {
            "open": open_grievances,
            "in_progress": in_prog_grievances,
            "resolved": resolved_grievances,
            "overdue": overdue_grievances,
        },
    }


@router.get("/reports/dashboard-kpis")
@router.get("/dashboard/kpis")
def dashboard_kpis(scheme_id: str | None = None, db: Session = Depends(get_db), user=Depends(require_roles(*REPORT_ROLES))):
    return {"success": True, "data": calculate_dashboard_kpis(db, scheme_id)}


@router.get("/reports/summary")
def report_summary(scheme_id: str | None = None, date_from: datetime | None = None, date_to: datetime | None = None, db: Session = Depends(get_db), user=Depends(require_roles(*REPORT_ROLES))):
    return {"success": True, "data": aggregate_report(db, scheme_id, date_from, date_to)}



@router.get("/reports/summary/export")
def export_report(
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    scheme_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(*REPORT_ROLES)),
):
    rows = report_rows(aggregate_report(db, scheme_id, date_from, date_to))
    if format == "csv":
        stream = io.StringIO()
        writer = csv.DictWriter(stream, fieldnames=["group", "metric", "value"])
        writer.writeheader()
        writer.writerows(rows)
        content = stream.getvalue().encode("utf-8")
        media_type = "text/csv"
        filename = "mota-report.csv"
    else:
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Report"
        sheet.append(["group", "metric", "value"])
        for row in rows:
            sheet.append([row["group"], row["metric"], row["value"]])
        output = io.BytesIO()
        workbook.save(output)
        content = output.getvalue()
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "mota-report.xlsx"
    audit(db,"REPORT_EXPORTED",user.id,"REPORT",filename,{"report":"summary","format":format,"scheme_id":scheme_id,"date_from":date_from.isoformat() if date_from else None,"date_to":date_to.isoformat() if date_to else None,"row_count":len(rows)})
    db.commit()
    return StreamingResponse(io.BytesIO(content), media_type=media_type,
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def report_for(name: str, db: Session, user):
    result=aggregate_report(db); result["report_type"]=name; return {"success":True,"data":result}
@router.get("/reports/executive")
def executive_report(db: Session=Depends(get_db),user=Depends(require_roles(*REPORT_ROLES))): return report_for("executive",db,user)
@router.get("/reports/operational")
def operational_report(db: Session=Depends(get_db),user=Depends(require_roles(*REPORT_ROLES))): return report_for("operational",db,user)
@router.get("/reports/scheme")
def scheme_report(db: Session=Depends(get_db),user=Depends(require_roles(*REPORT_ROLES))): return report_for("scheme",db,user)
@router.get("/reports/processing-time")
def processing_report(db: Session=Depends(get_db),user=Depends(require_roles(*REPORT_ROLES))): return report_for("processing-time",db,user)
@router.get("/reports/selection")
def selection_report(db: Session=Depends(get_db),user=Depends(require_roles(*REPORT_ROLES))): return report_for("selection",db,user)
@router.get("/reports/grievances")
def grievances_report(db: Session=Depends(get_db),user=Depends(require_roles(*REPORT_ROLES))): return report_for("grievances",db,user)
