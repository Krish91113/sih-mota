import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { FilterBar, type FilterBarDef } from "@/components/mota/FilterBar";
import { useAuditEventsQuery } from "@/hooks/api/useReports";
import type { AuditEvent } from "@/api/audit";
import { humanize } from "@/lib/status";
import { formatDateTime } from "@/lib/format";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/audit/log")({
  head: () => ({ meta: [{ title: "Audit Log | Audit Trail" }] }),
  component: AuditLog,
});

const columns: Column<AuditEvent>[] = [
  {
    key: "event_type",
    header: "Action",
    sortValue: (r) => r.event_type,
    cell: (r) => <span className="font-medium">{humanize(r.event_type)}</span>,
  },
  {
    key: "entity_type",
    header: "Entity",
    sortValue: (r) => r.entity_type,
    cell: (r) => (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        {humanize(r.entity_type)}
      </span>
    ),
  },
  {
    key: "entity_id",
    header: "Record",
    sortValue: (r) => r.entity_id ?? "",
    cell: (r) => (
      <span className="font-mono text-[11px] text-muted-foreground">{r.entity_id ?? "—"}</span>
    ),
    hideBelowMd: true,
  },
  {
    key: "actor_id",
    header: "Actor",
    sortValue: (r) => r.actor_id ?? "",
    cell: (r) => (
      <span className="font-mono text-[11px] text-muted-foreground">{r.actor_id ?? "system"}</span>
    ),
    hideBelowMd: true,
  },
  {
    key: "created_at",
    header: "Recorded at",
    sortValue: (r) => r.created_at,
    cell: (r) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDateTime(r.created_at)}
      </span>
    ),
  },
];

function AuditLog() {
  const navigate = useNavigate();
  const query = useAuditEventsQuery();
  const events = useMemo(() => query.data ?? [], [query.data]);
  const [values, setValues] = useState<Record<string, string>>({});
  const options = useMemo(
    () => ({
      eventTypes: Array.from(new Set(events.map((e) => e.event_type))).sort(),
      entityTypes: Array.from(new Set(events.map((e) => e.entity_type))).sort(),
    }),
    [events],
  );
  const filters: FilterBarDef<AuditEvent>[] = [
    {
      key: "event_type",
      label: "Action",
      placeholder: "All actions",
      options: options.eventTypes.map((x) => ({ value: x, label: humanize(x) })),
    },
    {
      key: "entity_type",
      label: "Entity",
      placeholder: "All entities",
      options: options.entityTypes.map((x) => ({ value: x, label: humanize(x) })),
    },
  ];
  const filtered = events.filter(
    (e) =>
      (!values["event_type"] || e.event_type === values["event_type"]) &&
      (!values["entity_type"] || e.entity_type === values["entity_type"]),
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
        searchPlaceholder="Search action, entity, record or actor"
        searchKeys={(r) =>
          `${r.id} ${r.event_type} ${r.entity_type} ${r.entity_id ?? ""} ${r.actor_id ?? ""} ${r.reason ?? ""}`
        }
        onRowClick={(r) => navigate({ to: "/audit/events/$id", params: { id: r.id } })}
      />
    </div>
  );
}
