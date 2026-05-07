import { httpClient, hasHttpStatus } from "./httpClient";

export const viewHistoryService = {
  /** POST /view-history/heartbeat/{roomId} — gửi mỗi 60s khi đang xem (optional JWT) */
  sendHeartbeat: (roomId: number) =>
    httpClient.post(`/view-history/heartbeat/${roomId}`),

  /**
   * POST /view-history/heartbeat/sessions/{sessionId} — heartbeat theo session.
   * Fallback về room heartbeat khi backend chưa hỗ trợ.
   */
  sendSessionHeartbeat: async (sessionId: number, fallbackRoomId: number | null) => {
    try {
      return await httpClient.post(`/view-history/heartbeat/sessions/${sessionId}`);
    } catch (error) {
      if ((!hasHttpStatus(error, 404) && !hasHttpStatus(error, 405)) || !fallbackRoomId) {
        throw error;
      }

      return viewHistoryService.sendHeartbeat(fallbackRoomId);
    }
  },
};
