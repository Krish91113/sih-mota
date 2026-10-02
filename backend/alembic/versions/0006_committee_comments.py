"""Add append-only committee comments."""
from alembic import op
import sqlalchemy as sa

revision = "0006_committee_comments"
down_revision = "0005_completion_state"
branch_labels = None
depends_on = None


def upgrade():
    if "committee_comments" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "committee_comments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("candidate_id", sa.String(length=36), sa.ForeignKey("selection_candidates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_committee_comments_candidate_id", "committee_comments", ["candidate_id"])
    op.create_index("ix_committee_comments_member_id", "committee_comments", ["member_id"])


def downgrade():
    if "committee_comments" not in sa.inspect(op.get_bind()).get_table_names():
        return
    op.drop_index("ix_committee_comments_member_id", table_name="committee_comments")
    op.drop_index("ix_committee_comments_candidate_id", table_name="committee_comments")
    op.drop_table("committee_comments")
