import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import create_engine, text, inspect

e = create_engine('postgresql+psycopg://mota:mota@localhost:5432/mota')
c = e.connect()
ins = inspect(e)

print("== schemes columns ==")
print([col['name'] for col in ins.get_columns('schemes')])
print("== scheme_versions columns ==")
print([col['name'] for col in ins.get_columns('scheme_versions')])

print("== schemes rows ==")
print(c.execute(text("select * from schemes")).fetchall())

print("== scheme_versions rows ==")
cols = [col['name'] for col in ins.get_columns('scheme_versions')]
rows = c.execute(text("select * from scheme_versions")).fetchall()
for r in rows:
    print(r)

print("== users: id/email/roles ==")
rows = c.execute(text("""
  select u.email, string_agg(r.name, ',') from users u
  left join user_roles ur on ur.user_id = u.id
  left join roles r on r.id = ur.role_id
  group by u.email
""")).fetchall()
for r in rows:
    print(r)

print("== module_records ==")
print(c.execute(text("select * from module_records limit 5")).fetchall())