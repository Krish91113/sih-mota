"""Database-backed permission resolution and scope evaluation."""

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .constants import (
    SCOPE_ANY,
    SCOPE_ASSIGNED,
    SCOPE_ORG,
    SCOPE_OWN,
    SCOPE_SCHEME,
    parse_permission,
)
from .models import Permission, Role, RolePermission, UserRole, UserScope


@dataclass(frozen=True)
class ResourceContext:
    """Identifiers used to evaluate ownership and assignment constraints."""

    owner_id: str | None = None
    assignee_id: str | None = None
    scheme_id: str | None = None
    org_id: str | None = None


def _value(context: ResourceContext | dict[str, Any] | Any, name: str) -> Any:
    if isinstance(context, dict):
        return context.get(name)
    return getattr(context, name, None)


def _scope_allowed(db: Session, user_id: str, scope: str, context: Any) -> bool:
    if scope == SCOPE_ANY:
        return True
    if scope == SCOPE_OWN:
        return _value(context, "owner_id") == user_id
    if scope == SCOPE_ASSIGNED:
        if (_value(context, "assignee_id") or _value(context, "assigned_to")) == user_id:
            return True
        return bool(
            db.scalar(
                select(UserScope.id).where(
                    UserScope.user_id == user_id,
                    UserScope.scope_type == SCOPE_ASSIGNED,
                    UserScope.scope_value == str(_value(context, "assignment_id") or _value(context, "assigned_id") or _value(context, "id") or ""),
                )
            )
        )
    if scope in (SCOPE_SCHEME, SCOPE_ORG):
        identifier = _value(context, f"{scope.lower()}_id")
        if identifier is None:
            return False
        return bool(
            db.scalar(
                select(UserScope.id).where(
                    UserScope.user_id == user_id,
                    UserScope.scope_type == scope,
                    UserScope.scope_value == str(identifier),
                )
            )
        )
    return False


def user_permission_specs(db: Session, user_id: str) -> list[Permission]:
    """Resolve active permissions through the user's active roles."""
    statement = (
        select(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .join(Role, Role.id == UserRole.role_id)
        .where(
            UserRole.user_id == user_id,
            Permission.is_active.is_(True),
            Role.is_active.is_(True),
        )
    )
    return list(db.scalars(statement).unique())


def has_permission(
    db: Session,
    user_id: str,
    permission: str,
    context: ResourceContext | dict[str, Any] | Any = None,
    *,
    is_super_admin: bool = False,
) -> bool:
    """Return whether a user has a permission and its resource scope."""
    resource, action, requested_scope = parse_permission(permission)
    if is_super_admin:
        return True
    for granted in user_permission_specs(db, user_id):
        if granted.resource != resource or granted.action != action:
            continue
        # ANY is a grant for every requested scope; otherwise the stored scope
        # must be the requested scope and its resource context must pass.
        if granted.scope == SCOPE_ANY or granted.scope == requested_scope:
            if _scope_allowed(db, user_id, granted.scope, context):
                return True
    return False


def seed_permissions(db: Session, specs: Any) -> int:
    """Insert permission specs idempotently; return the number inserted."""
    inserted = 0
    for spec in specs:
        resource, action, scope = spec.resource, spec.action, spec.scope
        exists = db.scalar(
            select(Permission).where(
                Permission.resource == resource,
                Permission.action == action,
                Permission.scope == scope,
            )
        )
        if exists is None:
            db.add(Permission(resource=resource, action=action, scope=scope, description=spec.description))
            inserted += 1
    if inserted:
        db.flush()
    return inserted
