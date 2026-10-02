from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.rbac.models import Role, Permission, UserRole, RolePermission, UserScope
from app.rbac.service import has_permission, ResourceContext
from app.domain.models import User

def test_scope_engine_blocks_cross_scheme_and_allows_assigned():
    engine=create_engine('sqlite:///:memory:'); Base.metadata.create_all(engine); db=sessionmaker(bind=engine)()
    user=User(email='officer@test',password_hash='x',full_name='Officer',role='SCRUTINY_OFFICER'); db.add(user); db.flush()
    role=Role(name='SCRUTINY_OFFICER'); permission=Permission(resource='APPLICATION',action='READ',scope='SCHEME'); db.add_all([role,permission]); db.flush(); db.add_all([UserRole(user_id=user.id,role_id=role.id),RolePermission(role_id=role.id,permission_id=permission.id),UserScope(user_id=user.id,scope_type='SCHEME',scope_value='scheme-a')]); db.commit()
    assert has_permission(db,user.id,'APPLICATION:READ:SCHEME',ResourceContext(scheme_id='scheme-a'))
    assert not has_permission(db,user.id,'APPLICATION:READ:SCHEME',ResourceContext(scheme_id='scheme-b'))

def test_own_scope_blocks_idor():
    engine=create_engine('sqlite:///:memory:'); Base.metadata.create_all(engine); db=sessionmaker(bind=engine)()
    user=User(email='applicant@test',password_hash='x',full_name='Applicant',role='APPLICANT'); db.add(user); db.flush(); role=Role(name='APPLICANT'); permission=Permission(resource='APPLICATION',action='READ',scope='OWN'); db.add_all([role,permission]); db.flush(); db.add_all([UserRole(user_id=user.id,role_id=role.id),RolePermission(role_id=role.id,permission_id=permission.id)]); db.commit()
    assert has_permission(db,user.id,'APPLICATION:READ:OWN',ResourceContext(owner_id=user.id))
    assert not has_permission(db,user.id,'APPLICATION:READ:OWN',ResourceContext(owner_id='other-user'))
