"""Generic metadata-driven seeder used by the endpoint smoke test.

Creates one representative row per table (plus a few high-value extras) so that
every REST route can be exercised against realistic identifiers instead of
random UUIDs. Rows are inserted in foreign-key dependency order and each
insert is retried with fresh values so a unique/check constraint on one table
cannot abort the whole seed.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Enum, Integer, JSON, Numeric, String, Text, select
from sqlalchemy.orm import Session

from app.core.database import Base

# Values that satisfy common enum-like status columns.
STATUS_VALUES = {
    "ACTIVE": "ACTIVE",
    "PUBLISHED": "PUBLISHED",
    "DRAFT": "DRAFT",
    "SUBMITTED": "SUBMITTED",
    "OPEN": "OPEN",
    "PENDING": "PENDING",
    "APPROVED": "APPROVED",
    "COMPLETED": "COMPLETED",
    "READY": "READY",
    "RECORDED": "RECORDED",
}

ROLE_FOR_TABLE = {
    "users": "SUPER_ADMIN",
    "applicants": "APPLICANT",
}

# Tables that must not receive fabricated rows. ``audit_logs`` is an
# append-only tamper-evident chain: inventing rows with random ``event_hash``
# values would make ``/audit/verify`` report tampering that never happened.
# Real rows are written by the application itself as the sweep runs.
SKIP_TABLES = {"audit_logs"}


def _json_type(column) -> bool:
    return isinstance(column.type, JSON)


def _value_for(column, index: int, table_name: str) -> Any:
    name = column.name
    lowered = name.lower()

    if _json_type(column):
        return {
            "required": True,
            "value": f"seed-{table_name}",
            "amount": 1000.0,
            "profile": {"full_name": "Seed Applicant", "aadhaar_hash": f"aadhaar-{table_name}"},
            "answers": {"institution": "seed-institution", "annual_income": 150000},
            "data": {"seeded": True},
            "definition": {"transitions": []},
            "configuration": {},
            "evidence": {"seeded": True},
            "steps": [],
            "transitions": [],
            "input_snapshot": {},
            "observed_values": {},
            "candidates": [],
        }.get(name, [0, 1, 2, 3, 4] if name == "working_weekdays" else {})

    if isinstance(column.type, Boolean):
        return True

    if isinstance(column.type, (Integer, Numeric)):
        if "amount" in lowered or "score" in lowered or "weight" in lowered:
            return 100.0
        if "confidence" in lowered:
            return 0.95
        return 1

    if isinstance(column.type, Date):
        if "date" in lowered and "due" in lowered:
            return (datetime.now(timezone.utc) + timedelta(days=7)).date()
        return (datetime.now(timezone.utc) + timedelta(days=30)).date()

    if isinstance(column.type, DateTime):
        now = datetime.now(timezone.utc)
        if "expir" in lowered:
            return now + timedelta(days=30)
        if "due" in lowered or "deadline" in lowered:
            return now + timedelta(days=7)
        return now - timedelta(minutes=index)

    if isinstance(column.type, String) or isinstance(column.type, Text):
        text = f"{name}-{uuid.uuid4().hex[:8]}"
        if "email" in lowered:
            return f"{uuid.uuid4().hex[:12]}@example.com"
        if "code" in lowered or "reference" in lowered:
            return f"C{uuid.uuid4().hex[:10].upper()}"
        if "hash" in lowered:
            return uuid.uuid4().hex * 2
        if "token" in lowered or "secret" in lowered or "password" in lowered:
            return uuid.uuid4().hex
        if "url" in lowered:
            return "https://example.test/resource"
        if "mime" in lowered:
            return "text/plain"
        if lowered == "role":
            return "SUPER_ADMIN"
        if lowered == "status":
            return "ACTIVE"
        if lowered == "operator":
            return "EQUALS"
        if lowered == "decision":
            return "APPROVED"
        if lowered == "priority" or lowered == "severity":
            return "HIGH"
        if lowered == "channel":
            return "EMAIL"
        if lowered == "type" or lowered == "record_type":
            return "GENERAL"
        if lowered == "category":
            return "GENERAL"
        if lowered == "scope_type":
            return "ORGANIZATION"
        if lowered == "assignment_type":
            return "SCRUTINY"
        if lowered == "stage" or lowered == "node_code":
            return "SCRUTINY"
        if lowered == "is_system" or lowered == "is_active" or lowered == "required" or lowered == "published":
            return True
        if lowered == "gender" or lowered == "category":
            return "GENERAL"
        if lowered == "name":
            return f"Seed {name} {index}"
        return text

    return f"seed-{table_name}-{index}"


class Seeder:
    def __init__(self, db: Session, per_table: int = 2):
        self.db = db
        self.per_table = per_table
        self.ids: dict[str, list[str]] = {}
        self.rows: dict[str, list[Any]] = {}
        self._counter: dict[str, int] = {}
        self._models = {
            mapper.local_table.name: mapper.class_
            for mapper in Base.registry.mappers
            if mapper.local_table is not None
        }

    def _next(self, table_name: str) -> int:
        self._counter[table_name] = self._counter.get(table_name, 0) + 1
        return self._counter[table_name]

    def _seeded(self, table_name: str) -> list[str]:
        return self.ids.get(table_name, [])

    def seed_all(self) -> dict[str, list[str]]:
        for table in self._ordered_tables():
            if table.name not in self._models or table.name in SKIP_TABLES:
                continue
            for _ in range(self.per_table):
                self._insert_one(table)
        self._post_process()
        return self.ids

    def _ordered_tables(self):
        return Base.metadata.sorted_tables

    def _insert_one(self, table) -> None:
        model = self._models[table.name]
        for attempt in range(4):
            index = self._next(table.name)
            kwargs: dict[str, Any] = {}
            for column in table.columns:
                if column.foreign_keys:
                    target = list(column.foreign_keys)[0].column.table.name
                    candidates = self._seeded(target)
                    if not candidates:
                        kwargs[column.name] = None
                        continue
                    kwargs[column.name] = candidates[index % len(candidates)]
                    continue
                if column.primary_key:
                    if isinstance(column.type, String):
                        kwargs[column.name] = f"{column.name}-{uuid.uuid4().hex[:8]}"
                    else:
                        kwargs[column.name] = str(uuid.uuid4())
                    continue
                kwargs[column.name] = _value_for(column, index, table.name)

            obj = model(**kwargs)
            self.db.add(obj)
            try:
                self.db.flush()
            except Exception:
                self.db.rollback()
                self.db.expunge_all()
                if attempt == 3:
                    return
                continue
            primary_key = list(table.primary_key.columns)
            key_value = getattr(obj, primary_key[0].name) if primary_key else None
            self.ids.setdefault(table.name, []).append(key_value)
            self.rows.setdefault(table.name, []).append(obj)
            return

    def _post_process(self) -> None:
        """Align a few rows so route guards exercise deeper code paths."""
        for name in ("users",):
            for row in self.rows.get(name, []):
                row.role = "SUPER_ADMIN"
        # An applicant must be reachable through a real Applicant row.
        for row in self.rows.get("users", []):
            if row.role == "APPLICANT":
                row.role = "APPROVING_AUTHORITY"
        for row in self.rows.get("sessions", []):
            row.revoked_at = None
            row.expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        for row in self.rows.get("applications", []):
            row.status = "SUBMITTED"
        for row in self.rows.get("verification_cases", []):
            row.status = "COMPLETED"
        for row in self.rows.get("approvals", []):
            row.decision = "APPROVED"
        for row in self.rows.get("selection_rounds", []):
            row.finalized_at = datetime.now(timezone.utc)
            row.status = "FINALIZED"
        for row in self.rows.get("finance_installments", []):
            row.status = "QUEUED"
        for row in self.rows.get("scheme_versions", []):
            row.status = "PUBLISHED"
        for row in self.rows.get("documents", []):
            row.status = "VERIFIED"
        self.db.commit()
