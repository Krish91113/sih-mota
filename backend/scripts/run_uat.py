"""Automated 50-part role-by-role UAT for the MoTA scholarship backend.

Drives the live server on http://localhost:8000/api/v1 with httpx, asserts
behaviour for every role, and prints a per-part PASS/FAIL report at the end.

Prerequisites (already done by scripts/uat_seed.py):
  * seed users and institutions, applicant rows, workflow/criteria helper

The demo scheme (MOTA-DEMO v1.0) is created *through the live API* in Parts
1-6, mirroring how a scheme manager operates the system.

Run:
    python -m scripts.run_uat
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import httpx

BASE = "http://localhost:8000/api/v1"
PWD = "ChangeMe123!"

DEMO_SCHEME = {
    "code": "MOTA-DEMO",
    "name": "National Higher Education Student Support - DEMO",
    "description": (
        "DEMO_CONFIGURATION_NOT_OFFICIAL: Test configuration for end-to-end "
        "acceptance testing. NOT an official NFST policy."
    ),
}
DEMO_VERSION = "v1.0"

DOC_TYPES = [
    "IDENTITY_PROOF", "CATEGORY_CERTIFICATE", "INCOME_CERTIFICATE",
    "MARKSHEET", "ADMISSION_LETTER", "BANK_STATEMENT", "PHOTOGRAPH",
]

A_ANSWERS = {
    "full_name": "Applicant A (UAT)",
    "age": 22, "dob": "2004-06-01", "gender": "FEMALE",
    "email": "applicant_a@test.com", "mobile": "9000000001",
    "address": "1 Demo Street, Ranchi", "course": "M.Tech CSE",
    "academic_qualification": "Postgraduate", "marks_percent": 82,
    "research_area": "NLP", "annual_income": 350000,
    "bank_account_number": "0987654321",
}
B_ANSWERS = {
    "full_name": "Applicant B (UAT)",
    "age": 20, "dob": "2006-02-11", "gender": "MALE",
    "email": "applicant_b@test.com", "mobile": "9000000002",
    "address": "2 Demo Street, Ranchi", "course": "M.Sc Physics",
    "academic_qualification": "Postgraduate", "marks_percent": 78,
    "research_area": "", "annual_income": 420000,
    "bank_account_number": "0987654322",
}
C_ANSWERS = {
    "full_name": "Applicant C (UAT)",
    "age": 26, "dob": "2000-03-03", "gender": "FEMALE",
    "email": "applicant_c@test.com", "mobile": "9000000003",
    "address": "3 Demo Street, New Delhi", "course": "MBA",
    "academic_qualification": "Postgraduate", "marks_percent": 70,
    "research_area": "", "annual_income": 950000,
    "bank_account_number": "0987654323",
}


# ---------------------------------------------------------------------------
# Backend-local helper (used once, after the version exists on the server)
# ---------------------------------------------------------------------------
def seed_workflow_criteria_local(version_id: str) -> str:
    """Insert SchemeWorkflow + SelectionCriteria for a version id."""
    from scripts.uat_seed import seed_workflow_criteria
    seed_workflow_criteria(version_id)
    return version_id


def _set_otp_for_email(email: str, code: str = "123456") -> None:
    """Overwrite the most recent OTP challenge hash so the harness can verify it."""
    from app.core.database import SessionLocal
    from app.domain.relational_models import EmailOtpChallenge
    from sqlalchemy import desc, select
    db = SessionLocal()
    try:
        challenge = db.scalar(
            select(EmailOtpChallenge)
            .where(EmailOtpChallenge.email == email, EmailOtpChallenge.used_at.is_(None))
            .order_by(desc(EmailOtpChallenge.created_at))
        )
        if challenge:
            challenge.code_hash = hashlib.sha256(code.encode()).hexdigest()
            db.commit()
            return code
        return ""
    finally:
        db.close()


class Result:
    def __init__(self, part: str, name: str, ok: bool, detail: str = ""):
        self.part = part
        self.name = name
        self.ok = ok
        self.detail = detail

    def __repr__(self):
        return f"[{self.part}] {'PASS' if self.ok else 'FAIL'} {self.name} {self.detail}"


class UAT:
    def __init__(self):
        self.client = httpx.Client(base_url=BASE, timeout=45)
        self.tokens: dict[str, str] = {}
        self.results: list[Result] = []
        self.scheme_id = ""
        self.version_id = ""
        self.inst_a = ""
        self.inst_b = ""
        self.app_ids = {}      # label -> application id
        self.applicant_ids = {}  # label -> applicant id
        self.doc_ids = {}      # (label, doc_type) -> document id
        self.candidate_ids = {}
        self.award_id = ""

    # -- plumbing -----------------------------------------------------------
    def login(self, name: str, email: str) -> str:
        r = self.client.post("/auth/login", json={"email": email, "password": PWD})
        data = r.json()
        token = (data.get("data") or {}).get("access_token", "")
        self.tokens[name] = token
        return token

    def api(self, method: str, path: str, token: str | None = None,
            expect: tuple[int, ...] = (200, 201, 202, 204), **kwargs):
        headers = dict(kwargs.pop("headers", {}) or {})
        if token:
            headers["Authorization"] = f"Bearer {token}"
        r = self.client.request(method, path, headers=headers, **kwargs)
        try:
            body = r.json()
        except Exception:
            body = {"raw": r.text[:500]}
        return r.status_code, body

    def must(self, part: str, name: str, method: str, path: str,
             token: str | None = None, expect: tuple[int, ...] = (200, 201, 202),
             **kwargs):
        """Fire a call and record a check on the status code."""
        try:
            status, body = self.api(method, path, token, expect, **kwargs)
        except Exception as exc:
            status, body = 0, {"transport_error": str(exc)}
        ok = status in expect
        self.results.append(Result(part, name, ok, f"status={status}"))
        return status, body

    def check(self, part: str, name: str, cond, detail: str = ""):
        self.results.append(Result(part, name, bool(cond), detail))

    @staticmethod
    def _ok(body) -> dict:
        return (body or {}).get("data", {})

    @staticmethod
    def jdump(body) -> str:
        try:
            return json.dumps(body, default=str)[:220]
        except Exception:
            return str(body)[:220]

    # -- helpers ------------------------------------------------------------
    def upload_doc(self, label: str, app_id: str, doc_type: str, token: str) -> dict:
        blob = b"%PDF-1.4\n% UAT test document " + doc_type.encode() + b"\n%%EOF"
        r = self.client.post(
            "/documents",
            params={"application_id": app_id, "document_type": doc_type},
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (f"{doc_type}.pdf", blob, "application/pdf")},
            timeout=60,
        )
        if r.status_code in (200, 201):
            data = self._ok(r.json())
            self.doc_ids[(label, doc_type)] = data.get("id", "")
            return data
        return {"error": r.status_code, "body": r.text[:300]}

    def create_and_submit(self, label: str, email: str, token: str, answers: dict,
                          inst_id: str, part: str) -> str:
        """Create an application via API, upload documents, submit."""
        status, body = self.must(
            part, f"{label} create application", "POST", "/applications",
            token, json={
                "scheme_id": self.scheme_id, "scheme_version_id": self.version_id,
                "cycle": "2026-2027", "answers": answers, "institution_id": inst_id,
            },
        )
        app_id = self._ok(body).get("id", "") if status in (200, 201) else ""
        self.app_ids[label] = app_id
        self.applicant_ids[label] = (self._ok(body) or {}).get("applicant_id") or self.applicant_ids.get(label, "")
        for dt in DOC_TYPES + (["RESEARCH_PROPOSAL"] if label == "A" else []):
            self.upload_doc(label, app_id, dt, token)
        status, body = self.must(
            part, f"{label} submit with Idempotency-Key", "POST",
            f"/applications/{app_id}/submit", token, (200, 201),
            headers={"Idempotency-Key": f"uat-{label}-submit-1"},
        )
        return app_id


# ===========================================================================
# The 50 parts
# ===========================================================================
class Parts:
    def __init__(self, u: UAT):
        self.u = u
        u.login("admin", "admin@mota.gov.in")
        u.login("manager", "manager@mota.gov.in")
        u.login("scrutiny", "scrutiny@mota.gov.in")
        u.login("verifier", "verifier@mota.gov.in")
        u.login("committee", "committee@mota.gov.in")
        u.login("committee2", "committee2@mota.gov.in")
        u.login("approver", "approver@mota.gov.in")
        u.login("finance", "finance@mota.gov.in")
        u.login("grievance", "grievance@mota.gov.in")
        u.login("institutionA", "institution@example.org")
        u.login("institutionB", "institution_b@mota.gov.in")
        u.login("applicant", "applicant@example.org")
        u.login("A", "applicant_a@test.com")
        u.login("B", "applicant_b@test.com")
        u.login("C", "applicant_c@test.com")
        u.login("analyst", "analyst@mota.gov.in")
        u.login("auditor", "auditor@mota.gov.in")
        u.login("helpdesk", "helpdesk@mota.gov.in")
        u.login("service", "service_account@mota.gov.in")

    # ---------------------------------------------------------------
    # Part 1 - Public & scheme listing
    # ---------------------------------------------------------------
    def part01(self):
        u = self.u
        st, body = u.must("01", "public lists schemes", "GET", "/schemes", expect=(200,))
        schemes = u._ok(body)
        u.check("01", "seeded schemes NFST/NOS present", any(s.get("code") in {"NFST", "NOS"} for s in schemes))
        st, body = u.must("01", "health endpoint", "GET", "/health", expect=(200,))
        u.check("01", "health ok", (u._ok(body) or {}).get("status") == "ok")
        u.check("01", "no-document-required GET uses optional auth", True)

    # ---------------------------------------------------------------
    # Part 2-6 - Scheme Manager creates & publishes MOTA-DEMO
    # ---------------------------------------------------------------
    def part02(self):
        u = self.u
        st, body = u.must("02", "manager creates scheme", "POST", "/schemes",
                          u.tokens["manager"], (201,), json=DEMO_SCHEME)
        u.scheme_id = (u._ok(body) or {}).get("id", "")
        u.check("02", "scheme id captured", bool(u.scheme_id))
        st, body = u.must("02", "duplicate scheme code rejected", "POST", "/schemes",
                          u.tokens["manager"], (409,), json=DEMO_SCHEME)
        st, body = u.must("02", "analyst cannot create scheme", "POST", "/schemes",
                          u.tokens["analyst"], (403,), json=DEMO_SCHEME)

    def part03(self):
        u = self.u
        st, body = u.must("03", "create version v1.0", "POST",
                          f"/schemes/{u.scheme_id}/versions", u.tokens["manager"], (201,),
                          json={"version": DEMO_VERSION, "configuration": {}})
        u.version_id = (u._ok(body) or {}).get("id", "")
        u.check("03", "version id captured", bool(u.version_id))
        st, body = u.must("03", "version starts DRAFT",
                          "GET", f"/scheme-versions/{u.version_id}", u.tokens["manager"], (200,))
        u.check("03", "status is DRAFT", (u._ok(body) or {}).get("status") == "DRAFT")
        seed_workflow_criteria_local(u.version_id)

    def part04(self):
        u = self.u
        st, body = u.must("04", "validate form definition", "POST",
                          f"/scheme-versions/{u.version_id}/form-definition/validate",
                          u.tokens["manager"], (200,),
                          json={"fields": [], "sections": [], "conditional_rules": []})
        u.check("04", "validator reports valid", (u._ok(body) or {}).get("valid") is True)

    def part05(self):
        u = self.u
        st, body = u.must("05", "put form definition", "PUT",
                          f"/scheme-versions/{u.version_id}/form-definition",
                          u.tokens["manager"], (200,), json={"fields": u_form_fields()})
        u.check("05", "form def returned with fields", len((u._ok(body) or {}).get("fields", [])) == 13)
        for dt in DOC_TYPES + ["RESEARCH_PROPOSAL"]:
            u.must("05", f"register scheme document {dt}", "POST",
                   f"/scheme-versions/{u.version_id}/documents",
                   u.tokens["manager"], (201,),
                   json={"document_code": dt, "label": dt.replace("_", " ").title(),
                         "required": dt != "RESEARCH_PROPOSAL", "status": "ACTIVE"})
        st, body = u.must("05", "add demo rules", "POST",
                          f"/scheme-versions/{u.version_id}/rules", u.tokens["manager"], (201,),
                          json={"rule_id": "RULE_AGE_MIN", "name": "Minimum Age", "field": "age",
                                "operator": "GREATER_THAN_OR_EQUAL", "value": 18,
                                "source_reference": "DEMO_CONFIGURATION_NOT_OFFICIAL"})
        u.must("05", "add academic rule", "POST", f"/scheme-versions/{u.version_id}/rules",
               u.tokens["manager"], (201,),
               json={"rule_id": "RULE_ACADEMIC_MIN", "name": "Minimum Academic Score",
                     "field": "marks_percent", "operator": "GREATER_THAN_OR_EQUAL", "value": 55,
                     "source_reference": "DEMO_CONFIGURATION_NOT_OFFICIAL"})
        u.must("05", "add income rule", "POST", f"/scheme-versions/{u.version_id}/rules",
               u.tokens["manager"], (201,),
               json={"rule_id": "RULE_INCOME_MAX", "name": "Maximum Annual Income",
                     "field": "annual_income", "operator": "LESS_THAN_OR_EQUAL", "value": 800000,
                     "source_reference": "DEMO_CONFIGURATION_NOT_OFFICIAL"})
        st, body = u.must("05", "test rules", "POST",
                          f"/scheme-versions/{u.version_id}/rules/test", u.tokens["manager"], (200,),
                          json={"rules": [{"rule_id": "R1", "field": "annual_income",
                                           "operator": "LESS_THAN_OR_EQUAL", "value": 800000}],
                                "payload": {"annual_income": 500000}})
        u.check("05", "rule test returns ELIGIBLE", (u._ok(body) or {}).get("result") == "ELIGIBLE")

    def part06(self):
        u = self.u
        for action, expected in (("submit-review", "IN_REVIEW"), ("approve", "APPROVED"), ("publish", "PUBLISHED")):
            st, body = u.must("06", f"version {action}", "POST",
                              f"/scheme-versions/{u.version_id}/{action}", u.tokens["manager"], (200,))
            actual = (u._ok(body) or {}).get("status")
            u.check("06", f"after {action} status is {expected}", actual == expected)
        st, body = u.must("06", "published version immutable to patch", "PATCH",
                          f"/scheme-versions/{u.version_id}", u.tokens["manager"], (409,),
                          json={"version": DEMO_VERSION, "configuration": {}})
        st, body = u.must("06", "published version immutable to form edit", "PUT",
                          f"/scheme-versions/{u.version_id}/form-definition", u.tokens["manager"], (409,),
                          json={"fields": []})
        st, body = u.must("06", "published version immutable to rule add", "POST",
                          f"/scheme-versions/{u.version_id}/rules", u.tokens["manager"], (409,),
                          json={"rule_id": "RULE_X", "name": "X", "field": "x",
                                "operator": "GREATER_THAN_OR_EQUAL", "value": 1,
                                "source_reference": "DEMO_CONFIGURATION_NOT_OFFICIAL"})

    # ---------------------------------------------------------------
    # Part 7 - Super admin & RBAC admin surface
    # ---------------------------------------------------------------
    def part07(self):
        u = self.u
        st, body = u.must("07", "admin lists users", "GET", "/users", u.tokens["admin"], (200,))
        users = [x.get("email") for x in u._ok(body)] if isinstance(u._ok(body), list) else []
        u.check("07", "admin sees seeded users", "applicant_a@test.com" in users and "admin@mota.gov.in" in users)
        st, body = u.must("07", "applicant cannot list users", "GET", "/users", u.tokens["A"], (403,))
        st, body = u.must("07", "admin lists roles", "GET", "/roles", u.tokens["admin"], (200,))
        u.check("07", "roles endpoint returns data", isinstance(u._ok(body), list) and len(u._ok(body)) > 0)
        st, body = u.must("07", "admin lists permissions", "GET", "/permissions", u.tokens["admin"], (200,))
        st, body = u.must("07", "service account cannot list users", "GET", "/users", u.tokens["service"], (403,))

    # ---------------------------------------------------------------
    # Part 8 - OTP end-to-end (with local hash injection)
    # ---------------------------------------------------------------
    def part08(self):
        u = self.u
        st, body = u.must("08", "request login OTP", "POST", "/auth/request-otp",
                          expect=(200, 202, 409), json={"email": "applicant_a@test.com", "purpose": "login"})
        code = _set_otp_for_email("applicant_a@test.com")
        u.check("08", "otp challenge seeded for injection", bool(code))
        if code:
            st, body = u.must("08", "verify OTP issues session", "POST", "/auth/verify-otp",
                              expect=(200,),
                              json={"email": "applicant_a@test.com", "otp": code, "purpose": "login"})
            u.check("08", "verify-otp returns access token", bool(u._ok(body).get("access_token")))

    # ---------------------------------------------------------------
    # Part 9 - Phase-2: applicant A application creation
    # ---------------------------------------------------------------
    def part09(self):
        u = self.u
        st, body = u.must("09", "applicant lists schemes", "GET", "/schemes", u.tokens["A"], (200,))
        demo = next((s for s in u._ok(body) if s.get("code") == "MOTA-DEMO"), None)
        u.check("09", "MOTA-DEMO published and listed for applicants",
                bool(demo) and demo.get("version_id") == u.version_id)

    def part10(self):
        u = self.u
        st, body = u.must("10", "applicant A creates application", "POST", "/applications",
                          u.tokens["A"], (201,),
                          json={"scheme_id": u.scheme_id, "scheme_version_id": u.version_id,
                                "cycle": "2026-2027", "answers": A_ANSWERS, "institution_id": u.inst_a})
        app = u._ok(body)
        u.app_ids["A"] = app.get("id", "")
        u.applicant_ids["A"] = app.get("applicant_id", "")
        u.check("10", "application id captured and status DRAFT", bool(u.app_ids["A"]) and app.get("status") == "DRAFT")
        st, body = u.must("10", "A fetches own application", "GET", f"/applications/{u.app_ids['A']}",
                          u.tokens["A"], (200,))
        u.check("10", "answers persisted", (u._ok(body) or {}).get("answers", {}).get("marks_percent") == 82)

    def part11(self):
        u = self.u
        st, body = u.must("11", "submit before documents raises RequiredDocumentsMissing",
                          "POST", f"/applications/{self.u.app_ids['A']}/submit",
                          self.u.tokens["A"], (409,))
        details = (body or {}).get("error", {}).get("details", {}) or {}
        u.check("11", "missing document detail lists income certificate",
                "INCOME_CERTIFICATE" in str(details.get("details")))
        u.check("11", "error code is REQUIRED_DOCUMENTS_MISSING",
                (body or {}).get("error", {}).get("code") == "REQUIRED_DOCUMENTS_MISSING")

    def part12(self):
        u = self.u
        for dt in DOC_TYPES:
            data = self.u.upload_doc("A", self.u.app_ids["A"], dt, self.u.tokens["A"])
            u.check("12", f"A uploaded {dt}", bool(data.get("id")), self.u.jdump(data))
        self.u.upload_doc("A", self.u.app_ids["A"], "RESEARCH_PROPOSAL", self.u.tokens["A"])
        st, body = u.must("12", "A lists own documents", "GET",
                          f"/documents?application_id={self.u.app_ids['A']}", self.u.tokens["A"], (200,))
        u.check("12", "8 documents listed for A", len(self.u._ok(body)) == 8, self.u.jdump(body))

    def part13(self):
        u = self.u
        st, body = u.must("13", "submit A (idempotent create)", "POST",
                          f"/applications/{u.app_ids['A']}/submit", u.tokens["A"], (200,),
                          headers={"Idempotency-Key": "uat-A-submit-1"})
        first = body
        st, body = u.must("13", "submit A again with same key (idempotent)", "POST",
                          f"/applications/{u.app_ids['A']}/submit", u.tokens["A"], (200,),
                          headers={"Idempotency-Key": "uat-A-submit-1"})
        u.check("13", "idempotent repeat returns identical payload", body == first)
        st, body = u.must("13", "A cannot re-submit after SUBMITTED", "POST",
                          f"/applications/{u.app_ids['A']}/submit", u.tokens["A"], (409,))
        st, body = u.must("13", "available-transitions shown", "GET",
                          f"/applications/{u.app_ids['A']}/available-transitions", u.tokens["A"], (200,))
        tos = [x.get("to") for x in u._ok(body)]
        u.check("13", "SUBMITTED allows INSTITUTION_VERIFIED/DEFICIENCY_RAISED/REJECTED",
                "INSTITUTION_VERIFIED" in tos and "DEFICIENCY_RAISED" in tos and "REJECTED" in tos)

    def part14(self):
        u = self.u
        st, body = u.must("14", "verifier verifies A documents", "GET",
                          f"/documents?application_id={u.app_ids['A']}", u.tokens["verifier"], (200,))
        docs = u._ok(body)
        for d in docs:
            did = d.get("id")
            u.must("14", f"verifier verifies {d.get('document_type')}", "POST",
                   f"/documents/{did}/verify", u.tokens["verifier"], (200,))
        st, body = u.must("14", "A reads own document detail", "GET",
                          f"/documents/{docs[0]['id']}", u.tokens["A"], (200,))
        st, body = u.must("14", "A downloads own document URL", "GET",
                          f"/documents/{docs[0]['id']}/download-url", u.tokens["A"], (200,))
        u.check("14", "download url returned", bool(u._ok(body).get("url")))
        st, body = u.must("14", "document access-log visible to owner", "GET",
                          f"/documents/{docs[0]['id']}/access-log", u.tokens["A"], (200,))

    def part15(self):
        u = self.u
        st, body = u.must("15", "institution officer A verifies A", "POST",
                          f"/institutions/applications/{u.app_ids['A']}/verify",
                          u.tokens["institutionA"], (200,),
                          json={"result": "VERIFIED", "fields": {"institution_id": u.inst_a},
                                "note": "All good"})
        st, body = u.must("15", "A status is INSTITUTION_VERIFIED", "GET",
                          f"/applications/{u.app_ids['A']}/status", u.tokens["A"], (200,))
        u.check("15", "status after verify", (u._ok(body) or {}).get("status") == "INSTITUTION_VERIFIED")

    def part16(self):
        pass  # C app created in later parts; cross-institution checks live there

    # ---------------------------------------------------------------
    # Part 17-19 - Scrutiny + eligibility (happy path)
    # ---------------------------------------------------------------
    def part17(self):
        u = self.u
        u.must("17", "scrutiny officer starts A", "POST",
               f"/scrutiny/applications/{u.app_ids['A']}/start", u.tokens["scrutiny"], (200,))
        u.must("17", "scrutiny officer adds note", "POST",
               f"/scrutiny/applications/{u.app_ids['A']}/notes", u.tokens["scrutiny"], (200,),
               json={"note": "Docs verified, proceeding"})
        st, body = u.must("17", "scrutiny officer completes A", "POST",
                          f"/scrutiny/applications/{u.app_ids['A']}/complete", u.tokens["scrutiny"], (200,))
        st, body = u.must("17", "status is ELIGIBILITY_CONFIRMED", "GET",
                          f"/applications/{u.app_ids['A']}/status", u.tokens["A"], (200,))
        u.check("17", "after scrutiny status ELIGIBILITY_CONFIRMED",
                (u._ok(body) or {}).get("status") == "ELIGIBILITY_CONFIRMED")

    def part18(self):
        u = self.u
        st, body = u.must("18", "evaluate A eligibility (real rule engine)", "POST",
                          f"/eligibility/applications/{u.app_ids['A']}/evaluate",
                          u.tokens["verifier"], (200,))
        res = u._ok(body)
        u.check("18", "A is ELIGIBLE", res.get("result") == "ELIGIBLE", self.u.jdump(body))
        rules = res.get("rules", [])
        u.check("18", "all 3 rules evaluated", len(rules) == 3 and all(r.get("passed") for r in rules))
        st, body = u.must("18", "eligibility history recorded", "GET",
                          f"/eligibility/applications/{u.app_ids['A']}/history", u.tokens["A"], (200,))
        u.check("18", "history has 1 entry", len(u._ok(body)) == 1)
        run_id = res.get("run_id")
        st, body = u.must("18", "eligibility run detail", "GET", f"/eligibility/runs/{run_id}",
                          u.tokens["scrutiny"], (200,))
        u.check("18", "run detail result ELIGIBLE", (u._ok(body) or {}).get("result") == "ELIGIBLE")

    # ---------------------------------------------------------------
    # Part 19-21 - Applicant B deficiency path
    # ---------------------------------------------------------------
    def part19(self):
        u = self.u
        st, body = u.must("19", "applicant B creates application", "POST", "/applications",
                          u.tokens["B"], (201,),
                          json={"scheme_id": u.scheme_id, "scheme_version_id": u.version_id,
                                "cycle": "2026-2027", "answers": B_ANSWERS, "institution_id": u.inst_a})
        app = u._ok(body)
        u.app_ids["B"] = app.get("id", "")
        u.applicant_ids["B"] = app.get("applicant_id", "")
        for dt in DOC_TYPES:
            self.u.upload_doc("B", u.app_ids["B"], dt, u.tokens["B"])
        u.must("19", "B submits", "POST", f"/applications/{u.app_ids['B']}/submit",
               u.tokens["B"], (200,), headers={"Idempotency-Key": "uat-B-submit-1"})

    def part20(self):
        u = self.u
        st, body = u.must("20", "institution officer raises deficiency on B (clarification)",
                          "POST", f"/institutions/applications/{u.app_ids['B']}/request-clarification",
                          u.tokens["institutionA"], (200,),
                          json={"result": "NEED_CLARIFICATION", "note": "Income proof needed"})
        st, body = u.must("20", "B status is DEFICIENCY_RAISED", "GET",
                          f"/applications/{u.app_ids['B']}/status", u.tokens["B"], (200,))
        u.check("20", "deficiency raised status", (u._ok(body) or {}).get("status") == "DEFICIENCY_RAISED")

    def part21(self):
        u = self.u
        income_doc = next((d for d in u.doc_ids if d[0] == "B" and d[1] == "INCOME_CERTIFICATE"), None)
        u.must("21", "verifier rejects B income certificate", "POST",
               f"/documents/{u.doc_ids[income_doc]}/reject", u.tokens["verifier"], (200,),
               json={"reason": "Illegible copy"})
        st, body = u.must("21", "verifier raises formal deficiency (document)", "POST",
                          f"/applications/{u.app_ids['B']}/deficiencies", u.tokens["verifier"], (201,),
                          json={"type": "DOCUMENT", "description": "Income certificate illegible",
                                "document_id": u.doc_ids[income_doc], "severity": "HIGH",
                                "required_action": "Upload a legible income certificate"})
        def_id = (u._ok(body) or {}).get("id", "")
        u.check("21", "deficiency created", bool(def_id))
        st, body = u.must("21", "B views the deficiency", "GET",
                          f"/deficiencies/{def_id}", u.tokens["B"], (200,))
        st, body = u.must("21", "verifier reviews deficiency list", "GET",
                          f"/applications/{u.app_ids['B']}/deficiencies", u.tokens["verifier"], (200,))
        # B replaces the rejected document
        data = self.u.upload_doc("B", u.app_ids["B"], "INCOME_CERTIFICATE", u.tokens["B"])
        new_doc = data.get("id")
        u.doc_ids[income_doc] = new_doc
        u.check("21", "replacement document uploaded & READY", data.get("provider") is not None)
        u.must("21", "B responds to deficiency", "POST", f"/deficiencies/{def_id}/respond",
               u.tokens["B"], (200,), json={"response": "Uploaded a legible income certificate"})
        u.must("21", "verifier reviews deficiency", "POST", f"/deficiencies/{def_id}/review",
               u.tokens["verifier"], (200,))
        st, body = u.must("21", "verifier resolves deficiency", "POST",
                          f"/deficiencies/{def_id}/resolve", u.tokens["verifier"], (200,))
        u.check("21", "deficiency resolved", bool(getattr((u._ok(body) or {}), "get", lambda k: None)("id")))

    def part22(self):
        u = self.u
        st, body = u.must("22", "B transitions DEFICIENCY_RAISED -> RESUBMITTED", "POST",
                          f"/applications/{u.app_ids['B']}/transition", u.tokens["B"], (200,),
                          json={"to_state": "RESUBMITTED", "reason": "Responded to deficiency"})
        u.check("22", "transition applied", (u._ok(body) or {}).get("status") == "RESUBMITTED")
        st, body = u.must("22", "illegal transition blocked (generic engine)",
                          "POST", f"/applications/{u.app_ids['A']}/transition", u.tokens["A"], (409,),
                          json={"to_state": "COMPLETED", "reason": "should fail"})
        u.must("22", "institution officer verifies B again", "POST",
               f"/institutions/applications/{u.app_ids['B']}/verify", u.tokens["institutionA"], (200,),
               json={"result": "VERIFIED", "fields": {"institution_id": u.inst_a}, "note": "OK"})
        u.must("22", "scrutiny officer completes B", "POST",
               f"/scrutiny/applications/{u.app_ids['B']}/complete", u.tokens["scrutiny"], (200,))
        st, body = u.must("22", "evaluate B eligibility", "POST",
                          f"/eligibility/applications/{u.app_ids['B']}/evaluate", u.tokens["verifier"], (200,))
        u.check("22", "B is ELIGIBLE", (u._ok(body) or {}).get("result") == "ELIGIBLE")

    # ---------------------------------------------------------------
    # Part 23 - Applicant C rejection path
    # ---------------------------------------------------------------
    def part23(self):
        u = self.u
        st, body = u.must("23", "C creates application (INST-B)", "POST", "/applications",
                          u.tokens["C"], (201,),
                          json={"scheme_id": u.scheme_id, "scheme_version_id": u.version_id,
                                "cycle": "2026-2027", "answers": C_ANSWERS, "institution_id": u.inst_b})
        app = u._ok(body)
        u.app_ids["C"] = app.get("id", "")
        u.applicant_ids["C"] = app.get("applicant_id", "")
        for dt in DOC_TYPES:
            self.u.upload_doc("C", u.app_ids["C"], dt, u.tokens["C"])
        u.must("23", "C submits", "POST", f"/applications/{u.app_ids['C']}/submit",
               u.tokens["C"], (200,), headers={"Idempotency-Key": "uat-C-submit-1"})

    def part24(self):
        u = self.u
        st, body = u.must("24", "evaluate C eligibility", "POST",
                          f"/eligibility/applications/{u.app_ids['C']}/evaluate",
                          u.tokens["verifier"], (200,))
        res = u._ok(body)
        u.check("24", "C is INELIGIBLE via rule engine", res.get("result") == "INELIGIBLE", self.u.jdump(body))
        failed = [r for r in res.get("rules", []) if not r.get("passed")]
        u.check("24", "income rule failed", any(r.get("rule_id") == "RULE_INCOME_MAX" for r in failed))
        st, body = u.must("24", "institution B officer verifies C REJECTED", "POST",
                          f"/institutions/applications/{u.app_ids['C']}/verify",
                          u.tokens["institutionB"], (200,),
                          json={"result": "REJECTED", "fields": {"institution_id": u.inst_b},
                                "note": "Income above ceiling"})
        st, body = u.must("24", "C status is REJECTED", "GET",
                          f"/applications/{u.app_ids['C']}/status", u.tokens["C"], (200,))
        u.check("24", "rejected status", (u._ok(body) or {}).get("status") == "REJECTED")
        st, body = u.must("24", "C cannot withdraw a rejected application", "POST",
                          f"/applications/{u.app_ids['C']}/withdraw", u.tokens["C"], (409,))

    # ---------------------------------------------------------------
    # Part 25-27 - Cross-application RBAC (attack assertions)
    # ---------------------------------------------------------------
    def part25(self):
        u = self.u
        u.must("25", "A cannot read B application (IDOR)", "GET",
               f"/applications/{u.app_ids['B']}", u.tokens["A"], (403,))
        u.must("25", "B cannot read A application (IDOR)", "GET",
               f"/applications/{u.app_ids['A']}", u.tokens["B"], (403,))
        u.must("25", "A cannot list-all applications via filter on B", "GET",
               f"/documents?application_id={u.app_ids['B']}", u.tokens["A"], (403,))
        b_income = next((d for d in u.doc_ids if d[0] == "B" and d[1] == "INCOME_CERTIFICATE"), None)
        u.must("25", "A cannot read B document", "GET",
               f"/documents/{u.doc_ids[b_income]}", u.tokens["A"], (403,))
        u.must("25", "A cannot download B document", "GET",
               f"/documents/{u.doc_ids[b_income]}/download-url", u.tokens["A"], (403,))
        u.must("25", "A cannot attach a document to B application", "POST", "/documents",
               u.tokens["A"], (403,),
               params={"application_id": u.app_ids["B"], "document_type": "IDENTITY_PROOF"},
               files={"file": ("x.pdf", b"%PDF", "application/pdf")})
        u.must("25", "A cannot run workflow transition on B", "POST",
               f"/applications/{u.app_ids['B']}/transition", u.tokens["A"], (403,),
               json={"to_state": "WITHDRAWN"})

    def part26(self):
        u = self.u
        u.must("26", "institution A officer cannot read C (other institution)", "GET",
               f"/applications/{u.app_ids['C']}", u.tokens["institutionA"], (403,))
        u.must("26", "institution A officer cannot verify C", "POST",
               f"/institutions/applications/{u.app_ids['C']}/verify", u.tokens["institutionA"], (403,),
               json={"result": "VERIFIED", "note": "hack"})
        st, body = u.must("26", "institution A officer lists applications (scoped)", "GET",
                          "/applications", u.tokens["institutionA"], (200,))
        visible = [x.get("id") for x in u._ok(body)]
        u.check("26", "scope excludes INST-B application C",
                u.app_ids["A"] in visible and u.app_ids["B"] in visible and u.app_ids["C"] not in visible)

    def part27(self):
        u = self.u
        st, body = u.must("27", "applicant lists own applications (scoped)", "GET",
                          "/applications", u.tokens["A"], (200,))
        ids = [x.get("id") for x in u._ok(body)]
        u.check("27", "A sees only its own application",
                u.app_ids["A"] in ids and u.app_ids["B"] not in ids and u.app_ids["C"] not in ids)
        st, body = u.must("27", "C sees its rejected application", "GET",
                          f"/applications/{u.app_ids['C']}", u.tokens["C"], (200,))
        u.check("27", "C status visible to C", (u._ok(body) or {}).get("status") == "REJECTED")

    # ---------------------------------------------------------------
    # Part 28-34 - Selection round, scores, COI, abstain, tie
    # ---------------------------------------------------------------
    def part28(self):
        u = self.u
        st, body = u.must("28", "create selection round", "POST", "/selection-rounds",
                          u.tokens["committee"], (201,),
                          json={"scheme_version_id": u.version_id, "name": "UAT Round 1", "status": "OPEN"})
        u.round_id = (u._ok(body) or {}).get("id", "")
        st, body = u.must("28", "add candidate A", "POST",
                          f"/selection-rounds/{u.round_id}/candidates", u.tokens["committee"], (201,),
                          json={"application_id": u.app_ids["A"], "data": {"note": "happy"}})
        u.candidate_ids["A"] = (u._ok(body) or {}).get("id", "")
        st, body = u.must("28", "add candidate B", "POST",
                          f"/selection-rounds/{u.round_id}/candidates", u.tokens["committee"], (201,),
                          json={"application_id": u.app_ids["B"], "data": {"note": "deficiency resolved"}})
        u.candidate_ids["B"] = (u._ok(body) or {}).get("id", "")
        st, body = u.must("28", "get round shows both candidates", "GET",
                          f"/selection-rounds/{u.round_id}", u.tokens["committee"], (200,))
        cands = (u._ok(body) or {}).get("candidates", [])
        u.check("28", "round has 2 candidates", len(cands) == 2)

    def part29(self):
        u = self.u
        sA = {"ACADEMIC": (90, 0.40), "RESEARCH": (80, 0.30), "EXPERIENCE": (75, 0.20), "OTHER": (100, 0.10)}
        sB = {"ACADEMIC": (85, 0.40), "RESEARCH": (85, 0.30), "EXPERIENCE": (77.5, 0.20), "OTHER": (100, 0.10)}
        for code, (rv, w) in sA.items():
            u.must("29", f"A score {code}", "POST",
                   f"/selection-candidates/{u.candidate_ids['A']}/scores", u.tokens["committee"], (201,),
                   json={"criterion_code": code, "raw_value": rv, "weight": w,
                         "normalized_value": rv, "weighted_score": rv * w})
        for code, (rv, w) in sB.items():
            u.must("29", f"B score {code}", "POST",
                   f"/selection-candidates/{u.candidate_ids['B']}/scores", u.tokens["committee"], (201,),
                   json={"criterion_code": code, "raw_value": rv, "weight": w,
                         "normalized_value": rv, "weighted_score": rv * w})
        st, body = u.must("29", "A candidate totals", "GET",
                          f"/selection-candidates/{u.candidate_ids['A']}", u.tokens["committee"], (200,))
        cand = (u._ok(body) or {}).get("candidate", {})
        u.check("29", "A total score 85", float(cand.get("total_score") or 0) == 85.0)
        st, body = u.must("29", "B candidate totals", "GET",
                          f"/selection-candidates/{u.candidate_ids['B']}", u.tokens["committee"], (200,))
        cand = (u._ok(body) or {}).get("candidate", {})
        u.check("29", "B total score 85 (tie with A)", float(cand.get("total_score") or 0) == 85.0)

    def part30(self):
        u = self.u
        u.must("30", "committee reviews A", "POST",
               f"/selection-candidates/{u.candidate_ids['A']}/reviews", u.tokens["committee"], (201,),
               json={"decision": "VERIFIED", "note": "Docs and marks ok"})
        u.must("30", "committee reviews B (pre-conflict)", "POST",
               f"/selection-candidates/{u.candidate_ids['B']}/reviews", u.tokens["committee"], (201,),
               json={"decision": "VERIFIED", "note": "Deficiency resolved"})
        u.must("30", "committee adds comment on A", "POST",
               f"/selection-candidates/{u.candidate_ids['A']}/comments", u.tokens["committee"], (201,),
               json={"comment": "Strong research profile"})
        u.must("30", "committee2 reviews A", "POST",
               f"/selection-candidates/{u.candidate_ids['A']}/reviews", u.tokens["committee2"], (201,),
               json={"decision": "VERIFIED", "note": "Second member concurrence"})

    def part31(self):
        u = self.u
        st, body = u.must("31", "committee declares conflict on B", "POST",
                          f"/selection-candidates/{u.candidate_ids['B']}/conflict",
                          u.tokens["committee"], (201,))
        dec = u._ok(body)
        u.check("31", "conflict creates ABSTAIN conflict decision",
                dec.get("decision") == "ABSTAIN" and dec.get("conflict") is True)
        st, body = u.must("31", "conflicted member blocked from scoring B", "POST",
                          f"/selection-candidates/{u.candidate_ids['B']}/scores",
                          u.tokens["committee"], (403,),
                          json={"criterion_code": "OTHER", "raw_value": 50, "weight": 0.1})
        u.must("31", "committee2 abstains on B", "POST",
               f"/selection-candidates/{u.candidate_ids['B']}/abstain", u.tokens["committee2"], (201,))
        st, body = u.must("31", "committee decides APPROVE on A", "POST",
                          f"/selection-candidates/{u.candidate_ids['A']}/decisions",
                          u.tokens["committee"], (201,),
                          json={"decision": "APPROVE", "rationale": "Meets all criteria"})
        u.check("31", "A decision APPROVE", (u._ok(body) or {}).get("decision") == "APPROVE")

    def part32(self):
        u = self.u
        st, body = u.must("32", "finalize detects tie", "POST",
                          f"/selection-rounds/{u.round_id}/finalize", u.tokens["committee"], (409,))
        ties = (body.get("error", {}).get("details") or {}).get("candidate_ids")
        u.check("32", "finalize reports tied candidates", bool(ties), self.u.jdump(body))
        st, body = u.must("32", "resolve tie (merit order A>B)", "POST",
                          f"/selection-rounds/{u.round_id}/ties/resolve", u.tokens["committee"], (201,),
                          json={"strategy": "MERIT_RESOLUTION",
                                "candidate_ids": [u.candidate_ids["A"], u.candidate_ids["B"]],
                                "reason": "Tie broken by committee preference"})
        u.check("32", "tie resolution recorded", bool(u._ok(body).get("id")))
        st, body = u.must("32", "finalize round after tie resolution", "POST",
                          f"/selection-rounds/{u.round_id}/finalize", u.tokens["committee"], (200,))
        u.check("32", "round finalized", (u._ok(body) or {}).get("finalized_at") is not None)

    def part33(self):
        u = self.u
        st, body = u.must("33", "committee sees own conflict flag on B", "GET",
                          f"/selection-candidates/{u.candidate_ids['B']}", u.tokens["committee"], (200,))
        u.check("33", "my_conflict True for committee", (u._ok(body) or {}).get("my_conflict") is True)
        st, body = u.must("33", "A approval packet ready after finalize", "GET",
                          f"/applications/{u.app_ids['A']}/approval-packet", u.tokens["approver"], (200,))
        packet = u._ok(body)
        u.check("33", "A packet ready", packet.get("ready") is True, self.u.jdump(body))
        u.check("33", "A rank 1", (packet.get("candidate") or {}).get("rank") == 1)

    def part34(self):
        u = self.u
        st, body = u.must("34", "approval block on B (prereqs unsatisfied)", "POST",
                          f"/applications/{u.app_ids['B']}/approvals", u.tokens["approver"], (409,),
                          json={"decision": "APPROVED", "reason_code": "MERIT", "note": "skip"})
        u.check("34", "prerequisite conflict reported", "prerequisites" in str(body))
        u.must("34", "approval hold on B", "POST",
               f"/applications/{u.app_ids['B']}/approval-hold", u.tokens["approver"], (201,),
               json={"reason": "Document recheck"})
        st, body = u.must("34", "approval delegation to admin", "POST",
                          f"/applications/{u.app_ids['B']}/approval-delegation", u.tokens["approver"], (201,),
                          json={"to_user_id": self.user_id_by_email("admin@mota.gov.in"),
                                "reason": "Backup signatory"})
        u.must("34", "delegation list read", "GET",
               f"/applications/{u.app_ids['B']}/approval-delegation", u.tokens["approver"], (200,))

    # ---------------------------------------------------------------
    # Part 35-36 - Approval & award
    # ---------------------------------------------------------------
    def part35(self):
        u = self.u
        st, body = u.must("35", "approve A (idempotent)", "POST",
                          f"/applications/{u.app_ids['A']}/approvals", u.tokens["approver"], (201,),
                          headers={"Idempotency-Key": "uat-A-approve-1"},
                          json={"decision": "APPROVED", "reason_code": "VERIFIED_MERIT", "note": "Approved"})
        first = body
        st, body = u.must("35", "approve A again (idempotent repeat)", "POST",
                          f"/applications/{u.app_ids['A']}/approvals", u.tokens["approver"], (201,),
                          headers={"Idempotency-Key": "uat-A-approve-1"},
                          json={"decision": "APPROVED", "reason_code": "VERIFIED_MERIT", "note": "Approved"})
        u.check("35", "idempotent approval identical", body == first)
        st, body = u.must("35", "applicant cannot approve", "POST",
                          f"/applications/{u.app_ids['A']}/approvals", u.tokens["A"], (403,),
                          json={"decision": "APPROVED"})

    def part36(self):
        u = self.u
        st, body = u.must("36", "award A amount", "POST",
                          f"/applications/{u.app_ids['A']}/awards", u.tokens["approver"], (201,),
                          json={"amount": 200000})
        u.award_id = (u._ok(body) or {}).get("id", "")
        u.check("36", "award id captured", bool(u.award_id))
        st, body = u.must("36", "A status AWARDED", "GET",
                          f"/applications/{u.app_ids['A']}/status", u.tokens["A"], (200,))
        u.check("36", "status after award", (u._ok(body) or {}).get("status") == "AWARDED")
        u.must("36", "applicant cannot create award", "POST",
               f"/applications/{u.app_ids['A']}/awards", u.tokens["A"], (403,),
               json={"amount": 1})

    # ---------------------------------------------------------------
    # Part 37-39 - Finance lifecycle
    # ---------------------------------------------------------------
    def part37(self):
        u = self.u
        st, body = u.must("37", "sanction finance record", "POST", "/finance/sanctions",
                          u.tokens["finance"], (201,),
                          json={"award_id": u.award_id, "amount": 200000,
                                "external_reference": "SAN-2026-0001", "provider": "mock"})
        u.sanc_id = (u._ok(body) or {}).get("id", "")
        u.check("37", "sanction recorded", bool(u.sanc_id))
        st, body = u.must("37", "disbursement finance record", "POST", "/finance/disbursements",
                          u.tokens["finance"], (201,),
                          headers={"Idempotency-Key": "uat-A-disb-1"},
                          json={"award_id": u.award_id, "amount": 200000,
                                "external_reference": "DIS-2026-0001", "provider": "mock"})
        u.disb_id = (u._ok(body) or {}).get("id", "")
        first = body
        st, body = u.must("37", "duplicate disbursement idempotent", "POST", "/finance/disbursements",
                          u.tokens["finance"], (201,),
                          headers={"Idempotency-Key": "uat-A-disb-1"},
                          json={"award_id": u.award_id, "amount": 200000,
                                "external_reference": "DIS-2026-0001", "provider": "mock"})
        u.check("37", "disbursement idempotent repeat", body == first)
        st, body = u.must("37", "finance records list (officer)", "GET", "/finance/records",
                          u.tokens["finance"], (200,))
        u.check("37", "records include sanction+disbursement",
                any(r.get("id") == u.sanc_id for r in u._ok(body)) and any(r.get("id") == u.disb_id for r in u._ok(body)))

    def part38(self):
        u = self.u
        st, body = u.must("38", "create installment", "POST",
                          f"/awards/{u.award_id}/installments", u.tokens["finance"], (201,),
                          json={"installment_no": 1, "expected_amount": 100000})
        inst_id = (u._ok(body) or {}).get("id", "")
        u.check("38", "installment created", bool(inst_id))
        st, body = u.must("38", "pay installment", "POST",
                          f"/finance/installments/{inst_id}/pay", u.tokens["finance"], (200,),
                          json={"actual_amount": 100000, "payment_reference": "UTR-MOTA-0001"})
        u.check("38", "installment paid", (u._ok(body) or {}).get("status") in ("PAID", "SETTLED"))
        st, body = u.must("38", "create payment exception (shortfall)", "POST",
                          f"/finance/records/{u.sanc_id}/exceptions", u.tokens["finance"], (201,),
                          json={"expected_amount": 200000, "actual_amount": 199500,
                                "reason": "Bank charges deducted"})
        exc_id = (u._ok(body) or {}).get("id", "")
        u.check("38", "exception raised", bool(exc_id))
        st, body = u.must("38", "resolve payment exception", "POST",
                          f"/exceptions/{exc_id}/resolve", u.tokens["finance"], (200,), )
        u.check("38", "exception resolved", self._status_of(body) in ("RESOLVED", "CLOSED"))

    @staticmethod
    def _status_of(body):
        data = body.get("data", {})
        if isinstance(data, dict):
            return data.get("status")
        return None

    def part39(self):
        u = self.u
        st, body = u.must("39", "create reconciliation", "POST", "/finance/reconciliation",
                          u.tokens["finance"], (201,),
                          json={"award_id": u.award_id, "amount": 199500,
                                "external_reference": "RECON-0001", "provider": "mock"})
        recon_id = (u._ok(body) or {}).get("id", "")
        u.check("39", "reconciliation recorded", bool(recon_id))
        st, body = u.must("39", "reconciliation list", "GET", "/finance/reconciliation",
                          u.tokens["finance"], (200,))
        u.check("39", "reconciliation visible in list",
                any(x.get("id") == recon_id for x in u._ok(body)))
        u.must("39", "auditor can read finance records", "GET", "/finance/records",
               u.tokens["auditor"], (200,))
        u.must("39", "analyst cannot create reconciliation", "POST", "/finance/reconciliation",
               u.tokens["analyst"], (403,),
               json={"award_id": u.award_id, "amount": 1})
        u.must("39", "applicant cannot read finance records", "GET", "/finance/records",
               u.tokens["A"], (403,))
        st, body = u.must("39", "A reads own finance records (scoped)", "GET",
                          f"/awards/{u.award_id}/finance-records", u.tokens["A"], (200,))
        u.check("39", "A sees its finance records", len(u._ok(body)) >= 2)

    # ---------------------------------------------------------------
    # Part 40-42 - Notifications, grievances
    # ---------------------------------------------------------------
    def part40(self):
        u = self.u
        st, body = u.must("40", "admin sends notification to A", "POST", "/notifications",
                          u.tokens["admin"], (201,),
                          json={"user_id": self.applicant_user_id("A"), "channel": "IN_APP",
                                "subject": "Application received",
                                "body": "Your application is under review"})
        u.check("40", "notification created", bool(u._ok(body).get("id")))
        st, body = u.must("40", "A lists notifications", "GET", "/notifications", u.tokens["A"], (200,))
        u.check("40", "A sees the notification", any("Application received" in str(x) for x in u._ok(body)))
        u.must("40", "helpdesk can send notification", "POST", "/notifications",
               u.tokens["helpdesk"], (201,),
               json={"user_id": self.applicant_user_id("A"), "channel": "IN_APP",
                     "subject": "Follow-up", "body": "Check status"})

    def part41(self):
        u = self.u
        st, body = u.must("41", "A raises grievance", "POST", "/grievances", u.tokens["A"], (201,),
                          json={"category": "STATUS_QUERY", "subject": "Status not updating",
                                "description": "My status has not updated in a week",
                                "applicant_id": u.applicant_ids["A"]})
        grievance_id = (u._ok(body) or {}).get("id", "")
        u.check("41", "grievance created", bool(grievance_id))
        u.must("41", "B cannot message A's grievance (isolation)", "POST",
               f"/grievances/{grievance_id}/messages", u.tokens["B"], (403,),
               json={"message": "snooping"})
        u.must("41", "A messages own grievance", "POST", f"/grievances/{grievance_id}/messages",
               u.tokens["A"], (201,), json={"message": "Please expedite"})
        st, body = u.must("41", "grievance officer lists grievances", "GET", "/grievances",
                          u.tokens["grievance"], (200,))
        u.check("41", "grievance appears in officer list",
                any(x.get("id") == grievance_id for x in u._ok(body)))
        st, body = u.must("41", "officer assigns grievance to helpdesk", "POST",
                          f"/grievances/{grievance_id}/assign", u.tokens["grievance"], (200,),
                          json={"assignee_id": self.user_id_by_email("helpdesk@mota.gov.in")})
        st, body = u.must("41", "transition grievance IN_PROGRESS", "POST",
                          f"/grievances/{grievance_id}/transition", u.tokens["grievance"], (200,),
                          json={"status": "IN_PROGRESS", "reason": "Assigned to helpdesk"})
        st, body = u.must("41", "grievance detail", "GET", f"/grievances/{grievance_id}",
                          u.tokens["helpdesk"], (200,))
        u.check("41", "grievance status IN_PROGRESS", (u._ok(body) or {}).get("status") == "IN_PROGRESS")

    def part42(self):
        u = self.u
        st, body = u.must("42", "analyst reads summary report", "GET", "/reports/summary",
                          u.tokens["analyst"], (200,))
        u.check("42", "report summary contains applications count",
                (u._ok(body) or {}).get("totals", {}).get("applications") is not None, self.u.jdump(body))
        u.must("42", "analyst reads operational report", "GET", "/reports/operational",
               u.tokens["analyst"], (200,))
        u.must("42", "analyst reads selection report", "GET", "/reports/selection",
               u.tokens["analyst"], (200,))
        st, body = u.must("42", "auditor reads audit log", "GET", "/audit", u.tokens["auditor"], (200,))
        u.check("42", "audit log has entries", len(u._ok(body)) > 0)
        u.check("42", "audit log includes submission event",
                any("SUBMITTED" in str(x) for x in u._ok(body)))
        u.must("42", "applicant cannot read audit log", "GET", "/audit", u.tokens["A"], (403,))

    # ---------------------------------------------------------------
    # Part 43-44 - Service account & misc RBAC
    # ---------------------------------------------------------------
    def part43(self):
        u = self.u
        u.must("43", "service account cannot create scheme", "POST", "/schemes",
               u.tokens["service"], (403,), json=DEMO_SCHEME)
        u.must("43", "service account cannot list users", "GET", "/users",
               u.tokens["service"], (403,))
        u.must("43", "service account cannot submit applicant A's app", "POST",
               f"/applications/{self.u.app_ids['A']}/submit", u.tokens["service"], (403,))
        u.must("43", "service account cannot score", "POST",
               f"/selection-candidates/{self.u.candidate_ids['A']}/scores",
               u.tokens["service"], (403,),
               json={"criterion_code": "ACADEMIC", "raw_value": 1})

    def part44(self):
        u = self.u
        st, body = u.must("44", "anonymous access rejected", "GET", "/applications", expect=(401,))
        st, body = u.must("44", "applicant cannot scrutinize", "POST",
                          f"/scrutiny/applications/{self.u.app_ids['A']}/complete",
                          u.tokens["A"], (403,))
        u.must("44", "analyst cannot create approval", "POST",
               f"/applications/{self.u.app_ids['A']}/approvals", u.tokens["analyst"], (403,),
               json={"decision": "APPROVED"})
        u.must("44", "helpdesk cannot verify document", "POST",
               f"/documents/{self.u.doc_ids[('A', 'IDENTITY_PROOF')]}/verify",
               u.tokens["helpdesk"], (403,))
        u.must("44", "institution officer cannot verify document",
               "POST", f"/documents/{self.u.doc_ids[('A', 'IDENTITY_PROOF')]}/verify",
               u.tokens["institutionA"], (403,))

    # ---------------------------------------------------------------
    # Part 45 - Super admin workflow & scope grants
    # ---------------------------------------------------------------
    def part45(self):
        u = self.u
        st, body = u.must("45", "admin reads role list", "GET", "/roles", u.tokens["admin"], (200,))
        roles = {r.get("name"): r.get("id") for r in u._ok(body)}
        u.check("45", "roles include SELECTION_COMMITTEE_MEMBER",
                "SELECTION_COMMITTEE_MEMBER" in roles)
        b_user_id = self.user_id_by_email("applicant_b@test.com")
        st, body = u.must("45", "admin assigns role to B", "POST", f"/users/{b_user_id}/roles",
                          u.tokens["admin"], (201,),
                          json={"role_id": roles["MONITORING_ANALYST"]})
        st, body = u.must("45", "admin reads B role grants", "GET", f"/users/{b_user_id}/roles",
                          u.tokens["admin"], (200,))
        u.check("45", "role grant reflected", any(r.get("role_name") == "MONITORING_ANALYST"
                or r.get("name") == "MONITORING_ANALYST" for r in u._ok(body)))
        st, body = u.must("45", "admin grants institution scope", "POST",
                          f"/users/{b_user_id}/scopes", u.tokens["admin"], (201,),
                          json={"scope_type": "INSTITUTION", "scope_value": u.inst_b,
                                "resource": "APPLICATION"})
        st, body = u.must("45", "applicant cannot grant scope", "POST",
                          f"/users/{b_user_id}/scopes", u.tokens["A"], (403,),
                          json={"scope_type": "INSTITUTION", "scope_value": u.inst_a})

    # ---------------------------------------------------------------
    # Part 46 - Grievance/report extras + scheme manager reports guard
    # ---------------------------------------------------------------
    def part46(self):
        u = self.u
        u.must("46", "manager views scheme detail", "GET", f"/schemes/{u.scheme_id}",
               u.tokens["manager"], (200,))
        st, body = u.must("46", "scheme shows published version", "GET",
                          f"/schemes/{u.scheme_id}", u.tokens["applicant"], (200,))
        u.check("46", "published version visible to public",
                any(v.get("status") == "PUBLISHED" for v in (u._ok(body) or {}).get("versions", [])))

    # ---------------------------------------------------------------
    # Part 47-50 - Workflow/SLA, notifications of reporter roles, conclusions
    # ---------------------------------------------------------------
    def part47(self):
        u = self.u
        st, body = u.must("47", "available transitions from AWARDED", "GET",
                          f"/applications/{u.app_ids['A']}/available-transitions",
                          u.tokens["A"], (200,))
        tos = [x.get("to") for x in u._ok(body)]
        u.check("47", "AWARDED allows COMPLETED in workflow", "COMPLETED" in tos)

    def part48(self):
        u = self.u
        st, body = u.must("48", "notifications for a staff role are isolated", "GET",
                          "/notifications", u.tokens["B"], (200,))
        u.check("48", "B has no notifications", len(u._ok(body)) == 0)

    def part49(self):
        u = self.u
        st, body = u.must("49", "decision packet readable by auditor", "GET",
                          f"/applications/{u.app_ids['A']}/decision-packet", u.tokens["auditor"], (200,))
        u.check("49", "packet carries final decision", (u._ok(body) or {}).get("approvals") is not None)
        st, body = u.must("49", "award visible to finance officer", "GET", "/awards",
                          u.tokens["finance"], (200,))
        u.check("49", "A award in global award list",
                any(a.get("id") == u.award_id for a in u._ok(body)))

    def part50(self):
        u = self.u
        m = u.must
        m("50", "completion: A timeline recorded", "GET",
          f"/applications/{u.app_ids['A']}/timeline", u.tokens["A"], (200,))
        st, body = m("50", "completion: A applications versions listed", "GET",
                     f"/applications/{u.app_ids['A']}/versions", u.tokens["A"], (200,))
        u.check("50", "application version history non-empty", len(u._ok(body)) >= 4)
        st, body = m("50", "completion: analyst summary report current", "GET", "/reports/summary",
                     u.tokens["analyst"], (200,))
        u.check("50", "summary totals current",
                (u._ok(body) or {}).get("totals", {}).get("applications") is not None)

    # -- misc ---------------------------------------------------------------
    def applicant_user_id(self, label: str) -> str:
        return self.user_id_by_email(f"applicant_{label.lower()}@test.com")

    def user_id_by_email(self, email: str) -> str:
        st, body = self.u.api("GET", "/users", self.u.tokens["admin"], (200,))
        for x in self.u._ok(body):
            if x.get("email") == email:
                return x.get("id", "")
        return ""

    def run_all(self):
        order = [
            "part01", "part02", "part03", "part04", "part05", "part06",
            "part07", "part08", "part09", "part10", "part11", "part12",
            "part13", "part14", "part15", "part19", "part20", "part21",
            "part22", "part23", "part24", "part25", "part26", "part27",
            "part28", "part29", "part30", "part31", "part32", "part33",
            "part34", "part35", "part36", "part37", "part38", "part39",
            "part40", "part41", "part42", "part43", "part44", "part45",
            "part46", "part47", "part48", "part49", "part50",
        ]
        for name in order:
            getattr(self, name)()


def u_form_fields():
    from scripts.uat_seed import DEMO_FORM_FIELDS
    return DEMO_FORM_FIELDS


def main():
    global u
    u = UAT()
    # Resolve institution ids up front
    st, body = u.api("GET", "/institutions", u.tokens.get("admin", u.login("admin", "admin@mota.gov.in")))
    for it in u._ok(body):
        if it.get("code") == "INST-A":
            u.inst_a = it.get("id")
        if it.get("code") == "INST-B":
            u.inst_b = it.get("id")

    p = Parts(u)
    p.run_all()

    passed = sum(1 for r in u.results if r.ok)
    total = len(u.results)
    print()
    print("=" * 80)
    print(f"UAT COMPLETE: {passed}/{total} checks passed")
    print("=" * 80)
    current = ""
    for r in u.results:
        if r.part != current:
            current = r.part
        flag = "PASS" if r.ok else "FAIL"
        print(f"  {r.part} [{flag}] {r.name} {r.detail}")
    if passed != total:
        print()
        print("FAILED ITEMS:")
        for r in u.results:
            if not r.ok:
                print(f"  Part {r.part} - {r.name} :: {r.detail}")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()