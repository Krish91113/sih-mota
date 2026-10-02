"""Provision one demo user per canonical MoTA role for one-click role login.

Idempotent: safe to re-run. Existing users are updated (password reset) and
missing RBAC roles/permissions are created. Mirrors the credential list in
`frontend/src/lib/auth/demoAccounts.ts` — keep the two in sync.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.domain.models import Applicant, User
from app.rbac.constants import PERMISSIONS
from app.rbac.models import Permission, Role, RolePermission, UserRole
from app.rbac.service import seed_permissions

DEMO_PASSWORD = "ChangeMe123!"

# (email, role, full_name, needs_applicant_profile)
DEMO_USERS = [
    ("admin@mota.gov.in", "SUPER_ADMIN", "Super Admin", False),
    ("manager@mota.gov.in", "SCHEME_MANAGER", "Scheme Manager", False),
    ("verifier@mota.gov.in", "VERIFICATION_OFFICER", "Verification Officer", False),
    ("scrutiny@mota.gov.in", "SCRUTINY_OFFICER", "Scrutiny Officer", False),
    ("committee@mota.gov.in", "SELECTION_COMMITTEE_MEMBER", "Selection Committee Member", False),
    ("approver@mota.gov.in", "APPROVING_AUTHORITY", "Approving Authority", False),
    ("finance@mota.gov.in", "FINANCE_OFFICER", "Finance Officer", False),
    ("grievance@mota.gov.in", "GRIEVANCE_OFFICER", "Grievance Officer", False),
    ("helpdesk@mota.gov.in", "HELPDESK_AGENT", "Helpdesk Agent", False),
    ("analyst@mota.gov.in", "MONITORING_ANALYST", "Monitoring Analyst", False),
    ("auditor@mota.gov.in", "AUDITOR", "Auditor", False),
    ("institution@example.org", "INSTITUTION_NODAL_OFFICER", "Institution Nodal Officer", False),
    ("applicant@example.org", "APPLICANT", "Demo Applicant", True),
]


def main() -> int:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    created, updated = 0, 0

    try:
        for email, role_name, full_name, needs_applicant in DEMO_USERS:
            user = db.query(User).filter_by(email=email).first()
            if user is None:
                user = User(email=email)
                db.add(user)
                created += 1
            else:
                updated += 1
            user.password_hash = hash_password(DEMO_PASSWORD)
            user.full_name = full_name
            user.role = role_name
            user.is_active = True
            db.flush()

            if needs_applicant and not db.query(Applicant).filter_by(user_id=user.id).first():
                db.add(Applicant(user_id=user.id))

            role = db.query(Role).filter_by(name=role_name).first()
            if role is None:
                role = Role(name=role_name, is_system=True)
                db.add(role)
                db.flush()
            if not db.query(UserRole).filter_by(user_id=user.id, role_id=role.id).first():
                db.add(UserRole(user_id=user.id, role_id=role.id))

        seed_permissions(db, PERMISSIONS)

        # Demo convenience: grant the full canonical permission vocabulary to
        # every role. Production grants must be least-privilege per role.
        for role in db.query(Role).all():
            for permission in db.query(Permission).all():
                if not db.query(RolePermission).filter_by(role_id=role.id, permission_id=permission.id).first():
                    db.add(RolePermission(role_id=role.id, permission_id=permission.id))

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(f"Seeded {len(DEMO_USERS)} demo role accounts ({created} created, {updated} updated).")
    print(f"Shared password: {DEMO_PASSWORD}")
    for email, role_name, _, _ in DEMO_USERS:
        print(f"  {role_name:<28} {email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
