"""Add deterministic completion tables for workflow, selection, approval and finance."""
from alembic import op
from sqlalchemy import inspect
from app.core.database import Base
from app.domain import models, relational_models, selection_finance_models, core_completion_models
from app.rbac import models as rbac_models
from app.core.audit import AuditLog
revision='0004_completion_tables'; down_revision='0003_document_type'; branch_labels=None; depends_on=None
def upgrade():
    bind=op.get_bind(); existing=set(inspect(bind).get_table_names())
    for table in Base.metadata.sorted_tables:
        if table.name not in existing: table.create(bind=bind)
def downgrade():
    bind=op.get_bind()
    for name in ('payment_exceptions','finance_installments','approval_delegations','selection_corrections','selection_tie_resolutions','workflow_sla_events','workflow_assignments'):
        if name in inspect(bind).get_table_names(): Base.metadata.tables[name].drop(bind=bind)
