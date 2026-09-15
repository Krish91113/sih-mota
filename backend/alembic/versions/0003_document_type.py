"""Add document type for scheme required-document validation."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
revision='0003_document_type'; down_revision='0002_committee_decisions'; branch_labels=None; depends_on=None
def upgrade():
    bind=op.get_bind()
    columns={c['name'] for c in inspect(bind).get_columns('documents')}
    if 'document_type' not in columns: op.add_column('documents',sa.Column('document_type',sa.String(length=100),nullable=True))
def downgrade():
    bind=op.get_bind(); columns={c['name'] for c in inspect(bind).get_columns('documents')}
    if 'document_type' in columns: op.drop_column('documents','document_type')
