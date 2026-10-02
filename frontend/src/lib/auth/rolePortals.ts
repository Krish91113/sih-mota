/**
 * Canonical role vocabulary and the portal each role lands in after sign-in.
 * Keep in sync with backend `app.core.constants.ROLE_NAMES`.
 */

export const ROLE_NAMES = [
  "APPLICANT",
  "INSTITUTION_NODAL_OFFICER",
  "VERIFICATION_OFFICER",
  "SCRUTINY_OFFICER",
  "SCHEME_MANAGER",
  "SELECTION_COMMITTEE_MEMBER",
  "APPROVING_AUTHORITY",
  "FINANCE_OFFICER",
  "GRIEVANCE_OFFICER",
  "HELPDESK_AGENT",
  "MONITORING_ANALYST",
  "AUDITOR",
  "SUPER_ADMIN",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

const PORTAL_BY_ROLE: Record<string, string> = {
  SUPER_ADMIN: "/admin",
  SCHEME_MANAGER: "/admin",
  VERIFICATION_OFFICER: "/officer",
  SCRUTINY_OFFICER: "/officer",
  GRIEVANCE_OFFICER: "/officer",
  HELPDESK_AGENT: "/officer",
  APPROVING_AUTHORITY: "/approval",
  FINANCE_OFFICER: "/finance",
  COMMITTEE_MEMBER: "/committee",
  SELECTION_COMMITTEE_MEMBER: "/committee",
  INSTITUTION_NODAL: "/institution",
  INSTITUTION_NODAL_OFFICER: "/institution",
  AUDITOR: "/analytics",
  MONITORING_ANALYST: "/analytics",
  APPLICANT: "/portal",
};

/** Map a backend role to the portal route it should be routed to. */
export function portalForRole(role: string | undefined | null): string {
  if (!role) return "/portal";
  return PORTAL_BY_ROLE[role] ?? "/portal";
}

/** Human label for a role, e.g. INSTITUTION_NODAL_OFFICER -> "Institution Nodal Officer". */
export function roleLabel(role: string): string {
  const words = role.replace(/_/g, " ").toLowerCase();
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}
