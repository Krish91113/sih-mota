import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { useState } from "react";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [{ title: "Notifications | Administration" }],
  }),
  component: AdminNotifications,
});

const INITIAL = [
  {
    id: 1,
    name: "Reminder: deficiency deadline approaching",
    audience: "287 applicants with open deficiencies",
    status: "Scheduled",
    when: "Tomorrow, 10:00",
    enabled: true,
  },
  {
    id: 2,
    name: "Scheme window closing notice",
    audience: "All applicants with saved drafts — TCE",
    status: "Scheduled",
    when: "29 Sep 2026, 18:00",
    enabled: true,
  },
  {
    id: 3,
    name: "Disbursement confirmation",
    audience: "Batch 2026-B03 beneficiaries",
    status: "Sent",
    when: "02 Sep 2026, 11:30",
    enabled: true,
  },
  {
    id: 4,
    name: "Institution verification reminder",
    audience: "12 institutions with overdue verifications",
    status: "Draft",
    when: "—",
    enabled: false,
  },
];

function AdminNotifications() {
  const [rows, setRows] = useState(INITIAL);

  const toggle = (i: number) => {
    setRows((r) => r.map((x, j) => (j === i ? { ...x, enabled: !x.enabled } : x)));
  };

  return (
    <div>
      <PageHeader
        title="Manual notifications"
        desc="Schedule and send notifications to selected applicant groups on demand."
      />
      <Card className="shadow-card">
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="text-base">Queued & sent notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Notification</th>
                  <th className="px-4 py-3 font-semibold">Audience</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Scheduled</th>
                  <th className="px-4 py-3 font-semibold">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((n, i) => (
                  <tr key={n.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{n.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{n.audience}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={n.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{n.when}</td>
                    <td className="px-4 py-3">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={n.enabled}
                          onChange={() => toggle(i)}
                          className="peer sr-only"
                        />
                        <span
                          className="h-5 w-9 rounded-full bg-muted transition peer-checked:bg-primary"
                          aria-hidden
                        />
                        <span className="sr-only">{n.enabled ? "Enabled" : "Disabled"}</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
