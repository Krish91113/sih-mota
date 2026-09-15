import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, KpiCard, StageTimeline } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useAwardsQuery } from "@/hooks/api/useFinance";
import { Banknote, CheckCircle2, Landmark, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
  amountMonthly: string;
  sanctionRef: string;
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
    cell: (r) => (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === "Disbursed" ? "bg-leaf/10 text-leaf" : r.status === "Closed" ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground"}`}
      >
        {r.status}
      </span>
    ),
  },
  {
    key: "annual",
    header: "Value",
    sortValue: (r) => r.sanctioned,
    cell: (r) => <span className="text-muted-foreground">{r.amountMonthly}</span>,
    hideBelowLg: true,
  },
];

function MyAwards() {
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const query = useAwardsQuery();
  const myAwards: AwardRow[] = (query.data ?? []).map((award) => ({
    id: award.id,
    scheme: String(award.scheme_name ?? award.application_id),
    sanctioned: award.amount == null ? "—" : `₹${award.amount.toLocaleString("en-IN")}`,
    status: award.status,
    amountMonthly: String(award.amount_monthly ?? "—"),
    sanctionRef: String(award.sanction_reference ?? "—"),
  }));

  return (
    <div>
      <PageHeader
        title="My awards & disbursements"
        desc="Sanctions, monthly entitlements and payment history against your name."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard label="Active awards" value="2" icon={Wallet} />
        <KpiCard label="Disbursed in 2026-27" value="₹4,56,000" icon={Banknote} />
        <KpiCard label="Next payment" value="Oct 2026" icon={Landmark} />
        <KpiCard label="Closed" value="1" icon={CheckCircle2} />
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
        action={
          <button
            className="text-xs text-primary underline underline-offset-2"
            onClick={() => setOpenDialog("AWD-2261")}
          >
            View payment schedule
          </button>
        }
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
        sanctioned: award.amount == null ? "—" : `₹${award.amount.toLocaleString("en-IN")}`,
        sanctionRef: String(award.sanction_reference ?? "—"),
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
          <CardTitle className="text-lg">{award.id} · payment schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Sanction</dt>
              <dd className="mt-1 font-medium">{awardView.sanctionRef}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase">Amount</dt>
              <dd className="mt-1 font-medium">{awardView.sanctioned}</dd>
            </div>
          </dl>
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payment timeline
            </p>
            <StageTimeline
              current={
                award.status === "Disbursed"
                  ? 3
                  : award.status === "Disbursing"
                    ? 2
                    : award.status === "Sanctioned"
                      ? 1
                      : 0
              }
            />
          </div>
          <div className="rounded-lg bg-muted/60 p-4 text-xs text-muted-foreground">
            Your monthly entitlement is credited to the verified account{" "}
            <span className="font-medium text-foreground">•••• 4821</span>. The current sanction
            letter is available for download from the award row.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => toast.success("Sanction letter downloading")}>
              Download sanction letter
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
