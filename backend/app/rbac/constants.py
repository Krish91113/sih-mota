"""Canonical permission and scope vocabulary used by the RBAC seed process."""

from dataclasses import dataclass

SCOPE_ANY = "ANY"
SCOPE_OWN = "OWN"
SCOPE_ASSIGNED = "ASSIGNED"
SCOPE_SCHEME = "SCHEME"
SCOPE_ORG = "ORG"
SCOPES = (SCOPE_ANY, SCOPE_OWN, SCOPE_ASSIGNED, SCOPE_SCHEME, SCOPE_ORG)


@dataclass(frozen=True)
class PermissionSpec:
    resource: str
    action: str
    scope: str = SCOPE_ANY
    description: str = ""

    @property
    def key(self) -> str:
        return permission_key(self.resource, self.action, self.scope)


# Keep this list small and composable. Applications may extend it in their own
# seed module without changing the authorization algorithm.
PERMISSIONS = (
    PermissionSpec("APPLICATION", "READ", SCOPE_OWN, "Read owned applications"),
    PermissionSpec("APPLICATION", "READ", SCOPE_ASSIGNED, "Read assigned applications"),
    PermissionSpec("APPLICATION", "READ", SCOPE_SCHEME, "Read applications in assigned schemes"),
    PermissionSpec("APPLICATION", "WRITE", SCOPE_OWN, "Update owned applications"),
    PermissionSpec("APPLICATION", "REVIEW", SCOPE_ASSIGNED, "Review assigned applications"),
    PermissionSpec("APPLICATION", "MANAGE", SCOPE_ANY, "Manage applications"),
    PermissionSpec("DOCUMENT", "READ", SCOPE_OWN, "Read owned documents"),
    PermissionSpec("DOCUMENT", "WRITE", SCOPE_OWN, "Manage owned documents"),
    PermissionSpec("SCHEME", "READ", SCOPE_ANY, "Read schemes"),
    PermissionSpec("SCHEME", "MANAGE", SCOPE_ANY, "Manage schemes"),
    PermissionSpec("USER", "MANAGE", SCOPE_ORG, "Manage users in an organization"),
    PermissionSpec("REPORT", "READ", SCOPE_ORG, "Read organization reports"),
)


def permission_key(resource: str, action: str, scope: str = SCOPE_ANY) -> str:
    """Return the normalized RESOURCE:ACTION:SCOPE representation."""
    resource, action, scope = resource.strip().upper(), action.strip().upper(), scope.strip().upper()
    if not resource or not action or scope not in SCOPES:
        raise ValueError("Permission must be RESOURCE:ACTION:SCOPE with a supported scope")
    return f"{resource}:{action}:{scope}"


def parse_permission(value: str) -> tuple[str, str, str]:
    parts = value.strip().upper().split(":")
    if len(parts) != 3:
        raise ValueError("Permission must use RESOURCE:ACTION:SCOPE")
    resource, action, scope = parts
    permission_key(resource, action, scope)
    return resource, action, scope
