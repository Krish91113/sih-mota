"""Idempotent seed for the automated UAT.

Creates test users, institutions, and institution–user links needed for the
50-part role-by-role acceptance test.  Run before ``run_uat.py``:

    python -m scripts.uat_seed

The demo scheme itself is created through the live scheme-manager API during
``run_uat.py`` (Parts 1–6); the only two tables with no HTTP endpoint
(``SchemeWorkflow`` and ``SchemeSelectionCriterion``) are written by the
:func:`seed_workflow_criteria` helper defined here.

Password for every seeded user is ``ChangeMe123!``  (same as seed.py users.)
The script can be re-run safely.
"""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from app.core.database import SessionLocal, Base, engine
from app.core.security import hash_password
from app.domain.models import User, Scheme, SchemeVersion, SchemeRule, Applicant, Application
from app.domain.relational_models import (
    Institution, InstitutionUser, SchemeForm, SchemeDocument,
    SchemeWorkflow, SchemeSelectionCriterion,
)
from app.rbac.models import Role, UserRole, Permission, RolePermission
from app.rbac.service import seed_permissions
from app.rbac.constants import PERMISSIONS

PWD = "ChangeMe123!"
EMAIL_DEFAULT = "applicant@example.org"

# ---------------------------------------------------------------------------
# Users to ensure exist (email, role)
# ---------------------------------------------------------------------------
ADDITIONAL_USERS: list[tuple[str, str, str]] = [
    # (email, role, full_name)
    ("applicant_a@test.com",   "APPLICANT",                  "Applicant A"),
    ("applicant_b@test.com",   "APPLICANT",                  "Applicant B"),
    ("applicant_c@test.com",   "APPLICANT",                  "Applicant C"),
    ("institution_b@mota.gov.in", "INSTITUTION_NODAL_OFFICER", "Institution B Nodal Officer"),
    ("committee2@mota.gov.in",    "SELECTION_COMMITTEE_MEMBER", "Selection Committee Member 2"),
    ("analyst@mota.gov.in",    "MONITORING_ANALYST",         "Monitoring Analyst"),
    ("auditor@mota.gov.in",    "AUDITOR",                     "Auditor"),
    ("helpdesk@mota.gov.in",   "HELPDESK_AGENT",             "Helpdesk Agent"),
    ("service_account@mota.gov.in", "APPLICANT",            "Service Account"),
]

# ---------------------------------------------------------------------------
# Institutions
# ---------------------------------------------------------------------------
INSTITUTIONS: list[tuple[str, str, str]] = [
    ("INST-A", "Ranchi University",        "University"),
    ("INST-B", "Delhi University",          "University"),
]

# Map (user.email → institution.code) for linking
INSTITUTION_LINKS: list[tuple[str, str]] = [
    ("institution@example.org",  "INST-A"),
    ("institution_b@mota.gov.in","INST-B"),
]

# ---------------------------------------------------------------------------
# Demo scheme configuration (created through the live API during run_uat.py;
# workflow + criteria have no HTTP endpoint and use seed_workflow_criteria)
# ---------------------------------------------------------------------------
DEMO_SCHEME_SPEC = {
    "code": "MOTA-DEMO",
    "name": "National Higher Education Student Support — DEMO",
    "description": (
        "DEMO_CONFIGURATION_NOT_OFFICIAL: Test configuration for end-to-end "
        "acceptance testing. NOT an official NFST policy."
    ),
}
DEMO_VERSION        = "v1.0"

