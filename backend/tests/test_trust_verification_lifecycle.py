import os
import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

os.environ.setdefault('DATABASE_URL','sqlite:///./test-suite.db')
os.environ.setdefault('ENVIRONMENT','test')
from app.main import app
from app.core.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app.domain.models import User, Applicant, Application, Document, Scheme
from app.domain.relational_models import (
    Evidence, VerificationCase, DecisionTrace, VerificationFinding,
    Deficiency, EligibilityRun, EligibilityRuleResult
)
from app.domain.core_completion_models import FinanceInstallment, PaymentAttempt
from app.core.audit import AuditLog
from app.scheme_engine import evaluate_rules

Base.metadata.create_all(engine)

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

@pytest.fixture(scope="module")
def setup_data():
    with SessionLocal() as db:
        admin_email = f"admin-{uuid.uuid4().hex[:8]}@test.com"
        admin = User(email=admin_email, password_hash=hash_password("test"), role="SUPER_ADMIN", full_name="Admin")
        
        applicant_email = f"applicant-{uuid.uuid4().hex[:8]}@test.com"
        applicant_user = User(email=applicant_email, password_hash=hash_password("test"), role="APPLICANT", full_name="App")
        
        verifier_email = f"verifier-{uuid.uuid4().hex[:8]}@test.com"
        verifier = User(email=verifier_email, password_hash=hash_password("test"), role="VERIFICATION_OFFICER", full_name="Verifier")
        
        finance_email = f"finance-{uuid.uuid4().hex[:8]}@test.com"
        finance_user = User(email=finance_email, password_hash=hash_password("test"), role="FINANCE_OFFICER", full_name="Finance")
        
        db.add_all([admin, applicant_user, verifier, finance_user])
        db.commit()
        
        scheme = Scheme(name="Test Scheme", code="TEST_SCHEME")
        db.add(scheme)
        db.commit()
        
        from app.domain.models import SchemeVersion
        scheme_version = SchemeVersion(scheme_id=scheme.id, version="1.0", status="PUBLISHED")
        db.add(scheme_version)
        db.commit()
        
        applicant = Applicant(user_id=applicant_user.id, profile={"full_name": "Test Applicant", "aadhaar_hash": "1234"})
        db.add(applicant)
        db.commit()
        
        application = Application(applicant_id=applicant.id, scheme_id=scheme.id, scheme_version_id=scheme_version.id, cycle="2024-25", status="SUBMITTED", application_number="APP-123")
        db.add(application)
        db.commit()
        
        return {
            "admin": admin, "applicant_user": applicant_user, "verifier": verifier, 
            "finance_user": finance_user, "applicant": applicant, "application": application,
            "scheme": scheme, "scheme_version": scheme_version
        }

def get_token(client, email):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "test"})
    return r.json()["data"]["access_token"]

def test_evidence_and_verification_case(client, setup_data):
    token = get_token(client, setup_data["verifier"].email)
    headers = {"Authorization": f"Bearer {token}"}
    app_id = setup_data["application"].id
    
    r = client.post(f"/api/v1/applications/{app_id}/evidence", headers=headers, json={
        "evidence_type": "INCOME_CERTIFICATE",
        "field_name": "annual_income",
        "observed_value": 150000,
        "source": "MANUAL",
        "confidence": 0.95
    })
    assert r.status_code == 201
    ev_id = r.json()["data"]["id"]
    
    r = client.post(f"/api/v1/evidence/{ev_id}/verify", headers=headers, json={"verified": True})
    assert r.status_code == 200
    assert r.json()["data"]["verified"] is True
    
    r = client.post(f"/api/v1/applications/{app_id}/verification-cases", headers=headers, json={
        "priority": "HIGH"
    })
    assert r.status_code == 201
    case_id = r.json()["data"]["id"]
    
    r = client.post(f"/api/v1/verification-cases/{case_id}/assign", headers=headers, json={
        "assignee_id": setup_data["verifier"].id
    })
    assert r.status_code == 200
    
    r = client.post(f"/api/v1/verification-cases/{case_id}/complete", headers=headers, json={
        "notes": "Looks good"
    })
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "COMPLETED"

def test_decision_trace_creation(client, setup_data):
    token = get_token(client, setup_data["verifier"].email)
    headers = {"Authorization": f"Bearer {token}"}
    app_id = setup_data["application"].id
    
    r = client.post(f"/api/v1/applications/{app_id}/decision-traces", headers=headers, json={
        "decision_type": "ELIGIBILITY",
        "decision_status": "CONFIRMED",
        "reason": "Passed all rules",
        "input_snapshot": {"income": 150000},
        "steps": [
            {
                "step_type": "RULE_CHECK",
                "description": "Income < 250000",
                "result": "PASSED"
            }
        ]
    })
    assert r.status_code == 201
    assert r.json()["data"]["decision_type"] == "ELIGIBILITY"

