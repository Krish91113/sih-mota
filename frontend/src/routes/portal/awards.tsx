import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, KpiCard, StageTimeline, StatusBadge } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useAwardsQuery } from "@/hooks/api/useFinance";
import { formatDate, formatINR, humanizeField } from "@/lib/format";
import { Banknote, CheckCircle2, Landmark, Wallet } from "lucide-react";
import { useState } from "react";

/** Award disbursement stages, in finance-module order. */
const AWARD_STAGES = ["Sanctioned", "Disbursing", "Processing", "Disbursed"] as const;

export const Route = createFileRoute("/portal/awards")({
  head: () => ({
    meta: [{ title: "My Awards | Applicant Portal" }],
  }),
  component: MyAwards,
});

type AwardRow = {
  id: string;
  scheme: string;
  sanctioned: string;
  status: string;
  awardDate: string;
};

const columns: Column<AwardRow>[] = [
  {
    key: "id",
    header: "Award",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "scheme",
    header: "Scheme",
    sortValue: (r) => r.scheme,
    cell: (r) => <span className="text-muted-foreground">{r.scheme}</span>,
    hideBelowMd: true,
  },
  {
    key: "sanctioned",
    header: "Sanctioned amount",
    sortValue: (r) => r.sanctioned,
    cell: (r) => <span className="font-medium">{r.sanctioned}</span>,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "awardDate",
    header: "Award date",
    sortValue: (r) => r.awardDate,
    cell: (r) => <span className="text-muted-foreground">{r.awardDate}</span>,
    hideBelowLg: true,
  },
];

function MyAwards() {
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const query = useAwardsQuery();
  /**
   * An award row carries `application_id`, `scheme_version_id`, `status`,
   * `amount`, `award_date` and `awarded_by`. There is no `scheme_name`,
   * `amount_monthly` or `sanction_reference` column.
   */
  const myAwards: AwardRow[] = (query.data ?? []).map((award) => ({
    id: award.id,
    scheme: String(award.scheme_version_id ?? award.application_id),
    sanctioned: award.amount == null ? "—" : formatINR(award.amount),
    status: award.status,
    awardDate: formatDate(award.award_date),
  }));
  /** All KPI tiles below are derived from the loaded rows. */
  const CLOSED_STATUSES = new Set(["CLOSED", "DISBURSED", "CANCELLED"]);
  const activeAwards = myAwards.filter((a) => !CLOSED_STATUSES.has(a.status.toUpperCase()));
  const disbursedTotal = (query.data ?? [])
    .filter((a) => a.status?.toUpperCase() === "DISBURSED" && a.amount != null)
    .reduce((sum, a) => sum + (a.amount ?? 0), 0);
  const latestAwardDate = (query.data ?? [])
    .map((a) => a.award_date)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  return (
    <div>
      <PageHeader
        title="My awards & disbursements"
        desc="Sanctions, monthly entitlements and payment history against your name."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard
          label="Total awards"
          value={String(myAwards.length)}
          icon={Wallet}
          hint={`${activeAwards.length} active`}
        />
        <KpiCard
          label="Disbursed"
          value={formatINR(disbursedTotal)}
          icon={Banknote}
          hint="Sum of disbursed award amounts"
        />
        <KpiCard
          label="Latest award"
          value={latestAwardDate ? formatDate(latestAwardDate) : "—"}
          icon={Landmark}
        />
        <KpiCard
          label="Closed"
          value={String(myAwards.length - activeAwards.length)}
          icon={CheckCircle2}
        />
      </div>

      {query.isLoading ? (
        <p className="mb-4 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Loading awards…
        </p>
      ) : null}
      {query.isError ? (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          We could not load awards.
        </p>
      ) : null}
      <DataTable
        data={myAwards}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search award or scheme"
        searchKeys={(r) => `${r.id} ${r.scheme} ${r.status}`}
        onRowClick={(r) => setOpenDialog(r.id)}
      />

      {openDialog ? <AwardDialog id={openDialog} onClose={() => setOpenDialog(null)} /> : null}
    </div>
  );
}

function AwardDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useAwardsQuery();
  const award = (query.data ?? []).find((a) => a.id === id);
  const awardView = award
    ? {
        ...award,
        sanctioned: award.amount == null ? "—" : formatINR(award.amount),
      }
    : null;
  if (!award || !awardView) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-lg shadow-lift" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="border-b border-dashed">
          <CardTitle className="text-lg">{award.id} · award details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Status</dt>
              <dd className="mt-1 font-medium">{humanizeField(award.status)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Amount</dt>
              <dd className="mt-1 font-medium">{awardView.sanctioned}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Award date</dt>
              <dd className="mt-1 font-medium">{formatDate(award.award_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Application</dt>
              <dd className="mt-1 font-medium">{award.application_id}</dd>
            </div>
          </dl>
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payment timeline
            </p>
            <StageTimeline
              stages={AWARD_STAGES}
              current={
                award.status === "DISBURSED"
                  ? 3
                  : award.status === "DISBURSING"
                    ? 2
                    : award.status === "SANCTIONED"
                      ? 1
                      : 0
              }
            />
          </div>
          <div className="rounded-lg bg-muted/60 p-4 text-xs text-muted-foreground">
            Disbursement details and the sanction letter are served by the finance module. This
            award references application{" "}
            <span className="font-medium text-foreground">{award.application_id}</span>.
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Close</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
