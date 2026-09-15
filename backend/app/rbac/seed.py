"""Idempotent seed helpers for the canonical RBAC vocabulary."""

from sqlalchemy.orm import Session

from .constants import PERMISSIONS
from .service import seed_permissions


def seed_default_permissions(db: Session) -> int:
    """Seed canonical permissions into an existing transaction."""
    return seed_permissions(db, PERMISSIONS)
