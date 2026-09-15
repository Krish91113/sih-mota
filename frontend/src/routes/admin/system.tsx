import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, KpiCard } from "@/components/mota/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCalendarsQuery,
  useHolidaysQuery,
  useCreateHolidayMutation,
} from "@/hooks/api/useAdmin";
import { Calendar, CalendarCheck, Clock, Plus } from "lucide-react";
import { toast } from "sonner";

interface CalendarItem {
  id: string;
  name?: string;
  timezone?: string;
  working_weekdays?: number[];
}

interface HolidayItem {
  id?: string;
  name: string;
  date: string;
}

export const Route = createFileRoute("/admin/system")({
  head: () => ({ meta: [{ title: "System Configuration | Administration" }] }),
  component: SystemConfig,
});

function SystemConfig() {
  const calendarsQuery = useCalendarsQuery();
  const holidaysQuery = useHolidaysQuery();
  const createHolidayMutation = useCreateHolidayMutation();

  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");

  const calendars: CalendarItem[] =
    (calendarsQuery.data as { data?: CalendarItem[] })?.data ||
    (Array.isArray(calendarsQuery.data) ? (calendarsQuery.data as CalendarItem[]) : []) ||
    [];
  const holidays: HolidayItem[] =
    (holidaysQuery.data as { data?: HolidayItem[] })?.data ||
    (Array.isArray(holidaysQuery.data) ? (holidaysQuery.data as HolidayItem[]) : []) ||
    [];

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayDate) {
      toast.error("Please enter holiday name and date");
      return;
    }
    const calendarId = calendars[0]?.id;
    if (!calendarId) {
      toast.error("No active working calendar found");
      return;
    }
    try {
      await createHolidayMutation.mutateAsync({
        calendar_id: calendarId,
        name: holidayName.trim(),
        date: new Date(holidayDate).toISOString(),
      });
      setHolidayName("");
      setHolidayDate("");
      toast.success("Holiday added to working calendar");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to add holiday";
      toast.error(errorMsg);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System configuration"
        desc="Platform-wide working calendars, holidays, and SLA configuration."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Working calendars" value={String(calendars.length)} icon={Calendar} />
        <KpiCard label="Declared holidays" value={String(holidays.length)} icon={CalendarCheck} />
        <KpiCard
          label="Default timezone"
          value={calendars[0]?.timezone || "Asia/Kolkata"}
          icon={Clock}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Working calendars</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {calendars.length === 0 ? (
              <p className="text-sm text-muted-foreground">No working calendar configured.</p>
            ) : (
              calendars.map((cal: CalendarItem) => (
                <div key={cal.id} className="rounded-lg border p-4 bg-card">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">
                      {cal.name || "Default Working Calendar"}
                    </p>
                    <span className="rounded-full bg-leaf/10 px-2.5 py-0.5 text-xs font-semibold text-leaf">
                      Active
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    <p>Timezone: {cal.timezone || "Asia/Kolkata"}</p>
                    <p>
                      Working days:{" "}
                      {(cal.working_weekdays || [0, 1, 2, 3, 4])
                        .map((d: number) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d])
                        .join(", ")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Add holiday</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleAddHoliday} className="space-y-4">
              <div>
                <Label htmlFor="hname">Holiday name</Label>
                <Input
                  id="hname"
                  placeholder="e.g. Independence Day"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="hdate">Date</Label>
                <Input
                  id="hdate"
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" disabled={createHolidayMutation.isPending} className="w-full">
                <Plus className="mr-1.5 size-4" />
                {createHolidayMutation.isPending ? "Adding…" : "Add holiday"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="text-base">Declared holidays ({holidays.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No holidays declared yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {holidays.map((h: HolidayItem) => (
                <div
                  key={h.id || h.name}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <span className="font-medium">{h.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
