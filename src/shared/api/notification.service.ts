import { httpClient } from "./httpClient";
import { PaginatedResponse } from "./room.service";

export type NotificationType =
  | "NEW_FOLLOWER"
  | "DONATION_RECEIVED"
  | "STREAM_LIVE"
  | "STREAM_TERMINATED"
  | "REPORT_RESOLVED";

export interface NotificationItem {
  id: number;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationService = {
  getNotifications: (params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<NotificationItem>>("/notifications", { params }),

  getUnreadCount: () =>
    httpClient.get<{ unreadCount: number }>("/notifications/unread-count"),

  markAsRead: (notificationId: number) =>
    httpClient.put(`/notifications/${notificationId}/read`),

  markAllAsRead: () =>
    httpClient.put("/notifications/read-all"),
};
