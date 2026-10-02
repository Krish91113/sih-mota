import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useFinanceRecordsQuery } from "@/hooks/api/useFinance";
import type { FinanceRecord } from "@/api/finance";
import { Landmark, ListChecks } from "lucide-react";

export const Route = createFileRoute("/finance/sanctions")({
  head: () => ({
    meta: [{ title: "Sanctions | Finance & Disbursement" }],
  }),
  component: FinanceSanctions,
});

const columns: Column<FinanceRecord>[] = [
  {
    key: "id",
    header: "Sanction ref",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "award_id",
    header: "Award",
    sortValue: (r) => r.award_id,
    cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.award_id}</span>,
  },
  {
    key: "amount",
    header: "Amount",
    sortValue: (r) => r.amount ?? 0,
    cell: (r) => (
      <span className="font-medium">
        {typeof r.amount === "number" ? `₹${r.amount.toLocaleString()}` : "—"}
      </span>
    ),
  },
  {
    key: "provider",
    header: "Provider",
    sortValue: (r) => String(r.provider ?? ""),
    cell: (r) => <span className="text-muted-foreground">{String(r.provider ?? "—")}</span>,
    hideBelowMd: true,
  },
  {
    key: "external_reference",
    header: "Reference",
    sortValue: (r) => String(r.external_reference ?? ""),
    cell: (r) => (
      <span className="text-muted-foreground">{String(r.external_reference ?? "—")}</span>
    ),
    hideBelowMd: true,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <StatusBadge status={r.status} />,
  },
];

function FinanceSanctions() {
  const { data: records = [], isLoading, isError } = useFinanceRecordsQuery();
  if (isLoading) return <p className="py-8 text-sm text-muted-foreground">Loading sanctions…</p>;
  if (isError) return <p className="py-8 text-sm text-destructive">We could not load sanctions.</p>;

  const sanctions = records.filter((r) => r.record_type === "SANCTION");
  const totalAmount = sanctions.reduce((sum, r) => sum + (r.amount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Sanctions"
        desc="Sanction records raised against awards, with their current finance status."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <KpiCard label="Total sanctions" value={String(sanctions.length)} icon={Landmark} />
        <KpiCard
          label="Total value"
          value={totalAmount > 0 ? `₹${totalAmount.toLocaleString()}` : "—"}
          icon={ListChecks}
        />
      </div>

      <DataTable
        data={sanctions}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search sanction ref, award or provider"
        searchKeys={(r) => `${r.id} ${r.award_id} ${r.provider ?? ""} ${r.status}`}
        emptyTitle="No sanctions recorded"
        emptyDesc="Sanction records appear here once a finance officer raises them against an award."
      />
    </div>
  );
}
