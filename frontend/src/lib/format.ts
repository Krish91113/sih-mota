/**
 * Display formatters for the administrative dashboard.
 *
 * The backend stores money as Decimal and dates as mixed UTC / IST ISO
 * strings. Everything user-facing is normalised here so no component has to
 * deal with raw values.
 */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** `12500` -> `₹1,25,000` (Indian digit grouping, no paise noise). */
export function formatINR(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return INR.format(n);
}

/** `12500` -> `1,25,000` without the currency symbol. */
export function formatNumber(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return new Intl.NumberFormat("en-IN").format(n);
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[₹,\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object" && "toString" in value) {
    const n = Number(String(value));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Percentage with a single decimal when it adds information. */
export function formatPercent(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const DATETIME_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/** `30 Sep 2026` */
export function formatDate(value: unknown): string {
  const d = parseDate(value);
  return d ? DATE_FMT.format(d) : "—";
}

/** `30 Sep 2026, 02:31 pm` */
export function formatDateTime(value: unknown): string {
  const d = parseDate(value);
  return d ? DATETIME_FMT.format(d) : "—";
}

/** Coarse "x minutes ago" used in timelines and activity feeds. */
export function formatRelative(value: unknown): string {
  const d = parseDate(value);
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days}d ago`;
  return formatDate(d);
}

export type SlaState = "breached" | "due" | "soon" | "on_track" | "none";

export interface SlaInfo {
  state: SlaState;
  label: string;
  dueAt?: string | null;
}

/**
 * Derive an SLA readout from a due date, or from the backend's own
 * `sla_status` when it supplied one (preferred — the backend owns the rule).
 */
export function slaFromDue(dueAt: unknown, backendStatus?: string | null): SlaInfo {
  if (backendStatus) {
    const key = backendStatus.toUpperCase();
    if (key === "BREACHED" || key === "BREACH")
      return { state: "breached", label: "SLA breached", dueAt: asDate(dueAt) };
    if (key === "AT_RISK" || key === "DUE_SOON")
      return { state: "soon", label: "SLA at risk", dueAt: asDate(dueAt) };
    if (key === "ON_TRACK") return { state: "on_track", label: "On track", dueAt: asDate(dueAt) };
  }
  const d = parseDate(dueAt);
  if (!d) return { state: "none", label: "No SLA" };
  const hours = (d.getTime() - Date.now()) / 3_600_000;
  if (hours < 0) {
    const days = Math.floor(Math.abs(hours) / 24);
    return {
      state: "breached",
      label: days > 0 ? `${days}d overdue` : "Overdue",
      dueAt: asDate(dueAt),
    };
  }
  if (hours < 24) return { state: "due", label: "Due today", dueAt: asDate(dueAt) };
  if (hours <= 72)
    return { state: "soon", label: `${Math.round(hours / 24)}d left`, dueAt: asDate(dueAt) };
  return { state: "on_track", label: `${Math.round(hours / 24)}d left`, dueAt: asDate(dueAt) };
}

function asDate(value: unknown): string | null {
  const d = parseDate(value);
  return d ? d.toISOString() : null;
}

/** Two-letter monogram used beside institution / scheme / document names. */
export function monogram(value: string | null | undefined): string {
  if (!value) return "—";
  const words = value
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return value.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** First letters of a person's name for the account avatar. */
export function initials(value: string | null | undefined): string {
  if (!value) return "?";
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Pretty-print an arbitrary JSON value for rule/evidence detail views. */
export function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "object") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Turn `ACADEMIC_MERIT` / `annual_income` into a readable label. */
export function humanizeField(key: string | null | undefined): string {
  if (!key) return "—";
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
