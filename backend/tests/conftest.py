import os
import pathlib

# Test collection must never require a developer PostgreSQL server.
# A file-backed SQLite database is used (rather than :memory:) because the
# TestClient runs the app on a worker thread. The file is recreated on every
# session so repeat runs start from an empty schema and cannot collide on
# unique constraints such as schemes.code.
TEST_DB = pathlib.Path(__file__).resolve().parent.parent / "test-suite.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["ENVIRONMENT"] = "test"
os.environ["STORAGE_PROVIDER"] = "mock"
os.environ["EMAIL_PROVIDER"] = "mock"
os.environ["FINANCE_PROVIDER"] = "mock"

if TEST_DB.exists():
    TEST_DB.unlink()

import pytest  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _fresh_test_database():
    from app.core.database import Base, engine

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if TEST_DB.exists():
        TEST_DB.unlink(missing_ok=True)
