"""Relational additions for committee decisions."""
from sqlalchemy import Boolean, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .relational_models import Timestamped, uid


class CommitteeDecision(Timestamped):
    __tablename__ = "committee_decisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    candidate_id: Mapped[str] = mapped_column(String(36), ForeignKey("selection_candidates.id", ondelete="CASCADE"), index=True)
    member_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    decision: Mapped[str] = mapped_column(String(30))
    rationale: Mapped[str | None] = mapped_column(Text)
    conflict: Mapped[bool] = mapped_column(Boolean, default=False)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    __table_args__ = (UniqueConstraint("candidate_id", "member_id"),)


class CommitteeComment(Timestamped):
    __tablename__ = "committee_comments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    candidate_id: Mapped[str] = mapped_column(String(36), ForeignKey("selection_candidates.id", ondelete="CASCADE"), index=True)
    member_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    comment: Mapped[str] = mapped_column(Text)
