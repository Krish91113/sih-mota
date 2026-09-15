import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, Priority } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useApplicationsQuery } from "@/hooks/api/useApplications";

type Row = Record<string, unknown>;
import { useState } from "react";

export const Route = createFileRoute("/approval/queue")({
  head: () => ({
    meta: [{ title: "Approval Queue | Sanctioning Authority" }],
  }),
  component: ApprovalQueue,
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
    key: "committee",
    label: "Committee",
    placeholder: "All committee results",
    options: [
      { value: "Recommended", label: "Recommended" },
      { value: "Not recommended", label: "Not recommended" },
    ],
  },
  {
    key: "institution",
    label: "Institution",
    placeholder: "All institution states",
    options: [
      { value: "Verified", label: "Verified" },
      { value: "Pending", label: "Pending" },
    ],
  },
];

const columns: Column<Row>[] = [
  {
    key: "id",
    header: "Application",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "applicant",
    header: "Applicant",
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
    key: "score",
    header: "Score",
    sortValue: (r) => r.score,
    cell: (r) => <span className="font-semibold text-primary">{r.score}</span>,
  },
  {
    key: "committee",
    header: "Committee",
    sortValue: (r) => r.committee,
    cell: (r) => <span className="text-muted-foreground">{r.committee}</span>,
  },
  {
    key: "scrutiny",
    header: "Scrutiny",
    sortValue: (r) => r.scrutiny,
    cell: (r) => <span className="text-muted-foreground">{r.scrutiny}</span>,
    hideBelowLg: true,
  },
  {
    key: "institution",
    header: "Institution",
    sortValue: (r) => r.institution,
    cell: (r) => <span className="text-muted-foreground">{r.institution}</span>,
    hideBelowLg: true,
  },
  {
    key: "amount",
    header: "Amount",
    sortValue: (r) => r.amount,
    cell: (r) => <span className="font-medium">{r.amount}</span>,
    hideBelowLg: true,
  },
  {
    key: "due",
    header: "Due",
    sortValue: (r) => r.due,
    cell: (r) => <span className="text-xs text-muted-foreground">{r.due}</span>,
  },
];

function ApprovalQueue() {
  const navigate = useNavigate();
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});
  const {
    data: approvalsQueue = [],
    isLoading,
    isError,
  } = useApplicationsQuery({ status: "approval" });

  const filtered = (approvalsQueue as Row[]).filter((r) => {
    if (filtersValue.scheme && r.scheme !== filtersValue.scheme) return false;
    if (filtersValue.committee && r.committee !== filtersValue.committee) return false;
    if (filtersValue.institution && r.institution !== filtersValue.institution) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Approval queue"
        desc="Applications cleared for sanctioning authority decision."
      />
      <div className="mb-4">
        <FilterBar
          definitions={filters}
          value={filtersValue}
          onChange={setFiltersValue}
          onClear={() => setFiltersValue({})}
        />
      </div>
      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading approval queue…</p>
      ) : isError ? (
        <p className="py-8 text-sm text-destructive">We could not load the approval queue.</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">No applications are awaiting approval.</p>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search application, applicant or scheme"
          searchKeys={(r) => `${r.id} ${r.applicant} ${r.scheme}`}
          onRowClick={(r) => navigate({ to: "/approval/applications/$id", params: { id: r.id } })}
        />
      )}
    </div>
  );
}