DEMO_FORM_FIELDS = [
    {"key": "full_name",              "label": "Full Name",              "type": "text",     "required": True},
    {"key": "dob",                    "label": "Date of Birth",          "type": "date",     "required": True},
    {"key": "gender",                 "label": "Gender",                 "type": "dropdown", "required": True,
     "options": ["MALE", "FEMALE", "OTHER"]},
    {"key": "email",                  "label": "Email Address",          "type": "text",     "required": True},
    {"key": "mobile",                 "label": "Mobile Number",          "type": "text",     "required": True},
    {"key": "address",                "label": "Address",                "type": "text",     "required": True},
    {"key": "institution_id",         "label": "Institution",            "type": "institution", "required": True},
    {"key": "course",                 "label": "Course / Programme",     "type": "text",     "required": True},
    {"key": "academic_qualification", "label": "Academic Qualification", "type": "dropdown", "required": True,
     "options": ["Undergraduate", "Postgraduate", "PhD", "Other"]},
    {"key": "marks_percent",          "label": "Marks / CGPA (%)",       "type": "number",   "required": True},
    {"key": "research_area",          "label": "Research Area (if any)", "type": "text",     "required": False},
    {"key": "annual_income",          "label": "Annual Family Income (₹)","type": "number", "required": True},
    {"key": "bank_account_number",    "label": "Bank Account Number",    "type": "text",     "required": True},
]

DEMO_DOCUMENTS: list[tuple[str, str, bool]] = [
    ("IDENTITY_PROOF",    "Identity Proof",                True),
    ("CATEGORY_CERTIFICATE","Category Certificate",        True),
    ("INCOME_CERTIFICATE","Income Certificate",            True),
    ("MARKSHEET",         "Latest Marksheet",              True),
    ("ADMISSION_LETTER",  "Admission Letter",              True),
    ("BANK_STATEMENT",    "Bank Statement / Passbook",     True),
    ("RESEARCH_PROPOSAL", "Research Proposal (conditional)", False),
    ("PHOTOGRAPH",        "Passport-size Photograph",      True),
]

DEMO_RULES: list[tuple[str, str, str, str, object, str]] = [
    # (rule_id, name, field, operator, value, source_reference)
    ("RULE_AGE_MIN",     "Minimum Age",          "age",               "GREATER_THAN_OR_EQUAL", 18, "National Policy"),
    ("RULE_ACADEMIC_MIN","Minimum Academic Score","marks_percent",     "GREATER_THAN_OR_EQUAL", 55, "National Policy"),
    ("RULE_INCOME_MAX",  "Maximum Annual Income","annual_income",     "LESS_THAN_OR_EQUAL",    800000, "National Policy"),
]

DEMO_WORKFLOW_TRANSITIONS: list[dict] = [
    {"from": "DRAFT",    "to": "SUBMITTED"},
    {"from": "DRAFT",    "to": "WITHDRAWN"},
    {"from": "SUBMITTED","to": "INSTITUTION_VERIFIED"},
    {"from": "SUBMITTED","to": "DEFICIENCY_RAISED"},
    {"from": "SUBMITTED","to": "REJECTED"},
    {"from": "SUBMITTED","to": "WITHDRAWN"},
    {"from": "DEFICIENCY_RAISED","to": "RESUBMITTED"},
    {"from": "DEFICIENCY_RAISED","to": "WITHDRAWN"},
    {"from": "RESUBMITTED","to": "INSTITUTION_VERIFIED"},
    {"from": "ELIGIBILITY_CONFIRMED","to": "AWARDED"},
    {"from": "ELIGIBILITY_CONFIRMED","to": "REJECTED"},
    {"from": "AWARDED",  "to": "COMPLETED"},
]

DEMO_SELECTION_CRITERIA: list[tuple[str, float, str]] = [
    # (criterion_code, weight, calculation_method)
    ("ACADEMIC",  0.40, "weighted"),
    ("RESEARCH",  0.30, "weighted"),
    ("EXPERIENCE",0.20, "weighted"),
    ("OTHER",     0.10, "weighted"),
]


# ===================================================================
# Helpers
# ===================================================================

