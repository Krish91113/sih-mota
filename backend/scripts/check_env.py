import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import create_engine, text
from app.core.config import get_settings

s = get_settings()
print("DATABASE_URL host:", s.database_url)
e = create_engine(s.database_url)
c = e.connect()

r = c.execute(text("select current_database()"))
print("current_database:", r.scalar())

r = c.execute(text("select count(*) from information_schema.tables where table_schema='public'"))
print("public tables:", r.scalar())

from sqlalchemy import inspect
ins = inspect(e)
print("table names sample:", ins.get_table_names()[:20])