def test_audit_tamper_evident_chain(client, setup_data):
    token = get_token(client, setup_data["admin"].email)
    headers = {"Authorization": f"Bearer {token}"}
    
    r = client.get("/api/v1/audit/verify", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["valid"] is True
    
    with SessionLocal() as db:
        log = db.query(AuditLog).first()
        if log:
            log.data = {"tampered": True}
            db.commit()
    
    r = client.get("/api/v1/audit/verify", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["valid"] is False

def test_rule_operators():
    res = evaluate_rules([{'rule_id':'D1','name':'d1','field':'dob','operator':'DATE_BEFORE','value':'2000-01-01'}], {'dob': '1999-05-15'})
    assert res['rules'][0]['passed'] is True
    
    res = evaluate_rules([{'rule_id':'D2','name':'d2','field':'dob','operator':'DATE_AFTER','value':'2000-01-01'}], {'dob': '2001-05-15'})
    assert res['rules'][0]['passed'] is True
    
    res = evaluate_rules([{'rule_id':'M1','name':'m1','field':'name','operator':'MATCH','value':'John Doe'}], {'name': 'john doe'})
    assert res['rules'][0]['passed'] is True
    
    res = evaluate_rules([{'rule_id':'C1','name':'c1','field':'application.name','operator':'CROSS_DOCUMENT_MATCH','value':'document.name'}], {'application': {'name': 'Jane'}, 'document': {'name': 'JANE'}})
    assert res['rules'][0]['passed'] is True

def test_workflow_prerequisites(client, setup_data):
    token = get_token(client, setup_data["verifier"].email)
    headers = {"Authorization": f"Bearer {token}"}
    
    with SessionLocal() as db:
        new_app = Application(applicant_id=setup_data["applicant"].id, scheme_id=setup_data["scheme"].id, scheme_version_id=setup_data["scheme_version"].id, cycle="2025-26", status="SUBMITTED", application_number=f"APP-{uuid.uuid4().hex[:8]}")
        db.add(new_app)
        db.commit()
        new_app_id = new_app.id
        
        case = VerificationCase(application_id=new_app_id, priority="HIGH", status="OPEN")
        db.add(case)
        db.commit()
        
    r = client.post(f"/api/v1/applications/{new_app_id}/status", headers=headers, json={"status": "ELIGIBILITY_CONFIRMED"})
    assert r.status_code == 409
    assert "Verification case" in str(r.json()) or "Prerequisite" in str(r.json())

def test_deficiency_lifecycle(client, setup_data):
    token = get_token(client, setup_data["verifier"].email)
    headers = {"Authorization": f"Bearer {token}"}
    app_id = setup_data["application"].id
    
    r = client.post(f"/api/v1/applications/{app_id}/deficiencies", headers=headers, json={
        "type": "DOCUMENT_MISSING",
        "description": "Missing income cert",
        "severity": "HIGH",
        "required_action": "Upload it"
    })
    assert r.status_code == 201
    d_id = r.json()["data"]["id"]
    
    r = client.post(f"/api/v1/deficiencies/{d_id}/resolve", headers=headers, json={
        "resolution_notes": "Found it"
    })
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "RESOLVED"

def test_payment_lifecycle(client, setup_data):
    token = get_token(client, setup_data["finance_user"].email)
    headers = {"Authorization": f"Bearer {token}"}
    
    with SessionLocal() as db:
        inst = FinanceInstallment(expected_amount=5000, installment_no=1, provider="mock", status="QUEUED")
        db.add(inst)
        db.commit()
        inst_id = inst.id
    
    r = client.post(f"/api/v1/finance/installments/{inst_id}/pay", headers=headers, json={"provider": "mock"})
    assert r.status_code in [200, 201]
    
    r = client.post(f"/api/v1/finance/installments/{inst_id}/fail", headers=headers, json={"failure_reason": "Bank offline"})
    assert r.status_code == 200
    
    r = client.post(f"/api/v1/finance/installments/{inst_id}/retry", headers=headers)
    assert r.status_code == 200
    
    r = client.post(f"/api/v1/finance/installments/{inst_id}/return", headers=headers, json={"return_reason": "Invalid account"})
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "RETURNED"

def test_separation_of_duties(client, setup_data):
    token = get_token(client, setup_data["verifier"].email)
    headers = {"Authorization": f"Bearer {token}"}
    app_id = setup_data["application"].id
    
    with SessionLocal() as db:
        u = db.get(User, setup_data["verifier"].id)
        u.role = "APPROVING_AUTHORITY"
        db.commit()
        
        dt = DecisionTrace(application_id=app_id, decision_type="VERIFICATION", decision_status="VERIFIED", input_snapshot={}, actor_id=u.id)
        db.add(dt)
        db.commit()
        
    r = client.post(f"/api/v1/applications/{app_id}/approvals", headers=headers, json={"decision": "APPROVED", "note": "ok"})
    assert r.status_code == 409
    assert "Separation of duties" in str(r.json())

def test_deterministic_duplicate_detection(client, setup_data):
    token = get_token(client, setup_data["verifier"].email)
    headers = {"Authorization": f"Bearer {token}"}
    app_id = setup_data["application"].id

    with SessionLocal() as db:
        # A different cycle for the same applicant+scheme is an overlapping
        # application (the DB only forbids an identical applicant/scheme/cycle).
        dup = Application(applicant_id=setup_data["applicant"].id, scheme_id=setup_data["scheme"].id, scheme_version_id=setup_data["scheme_version"].id, cycle="2026-27", status="SUBMITTED", application_number=f"APP-{uuid.uuid4().hex[:8]}")
        db.add(dup)
        db.commit()

    r = client.post(f"/api/v1/applications/{app_id}/check-duplicates", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["total_flags"] > 0

def test_consent_apis(client, setup_data):
    token = get_token(client, setup_data["applicant_user"].email)
    headers = {"Authorization": f"Bearer {token}"}
    app_id = setup_data["application"].id
    
    r = client.post("/api/v1/consent", headers=headers, json={
        "application_id": app_id,
        "consent_type": "DATA_SHARING",
        "purpose": "Aadhaar authentication",
        "policy_version": "1.0",
        "scope": "READ_IDENTITY"
    })
    assert r.status_code == 201
    c_id = r.json()["data"]["id"]
    
    r = client.get("/api/v1/consent/current", headers=headers)
    assert r.status_code == 200
    
    r = client.post(f"/api/v1/consent/{c_id}/revoke", headers=headers, json={})
    assert r.status_code == 200
    assert r.json()["data"]["granted"] is False


def test_consent_history_route_not_shadowed(client, setup_data):
    """`/consent/history` must not be captured by the `/{id}` route.

    FastAPI matches routes in declaration order, so `/history` has to be
    declared before `/consent/{id}` or it 404s as a missing consent id.
    """
    token = get_token(client, setup_data["applicant_user"].email)
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post("/api/v1/consent", headers=headers, json={
        "consent_type": "DATA_SHARING",
        "purpose": "Route ordering regression check",
    })
    assert created.status_code == 201

    r = client.get("/api/v1/consent/history", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)
    # The row created above must be present in the caller's own history.
    assert any(c["consent_type"] == "DATA_SHARING" for c in body["data"])


def test_document_replace_with_idempotency_key(client, setup_data):
    """Caching a replace response must survive the datetime fields.

    `IdempotencyRecord.response` is a JSON column, so the response dict has to
    be encoded before it is stored or the write fails with "Object of type
    datetime is not JSON serializable" and the endpoint 500s.
    """
    token = get_token(client, setup_data["applicant_user"].email)
    headers = {"Authorization": f"Bearer {token}"}
    app_id = setup_data["application"].id

    up = client.post(
        "/api/v1/documents",
        headers=headers,
        params={"application_id": app_id, "document_type": "INCOME_PROOF"},
        files={"file": ("proof.pdf", b"%PDF-1.4 original", "application/pdf")},
    )
    assert up.status_code == 201, up.text
    doc_id = up.json()["data"]["id"]

    idem = {"Idempotency-Key": f"replace-{uuid.uuid4().hex}"}
    first = client.post(
        f"/api/v1/documents/{doc_id}/replace",
        headers={**headers, **idem},
        files={"file": ("proof-v2.pdf", b"%PDF-1.4 replacement", "application/pdf")},
    )
    assert first.status_code == 201, first.text

    # Replaying the same key must return the cached response, not re-upload.
    replay = client.post(
        f"/api/v1/documents/{doc_id}/replace",
        headers={**headers, **idem},
        files={"file": ("proof-v2.pdf", b"%PDF-1.4 replacement", "application/pdf")},
    )
    assert replay.status_code == 201, replay.text
    assert replay.json() == first.json()
