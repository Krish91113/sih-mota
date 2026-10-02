/** Notifications API — maps to /notifications/* */
import { api } from "./client";
import { humanizeField } from "@/lib/format";

/**
 * `notifications` table — verified against
 * `backend/app/domain/relational_models.py`.
 *
 * NOTE: there is no `title`, `body` or `read` column. A notification is a
 * *delivery record* for one channel: `channel` says where it went, `payload`
 * holds the rendered content, and a notification is read when `read_at` is set
 * (read state is therefore derived, not stored as a boolean).
 */
export interface Notification {
  id: string;
  user_id: string;
  template_id: string | null;
  channel: string;
  payload: Record<string, unknown>;
  /** PENDING | SENT | DELIVERED | FAILED */
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  retry_count: number;
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** A notification is read once `read_at` has been stamped. */
export function isNotificationRead(n: Pick<Notification, "read_at">): boolean {
  return Boolean(n.read_at);
}

/** Best-effort title from the delivery payload. */
export function notificationTitle(n: Notification): string {
  const p = n.payload;
  const candidate = p["subject"] ?? p["title"] ?? p["headline"];
  return typeof candidate === "string" && candidate ? candidate : humanizeField(n.channel);
}

/** Best-effort body/summary from the delivery payload. */
export function notificationBody(n: Notification): string {
  const p = n.payload;
  const candidate = p["body"] ?? p["message"] ?? p["text"];
  return typeof candidate === "string" ? candidate : "";
}

/** When the notification was delivered, else when it was created. */
export function notificationTime(n: Notification): string | null {
  return n.delivered_at ?? n.sent_at ?? n.created_at ?? null;
}

export function listNotifications(params?: Record<string, string | number | boolean | undefined>) {
  return api.get<Notification[]>("/notifications", { params });
}

export interface SentNotification {
  id: string;
  user_id: string;
  channel: string;
  status: string | null;
  created_at: string;
  recipient_email?: string | null;
  recipient_name?: string | null;
  payload?: { subject?: string; body?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export function listSentNotifications(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return api.get<SentNotification[]>("/notifications/sent", { params });
}

export function createNotification(data: Record<string, unknown>) {
  return api.post("/notifications", data);
}

export function markNotificationRead(id: string) {
  return api.post(`/notifications/${id}/read`);
}

export function markNotificationsRead(data: { notification_ids?: string[]; all?: boolean }) {
  return api.post("/notifications/mark-read", data);
}
