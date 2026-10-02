import os
import uuid
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite:///./test-suite.db")
os.environ.setdefault("ENVIRONMENT", "test")

from app.main import app
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.domain.models import User, Applicant, Application, Scheme, SchemeVersion, SchemeRule
from app.domain.relational_models import Evidence, Award, SelectionRound, SelectionCandidate
from app.domain.core_completion_models import FinanceInstallment


def get_token(client: TestClient, email: str, password: str = "test") -> str:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["data"]["access_token"]


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def hardening_data():
    with SessionLocal() as db:
        admin_email = f"admin-{uuid.uuid4().hex[:8]}@test.com"
        admin = User(email=admin_email, password_hash=hash_password("test"), role="SUPER_ADMIN", full_name="Admin User")

        verifier_email = f"verifier-{uuid.uuid4().hex[:8]}@test.com"
        verifier = User(email=verifier_email, password_hash=hash_password("test"), role="VERIFICATION_OFFICER", full_name="Verifier")

        finance_email = f"finance-{uuid.uuid4().hex[:8]}@test.com"
        finance = User(email=finance_email, password_hash=hash_password("test"), role="FINANCE_OFFICER", full_name="Finance Officer")

        app_user_email = f"applicant-{uuid.uuid4().hex[:8]}@test.com"
        app_user = User(email=app_user_email, password_hash=hash_password("test"), role="APPLICANT", full_name="Hardened Applicant")

        db.add_all([admin, verifier, finance, app_user])
        db.commit()

        scheme = Scheme(name="Hardened Scheme", code=f"SCHEME_{uuid.uuid4().hex[:6]}")
        db.add(scheme)
        db.commit()

        scheme_version = SchemeVersion(scheme_id=scheme.id, version="1.0", status="PUBLISHED")
        db.add(scheme_version)
        db.commit()

        # Add an age rule for eligibility testing
        rule = SchemeRule(
            scheme_version_id=scheme_version.id,
            rule_id="RULE_MIN_AGE",
            name="Minimum Age",
            field="age",
            operator="GREATER_THAN_OR_EQUAL",
            value=18,
            source_reference="POLICY_SEC_3",
        )
        db.add(rule)
        db.commit()

        applicant = Applicant(
            user_id=app_user.id,
            profile={"full_name": "Hardened Applicant", "aadhaar_hash": "hardened-hash-123"},
        )
        db.add(applicant)
        db.commit()

        application = Application(
            applicant_id=applicant.id,
            scheme_id=scheme.id,
            scheme_version_id=scheme_version.id,
            cycle="2026-2027",
            status="SUBMITTED",
            application_number=f"APP-HARDEN-{uuid.uuid4().hex[:6]}",
            answers={"age": 22, "income": 200000},
        )
        db.add(application)
        db.commit()

        return {
            "admin_email": admin_email,
            "verifier_email": verifier_email,
            "finance_email": finance_email,
            "applicant_email": app_user_email,
            "application_id": application.id,
            "applicant_id": applicant.id,
            "scheme_id": scheme.id,
            "scheme_version_id": scheme_version.id,
        }


