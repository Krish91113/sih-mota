"""Regression coverage for relational selection and finance boundaries."""
import os
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("ENVIRONMENT", "test")

import uuid
from datetime import datetime, timezone

import pytest

from app.core.database import Base, SessionLocal, engine
from app.core.errors import Immutable
from app.domain.models import Application, SchemeVersion
from app.domain.relational_models import (
    Approval, SelectionCandidate, SelectionRound, SelectionScore,
)
from app.domain.selection_finance_models import CommitteeDecision
from app.selection_finance import declared_conflict, locked, packet


Base.metadata.create_all(engine)


def ident():
    return str(uuid.uuid4())


def test_finalized_round_is_immutable():
    row = SelectionRound(
        scheme_version_id=ident(), name=f"round-{ident()}", status="FINALIZED",
        finalized_at=datetime.now(timezone.utc), finalized_by=ident(),
    )
    with pytest.raises(Immutable):
        locked(row)


def test_declared_committee_conflict_is_persisted_and_detectable():
    db = SessionLocal()
    candidate_id = ident()
    member_id = ident()
    try:
        row = CommitteeDecision(
            candidate_id=candidate_id, member_id=member_id,
            decision="ABSTAIN", conflict=True,
            evidence={"declared_via": "conflict"},
        )
        db.add(row)
        db.commit()
        assert declared_conflict(db, candidate_id, member_id) is not None
    finally:
        db.query(CommitteeDecision).filter(
            CommitteeDecision.candidate_id == candidate_id,
            CommitteeDecision.member_id == member_id,
        ).delete()
        db.commit()
        db.close()


def test_approval_packet_reports_relational_prerequisites():
    db = SessionLocal()
    application_id = ident()
    try:
        version = SchemeVersion(id=ident(), scheme_id=ident(), version=f"test-{ident()}", status="PUBLISHED")
        application = Application(
            id=application_id, application_number=f"APP-{ident()[:8]}", applicant_id=ident(),
            scheme_id=version.scheme_id, scheme_version_id=version.id, cycle=ident()[:8],
            status="PROVISIONALLY_SELECTED", answers={"field": "value"}, version=1,
        )
        round_ = SelectionRound(
            id=ident(), scheme_version_id=version.id, name="final", status="FINALIZED",
            finalized_at=datetime.now(timezone.utc), finalized_by=ident(),
        )
        candidate = SelectionCandidate(id=ident(), round_id=round_.id, application_id=application_id, total_score=10)
        score = SelectionScore(
            candidate_id=candidate.id, criterion_code="MERIT", raw_value=10,
            normalized_value=10, weight=1, weighted_score=10,
        )
        decision = CommitteeDecision(
            candidate_id=candidate.id, member_id=ident(), decision="APPROVE", conflict=False,
        )
        db.add_all([version, application, round_, candidate, score, decision])
        db.commit()

        result = packet(db, application_id)
        assert result["ready"] is True
        assert result["prerequisites"]["selection_finalized"] is True
        assert result["prerequisites"]["committee_approved"] is True
        assert len(result["scores"]) == 1
        assert len(result["committee_decisions"]) == 1
    finally:
        db.query(Approval).filter(Approval.application_id == application_id).delete()
        db.query(SelectionScore).filter(SelectionScore.candidate_id == candidate.id).delete() if "candidate" in locals() else None
        db.query(CommitteeDecision).filter(CommitteeDecision.candidate_id == candidate.id).delete() if "candidate" in locals() else None
        db.query(SelectionCandidate).filter(SelectionCandidate.application_id == application_id).delete()
        db.query(SelectionRound).filter(SelectionRound.id == round_.id).delete() if "round_" in locals() else None
        db.query(Application).filter(Application.id == application_id).delete()
        db.query(SchemeVersion).filter(SchemeVersion.id == version.id).delete() if "version" in locals() else None
        db.commit()
        db.close()


def test_packet_rejects_approval_without_prerequisites():
    db = SessionLocal()
    application_id = ident()
    try:
        application = Application(
            id=application_id, application_number=f"APP-{ident()[:8]}", applicant_id=ident(),
            scheme_id=ident(), scheme_version_id=ident(), cycle=ident()[:8], answers={}, version=1,
        )
        db.add(application)
        db.commit()
        result = packet(db, application_id)
        assert result["ready"] is False
        assert result["prerequisites"]["candidate_present"] is False
    finally:
        db.query(Application).filter(Application.id == application_id).delete()
        db.commit()
        db.close()
