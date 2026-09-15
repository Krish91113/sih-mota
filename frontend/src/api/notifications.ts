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

export function createNotification(data: Record<string, unknown>) {
  return api.post("/notifications", data);
}
