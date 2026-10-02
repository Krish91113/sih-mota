"""Add relational committee decisions."""
from alembic import op
import sqlalchemy as sa

revision = "0002_committee_decisions"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    if "committee_decisions" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "committee_decisions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("candidate_id", sa.String(length=36), sa.ForeignKey("selection_candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("decision", sa.String(length=30), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("conflict", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("candidate_id", "member_id"),
    )
    op.create_index("ix_committee_decisions_candidate_id", "committee_decisions", ["candidate_id"])
    op.create_index("ix_committee_decisions_member_id", "committee_decisions", ["member_id"])


def downgrade():
    if "committee_decisions" not in sa.inspect(op.get_bind()).get_table_names():
        return
    op.drop_index("ix_committee_decisions_member_id", table_name="committee_decisions")
    op.drop_index("ix_committee_decisions_candidate_id", table_name="committee_decisions")
    op.drop_table("committee_decisions")
