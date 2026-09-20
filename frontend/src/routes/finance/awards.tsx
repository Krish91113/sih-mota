import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge, KpiCard } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useAwardsQuery } from "@/hooks/api/useFinance";
import type { Award } from "@/api/finance";
import { useMemo, useState } from "react";
import { BadgeCheck, Landmark, Wallet } from "lucide-react";

export const Route = createFileRoute("/finance/awards")({
  head: () => ({
    meta: [{ title: "Awards | Finance & Disbursement" }],
  }),
  component: FinanceAwards,
});

const columns: Column<Award>[] = [
  {
    key: "id",
    header: "Award",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "application_id",
    header: "Application",
    sortValue: (r) => r.application_id,
    cell: (r) => (
      <span className="font-mono text-xs text-muted-foreground">{r.application_id}</span>
    ),
  },
  {
    key: "scheme_version_id",
    header: "Scheme version",
    sortValue: (r) => String(r.scheme_version_id ?? ""),
    cell: (r) => (
      <span className="text-muted-foreground">{String(r.scheme_version_id ?? "—")}</span>
    ),
    hideBelowMd: true,
  },
  {
    key: "award_date",
    header: "Awarded on",
    sortValue: (r) => String(r.award_date ?? ""),
    cell: (r) => (
      <span className="text-muted-foreground">
        {r.award_date ? new Date(String(r.award_date)).toLocaleDateString() : "—"}
      </span>
    ),
    hideBelowMd: true,
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
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => <StatusBadge status={r.status} />,
  },
];

function FinanceAwards() {
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});
  const { data: financeAwards = [], isLoading, isError } = useAwardsQuery();

  const statuses = useMemo(
    () => Array.from(new Set(financeAwards.map((a) => a.status).filter(Boolean))).sort(),
    [financeAwards],
  );
  const filters: FilterBarDef<Award>[] = [
    {
      key: "status",
      label: "Status",
      placeholder: "All statuses",
      options: statuses.map((s) => ({ value: s, label: s })),
    },
  ];

  const filtered = financeAwards.filter(
    (a) => !filtersValue["status"] || a.status === filtersValue["status"],
  );
  const activeCount = financeAwards.filter((a) => a.status === "ACTIVE").length;
  const totalAmount = financeAwards.reduce((sum, a) => sum + (a.amount ?? 0), 0);

  return (
    <div>
      <PageHeader title="Awards" desc="Every sanctioned award with its current payment state." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total awards" value={String(financeAwards.length)} icon={BadgeCheck} />
        <KpiCard label="Active awards" value={String(activeCount)} icon={Wallet} />
        <KpiCard
          label="Total value"
          value={totalAmount > 0 ? `₹${totalAmount.toLocaleString()}` : "—"}
          icon={Landmark}
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
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search award or application"
          searchKeys={(r) => `${r.id} ${r.application_id} ${r.status}`}
          emptyTitle="No awards available"
          emptyDesc="Awards appear here once an approved application is sanctioned."
        />
      )}
    </div>
  );
}
