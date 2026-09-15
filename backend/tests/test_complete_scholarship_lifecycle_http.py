"""HTTP-level deterministic lifecycle proof for the completion stages."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.domain.models import User, Scheme, SchemeVersion, Applicant, Application
from app.domain.relational_models import SelectionRound, SelectionCandidate, Award
from app.core.audit import AuditLog


def test_http_completion_lifecycle_with_all_external_providers_off():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    db = Session()
    manager = User(email="http-manager@example.com", password_hash=hash_password("secret123"), full_name="Manager", role="SCHEME_MANAGER")
    approver = User(email="http-approver@example.com", password_hash=hash_password("secret123"), full_name="Approver", role="APPROVING_AUTHORITY")
    delegate = User(email="http-delegate@example.com", password_hash=hash_password("secret123"), full_name="Delegate", role="APPROVING_AUTHORITY")
    finance = User(email="http-finance@example.com", password_hash=hash_password("secret123"), full_name="Finance", role="FINANCE_OFFICER")
    db.add_all([manager, approver, delegate, finance]); db.flush()
    scheme = Scheme(code="HTTP-DEMO", name="DEMO_CONFIGURATION_NOT_OFFICIAL"); db.add(scheme); db.flush()
    version = SchemeVersion(scheme_id=scheme.id, version="1", status="PUBLISHED"); db.add(version); db.flush()
    applicant = Applicant(user_id=manager.id); applicant2 = Applicant(user_id=delegate.id); db.add_all([applicant, applicant2]); db.flush()
    application = Application(application_number="HTTP-0001", applicant_id=applicant.id, scheme_id=scheme.id, scheme_version_id=version.id, cycle="2026"); application2 = Application(application_number="HTTP-0002", applicant_id=applicant2.id, scheme_id=scheme.id, scheme_version_id=version.id, cycle="2026"); db.add_all([application, application2]); db.flush()
    round_ = SelectionRound(scheme_version_id=version.id, name="HTTP Selection"); db.add(round_); db.flush()
    c1 = SelectionCandidate(round_id=round_.id, application_id=application.id, total_score=90); c2 = SelectionCandidate(round_id=round_.id, application_id=application2.id, total_score=90); db.add_all([c1, c2]); db.flush()
    award = Award(application_id=application.id, scheme_version_id=version.id, amount=1000, awarded_by=approver.id); db.add(award); db.commit()

    app.dependency_overrides[get_db] = lambda: Session()
    try:
        with TestClient(app) as client:
            def token(email):
                response = client.post("/api/v1/auth/login", json={"email": email, "password": "secret123"})
                assert response.status_code == 200, response.text
                return response.json()["data"]["access_token"]

            manager_headers = {"Authorization": f"Bearer {token(manager.email)}"}
            approver_headers = {"Authorization": f"Bearer {token(approver.email)}"}
            finance_headers = {"Authorization": f"Bearer {token(finance.email)}"}

            assigned = client.post(f"/api/v1/applications/{application.id}/assign", headers=manager_headers, json={"stage": "SCRUTINY", "assignee_id": manager.id, "due_days": 2})
            assert assigned.status_code == 201, assigned.text
            assignment_id = assigned.json()["data"]["id"]
            assert client.post(f"/api/v1/workflow-assignments/{assignment_id}/pause", headers=manager_headers, json={"reason": "Clarification"}).status_code == 200
            assert client.post(f"/api/v1/workflow-assignments/{assignment_id}/resume", headers=manager_headers, json={"reason": "Clarification resolved"}).status_code == 200

            tie = client.post(f"/api/v1/selection-rounds/{round_.id}/ties/resolve", headers=manager_headers, json={"strategy": "MANUAL_ORDER", "candidate_ids": [c1.id, c2.id], "reason": "Configured deterministic order"})
            assert tie.status_code == 201, tie.text
            finalized = client.post(f"/api/v1/selection-rounds/{round_.id}/finalize", headers=manager_headers)
            assert finalized.status_code == 200, finalized.text

            delegation = client.post(f"/api/v1/applications/{application.id}/approval-delegation", headers=approver_headers, json={"to_user_id": delegate.id, "reason": "Temporary delegation", "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()})
            assert delegation.status_code == 201, delegation.text
            hold = client.post(f"/api/v1/applications/{application.id}/approval-hold", headers=approver_headers, json={"reason": "Awaiting final packet"})
            assert hold.status_code == 201, hold.text

            installment = client.post(f"/api/v1/awards/{award.id}/installments", headers=finance_headers, json={"installment_no": 1, "expected_amount": 1000})
            assert installment.status_code == 201, installment.text
            payment_id = installment.json()["data"]["id"]
            payment = client.post(f"/api/v1/finance/installments/{payment_id}/pay", headers=finance_headers, json={"actual_amount": 1000, "payment_reference": "HTTP-PAY-1"})
            assert payment.status_code == 200, payment.text

        check = Session()
        assert check.scalar(select(AuditLog).where(AuditLog.event_type == "APPLICATION_ASSIGNED")) is not None
        assert check.scalar(select(AuditLog).where(AuditLog.event_type == "INSTALLMENT_PAID")) is not None
        check.close()
    finally:
        app.dependency_overrides.clear()
        db.close()
