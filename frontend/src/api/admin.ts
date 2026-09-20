/** Admin API — maps to /admin/*, /approvals/* */
import { api } from "./client";

// ── Calendar & Holidays ──────────────────────────────────────────────────────

export function listCalendars() {
  return api.get("/admin/calendars");
}

export function createCalendar(data: Record<string, unknown>) {
  return api.post("/admin/calendars", data);
}

export function updateCalendar(id: string, data: Record<string, unknown>) {
  return api.patch(`/admin/calendars/${id}`, data);
}

export function listHolidays() {
  return api.get("/admin/holidays");
}

export function createHoliday(data: Record<string, unknown>) {
  return api.post("/admin/holidays", data);
}

export function updateHoliday(id: string, data: Record<string, unknown>) {
  return api.patch(`/admin/holidays/${id}`, data);
}

export function deleteHoliday(id: string) {
  return api.delete(`/admin/holidays/${id}`);
}

// ── Notification Templates ──────────────────────────────────────────────────

export function listNotificationTemplates() {
  return api.get("/notification-templates");
}

export function createNotificationTemplate(data: {
  code: string;
  channel: string;
  subject?: string | undefined;
  body: string;
  published?: boolean | undefined;
}) {
  return api.post("/notification-templates", data);
}
