"""Add persisted workflow and finance completion state."""
from alembic import op
from sqlalchemy import inspect, Column, DateTime, Numeric

revision = "0005_completion_state"
down_revision = "0004_completion_tables"
branch_labels = None
depends_on = None


def _add(bind, table, column):
    if column.name not in {c["name"] for c in inspect(bind).get_columns(table)}:
        op.add_column(table, column)


def upgrade():
    bind = op.get_bind()
    _add(bind, "workflow_assignments", Column("paused_at", DateTime(timezone=True)))
    _add(bind, "workflow_assignments", Column("resumed_at", DateTime(timezone=True)))
    _add(bind, "workflow_assignments", Column("escalated_at", DateTime(timezone=True)))
    _add(bind, "selection_corrections", Column("approved_at", DateTime(timezone=True)))
    _add(bind, "finance_installments", Column("paid_amount", Numeric(14, 2), nullable=False, server_default="0"))
    _add(bind, "finance_installments", Column("paid_at", DateTime(timezone=True)))


def downgrade():
    bind = op.get_bind()
    for table, column in (("finance_installments", "paid_at"), ("finance_installments", "paid_amount"), ("selection_corrections", "approved_at"), ("workflow_assignments", "escalated_at"), ("workflow_assignments", "resumed_at"), ("workflow_assignments", "paused_at")):
        if column in {c["name"] for c in inspect(bind).get_columns(table)}:
            op.drop_column(table, column)
