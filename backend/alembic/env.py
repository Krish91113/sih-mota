from logging.config import fileConfig
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from alembic import context
from sqlalchemy import engine_from_config,pool
from app.core.database import Base
from app.domain import models, relational_models, selection_finance_models, core_completion_models
from app.rbac import models as rbac_models
from app.core.audit import AuditLog
config=context.config
from app.core.config import get_settings
config.set_main_option("sqlalchemy.url", get_settings().database_url.replace("%", "%%"))
if config.config_file_name: fileConfig(config.config_file_name)
target_metadata=Base.metadata
def run_migrations_offline():
 context.configure(url=config.get_main_option("sqlalchemy.url"),target_metadata=target_metadata,literal_binds=True,compare_type=True)
 with context.begin_transaction(): context.run_migrations()
def run_migrations_online():
 connectable=engine_from_config(config.get_section(config.config_ini_section,{}),prefix="sqlalchemy.",poolclass=pool.NullPool)
 with connectable.connect() as connection:
  context.configure(connection=connection,target_metadata=target_metadata,compare_type=True)
  with context.begin_transaction(): context.run_migrations()
if context.is_offline_mode(): run_migrations_offline()
else: run_migrations_online()
