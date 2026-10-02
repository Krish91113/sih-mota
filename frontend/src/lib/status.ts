/**
 * Status vocabulary and presentation helpers.
 *
 * Status strings come straight from the backend enums
 * (DRAFT, SUBMITTED, UNDER_REVIEW, APPROVAL_HOLD, ELIGIBLE, ...). They are
 * normalised to Title Case for display and mapped to one of five tones so the
 * interface stays readable without relying on colour alone.
 */

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/**
 * Explicit map for every status the backend can emit. Anything unlisted falls
 * back to a keyword scan, so a new backend status still renders legibly.
 */
const STATUS_TONE: Record<string, Tone> = {
  // application lifecycle
  DRAFT: "neutral",
  SUBMITTED: "info",
  UNDER_REVIEW: "info",
  IN_REVIEW: "info",
  VALIDATION: "info",
  DOCUMENTS: "info",
  VERIFICATION: "info",
  SCRUTINY: "info",
  INSTITUTION_VERIFICATION: "info",
  SELECTION: "info",
  APPROVAL: "info",
  APPROVAL_HOLD: "warning",
  ELIGIBILITY: "info",
  EVALUATED: "info",
  QUEUED: "info",

  // decisions
  ELIGIBLE: "success",
  APPROVED: "success",
  ACCEPTED: "success",
  VERIFIED: "success",
  COMPLETED: "success",
  COMPLETE: "success",
  ACTIVE: "success",
  PUBLISHED: "success",
  FINALIZED: "success",
  RECONCILED: "success",
  RESOLVED: "success",
  SUCCESS: "success",
  SUCCESSFUL: "success",
  PAID: "success",
  RECOMMEND: "success",
  SANCTIONED: "success",

  // needs attention
  PENDING: "warning",
  OPEN: "warning",
  IN_PROGRESS: "warning",
  PROCESSING: "warning",
  RETURNED: "warning",
  RETRY: "warning",
  RECOMMENDED: "warning",
  HOLD: "warning",
  MEDIUM: "warning",
  AWAITING: "warning",

  // negative
  REJECTED: "danger",
  REJECT: "danger",
  DENIED: "danger",
  FAILED: "danger",
  FAILURE: "danger",
  CANCELLED: "danger",
  CANCELED: "danger",
  WITHDRAWN: "danger",
  INELIGIBLE: "danger",
  BREACHED: "danger",
  HIGH: "danger",
  LOW: "neutral",
  ABSTAIN: "neutral",
  INACTIVE: "neutral",
  ARCHIVED: "neutral",
  CLOSED: "neutral",
};

export function statusTone(status: string | null | undefined): Tone {
  if (!status) return "neutral";
  const key = status.toUpperCase();
  const direct = STATUS_TONE[key];
  if (direct) return direct;
  if (/(REJECT|FAIL|DENY|BREACH|INELIGIB|INVALID)/.test(key)) return "danger";
  if (/(APPROV|VERIF|ELIGIB|COMPLET|SUCCESS|AWARD|PUBLISH|FINALIZ|ACTIVE)/.test(key))
    return "success";
  if (/(PENDING|OPEN|PROCESS|RETURN|RETRY|HOLD|QUEUED|WARN)/.test(key)) return "warning";
  return "info";
}

/** "UNDER_REVIEW" -> "Under Review" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Compact title-casing used for column values such as document types. */
export function humanizeCode(value: string | null | undefined): string {
  return humanize(value);
}
