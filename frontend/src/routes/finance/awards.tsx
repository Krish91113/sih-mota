import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useAwardsQuery } from "@/hooks/api/useFinance";

type Row = Record<string, unknown>;
import { useState } from "react";
import { BadgeCheck, Landmark, Wallet } from "lucide-react";

export const Route = createFileRoute("/finance/awards")({
  head: () => ({
    meta: [{ title: "Awards | Finance & Disbursement" }],
  }),
  component: FinanceAwards,
});

const filters: FilterBarDef<Row>[] = [
  {
    key: "scheme",
    label: "Scheme",
    placeholder: "All schemes",
    options: [
      { value: "NFST", label: "NFST" },
      { value: "NOS", label: "NOS" },
      { value: "TCE", label: "Top Class Education" },
      { value: "PMS", label: "PMS" },
    ],
  },
  {
    key: "status",
    label: "Status",
    placeholder: "All statuses",
    options: [
      { value: "Sanctioned", label: "Sanctioned" },
      { value: "Disbursing", label: "Disbursing" },
      { value: "Disbursed", label: "Disbursed" },
      { value: "Closed", label: "Closed" },
    ],
  },
];

const columns: Column<Row>[] = [
  {
    key: "id",
    header: "Award",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "application",
    header: "Application",
    sortValue: (r) => r.application,
    cell: (r) => <span>{r.application}</span>,
  },
  {
    key: "applicant",
    header: "Beneficiary",
    sortValue: (r) => r.applicant,
    cell: (r) => <span className="font-medium">{r.applicant}</span>,
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
    header: "Sanctioned",
    sortValue: (r) => r.sanctioned,
    cell: (r) => <span className="font-medium">{r.sanctioned}</span>,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <StatusBadge status={r.status} />,
  },
];

function FinanceAwards() {
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});
  const { data: financeAwards = [], isLoading, isError } = useAwardsQuery();
  const filtered = (financeAwards as Row[]).filter((r) => {
    if (filtersValue.scheme && r.scheme !== filtersValue.scheme) return false;
    if (filtersValue.status && r.status !== filtersValue.status) return false;
    return true;
  });

  const sanctionedCount = (financeAwards as Row[]).filter(
    (a) => a.status === "Sanctioned" || a.status === "SANCTIONED",
  ).length;
  const disbursingCount = (financeAwards as Row[]).filter(
    (a) => a.status === "Disbursing" || a.status === "DISBURSING",
  ).length;
  const disbursedCount = (financeAwards as Row[]).filter(
    (a) =>
      a.status === "Disbursed" ||
      a.status === "DISBURSED" ||
      a.status === "Closed" ||
      a.status === "CLOSED",
  ).length;
  const totalAmount = (financeAwards as Row[]).reduce((sum, a) => {
    const val =
      typeof a.amount === "number" ? a.amount : typeof a.sanctioned === "number" ? a.sanctioned : 0;
    return sum + val;
  }, 0);

  return (
    <div>
      <PageHeader title="Awards" desc="Every sanctioned award with its current payment state." />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard label="Sanctioned" value={String(sanctionedCount)} icon={BadgeCheck} />
        <KpiCard label="Disbursing" value={String(disbursingCount)} icon={Wallet} />
        <KpiCard label="Disbursed + closed" value={String(disbursedCount)} icon={Landmark} />
        <KpiCard
          label="Total value"
          value={totalAmount > 0 ? `₹${totalAmount.toLocaleString()}` : "—"}
          icon={Wallet}
        />
      </div>

      <div className="mb-4">
        <FilterBar
          definitions={filters}
          value={filtersValue}
          onChange={setFiltersValue}
          onClear={() => setFiltersValue({})}
        />
      </div>

      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading awards…</p>
      ) : isError ? (
        <p className="py-8 text-sm text-destructive">We could not load awards.</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">No awards are available.</p>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search award, application or beneficiary"
          searchKeys={(r) => `${r.id} ${r.application} ${r.applicant} ${r.scheme}`}
        />
      )}
    </div>
  );
}
