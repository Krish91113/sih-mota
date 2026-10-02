"""Add notification delivery and read state columns."""
from alembic import op
import sqlalchemy as sa

revision = "0008_notification_read_state"
down_revision = "0007_application_notes"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("notifications")}
    with op.batch_alter_table("notifications") as batch:
        if "sent_at" not in columns:
            batch.add_column(sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True))
        if "status" not in columns:
            batch.add_column(sa.Column("status", sa.String(length=30), nullable=False, server_default="PENDING"))
        if "read_at" not in columns:
            batch.add_column(sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))
        if "failed_at" not in columns:
            batch.add_column(sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True))
        if "retry_count" not in columns:
            batch.add_column(sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("notifications")}
    with op.batch_alter_table("notifications") as batch:
        if "sent_at" in columns:
            batch.drop_column("sent_at")
        if "status" in columns:
            batch.drop_column("status")
        if "read_at" in columns:
            batch.drop_column("read_at")
        if "failed_at" in columns:
            batch.drop_column("failed_at")
        if "retry_count" in columns:
            batch.drop_column("retry_count")