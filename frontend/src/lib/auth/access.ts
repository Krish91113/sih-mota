/**
 * Route → role authorisation, mirroring the backend's own `require_roles(...)`
 * scoping so a user is never shown a workspace they cannot use.
 *
 * This is a UX guard only. The backend re-checks every request; nothing here is
 * a security boundary. Keep the role sets in sync with:
 *   - `app.core.access.STAFF_READ_ROLES` / `FINANCE_STAFF_READ_ROLES`
 *   - `app.verification_api.VERIFICATION_ROLES`
 *   - the `require_roles(...)` calls across the backend routers.
 */

export interface PathRoleRule {
  /** Roles that grant access to at least one route under this prefix. */
  roles: string[];
  /** Shown on the "no access" screen. */
  label: string;
}

/** `app.core.access.STAFF_READ_ROLES` */
const STAFF_READ_ROLES = [
  "SUPER_ADMIN",
  "SCHEME_MANAGER",
  "VERIFICATION_OFFICER",
  "SCRUTINY_OFFICER",
  "APPROVING_AUTHORITY",
  "FINANCE_OFFICER",
  "AUDITOR",
  "MONITORING_ANALYST",
  "GRIEVANCE_OFFICER",
  "HELPDESK_AGENT",
];

/** `app.core.access.FINANCE_STAFF_READ_ROLES` */
const FINANCE_READ_ROLES = [
  "FINANCE_OFFICER",
  "AUDITOR",
  "APPROVING_AUTHORITY",
  "SCHEME_MANAGER",
  "SUPER_ADMIN",
];

/** `app.verification_api.VERIFICATION_ROLES` */
const VERIFICATION_ROLES = [
  "VERIFICATION_OFFICER",
  "SCRUTINY_OFFICER",
  "SCHEME_MANAGER",
  "SUPER_ADMIN",
];

/**
 * Longest prefix wins, so `/audit/integrity` can be narrower than `/audit`.
 */
const RULES: ReadonlyArray<PathRoleRule & { prefix: string }> = [
  {
    prefix: "/admin",
    roles: ["SUPER_ADMIN", "SCHEME_MANAGER"],
    label: "Scheme and platform administration",
  },
  {
    prefix: "/committee",
    roles: ["SELECTION_COMMITTEE_MEMBER", "SCHEME_MANAGER", "SUPER_ADMIN"],
    label: "Selection committee workspace",
  },
  {
    prefix: "/approval",
    roles: ["APPROVING_AUTHORITY", "SCHEME_MANAGER", "SUPER_ADMIN"],
    label: "Approval authority workspace",
  },
  {
    prefix: "/finance",
    roles: FINANCE_READ_ROLES,
    label: "Finance and disbursement workspace",
  },
  {
    prefix: "/verification",
    roles: VERIFICATION_ROLES,
    label: "Trust and verification workspace",
  },
  {
    prefix: "/audit",
    roles: ["AUDITOR", "SUPER_ADMIN", ...STAFF_READ_ROLES.filter((r) => r !== "AUDITOR")],
    label: "Audit log and integrity workspace",
  },
  {
    prefix: "/analytics",
    roles: ["MONITORING_ANALYST", "AUDITOR", "SCHEME_MANAGER", "SUPER_ADMIN"],
    label: "Monitoring and analytics workspace",
  },
  {
    prefix: "/institution",
    roles: ["INSTITUTION_NODAL_OFFICER", "SUPER_ADMIN"],
    label: "Institution workspace",
  },
  {
    prefix: "/officer",
    roles: STAFF_READ_ROLES,
    label: "Officer workspace",
  },
];

/**
 * Returns the authorisation rule for a pathname, or `undefined` when the path
 * is unguarded (public pages, `/portal`, `/login`, …).
 */
export function canAccessPath(pathname: string): PathRoleRule | undefined {
  const path = pathname.replace(/\/+$/, "") || "/";
  let match: (PathRoleRule & { prefix: string }) | undefined;

  for (const rule of RULES) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      if (!match || rule.prefix.length > match.prefix.length) match = rule;
    }
  }

  if (!match) return undefined;
  return { roles: match.roles, label: match.label };
}

/** True when the account holds a role that unlocks this pathname. */
export function isAllowed(pathname: string, heldRoles: readonly string[]): boolean {
  const rule = canAccessPath(pathname);
  if (!rule) return true;
  return rule.roles.some((r) => heldRoles.includes(r));
}

/** All prefixes the account can open — used to filter the sidebar. */
export function allowedPrefixes(heldRoles: readonly string[]): string[] {
  return RULES.filter((r) => r.roles.some((role) => heldRoles.includes(role))).map((r) => r.prefix);
}

export { FINANCE_READ_ROLES, STAFF_READ_ROLES, VERIFICATION_ROLES };
