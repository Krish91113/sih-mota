from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.errors import Conflict
from app.domain.models import User, Scheme, SchemeVersion, Applicant, Application
from app.domain.relational_models import SelectionRound, SelectionCandidate, Award
from app.domain.core_completion_models import WorkflowAssignment, WorkflowSLAEvent, SelectionTieResolution, ApprovalDelegation, FinanceInstallment
from app.workflow_api import assign_application, pause_assignment, resume_assignment, AssignmentIn, SLAActionIn
from app.completion_api import resolve_tie, delegate_approval, create_installment, pay_installment, TieIn, DelegationIn, InstallmentIn, PaymentIn
from app.selection_finance import finalize_round


def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def users(db):
    admin = User(email="manager@test", password_hash="x", full_name="Manager", role="SCHEME_MANAGER")
    officer = User(email="officer@test", password_hash="x", full_name="Officer", role="SCRUTINY_OFFICER")
    approver = User(email="approver@test", password_hash="x", full_name="Approver", role="APPROVING_AUTHORITY")
    finance = User(email="finance@test", password_hash="x", full_name="Finance", role="FINANCE_OFFICER")
    db.add_all([admin, officer, approver, finance]); db.flush()
    return admin, officer, approver, finance


def test_assignment_sla_pause_resume_and_history():
    db = db_session(); manager, officer, _, _ = users(db)
    scheme = Scheme(code="SLA", name="SLA"); db.add(scheme); db.flush()
    version = SchemeVersion(scheme_id=scheme.id, version="1"); db.add(version); db.flush()
    applicant = Applicant(user_id=officer.id); db.add(applicant); db.flush()
    application = Application(application_number="SLA-1", applicant_id=applicant.id, scheme_id=scheme.id, scheme_version_id=version.id, cycle="2026"); db.add(application); db.flush()
    assigned = assign_application(application.id, AssignmentIn(stage="SCRUTINY", assignee_id=officer.id, due_days=2), db, manager, None)
    assignment = db.get(WorkflowAssignment, assigned["data"]["id"])
    assert assignment.due_at is not None
    pause_assignment(assignment.id, SLAActionIn(reason="Applicant clarification"), db, officer)
    assert assignment.sla_status == "PAUSED"
    resume_assignment(assignment.id, SLAActionIn(reason="Clarification received"), db, officer)
    assert assignment.sla_status == "ON_TRACK"
    assert len(db.scalars(select(WorkflowSLAEvent).where(WorkflowSLAEvent.assignment_id == assignment.id)).all()) == 3


def test_tie_requires_resolution_before_finalization():
    db = db_session(); manager, _, _, _ = users(db)
    scheme = Scheme(code="TIE", name="Tie"); db.add(scheme); db.flush()
    version = SchemeVersion(scheme_id=scheme.id, version="1"); db.add(version); db.flush()
    applicant = Applicant(user_id=manager.id); db.add(applicant); db.flush()
    app1 = Application(application_number="TIE-1", applicant_id=applicant.id, scheme_id=scheme.id, scheme_version_id=version.id, cycle="2026"); app2 = Application(application_number="TIE-2", applicant_id=applicant.id, scheme_id=scheme.id, scheme_version_id=version.id, cycle="2027"); db.add_all([app1, app2]); db.flush()
    round_ = SelectionRound(scheme_version_id=version.id, name="Tie"); db.add(round_); db.flush()
    c1 = SelectionCandidate(round_id=round_.id, application_id=app1.id, total_score=90); c2 = SelectionCandidate(round_id=round_.id, application_id=app2.id, total_score=90); db.add_all([c1, c2]); db.flush()
    try:
        finalize_round(round_.id, db, manager, None)
        assert False, "finalization should reject unresolved ties"
    except Conflict:
        pass
    result = resolve_tie(round_.id, TieIn(strategy="MANUAL_ORDER", candidate_ids=[c1.id, c2.id], reason="Committee order"), db, manager, None)
    assert result["data"]["round_id"] == round_.id
    finalize_round(round_.id, db, manager, None)
    assert round_.finalized_at is not None


def test_delegation_and_installment_payment_are_stateful():
    db = db_session(); manager, _, approver, finance = users(db)
    scheme = Scheme(code="FIN", name="Finance"); db.add(scheme); db.flush()
    version = SchemeVersion(scheme_id=scheme.id, version="1"); db.add(version); db.flush()
    applicant = Applicant(user_id=manager.id); db.add(applicant); db.flush()
    application = Application(application_number="FIN-1", applicant_id=applicant.id, scheme_id=scheme.id, scheme_version_id=version.id, cycle="2026"); db.add(application); db.flush()
    delegation = delegate_approval(application.id, DelegationIn(to_user_id=approver.id, reason="Leave", expires_at=datetime.now(timezone.utc) + timedelta(days=1)), db, approver)
    assert delegation["data"]["to_user_id"] == approver.id
    award = Award(application_id=application.id, scheme_version_id=version.id, amount=1000, awarded_by=approver.id); db.add(award); db.flush()
    installment = create_installment(award.id, InstallmentIn(installment_no=1, expected_amount=1000), db, finance)
    paid = pay_installment(installment["data"]["id"], PaymentIn(actual_amount=1000, payment_reference="PAY-1"), db, finance, "payment-1")
    assert paid["data"]["status"] == "PAID"
    try:
        pay_installment(installment["data"]["id"], PaymentIn(actual_amount=1000, payment_reference="PAY-2"), db, finance, "payment-2")
        assert False, "duplicate installment payment should fail"
    except Conflict:
        pass