def test_evidence_validation_and_get(client, hardening_data):
    token = get_token(client, hardening_data["verifier_email"])
    headers = {"Authorization": f"Bearer {token}"}
    app_id = hardening_data["application_id"]

    # 1. Invalid confidence (> 1.0) -> 422
    invalid_conf = client.post(
        f"/api/v1/applications/{app_id}/evidence",
        headers=headers,
        json={"evidence_type": "AGE_PROOF", "field_name": "age", "observed_value": 22, "confidence": 1.5},
    )
    assert invalid_conf.status_code == 422

    # 2. Empty observed_value -> 409
    empty_val = client.post(
        f"/api/v1/applications/{app_id}/evidence",
        headers=headers,
        json={"evidence_type": "AGE_PROOF", "field_name": "age", "observed_value": ""},
    )
    assert empty_val.status_code == 409

    # 3. Valid evidence creation -> 201
    valid_res = client.post(
        f"/api/v1/applications/{app_id}/evidence",
        headers=headers,
        json={"evidence_type": "AGE_PROOF", "field_name": "age", "observed_value": 22, "confidence": 0.95},
    )
    assert valid_res.status_code == 201
    ev_id = valid_res.json()["data"]["id"]

    # 4. Fetch evidence by ID -> 200
    get_res = client.get(f"/api/v1/evidence/{ev_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["field_name"] == "age"
    assert get_res.json()["data"]["observed_value"] == 22


def test_verification_finding_get(client, hardening_data):
    token = get_token(client, hardening_data["verifier_email"])
    headers = {"Authorization": f"Bearer {token}"}
    app_id = hardening_data["application_id"]

    post_res = client.post(
        f"/api/v1/applications/{app_id}/findings",
        headers=headers,
        json={"category": "DATA_CHECK", "severity": "LOW", "description": "Minor spelling discrepancy"},
    )
    assert post_res.status_code == 201
    finding_id = post_res.json()["data"]["id"]

    get_res = client.get(f"/api/v1/findings/{finding_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["id"] == finding_id
    assert get_res.json()["data"]["category"] == "DATA_CHECK"


def test_eligibility_links_evidence_in_decision_trace(client, hardening_data):
    token = get_token(client, hardening_data["verifier_email"])
    headers = {"Authorization": f"Bearer {token}"}
    app_id = hardening_data["application_id"]

    # Evaluate eligibility
    eval_res = client.post(f"/api/v1/eligibility/applications/{app_id}/evaluate", headers=headers)
    assert eval_res.status_code == 200
    trace_id = eval_res.json()["data"]["trace_id"]

    # Read decision trace
    trace_res = client.get(f"/api/v1/decision-traces/{trace_id}", headers=headers)
    assert trace_res.status_code == 200
    steps = trace_res.json()["data"]["steps"]
    assert len(steps) > 0
    # The rule was for field 'age', for which we added evidence in the previous test!
    age_step = next((s for s in steps if "age" in s["description"].lower()), None)
    assert age_step is not None
    assert age_step.get("evidence_id") is not None
    assert age_step.get("rule_result_id") is not None


def test_finance_installment_lifecycle_and_integration_log(client, hardening_data):
    finance_token = get_token(client, hardening_data["finance_email"])
    headers = {"Authorization": f"Bearer {finance_token}"}
    app_id = hardening_data["application_id"]
    version_id = hardening_data["scheme_version_id"]

    with SessionLocal() as db:
        admin_user = db.query(User).filter(User.email == hardening_data["admin_email"]).first()
        # Create an award for application
        award = Award(application_id=app_id, scheme_version_id=version_id, amount=50000, status="ACTIVE", awarded_by=admin_user.id)
        db.add(award)
        db.commit()
        award_id = award.id

    # 1. Create installment
    create_res = client.post(
        f"/api/v1/awards/{award_id}/installments",
        headers=headers,
        json={"installment_no": 1, "expected_amount": 25000},
    )
    assert create_res.status_code == 201
    inst_id = create_res.json()["data"]["id"]

    # 2. Validate fails without bank details
    val_fail = client.post(f"/api/v1/finance/installments/{inst_id}/validate", headers=headers)
    assert val_fail.status_code == 409
    assert "Bank details" in val_fail.text

    # Provide bank details on application answers
    with SessionLocal() as db:
        app_obj = db.get(Application, app_id)
        current_answers = dict(app_obj.answers or {})
        current_answers["bank_account_number"] = "123456789012"
        app_obj.answers = current_answers
        db.commit()

    # 3. Validate succeeds
    val_ok = client.post(f"/api/v1/finance/installments/{inst_id}/validate", headers=headers)
    assert val_ok.status_code == 200
    assert val_ok.json()["data"]["status"] == "VALIDATED"

    # 4. Queue installment
    queue_res = client.post(f"/api/v1/finance/installments/{inst_id}/queue", headers=headers)
    assert queue_res.status_code == 200
    assert queue_res.json()["data"]["status"] == "QUEUED"

    # 5. Submit installment
    sub_res = client.post(f"/api/v1/finance/installments/{inst_id}/submit", headers=headers)
    assert sub_res.status_code == 200
    assert sub_res.json()["data"]["status"] == "SUBMITTED"

    # 6. Pay installment
    pay_res = client.post(f"/api/v1/finance/installments/{inst_id}/pay", headers=headers, json={"actual_amount": 25000})
    assert pay_res.status_code == 200
    assert pay_res.json()["data"]["status"] == "PAID"

    # 7. Check installment history has the transition steps
    hist_res = client.get(f"/api/v1/finance/installments/{inst_id}/history", headers=headers)
    assert hist_res.status_code == 200
    history = hist_res.json()["data"]["status_history"]
    statuses = [h["to_status"] for h in history]
    assert "VALIDATED" in statuses
    assert "QUEUED" in statuses
    assert "SUBMITTED" in statuses
    assert "PAID" in statuses

    # 8. Check IntegrationLog recorded the disburse call
    admin_token = get_token(client, hardening_data["admin_email"])
    log_res = client.get("/api/v1/integration-logs?operation=disburse_installment", headers={"Authorization": f"Bearer {admin_token}"})
    assert log_res.status_code == 200
    logs = log_res.json()["data"]
    assert len(logs) > 0
    assert logs[0]["operation"] == "disburse_installment"


def test_decision_packet_enrichment(client, hardening_data):
    admin_token = get_token(client, hardening_data["admin_email"])
    headers = {"Authorization": f"Bearer {admin_token}"}
    app_id = hardening_data["application_id"]

    res = client.get(f"/api/v1/applications/{app_id}/decision-packet", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]

    # Verify new enriched fields
    assert "scheme" in data
    assert "rule_results" in data
    assert "recommendations" in data
    assert "summary_reason" in data
    assert len(data["summary_reason"]) > 10


def test_consent_get_endpoint(client, hardening_data):
    app_token = get_token(client, hardening_data["applicant_email"])
    headers = {"Authorization": f"Bearer {app_token}"}

    create_res = client.post(
        "/api/v1/consent",
        headers=headers,
        json={"consent_type": "DATA_SHARING", "purpose": "Scholarship eligibility verification"},
    )
    assert create_res.status_code == 201
    consent_id = create_res.json()["data"]["id"]

    get_res = client.get(f"/api/v1/consent/{consent_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["id"] == consent_id
    assert get_res.json()["data"]["purpose"] == "Scholarship eligibility verification"


def test_duplicate_check_output_structure(client, hardening_data):
    admin_token = get_token(client, hardening_data["admin_email"])
    headers = {"Authorization": f"Bearer {admin_token}"}
    app_id = hardening_data["application_id"]

    # Create a duplicate application for the same applicant (different cycle)
    with SessionLocal() as db:
        dup = Application(
            applicant_id=hardening_data["applicant_id"],
            scheme_id=hardening_data["scheme_id"],
            scheme_version_id=hardening_data["scheme_version_id"],
            cycle="2025-2026",
            status="SUBMITTED",
            application_number=f"APP-DUP-{uuid.uuid4().hex[:6]}",
        )
        db.add(dup)
        db.commit()
        dup_id = dup.id

    res = client.get(f"/api/v1/applications/{dup_id}/duplicate-checks", headers=headers)
    assert res.status_code == 200
    findings = res.json()["data"]
    assert len(findings) > 0
    f = findings[0]
    # Check exact contract fields required by spec
    assert "matched_field" in f
    assert "matched_value" in f
    assert "related_application_id" in f
    assert "reason" in f
