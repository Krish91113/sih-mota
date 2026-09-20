import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, Sla } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useApprovalsQueueQuery } from "@/hooks/api/useQueues";
import type { QueueRow } from "@/api/queue";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/approval/queue")({
  head: () => ({
    meta: [{ title: "Approval Queue | Sanctioning Authority" }],
  }),
  component: ApprovalQueue,
});

const columns: Column<QueueRow>[] = [
  {
    key: "application_number",
    header: "Application",
    sortValue: (r) => r.application_number ?? r.id,
    cell: (r) => <span className="font-semibold">{r.application_number ?? r.id}</span>,
  },
  {
    key: "applicant",
    header: "Applicant",
    sortValue: (r) => r.applicant ?? "",
    cell: (r) => <span className="font-medium">{r.applicant ?? "—"}</span>,
  },
  {
    key: "scheme",
    header: "Scheme",
    sortValue: (r) => r.scheme_code ?? r.scheme ?? "",
    cell: (r) => <span className="text-muted-foreground">{r.scheme ?? "—"}</span>,
    hideBelowMd: true,
  },
  {
    key: "score",
    header: "Score",
    sortValue: (r) => r.score ?? 0,
    cell: (r) => (
      <span className="font-semibold text-primary">
        {r.score === null || r.score === undefined ? "—" : r.score}
      </span>
    ),
  },
  {
    key: "committee",
    header: "Committee",
    sortValue: (r) => r.committee ?? "",
    cell: (r) => <span className="text-muted-foreground">{r.committee ?? "Not recommended"}</span>,
  },
  {
    key: "scrutiny",
    header: "Scrutiny",
    sortValue: (r) => r.scrutiny ?? "",
    cell: (r) => <span className="text-muted-foreground">{r.scrutiny ?? "—"}</span>,
    hideBelowLg: true,
  },
  {
    key: "institution",
    header: "Institution",
    sortValue: (r) => r.institution ?? "",
    cell: (r) => <span className="text-muted-foreground">{r.institution ?? "—"}</span>,
    hideBelowLg: true,
  },
  {
    key: "sla_days",
    header: "SLA",
    sortValue: (r) => r.sla_days,
    cell: (r) => <Sla days={r.sla_days} />,
  },
];

function ApprovalQueue() {
  const navigate = useNavigate();
  const [filtersValue, setFiltersValue] = useState<Record<string, string>>({});
  const { data: approvalsQueue = [], isLoading, isError } = useApprovalsQueueQuery();

  const schemeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of approvalsQueue) {
      const value = row.scheme_code ?? row.scheme;
      if (value && !seen.has(value)) seen.set(value, row.scheme ?? value);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [approvalsQueue]);

  const filters: FilterBarDef<QueueRow>[] = [
    { key: "scheme", label: "Scheme", placeholder: "All schemes", options: schemeOptions },
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

  const filtered = approvalsQueue.filter((r) => {
    if (filtersValue["scheme"] && (r.scheme_code ?? r.scheme) !== filtersValue["scheme"])
      return false;
    if (
      filtersValue["committee"] &&
      (r.committee ?? "Not recommended") !== filtersValue["committee"]
    )
      return false;
    if (filtersValue["institution"] && (r.institution ?? "Pending") !== filtersValue["institution"])
      return false;
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
          searchKeys={(r) => `${r.application_number ?? ""} ${r.applicant ?? ""} ${r.scheme ?? ""}`}
          onRowClick={(r) => navigate({ to: "/approval/applications/$id", params: { id: r.id } })}
        />
      )}
    </div>
  );
}
