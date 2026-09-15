import os
os.environ['DATABASE_URL']='sqlite:///./test.db'
os.environ['ENVIRONMENT']='test'
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base,engine
Base.metadata.create_all(engine)
def test_health_and_auth():
    client=TestClient(app)
    assert client.get('/api/v1/health').status_code==200
    r=client.post('/api/v1/auth/register',json={'email':'test@example.com','password':'StrongPassword1!','full_name':'Test User'})
    assert r.status_code in (201,409)
    r=client.post('/api/v1/auth/login',json={'email':'test@example.com','password':'StrongPassword1!'})
    assert r.status_code==200
    token=r.json()['data']['access_token']
    assert client.get('/api/v1/auth/me',headers={'Authorization':f'Bearer {token}'}).status_code==200
