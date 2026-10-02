/**
 * Demo/development accounts for one-click role login on the sign-in page.
 *
 * These identities are provisioned by `backend/scripts/seed_demo_roles.py`.
 * The panel is rendered unless VITE_DEMO_LOGIN is explicitly "false".
 */

export const DEMO_PASSWORD = "ChangeMe123!";

export interface DemoAccount {
  role: string;
  email: string;
  /** Short description of what this role can do. */
  blurb: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "APPLICANT",
    email: "applicant@example.org",
    blurb: "Apply to schemes, upload documents, track status",
  },
  {
    role: "INSTITUTION_NODAL_OFFICER",
    email: "institution@example.org",
    blurb: "Verify students, forward applications to MoTA",
  },
  {
    role: "VERIFICATION_OFFICER",
    email: "verifier@mota.gov.in",
    blurb: "System validation and document verification queue",
  },
  {
    role: "SCRUTINY_OFFICER",
    email: "scrutiny@mota.gov.in",
    blurb: "Scrutinise applications, raise or clear deficiencies",
  },
  {
    role: "GRIEVANCE_OFFICER",
    email: "grievance@mota.gov.in",
    blurb: "Triage and resolve applicant grievances",
  },
  {
    role: "HELPDESK_AGENT",
    email: "helpdesk@mota.gov.in",
    blurb: "Handle applicant queries and support tickets",
  },
  {
    role: "SCHEME_MANAGER",
    email: "manager@mota.gov.in",
    blurb: "Create schemes, forms and eligibility rules",
  },
  {
    role: "SELECTION_COMMITTEE_MEMBER",
    email: "committee@mota.gov.in",
    blurb: "Screen and shortlist eligible candidates",
  },
  {
    role: "APPROVING_AUTHORITY",
    email: "approver@mota.gov.in",
    blurb: "Grant final approval on selections",
  },
  {
    role: "FINANCE_OFFICER",
    email: "finance@mota.gov.in",
    blurb: "Sanction funds, disburse and reconcile",
  },
  {
    role: "MONITORING_ANALYST",
    email: "analyst@mota.gov.in",
    blurb: "Dashboards, KPIs and scheme analytics",
  },
  {
    role: "AUDITOR",
    email: "auditor@mota.gov.in",
    blurb: "Read-only audit trail and compliance reports",
  },
  {
    role: "SUPER_ADMIN",
    email: "admin@mota.gov.in",
    blurb: "Full access — users, roles, scopes, configuration",
  },
];

/** Vite statically replaces this value in both the client and SSR builds. */
export const isDemoLoginEnabled = import.meta.env.VITE_DEMO_LOGIN !== "false";
