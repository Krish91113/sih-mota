import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useAuditEventsQuery } from "@/hooks/api/useReports";
import type { AuditEvent } from "@/api/audit";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/audit/log")({
  head: () => ({ meta: [{ title: "Audit Log | Audit Trail" }] }),
  component: AuditLog,
});

const columns: Column<AuditEvent>[] = [
  {
    key: "id",
    header: "Event",
    sortValue: (r) => r.id,
    cell: (r) => <span className="font-semibold">{r.id}</span>,
  },
  {
    key: "timestamp",
    header: "Timestamp",
    sortValue: (r) => r.timestamp,
    cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{r.timestamp}</span>,
  },
  {
    key: "action",
    header: "Action",
    sortValue: (r) => r.action,
    cell: (r) => <span className="font-mono text-xs">{r.action}</span>,
  },
  {
    key: "actor_id",
    header: "Actor",
    sortValue: (r) => r.actor_id,
    cell: (r) => <span className="text-muted-foreground">{r.actor_id}</span>,
    hideBelowMd: true,
  },
  {
    key: "resource_type",
    header: "Resource",
    sortValue: (r) => r.resource_type,
    cell: (r) => (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        {r.resource_type}
      </span>
    ),
  },
];

function AuditLog() {
  const navigate = useNavigate();
  const query = useAuditEventsQuery();
  const events = query.data ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const options = useMemo(
    () => ({
      actions: Array.from(new Set(events.map((e) => e.action))).sort(),
      resources: Array.from(new Set(events.map((e) => e.resource_type))).sort(),
    }),
    [events],
  );
  const filters: FilterBarDef<AuditEvent>[] = [
    {
      key: "action",
      label: "Action",
      placeholder: "All actions",
      options: options.actions.map((x) => ({ value: x, label: x })),
    },
    {
      key: "resource",
      label: "Resource",
      placeholder: "All resources",
      options: options.resources.map((x) => ({ value: x, label: x })),
    },
  ];
  const filtered = events.filter(
    (e) =>
      (!values.action || e.action === values.action) &&
      (!values.resource || e.resource_type === values.resource),
  );
  return (
    <div>
      <PageHeader
        title="Audit log"
        desc="Append-only ledger of every write event across the platform."
      />
      {query.isLoading ? (
        <p className="mb-4 text-sm text-muted-foreground">Loading audit events…</p>
      ) : null}
      {query.isError ? (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Unable to load the audit log.
        </p>
      ) : null}
      {!query.isLoading && !query.isError && events.length === 0 ? (
        <p className="mb-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No audit events found.
        </p>
      ) : null}
      <div className="mb-4">
        <FilterBar
          definitions={filters}
          value={values}
          onChange={setValues}
          onClear={() => setValues({})}
        />
      </div>
      <DataTable
        data={filtered}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search event, actor or resource"
        searchKeys={(r) => `${r.id} ${r.action} ${r.actor_id} ${r.resource_type} ${r.resource_id}`}
        onRowClick={(r) => navigate({ to: "/audit/events/$id", params: { id: r.id } })}
      />
    </div>
  );
}
