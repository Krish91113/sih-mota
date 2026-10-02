"""Add persistent application and officer notes."""
from alembic import op
import sqlalchemy as sa

revision = "0007_application_notes"
down_revision = ("0006_email_otp_challenges", "0006_committee_comments")
branch_labels = None
depends_on = None


def upgrade():
    if "application_notes" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "application_notes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("application_id", sa.String(length=36), nullable=False),
        sa.Column("author_id", sa.String(length=36), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("internal", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
    )
    op.create_index("ix_application_notes_application_id", "application_notes", ["application_id"])
    op.create_index("ix_application_notes_author_id", "application_notes", ["author_id"])


def downgrade():
    if "application_notes" not in sa.inspect(op.get_bind()).get_table_names():
        return
    op.drop_index("ix_application_notes_author_id", table_name="application_notes")
    op.drop_index("ix_application_notes_application_id", table_name="application_notes")
    op.drop_table("application_notes")
