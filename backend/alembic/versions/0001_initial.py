"""Initial MoTA modular monolith schema"""
from alembic import op
from app.core.database import Base
from app.domain import models, relational_models, selection_finance_models, core_completion_models
from app.rbac import models as rbac_models
from app.core.audit import AuditLog
revision='0001_initial'; down_revision=None; branch_labels=None; depends_on=None
def upgrade(): Base.metadata.create_all(bind=op.get_bind())
def downgrade(): Base.metadata.drop_all(bind=op.get_bind())
