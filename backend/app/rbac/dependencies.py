"""FastAPI dependencies for declarative RBAC checks.

Example::

    @router.get("/applications/{id}")
    def get_application(..., user=Depends(require_permission("APPLICATION:READ:OWN"))):
        ...
"""

from typing import Any, Callable

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import Forbidden
from app.core.permissions import current_user

from .service import ResourceContext, has_permission


def require_permission(
    permission: str,
    context_factory: Callable[[Any], ResourceContext | dict[str, Any] | Any] | None = None,
):
    """Create a dependency that rejects users without a scoped permission.

    ``context_factory`` receives the authenticated user. For checks involving a
    loaded resource, use ``authorize`` directly in the route after loading it,
    or provide a factory that can obtain context from request state.
    """
    def dependency(
        db: Session = Depends(get_db),
        user: Any = Depends(current_user),
    ) -> Any:
        context = context_factory(user) if context_factory else None
        if not has_permission(
            db,
            user.id,
            permission,
            context,
            is_super_admin=getattr(user, "role", None) == "SUPER_ADMIN",
        ):
            raise Forbidden("Insufficient permission")
        return user

    return dependency


def authorize(
    db: Session,
    user: Any,
    permission: str,
    resource: ResourceContext | dict[str, Any] | Any = None,
) -> Any:
    """Imperative variant for routes that load a resource before checking it."""
    if not has_permission(
        db,
        user.id,
        permission,
        resource,
        is_super_admin=getattr(user, "role", None) == "SUPER_ADMIN",
    ):
        raise Forbidden("Insufficient permission")
    return user


# Alias reads naturally at call sites while keeping one implementation.
require_permissions = require_permission
