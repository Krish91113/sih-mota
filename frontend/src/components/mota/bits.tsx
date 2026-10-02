import { cn } from "@/lib/utils";
import { statusTone, humanize, type Tone } from "@/lib/status";
import { formatDate, slaFromDue, type SlaInfo, type SlaState } from "@/lib/format";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Clock,
  FileText,
  History,
  Inbox,
  Loader2,
  Sparkles,
  Upload,
  Eye,
  RefreshCw,
  ShieldQuestion,
  TriangleAlert,
} from "lucide-react";
export const STAGES = [
  "Submitted",
  "Validation",
  "Documents",
  "Institution Verification",
  "Scrutiny",
  "Selection",
  "Approval",
  "Awarded",
] as const;

/* ---------- headings ---------- */

export function SectionHead({
  eyebrow,
  title,
  desc,
  center,
  action,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  center?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        center && "md:flex-col md:items-center md:text-center",
      )}
    >
      <div className={cn("max-w-2xl", center && "mx-auto")}>
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="text-2xl leading-tight text-balance sm:text-3xl md:text-4xl">{title}</h2>
        {desc ? <p className="mt-3 text-muted-foreground text-pretty">{desc}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl md:text-3xl">{title}</h1>
        {desc ? <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

/* ---------- status ---------- */

const LEGACY_STATUS_TONE: Record<string, string> = {
  Verified: "border-leaf/30 bg-leaf/10 text-leaf",
  Awarded: "border-leaf/30 bg-leaf/10 text-leaf",
  Resolved: "border-leaf/30 bg-leaf/10 text-leaf",
  Approved: "border-leaf/30 bg-leaf/10 text-leaf",
  Rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  "Action Required": "border-destructive/30 bg-destructive/10 text-destructive",
  Processing: "border-navy/30 bg-navy/10 text-navy",
  Pending: "border-border bg-muted text-muted-foreground",
  Draft: "border-border bg-muted text-muted-foreground",
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-primary/25 bg-primary/8 text-primary",
  success: "border-[#2E7D32]/30 bg-[#2E7D32]/10 text-[#245F27]",
  warning: "border-[#B7791F]/30 bg-[#B7791F]/10 text-[#8F5E17]",
  danger: "border-[#C0392B]/30 bg-[#C0392B]/10 text-[#96291D]",
};

export function StatusBadge({
  status,
  className,
  label,
}: {
  /** Nullable: `status` is an optional column on several backend tables. */
  status: string | null | undefined;
  className?: string;
  /** Overrides the displayed text; useful for compact labels like "In review". */
  label?: string;
}) {
  // Legacy Title-Case labels win so any hard-coded copy elsewhere stays stable.
  const raw = status ?? "";
  const legacy = LEGACY_STATUS_TONE[raw];
  const tone = legacy ? null : TONE_CLASS[statusTone(raw)];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        legacy ?? tone,
        className,
      )}
    >
      {label ?? (raw ? humanize(raw) : "—")}
    </span>
  );
}

/** Severity chip for rule breaches and risk findings. */
export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Priority readout.
 *
 * Accepts the backend's raw `priority` codes as well as the legacy Title-Case
 * labels, because the API returns `HIGH` / `NORMAL` / `URGENT` / `LOW` rather
 * than `High` / `Medium` / `Low`. Normalising here keeps every call site from
 * having to re-map the same codes.
 */
export function Priority({ level }: { level: string | null | undefined }) {
  const raw = (level ?? "").trim();
  const key = raw.toUpperCase();
  const tone =
    key === "HIGH" || key === "URGENT" || key === "CRITICAL"
      ? "bg-destructive"
      : key === "NORMAL" || key === "MEDIUM"
        ? "bg-warn"
        : "bg-leaf";
  const label = humanize(raw) || "—";
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <span className={cn("size-2 rounded-full", tone)} aria-hidden />
      {label}
    </span>
  );
}

/**
 * SLA readout.
 *
 * Prefers the backend's own `sla_status` / `sla_due_at` when present (the
 * backend owns the rule); falls back to deriving the window from the due date,
 * and finally to the legacy day-count form still used by older tables.
 */
