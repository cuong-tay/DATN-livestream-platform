import { httpClient } from "./httpClient";
import { PaginatedResponse } from "./room.service";

export interface NotificationItem {
  id: number;
  type: "NEW_FOLLOWER" | "DONATION_RECEIVED" | "SYSTEM_ALERT" | "STREAM_BANNED";
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