def _ensure_user(db, email: str, role: str, full_name: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user:
        return user
    user = User(
        email=email,
        full_name=full_name,
        role=role,
        password_hash=hash_password(PWD),
    )
    db.add(user)
    db.flush()

    # RBAC role + permission linkage
    db_role = db.scalar(select(Role).where(Role.name == role))
    if not db_role:
        db_role = Role(name=role, is_system=True)
        db.add(db_role)
        db.flush()
        for spec in PERMISSIONS:
            perm = db.scalar(select(Permission).where(
                Permission.resource == spec.resource, Permission.action == spec.action,
                Permission.scope == spec.scope))
            if perm and not db.scalar(select(RolePermission).where(
                    RolePermission.role_id == db_role.id, RolePermission.permission_id == perm.id)):
                db.add(RolePermission(role_id=db_role.id, permission_id=perm.id))
    if not db.scalar(select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == db_role.id)):
        db.add(UserRole(user_id=user.id, role_id=db_role.id))
    return user


def _ensure_applicant_row(db, user: User) -> Applicant:
    applicant = db.scalar(select(Applicant).where(Applicant.user_id == user.id))
    if not applicant:
        applicant = Applicant(user_id=user.id, profile={})
        db.add(applicant)
        db.flush()
    return applicant


def _ensure_institution(db, code: str, name: str, inst_type: str) -> Institution:
    inst = db.scalar(select(Institution).where(Institution.code == code))
    if inst:
        return inst
    inst = Institution(code=code, name=name, institution_type=inst_type)
    db.add(inst)
    db.flush()
    return inst


def _ensure_institution_link(db, email: str, inst_code: str):
    user = db.scalar(select(User).where(User.email == email))
    inst = db.scalar(select(Institution).where(Institution.code == inst_code))
    if not user or not inst:
        return
    exists = db.scalar(
        select(InstitutionUser).where(
            InstitutionUser.user_id == user.id,
            InstitutionUser.institution_id == inst.id,
        )
    )
    if not exists:
        db.add(InstitutionUser(user_id=user.id, institution_id=inst.id))


# ---------------------------------------------------------------------------
# SchemeWorkflow / SchemeSelectionCriterion have no HTTP endpoints. These are
# written directly by the harness (via this helper) after the scheme-manager
# creates the version through the live API.
# ---------------------------------------------------------------------------

def seed_workflow_criteria(scheme_version_id: str):
    """Insert SchemeWorkflow definition + selection criteria for a version.

    Safe to call repeatedly (upsert by scheme_version_id).
    """
    db = SessionLocal()
    try:
        existing = db.scalar(select(SchemeWorkflow).where(SchemeWorkflow.scheme_version_id == scheme_version_id))
        if not existing:
            db.add(SchemeWorkflow(
                scheme_version_id=scheme_version_id,
                definition={"transitions": DEMO_WORKFLOW_TRANSITIONS},
            ))
        for code, weight, method in DEMO_SELECTION_CRITERIA:
            row = db.scalar(select(SchemeSelectionCriterion).where(
                SchemeSelectionCriterion.scheme_version_id == scheme_version_id,
                SchemeSelectionCriterion.criterion_code == code,
            ))
            if not row:
                db.add(SchemeSelectionCriterion(
                    scheme_version_id=scheme_version_id,
                    criterion_code=code,
                    weight=weight,
                    calculation_method=method,
                ))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def seed_all():
    """Run the full idempotent seed (infrastructure only)."""
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        # RBAC roles + permissions
        seed_permissions(db, PERMISSIONS)
        db.flush()

        # Users
        for email, role, full_name in ADDITIONAL_USERS:
            user = _ensure_user(db, email, role, full_name)
            if role == "APPLICANT":
                _ensure_applicant_row(db, user)
        db.flush()

        # Institutions
        for code, name, itype in INSTITUTIONS:
            _ensure_institution(db, code, name, itype)
        for email, code in INSTITUTION_LINKS:
            _ensure_institution_link(db, email, code)
        db.flush()

        db.commit()
        print("[uat_seed] All test infrastructure seeded successfully.")
        print(f"  Users: {[u[0] for u in ADDITIONAL_USERS]}  (+ seed.py users)")
        print(f"  Institutions: {[i[0] for i in INSTITUTIONS]}")
        print(f"  Demo scheme config: {DEMO_SCHEME_SPEC['code']} {DEMO_VERSION} (created via API in run_uat.py)")
        print(f"  Password for all users: {PWD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
