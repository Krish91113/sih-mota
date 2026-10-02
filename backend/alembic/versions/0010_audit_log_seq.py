"""Add a monotonic `seq` column to audit_logs and order the chain by it.

`AuditLog.id` is a random uuid4 and `created_at` only resolves to microseconds,
so ordering the tamper-evident chain by `(created_at, id)` does not reproduce
the real write order. The writer picked its predecessor with
`ORDER BY created_at DESC, id DESC` while the verifier read
`ORDER BY created_at ASC, id ASC`, so timestamp ties were broken differently on
each side, forking the chain at write time and making a healthy ledger report
"Previous hash mismatch". `seq` gives both sides one deterministic order.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "0010_audit_log_seq"
down_revision = "0009_finance_inst_provider"
branch_labels = None
depends_on = None

TABLE = "audit_logs"
INDEX = "ix_audit_logs_seq"


def upgrade():
    bind = op.get_bind()
    columns = {c["name"] for c in inspect(bind).get_columns(TABLE)}

    if "seq" not in columns:
        # Nullable first so existing rows can be backfilled before NOT NULL.
        op.add_column(TABLE, sa.Column("seq", sa.Integer(), nullable=True))

    # Backfill in the best available approximation of write order: oldest
    # timestamp first, uuid as a stable tie-break. Done in Python so the
    # migration behaves identically on PostgreSQL and SQLite.
    rows = bind.execute(
        text(f"SELECT id FROM {TABLE} WHERE seq IS NULL ORDER BY created_at ASC, id ASC")
    ).fetchall()
    for position, row in enumerate(rows, start=1):
        bind.execute(
            text(f"UPDATE {TABLE} SET seq = :seq WHERE id = :id"),
            {"seq": position, "id": row[0]},
        )

    op.alter_column(TABLE, "seq", existing_type=sa.Integer(), nullable=False)

    # Unique index (not a separate constraint) so it matches what
    # `mapped_column(..., index=True, unique=True)` produces via create_all.
    # It also stops two writers claiming the same position in the chain.
    if INDEX not in {i["name"] for i in inspect(bind).get_indexes(TABLE)}:
        op.create_index(INDEX, TABLE, ["seq"], unique=True)


def downgrade():
    bind = op.get_bind()
    if INDEX in {i["name"] for i in inspect(bind).get_indexes(TABLE)}:
        op.drop_index(INDEX, table_name=TABLE)
    if "seq" in {c["name"] for c in inspect(bind).get_columns(TABLE)}:
        op.drop_column(TABLE, "seq")