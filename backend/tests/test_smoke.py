import os
import uuid

os.environ['DATABASE_URL']='sqlite:///./test.db'
os.environ['ENVIRONMENT']='test'
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base,engine,SessionLocal
from app.core.security import hash_password
from app.domain.models import User
Base.metadata.create_all(engine)
def test_health_and_auth():
    client=TestClient(app)
    assert client.get('/api/v1/health').status_code==200
    email=f'smoke-{uuid.uuid4().hex[:8]}@example.com'
    with SessionLocal() as db:
        db.add(User(email=email,password_hash=hash_password('StrongPassword1!'),full_name='Smoke Test',role='APPLICANT'))
        db.commit()
    r=client.post('/api/v1/auth/login',json={'email':email,'password':'StrongPassword1!'})
    assert r.status_code==200
    token=r.json()['data']['access_token']
    assert client.get('/api/v1/auth/me',headers={'Authorization':f'Bearer {token}'}).status_code==200
    r=client.post('/api/v1/auth/login',json={'email':email,'password':'wrong'})
    assert r.status_code==401
