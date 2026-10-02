"""trust_verification_trace_finance
Revision ID: e5ae5ddb232c
"""
from alembic import op
import sqlalchemy as sa
revision = 'e5ae5ddb232c'
down_revision = '0008_notification_read_state'
branch_labels = None
depends_on = None

TABLES = {
    'decision_traces': lambda: sa.Table(
        'decision_traces', sa.MetaData(),
        sa.Column('application_id', sa.String(length=36), nullable=False),
        sa.Column('decision_type', sa.String(length=60), nullable=False),
        sa.Column('decision_status', sa.String(length=40), nullable=False),
        sa.Column('scheme_version_id', sa.String(length=36), nullable=True),
        sa.Column('policy_version', sa.String(length=40), nullable=True),
        sa.Column('input_snapshot', sa.JSON(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('actor_id', sa.String(length=36), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('status', sa.String(length=40), nullable=True),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id']),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['scheme_version_id'], ['scheme_versions.id']),
        sa.PrimaryKeyConstraint('id'),
    ),
    'verification_cases': lambda: sa.Table(
        'verification_cases', sa.MetaData(),
        sa.Column('application_id', sa.String(length=36), nullable=False),
        sa.Column('assigned_to', sa.String(length=36), nullable=True),
        sa.Column('priority', sa.String(length=30), nullable=False),
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('status', sa.String(length=40), nullable=True),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    ),
    'evidences': lambda: sa.Table(
        'evidences', sa.MetaData(),
        sa.Column('application_id', sa.String(length=36), nullable=False),
        sa.Column('document_id', sa.String(length=36), nullable=True),
        sa.Column('evidence_type', sa.String(length=80), nullable=False),
        sa.Column('field_name', sa.String(length=100), nullable=False),
        sa.Column('observed_value', sa.JSON(), nullable=False),
        sa.Column('normalized_value', sa.JSON(), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=False),
        sa.Column('confidence', sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column('verified', sa.Boolean(), nullable=False),
        sa.Column('verified_by', sa.String(length=36), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('status', sa.String(length=40), nullable=True),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['verified_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    ),
    'decision_steps': lambda: sa.Table(
        'decision_steps', sa.MetaData(),
        sa.Column('decision_trace_id', sa.String(length=36), nullable=False),
        sa.Column('step_order', sa.Integer(), nullable=False),
        sa.Column('step_type', sa.String(length=60), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('result', sa.String(length=40), nullable=False),
        sa.Column('evidence_id', sa.String(length=36), nullable=True),
        sa.Column('rule_result_id', sa.String(length=36), nullable=True),
        sa.Column('actor_id', sa.String(length=36), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('status', sa.String(length=40), nullable=True),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id']),
        sa.ForeignKeyConstraint(['decision_trace_id'], ['decision_traces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['evidence_id'], ['evidences.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['rule_result_id'], ['eligibility_rule_results.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    ),
    'payment_attempts': lambda: sa.Table(
        'payment_attempts', sa.MetaData(),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('installment_id', sa.String(length=36), nullable=False),
        sa.Column('finance_record_id', sa.String(length=36), nullable=True),
        sa.Column('attempt_no', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('provider_reference', sa.String(length=255), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['finance_record_id'], ['finance_records.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['installment_id'], ['finance_installments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    ),
    'payment_status_history': lambda: sa.Table(
        'payment_status_history', sa.MetaData(),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('installment_id', sa.String(length=36), nullable=False),
        sa.Column('from_status', sa.String(length=30), nullable=True),
        sa.Column('to_status', sa.String(length=30), nullable=False),
        sa.Column('actor_id', sa.String(length=36), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id']),
        sa.ForeignKeyConstraint(['installment_id'], ['finance_installments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    ),
    'verification_findings': lambda: sa.Table(
        'verification_findings', sa.MetaData(),
        sa.Column('application_id', sa.String(length=36), nullable=False),
        sa.Column('evidence_id', sa.String(length=36), nullable=True),
        sa.Column('category', sa.String(length=80), nullable=False),
        sa.Column('severity', sa.String(length=30), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('expected_value', sa.JSON(), nullable=True),
        sa.Column('observed_value', sa.JSON(), nullable=True),
        sa.Column('created_by', sa.String(length=36), nullable=False),
        sa.Column('resolved_by', sa.String(length=36), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('status', sa.String(length=40), nullable=True),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['evidence_id'], ['evidences.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    ),
}

INDEXES = {
    'decision_traces': [('application_id', False), ('decision_status', False), ('decision_type', False), ('status', False)],
    'verification_cases': [('application_id', True), ('assigned_to', False), ('status', False)],
    'evidences': [('application_id', False), ('document_id', False), ('evidence_type', False), ('field_name', False), ('status', False)],
    'decision_steps': [('decision_trace_id', False), ('status', False)],
    'payment_attempts': [('installment_id', False)],
    'payment_status_history': [('installment_id', False)],
    'verification_findings': [('application_id', False), ('category', False), ('evidence_id', False), ('status', False)],
}


def upgrade():
    # 0001_initial bootstraps the schema from the live model metadata, so an
    # existing table means the columns are already present. Guarding every
    # statement keeps this migration re-runnable on a fresh or an existing DB.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for name, factory in TABLES.items():
        if name not in existing_tables:
            factory().create(bind=bind)
            inspector = sa.inspect(bind)

    for table, indexes in INDEXES.items():
        if table not in existing_tables:
            continue
        present = {i['name'] for i in inspector.get_indexes(table)}
        for column, unique in indexes:
            name = f'ix_{table}_{column}'
            if name not in present:
                op.create_index(name, table, [column], unique=unique)

    foreign_keys = {fk['constrained_columns'][0] for fk in inspector.get_foreign_keys('deficiencies')}
    if 'evidence_id' not in foreign_keys:
        op.create_foreign_key(
            'fk_deficiencies_evidence_id', 'deficiencies', 'evidences',
            ['evidence_id'], ['id'], ondelete='SET NULL',
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'deficiencies' in existing_tables:
        foreign_keys = {fk['constrained_columns'][0] for fk in inspector.get_foreign_keys('deficiencies')}
        if 'evidence_id' in foreign_keys:
            op.drop_constraint('fk_deficiencies_evidence_id', 'deficiencies', type_='foreignkey')

    for table in reversed(list(TABLES)):
        if table in existing_tables:
            TABLES[table]().drop(bind=bind)