export function Sla({
  days,
  dueAt,
  backendStatus,
}: {
  days?: number;
  dueAt?: string | null;
  backendStatus?: string | null;
}) {
  const info = slaFromDue(dueAt, backendStatus);
  const resolved: SlaInfo =
    dueAt || backendStatus
      ? info
      : days === undefined
        ? { state: "none", label: "No SLA" }
        : info.state === "none"
          ? info
          : {
              state: days < 0 ? "breached" : days <= 2 ? "soon" : "on_track",
              label: slaLabel(days),
            };

  const colour: Record<SlaState, string> = {
    breached: "text-destructive",
    due: "text-warn",
    soon: "text-warn",
    on_track: "text-muted-foreground",
    none: "text-muted-foreground",
  };

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", colour[resolved.state])}
    >
      <Clock className="size-3.5" aria-hidden />
      <span className="whitespace-nowrap">{resolved.label}</span>
      {resolved.dueAt ? <span className="sr-only">Due {formatDate(resolved.dueAt)}</span> : null}
    </span>
  );
}

function slaLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return `${days}d left`;
}

/* ---------- data display ---------- */

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  icon?: React.ElementType;
  /** Colours the value — used for status-style KPIs such as "Chain intact". */
  tone?: Tone;
}) {
  const toneText: Record<Tone, string> = {
    neutral: "text-foreground",
    info: "text-primary",
    success: "text-[#2E7D32]",
    warning: "text-[#8F5E17]",
    danger: "text-[#96291D]",
  };

  return (
    <Card className="shadow-card">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 font-display text-3xl leading-none",
              tone ? toneText[tone] : "text-foreground",
            )}
          >
            {value}
          </p>
          {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className="shrink-0 rounded-lg bg-accent p-2 text-accent-foreground">
            <Icon className="size-5" aria-hidden />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-words">{value}</dd>
    </div>
  );
}

