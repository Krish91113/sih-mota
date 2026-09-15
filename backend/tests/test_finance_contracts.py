from sqlalchemy import select

from app.core.database import Base
from app.domain.core_completion_models import PaymentException
from app.domain.relational_models import Award, FinanceRecord, IdempotencyRecord
from app.finance_api import (
    ExceptionIn,
    ReconciliationIn,
    create_exception,
    create_reconciliation,
    get_reconciliation,
    list_reconciliation,
    reopen_exception,
    resolve_exception,
)
from app.domain.models import User


def db_session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def finance_user(role="FINANCE_OFFICER"):
    return User(email=f"{role.lower()}@test", password_hash="x", full_name=role, role=role)


def test_exception_lifecycle_and_idempotent_create():
    db = db_session()
    user = finance_user()
    db.add(user)
    db.flush()
    source = FinanceRecord(award_id="award-1", record_type="DISBURSEMENT", amount=100, status="RECORDED")
    db.add(source)
    db.flush()

    body = ExceptionIn(finance_record_id=source.id, expected_amount=100, actual_amount=80, reason="Short payment")
    created = create_exception(body, db, user, "exception-key")
    replayed = create_exception(body, db, user, "exception-key")
    assert created == replayed
    assert len(db.scalars(select(PaymentException)).all()) == 1

    exception_id = created["data"]["id"]
    resolved = resolve_exception(exception_id, db, user, "resolve-key")
    assert resolved["data"]["status"] == "RESOLVED"
    reopened = reopen_exception(exception_id, db, user, "reopen-key")
    assert reopened["data"]["status"] == "OPEN"
    assert reopened["data"]["resolved_by"] is None


def test_reconciliation_contract_filters_records_and_supports_get_by_id():
    db = db_session()
    user = finance_user()
    db.add(user)
    db.flush()
    award = Award(application_id="application-1", scheme_version_id="scheme-version-1", amount=1000, awarded_by=user.id)
    db.add(award)
    db.flush()

    body = ReconciliationIn(award_id=award.id, amount=975, external_reference="BANK-1", data={"matched": True})
    created = create_reconciliation(body, db, user, "reconciliation-key")
    replayed = create_reconciliation(body, db, user, "reconciliation-key")
    assert created == replayed
    assert created["data"]["record_type"] == "RECONCILIATION"

    listed = list_reconciliation(db, user)
    assert [item["id"] for item in listed["data"]] == [created["data"]["id"]]
    fetched = get_reconciliation(created["data"]["id"], db, user)
    assert fetched["data"]["id"] == created["data"]["id"]
    assert fetched["data"]["record_type"] == "RECONCILIATION"
    assert db.scalar(select(IdempotencyRecord).where(IdempotencyRecord.key == "reconciliation-key")) is not None
