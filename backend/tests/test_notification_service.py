import os
from uuid import uuid4

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("ENVIRONMENT", "test")

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import Base, SessionLocal, engine
from app.core.security import create_token, hash_password
from app.domain.models import User
from app.domain.relational_models import Grievance, IntegrationLog, Notification
from app.main import app

Base.metadata.create_all(engine)
client = TestClient(app)


def make_user(role: str):
    user = User(email=f"{uuid4()}@example.com", password_hash=hash_password("StrongPassword1!"),
                full_name="Boundary Test", role=role)
    with SessionLocal() as db:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def token(user):
    return create_token(user.id, user.role)


def test_notification_uses_relational_row_and_mock_provider():
    staff = make_user("HELPDESK_AGENT")
    recipient = make_user("APPLICANT")
    response = client.post(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {token(staff)}", "Idempotency-Key": "notification-test-1"},
        json={"user_id": recipient.id, "channel": "EMAIL", "body": "Your update is ready"},
    )
    assert response.status_code == 201
    assert response.json()["data"]["provider"]["provider"] == "mock-email"
    with SessionLocal() as db:
        assert db.scalar(select(Notification).where(Notification.user_id == recipient.id)) is not None
        assert db.scalar(select(IntegrationLog).where(IntegrationLog.operation == "send_notification")) is not None


def test_grievance_transition_is_idempotent_and_auditable():
    officer = make_user("GRIEVANCE_OFFICER")
    create = client.post(
        "/api/v1/grievances",
        headers={"Authorization": f"Bearer {token(officer)}", "Idempotency-Key": "grievance-test-1"},
        json={"category": "PROCESS", "subject": "Status question", "description": "Please clarify status"},
    )
    assert create.status_code == 201
    grievance_id = create.json()["data"]["id"]
    headers = {"Authorization": f"Bearer {token(officer)}", "Idempotency-Key": "transition-test-1"}
    first = client.post(f"/api/v1/grievances/{grievance_id}/transition", headers=headers,
                        json={"status": "IN_PROGRESS"})
    second = client.post(f"/api/v1/grievances/{grievance_id}/transition", headers=headers,
                         json={"status": "IN_PROGRESS"})
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    with SessionLocal() as db:
        assert db.get(Grievance, grievance_id).status == "IN_PROGRESS"


def test_report_exports_csv_and_xlsx():
    analyst = make_user("MONITORING_ANALYST")
    headers = {"Authorization": f"Bearer {token(analyst)}"}
    csv_response = client.get("/api/v1/reports/summary/export?format=csv", headers=headers)
    xlsx_response = client.get("/api/v1/reports/summary/export?format=xlsx", headers=headers)
    assert csv_response.status_code == 200
    assert "group,metric,value" in csv_response.text
    assert xlsx_response.status_code == 200
    assert xlsx_response.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert xlsx_response.content[:2] == b"PK"
