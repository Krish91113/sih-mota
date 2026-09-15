import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useAwardsQuery } from "@/hooks/api/useFinance";

type Row = Record<string, unknown>;
import { useState } from "react";

export const Route = createFileRoute("/finance/disbursements")({
  head: () => ({
    meta: [{ title: "Disbursements | Finance & Disbursement" }],
  }),
  component: FinanceDisbursements,
});

const filters: FilterBarDef<Row>[] = [
  {
    key: "batch",
    label: "Batch",
    placeholder: "All batches",
    options: [
      { value: "2026-B03", label: "2026-B03" },
      { value: "2026-B02", label: "2026-B02" },
      { value: "2026-B01", label: "2026-B01" },
    ],
  },
  {
    key: "status",
    label: "Status",
    placeholder: "All statuses",
    options: [
      { value: "Success", label: "Success" },
      { value: "Failed — retry", label: "Failed — retry" },
      { value: "Pending", label: "Pending" },
    ],
  },
];

const columns: Column<Row>[] = [
  {
    key: "id",
    header: "Ref",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "applicant",
    header: "Beneficiary",
    sortValue: (r) => r.applicant,
    cell: (r) => <span className="font-medium">{r.applicant}</span>,
  },
  {
    key: "award",
    header: "Award",
    sortValue: (r) => r.award,
    cell: (r) => <span className="text-muted-foreground">{r.award}</span>,
  },
  {
    key: "batch",
    header: "Batch",
    sortValue: (r) => r.batch,
    cell: (r) => <span className="text-muted-foreground">{r.batch}</span>,
    hideBelowMd: true,
  },
  {
    key: "date",
    header: "Date",
    sortValue: (r) => r.date,
    cell: (r) => <span className="text-muted-foreground">{r.date}</span>,
    hideBelowMd: true,
  },
  {
    key: "amount",
    header: "Amount",
    sortValue: (r) => r.amount,
    cell: (r) => <span className="font-medium">{r.amount}</span>,
  },
  {
    key: "bank",
    header: "Bank",
    sortValue: (r) => r.bank,
    cell: (r) => <span className="text-muted-foreground">{r.bank}</span>,
    hideBelowLg: true,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    cell: (r) => (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === "Success" ? "bg-leaf/10 text-leaf" : "bg-destructive/10 text-destructive"}`}
      >
        {r.status}
      </span>
    ),
  },
];

function FinanceDisbursements() {
  const { data: financeDisbursements = [], isLoading, isError } = useAwardsQuery();
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});
  const filtered = financeDisbursements.filter((r) => {
    if (filtersValue.batch && r.batch !== filtersValue.batch) return false;
    if (filtersValue.status && r.status !== filtersValue.status) return false;
    return true;
  });

  if (isLoading)
    return <p className="py-8 text-sm text-muted-foreground">Loading disbursements…</p>;
  if (isError)
    return <p className="py-8 text-sm text-destructive">We could not load disbursements.</p>;
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
        data={filtered}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search reference, beneficiary or award"
        searchKeys={(r) => `${r.id} ${r.applicant} ${r.award} ${r.batch}`}
      />
    </div>
  );
}
