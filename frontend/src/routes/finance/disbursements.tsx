import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useFinanceRecordsQuery } from "@/hooks/api/useFinance";
import type { FinanceRecord } from "@/api/finance";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/finance/disbursements")({
  head: () => ({
    meta: [{ title: "Disbursements | Finance & Disbursement" }],
  }),
  component: FinanceDisbursements,
});

const columns: Column<FinanceRecord>[] = [
  {
    key: "id",
    header: "Ref",
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
    hideBelowLg: true,
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

function FinanceDisbursements() {
  const { data: records = [], isLoading, isError } = useFinanceRecordsQuery();
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});

  const statuses = useMemo(
    () => Array.from(new Set(records.map((r) => r.status).filter(Boolean))).sort(),
    [records],
  );
  const filters: FilterBarDef<FinanceRecord>[] = [
    {
      key: "status",
      label: "Status",
      placeholder: "All statuses",
      options: statuses.map((s) => ({ value: s, label: s })),
    },
  ];

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading disbursements…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load disbursements.</p>;

  const disbursements = records.filter(
    (r) =>
      r.record_type === "DISBURSEMENT" &&
      (!filtersValue["status"] || r.status === filtersValue["status"]),
  );

  return (
    <div>
      <PageHeader
        title="Disbursements"
        desc="Individual payment legs recorded against each sanctioned award."
      />
      <div className="mb-4">
        <FilterBar
          definitions={filters}
          value={filtersValue}
          onChange={setFiltersValue}
          onClear={() => setFiltersValue({})}
        />
      </div>
      <DataTable
        data={disbursements}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search reference, provider or award"
        searchKeys={(r) => `${r.id} ${r.award_id} ${r.provider ?? ""} ${r.status}`}
        emptyTitle="No disbursements recorded"
        emptyDesc="Disbursement records appear here once payments are initiated against awards."
      />
    </div>
  );
}
