from app.core.database import SessionLocal, Base, engine
from app.domain.models import User, Scheme, SchemeVersion
from app.rbac.models import Role, UserRole, RolePermission
from app.rbac.constants import PERMISSIONS
from app.rbac.service import seed_permissions
from app.core.security import hash_password
Base.metadata.create_all(engine)
db=SessionLocal()
users=[('admin@mota.gov.in','SUPER_ADMIN'),('manager@mota.gov.in','SCHEME_MANAGER'),('scrutiny@mota.gov.in','SCRUTINY_OFFICER'),('verifier@mota.gov.in','VERIFICATION_OFFICER'),('committee@mota.gov.in','SELECTION_COMMITTEE_MEMBER'),('approver@mota.gov.in','APPROVING_AUTHORITY'),('finance@mota.gov.in','FINANCE_OFFICER'),('grievance@mota.gov.in','GRIEVANCE_OFFICER'),('institution@example.org','INSTITUTION_NODAL_OFFICER'),('applicant@example.org','APPLICANT')]
for email,role in users:
    if not db.query(User).filter_by(email=email).first(): db.add(User(email=email,password_hash=hash_password('ChangeMe123!'),full_name=role.replace('_',' ').title(),role=role))
for code,name in [('NFST','NFST demo scheme'),('NOS','NOS demo scheme')]:
    if not db.query(Scheme).filter_by(code=code).first():
        s=Scheme(code=code,name=name,description='DEMO_CONFIGURATION_NOT_OFFICIAL'); db.add(s); db.flush(); db.add(SchemeVersion(scheme_id=s.id,version='demo-1',configuration={'source_reference':'DEMO_CONFIGURATION_NOT_OFFICIAL','form_definition':{'fields':[]}}))
seed_permissions(db, PERMISSIONS)
for email,role_name in users:
    user=db.query(User).filter_by(email=email).first(); role=db.query(Role).filter_by(name=role_name).first()
    if not role: role=Role(name=role_name,is_system=True); db.add(role); db.flush()
    if user and not db.query(UserRole).filter_by(user_id=user.id,role_id=role.id).first(): db.add(UserRole(user_id=user.id,role_id=role.id))
# Development seed grants the canonical permission vocabulary to system roles; production grants must be least-privilege.
for role in db.query(Role).all():
    for permission in db.query(__import__('app.rbac.models',fromlist=['Permission']).Permission).all():
        if not db.query(RolePermission).filter_by(role_id=role.id,permission_id=permission.id).first(): db.add(RolePermission(role_id=role.id,permission_id=permission.id))
db.commit(); print('Seeded demo users, RBAC roles/permissions and schemes. Password: ChangeMe123!')
