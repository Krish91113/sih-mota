import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Integer, JSON, String, Text, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column

from .database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    request_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    before_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    previous_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    event_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Monotonic insertion counter. `id` is a random uuid4 and `created_at` only
    # has microsecond resolution, so ordering by either can disagree with the
    # real write order and make a healthy chain look tampered with. `seq` is the
    # single authoritative order shared by the writer and the verifier.
    seq: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


def canonical_timestamp(value: datetime | None) -> str:
    """Render a datetime as a stable, timezone-explicit UTC string.

    Backends such as SQLite drop timezone information on round-trip, so hashing
    the naive local value read back from the database would not match the hash
    computed from the timezone-aware value at write time. Normalising to UTC
    makes the hash reproducible across backends.
    """
    if value is None:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def compute_audit_hash(
    previous_hash: str | None,
    event_type: str,
    actor_id: str | None,
    entity_type: str | None,
    entity_id: str | None,
    created_at: datetime,
    data: dict | None,
    before_state: dict | None,
    after_state: dict | None,
    reason: str | None,
) -> str:
    timestamp_str = canonical_timestamp(created_at)
    payload = {
        "previous_hash": previous_hash or "GENESIS",
        "event_type": event_type,
        "actor_id": actor_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "created_at": timestamp_str,
        "data": data or {},
        "before_state": before_state,
        "after_state": after_state,
        "reason": reason,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# Attempts to claim the next audit_logs.seq before giving up.
_SEQ_RETRIES = 5


def audit(
    db: Session,
    event_type: str,
    actor_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    data: dict | None = None,
    before_state: dict | None = None,
    after_state: dict | None = None,
    reason: str | None = None,
    request_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditLog:
    now_dt = datetime.now(timezone.utc)
    # The session runs with autoflush=False, so an audit row queued earlier in
    # this same transaction would be invisible to the tail query below and we
    # would hand it the same `seq`. Push pending audit rows out first.
    pending = [obj for obj in db.new if isinstance(obj, AuditLog)]
    if pending:
        db.flush(objects=pending)

    # `seq` is assigned explicitly because a non-primary-key identity column is
    # not auto-populated on every backend (SQLite leaves it NULL), and ordering
    # by created_at/id is not reliable. A concurrent transaction can still take
    # the same slot, so retry on the unique-constraint conflict rather than
    # forking the chain or failing the request.
    for attempt in range(_SEQ_RETRIES):
        last_record = db.scalar(select(AuditLog).order_by(AuditLog.seq.desc()).limit(1))
        prev_hash = (
            last_record.event_hash
            if (last_record and last_record.event_hash)
            else (last_record.id if last_record else "GENESIS")
        )
        next_seq = (last_record.seq + 1) if last_record else 1
        ev_hash = compute_audit_hash(
            previous_hash=prev_hash,
            event_type=event_type,
            actor_id=actor_id,
            entity_type=entity_type,
            entity_id=entity_id,
            created_at=now_dt,
            data=data,
            before_state=before_state,
            after_state=after_state,
            reason=reason,
        )
        record = AuditLog(
            event_type=event_type,
            actor_id=actor_id,
            entity_type=entity_type,
            entity_id=entity_id,
            request_id=request_id,
            data=data or {},
            before_state=before_state,
            after_state=after_state,
            reason=reason,
            ip_address=ip_address,
            user_agent=user_agent,
            previous_hash=prev_hash,
            event_hash=ev_hash,
            seq=next_seq,
            created_at=now_dt,
        )
        db.add(record)
        try:
            # Flush inside a savepoint so a lost race rolls back only this row.
            with db.begin_nested():
                db.flush(objects=[record])
        except IntegrityError:
            db.expunge(record)
            continue
        return record

    raise IntegrityError(
        "could not allocate an audit_logs.seq after "
        f"{_SEQ_RETRIES} attempts",
        params=None,
        orig=RuntimeError("audit sequence contention"),
    )


def verify_audit_chain(db: Session) -> dict[str, Any]:
    records = db.scalars(select(AuditLog).order_by(AuditLog.seq.asc())).all()
    if not records:
        return {"valid": True, "total_records": 0, "broken_at_id": None, "message": "Audit chain is empty and valid."}

    prev_hash = "GENESIS"
    for idx, rec in enumerate(records):
        if rec.previous_hash is not None and rec.previous_hash != prev_hash and idx > 0 and prev_hash != "GENESIS":
            return {
                "valid": False,
                "total_records": len(records),
                "broken_at_id": rec.id,
                "message": f"Previous hash mismatch at record {rec.id}: expected {prev_hash}, found {rec.previous_hash}",
            }
        if rec.event_hash:
            expected_hash = compute_audit_hash(
                previous_hash=rec.previous_hash,
                event_type=rec.event_type,
                actor_id=rec.actor_id,
                entity_type=rec.entity_type,
                entity_id=rec.entity_id,
                created_at=rec.created_at,
                data=rec.data,
                before_state=rec.before_state,
                after_state=rec.after_state,
                reason=rec.reason,
            )
            if rec.event_hash != expected_hash:
                return {
                    "valid": False,
                    "total_records": len(records),
                    "broken_at_id": rec.id,
                    "message": f"Event hash tampering detected at record {rec.id}: expected {expected_hash}, recorded {rec.event_hash}",
                }
            prev_hash = rec.event_hash
        else:
            prev_hash = rec.id

    return {
        "valid": True,
        "total_records": len(records),
        "broken_at_id": None,
        "message": f"Audit chain successfully verified across {len(records)} records.",
    }

