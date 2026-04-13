import { httpClient } from "./httpClient";

export const viewHistoryService = {
  /** POST /view-history/heartbeat/{roomId} — gửi mỗi 60s khi đang xem (optional JWT) */
  sendHeartbeat: (roomId: number) =>
    httpClient.post(`/view-history/heartbeat/${roomId}`),
};