export function EmptyState({
  title,
  desc,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-surface/60 px-6 py-14 text-center">
      <span className="rounded-full bg-accent p-3 text-accent-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-4 font-display text-lg">{title}</p>
      {desc ? <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{desc}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({ label = "Loading records" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 rounded-xl border bg-card py-12 text-sm text-muted-foreground"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label}…
    </div>
  );
}

export function ErrorBlock({
  label = "We could not load this section",
  onRetry,
}: {
  label?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center">
      <TriangleAlert className="size-5 text-destructive" aria-hidden />
      <p className="text-sm font-medium">{label}</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Please retry. If it continues, raise a grievance and quote the time of the error.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/* ---------- timeline ---------- */

/**
 * Live `Application.status` values, in workflow order. Verified against
 * `GET /applications` (returns e.g. `DRAFT`, `APPROVAL`). Anything not listed
 * is treated as "not reached yet" rather than being forced into a stage.
 */
const STAGE_CODES: Record<string, number> = {
  DRAFT: 0,
  SUBMITTED: 0,
  UNDER_VALIDATION: 1,
  VALIDATION: 1,
  DOCUMENTS: 2,
  AWAITING_DOCUMENTS: 2,
  INSTITUTION_VERIFICATION: 3,
  VERIFICATION: 3,
  SCRUTINY: 4,
  SELECTION: 5,
  APPROVAL: 6,
  AWARDED: 7,
  DISBURSED: 7,
};

/** Maps a live status code onto its index in `STAGES`; `0` when unknown. */
export function stageIndex(status: string | null | undefined): number {
  if (!status) return 0;
  return STAGE_CODES[status] ?? STAGE_CODES[status.toUpperCase()] ?? 0;
}

export function StageTimeline({
  current,
  stageStatus,
  stages,
  compact,
}: {
  /** Positional index. Ignored when `stageStatus` is supplied. */
  current?: number;
  /** A live backend status code, preferred over `current`. */
  stageStatus?: string | null;
  /** Override the default stage list (e.g. award payment states). */
  stages?: readonly string[];
  compact?: boolean;
}) {
  const list = stages ?? STAGES;
  const index = stageStatus !== undefined ? stageIndex(stageStatus) : (current ?? 0);
  return (
    <ol className={cn("grid gap-0", compact ? "sm:grid-cols-2" : "md:grid-cols-4")}>
      {list.map((s, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <li key={s} className="relative flex gap-3 pb-6 md:block md:pb-0">
            <div className="flex flex-col items-center md:w-full md:flex-row">
              <span
                className={cn(
                  "z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold",
                  done && "border-leaf bg-leaf text-white",
                  active && "border-primary bg-primary text-primary-foreground",
                  !done && !active && "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden h-0.5 w-full md:block",
                  i === list.length - 1 && "md:invisible",
                  done ? "bg-leaf" : "bg-border",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "w-0.5 grow md:hidden",
                  i === list.length - 1 ? "invisible" : done ? "bg-leaf" : "bg-border",
                )}
                aria-hidden
              />
            </div>
            <div className="md:mt-3 md:pr-6">
              <p className={cn("text-sm font-medium", active && "text-primary")}>{s}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {done ? "Completed" : active ? "In progress" : "Not started"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- documents ---------- */

export function DocumentCard({
  doc,
}: {
  doc: {
    name: string;
    required: boolean;
    file?: string;
    size?: string;
    status: string;
    note?: string;
    versions: number;
  };
}) {
  return (
    <Card className="shadow-card transition-shadow hover:shadow-lift">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span className="rounded-lg bg-accent p-2 text-accent-foreground">
              <FileText className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{doc.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {doc.required ? "Required" : "Optional"}
                {doc.file ? ` · ${doc.file} · ${doc.size}` : " · No file uploaded"}
              </p>
            </div>
          </div>
          <StatusBadge status={doc.status} />
        </div>

        {doc.status === "Processing" ? (
          <div className="mt-4">
            <Progress value={68} className="h-1.5" />
            <p className="mt-2 text-xs text-muted-foreground">
              Reading document and checking readability…
            </p>
          </div>
        ) : null}

        {doc.note ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {doc.note}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {doc.file ? (
            <>
              <Button size="sm" variant="outline">
                <Eye className="size-4" aria-hidden /> Preview
              </Button>
              <Button size="sm" variant="outline">
                <RefreshCw className="size-4" aria-hidden /> Replace
              </Button>
            </>
          ) : (
            <Button size="sm">
              <Upload className="size-4" aria-hidden /> Upload
            </Button>
          )}
          {doc.versions > 1 ? (
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              <History className="size-4" aria-hidden /> {doc.versions} versions
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- deficiency ---------- */

export function DeficiencyCard({
  d,
  onResolve,
}: {
  d: {
    id: string;
    application: string;
    issue: string;
    action: string;
    raisedBy: string;
    raised: string;
    deadline: string;
    severity: "High" | "Medium";
  };
  onResolve?: () => void;
}) {
  return (
    <Card className="border-destructive/30 bg-destructive/[0.03] shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground">
            <AlertTriangle className="size-3.5" aria-hidden /> Action Required
          </span>
          <span className="text-xs text-muted-foreground">
            {d.id} · {d.application}
          </span>
        </div>
        <CardTitle className="mt-2 text-base leading-snug">{d.issue}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Field label="Required action" value={d.action} />
          <Field label="Raised by" value={`${d.raisedBy}, ${d.raised}`} />
          <Field
            label="Respond by"
            value={<span className="text-destructive">{d.deadline}</span>}
          />
        </dl>
        <div className="rounded-lg border border-dashed bg-card p-4">
          <p className="text-sm font-medium">Upload replacement document</p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF or JPG up to 5 MB. The earlier file is retained in version history.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline">
              <Upload className="size-4" aria-hidden /> Choose file
            </Button>
            <Button size="sm" variant="ghost">
              <Eye className="size-4" aria-hidden /> Review response
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onResolve}>Resolve now</Button>
          <Button variant="outline">Submit response</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- AI-ready ---------- */

const AI_UNAVAILABLE = "AI review not yet available — manual verification in progress.";

export function AiConfidenceBadge({ label = "Confidence" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <Sparkles className="size-3.5" aria-hidden /> {label}: not scored
    </span>
  );
}

export function AiSummaryCard({ title = "AI assisted summary" }: { title?: string }) {
  return (
    <Card className="border-primary/20 bg-accent/40 shadow-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" aria-hidden /> {title}
          </CardTitle>
          <AiConfidenceBadge />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{AI_UNAVAILABLE}</p>
      </CardContent>
    </Card>
  );
}

export function AiFlag({
  kind,
  text = AI_UNAVAILABLE,
}: {
  kind?: "consistency" | "duplicate" | "risk";
  text?: string;
}) {
  const entry = kind
    ? {
        consistency: { icon: ShieldQuestion, label: "Cross-document consistency" },
        duplicate: { icon: BadgeCheck, label: "Duplicate application advisory" },
        risk: { icon: TriangleAlert, label: "Risk advisory" },
      }[kind]
    : undefined;
  const Icon = entry?.icon ?? ShieldQuestion;
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <p className="text-sm font-medium">{entry?.label ?? "AI review"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

export function AiReviewWorkspace() {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" aria-hidden /> AI review workspace
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{AI_UNAVAILABLE}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <AiFlag kind="consistency" />
          <AiFlag kind="duplicate" />
          <AiFlag kind="risk" />
        </div>
      </CardContent>
    </Card>
  );
}
