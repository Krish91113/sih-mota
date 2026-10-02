"""Datetime helpers shared across the app.

Database round-trips drop timezone information on backends that store naive
timestamps (SQLite), while application code works in UTC-aware datetimes.
Mixing the two raises ``TypeError: can't subtract offset-naive and offset-aware
datetimes`` at runtime, so every value read from the database is funnelled
through :func:`as_utc` before it is compared or subtracted.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def as_utc(value: datetime | None) -> datetime | None:
    """Return ``value`` as a timezone-aware UTC datetime (or ``None``)."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def is_past(value: Any, reference: datetime | None = None) -> bool:
    """True when ``value`` is strictly before ``reference`` (defaults to now)."""
    moment = as_utc(value)
    if moment is None:
        return False
    return moment < (reference or utcnow())


def elapsed_seconds(start: Any, end: Any) -> float:
    """Seconds between two datetimes, tolerant of mixed awareness."""
    start_utc = as_utc(start)
    end_utc = as_utc(end)
    if start_utc is None or end_utc is None:
        return 0.0
    return (end_utc - start_utc).total_seconds()


def elapsed_days(start: Any, end: Any) -> int:
    """Whole days between two datetimes, tolerant of mixed awareness."""
    start_utc = as_utc(start)
    end_utc = as_utc(end)
    if start_utc is None or end_utc is None:
        return 0
    return (end_utc - start_utc).days
