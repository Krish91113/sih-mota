"""Add provider to finance_installments and allow award-less installments."""
from alembic import op
from sqlalchemy import Column, String, inspect

revision = "0009_finance_inst_provider"
down_revision = "e5ae5ddb232c"
branch_labels = None
depends_on = None

TABLE = "finance_installments"


def _columns(bind):
    return {c["name"]: c for c in inspect(bind).get_columns(TABLE)}


def upgrade():
    bind = op.get_bind()
    columns = _columns(bind)
    if "provider" not in columns:
        op.add_column(
            TABLE,
            Column("provider", String(50), nullable=False, server_default="mock"),
        )
    if not columns.get("award_id", {}).get("nullable", True):
        op.alter_column(TABLE, "award_id", existing_type=String(36), nullable=True)


def downgrade():
    bind = op.get_bind()
    if "provider" in _columns(bind):
        op.drop_column(TABLE, "provider")
    op.alter_column(TABLE, "award_id", existing_type=String(36), nullable=False)
