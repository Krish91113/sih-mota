"""Persist email OTP challenges for registration and sign-in."""
from alembic import op
import sqlalchemy as sa

revision = "0006_email_otp_challenges"
down_revision = "0005_completion_state"
branch_labels = None
depends_on = None


def upgrade():
    if "email_otp_challenges" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "email_otp_challenges",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("purpose", sa.String(length=40), nullable=False),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_email_otp_challenges_email", "email_otp_challenges", ["email"])
    op.create_index("ix_email_otp_challenges_purpose", "email_otp_challenges", ["purpose"])


def downgrade():
    if "email_otp_challenges" not in sa.inspect(op.get_bind()).get_table_names():
        return
    op.drop_index("ix_email_otp_challenges_purpose", table_name="email_otp_challenges")
    op.drop_index("ix_email_otp_challenges_email", table_name="email_otp_challenges")
    op.drop_table("email_otp_challenges")
