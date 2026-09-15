import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useAwardsQuery } from "@/hooks/api/useFinance";

type Row = Record<string, unknown>;
import { Landmark, ListChecks } from "lucide-react";

export const Route = createFileRoute("/finance/sanctions")({
  head: () => ({
    meta: [{ title: "Sanctions | Finance & Disbursement" }],
  }),
  component: FinanceSanctions,
});

const columns: Column<Row>[] = [
  {
    key: "id",
    header: "Sanction ref",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "scheme",
    header: "Scheme",
    sortValue: (r) => r.scheme,
    cell: (r) => <span className="text-muted-foreground">{r.scheme}</span>,
  },
  {
    key: "count",
    header: "Beneficiaries",
    sortValue: (r) => r.count,
    cell: (r) => <span className="font-medium">{r.count.toLocaleString()}</span>,
  },
  {
    key: "amount",
    header: "Total",
    sortValue: (r) => r.amount,
    cell: (r) => <span className="font-medium">{r.amount}</span>,
  },
  {
    key: "issued",
    header: "Issued",
    sortValue: (r) => r.issued,
    cell: (r) => <span className="text-muted-foreground">{r.issued}</span>,
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
  const { data: financeSanctions = [], isLoading, isError } = useAwardsQuery();
  if (isLoading) return <p className="py-8 text-sm text-muted-foreground">Loading sanctions…</p>;
  if (isError) return <p className="py-8 text-sm text-destructive">We could not load sanctions.</p>;

  const totalSanctions = (financeSanctions as Row[]).length;
  const totalAmount = (financeSanctions as Row[]).reduce((sum, s) => {
    const val =
      typeof s.amount === "number"
        ? s.amount
        : parseFloat(String(s.amount).replace(/[^0-9.-]+/g, "")) || 0;
    return sum + val;
  }, 0);

  return (
    <div>
      <PageHeader
        title="Sanctions"
        desc="Approved sanction orders with their current disbursement stage."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <KpiCard label="Total sanctions" value={String(totalSanctions)} icon={Landmark} />
        <KpiCard
          label="Total value"
          value={totalAmount > 0 ? `₹${totalAmount.toLocaleString()}` : "—"}
          icon={ListChecks}
        />
      </div>

      <DataTable
        data={financeSanctions}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search sanction ref or scheme"
        searchKeys={(r) => `${r.id} ${r.scheme} ${r.status}`}
      />
    </div>
  );
}
