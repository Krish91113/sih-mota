/** Notifications API — maps to /notifications/* */
import { api } from "./client";

export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  [key: string]: unknown;
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
