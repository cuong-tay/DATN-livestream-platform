import type { AxiosResponse } from "axios";
import { httpClient, hasHttpStatus } from "./httpClient";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export type RoomStatus = "PENDING" | "LIVE" | "RECONNECTING" | "ENDED" | "BANNED";

export interface RoomLiveItem {
  roomId: number;
  title: string;
  streamerUsername: string;
  streamerId: number;
  streamerAvatarUrl: string | null;
  categoryName: string;
  hlsUrl: string | null;
  status: RoomStatus;
  activeSessionId?: number | null;
  ingestUrl?: string | null;
  viewers?: number;
}

export interface RoomDetail extends RoomLiveItem {
  streamKey?: string;
  createdAt?: string;
  streamerName?: string;
}

export interface CreateRoomRequest {
  title: string;
  categoryId: number;
}

export interface CreateRoomResponse {
  roomId: number;
  sessionId?: number | null;
  title: string;
  streamerName: string;
  categoryName: string;
  streamKey: string;
  status: RoomStatus;
}

export interface StartStreamSessionRequest {
  title: string;
  categoryId: number;
}

const ROOM_STATUS_PRIORITY: Record<RoomStatus, number> = {
  LIVE: 0,
  RECONNECTING: 1,
  PENDING: 2,
  ENDED: 3,
  BANNED: 4,
};

function buildSyntheticResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {
      headers: {} as AxiosResponse<T>["config"]["headers"],
    },
  };
}

export function isActiveRoomStatus(status?: RoomStatus): boolean {
  return status === "PENDING" || status === "LIVE" || status === "RECONNECTING";
}

export function hasActiveLiveSession(
  room?: Pick<RoomLiveItem, "activeSessionId" | "status"> | null,
): boolean {
  if (!room) return false;
  if (room.activeSessionId != null) return true;
  return room.status === "LIVE" || room.status === "RECONNECTING";
}

export function pickPreferredRoom(rooms: RoomLiveItem[]): RoomLiveItem | undefined {
  return [...rooms]
    .sort((left, right) => {
      const statusDiff = ROOM_STATUS_PRIORITY[left.status] - ROOM_STATUS_PRIORITY[right.status];
      if (statusDiff !== 0) return statusDiff;
      return right.roomId - left.roomId;
    })[0];
}

export type VodStatus = "PENDING" | "UPLOADING" | "DONE" | "FAILED" | "DRAFT";

export interface StreamSession {
  id: number;
  roomId: number;
  streamerUsername?: string;
  streamerAvatarUrl?: string | null;
  title: string;
  maxCcv: number;
  likeCount?: number;
  dislikeCount?: number;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  vodUrl: string | null;
  vodStatus: VodStatus | null;
  vodError?: string | null;
}

export type PublicVodSort = "latest" | "popular" | "views";

export interface PublicVodItem {
  sessionId: number;
  roomId: number;
  streamerId: number;
  streamerUsername: string;
  streamerAvatarUrl: string | null;
  title: string;
  categoryId: number;
  categoryName: string;
  vodUrl: string | null;
  durationMinutes: number;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  startedAt: string;
  endedAt: string | null;
}

export interface ChatMessageResponse {
  messageId?: string;
  roomId: number;
  senderName: string;
  content: string;
  messageType?: string;
  blockedWords?: string[] | null;
  timestamp?: string;
  createdAt?: string;
}

export interface BlockedWord {
  id: number;
  roomId: number;
  word: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertBlockedWordRequest {
  word?: string;
  enabled?: boolean;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const roomService = {
  /** GET /rooms/live — danh sách phòng đang LIVE (public) */
  getLiveRooms: (params?: { categoryId?: number; page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<RoomLiveItem>>("/rooms/live", { params }),

  /** GET /rooms/{roomId} — chi tiết một phòng (public) */
  getRoomById: (roomId: number) =>
    httpClient.get<RoomDetail>(`/rooms/${roomId}`),

  /** GET /rooms/me — phòng/channel cố định của tôi (JWT). Fallback về /rooms/me/all nếu backend cũ. */
  getMyRoom: async () => {
    try {
      return await httpClient.get<RoomDetail>("/rooms/me", { skipErrorLog: true });
    } catch (error) {
      if (!hasHttpStatus(error, 404) && !hasHttpStatus(error, 405)) {
        throw error;
      }

      const response = await httpClient.get<PaginatedResponse<RoomLiveItem>>(
        "/rooms/me/all",
        {
          params: { page: 0, size: 50 },
          skipErrorLog: true,
        },
      );
      const preferredRoom = pickPreferredRoom(response.data.content);
      return buildSyntheticResponse<RoomDetail | null>(preferredRoom ? { ...preferredRoom } : null);
    }
  },

  /** POST /rooms — tạo phòng mới (JWT) */
  createRoom: (data: CreateRoomRequest) =>
    httpClient.post<CreateRoomResponse>("/rooms", data),

  /**
   * POST /rooms/me/sessions — bắt đầu một phiên live mới trên room hiện có.
   * Fallback về POST /rooms khi backend chưa tách room/session.
   */
  startMyStreamSession: async (data: StartStreamSessionRequest) => {
    try {
      return await httpClient.post<CreateRoomResponse>("/rooms/me/sessions", data);
    } catch (error) {
      if (!hasHttpStatus(error, 404) && !hasHttpStatus(error, 405)) {
        throw error;
      }

      return roomService.createRoom(data);
    }
  },

  /** PUT /rooms/me — cập nhật phòng của tôi (JWT) */
  updateMyRoom: (data: { title?: string; categoryId?: number }) =>
    httpClient.put("/rooms/me", data),

  /** PATCH /rooms/{roomId}/end — kết thúc stream (JWT) */
  endStream: (roomId: number) =>
    httpClient.patch(`/rooms/${roomId}/end`),

  /** PATCH /rooms/me/end — kết thúc phiên live hiện tại trên room cố định. */
  endMyStream: async (roomId: number) => {
    try {
      return await httpClient.patch("/rooms/me/end");
    } catch (error) {
      if (!hasHttpStatus(error, 404) && !hasHttpStatus(error, 405)) {
        throw error;
      }

      return roomService.endStream(roomId);
    }
  },

  /** GET /rooms/me/all — tất cả phòng của tôi (JWT) */
  getMyRooms: (params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<RoomLiveItem>>("/rooms/me/all", { params }),

  /** GET /rooms/{roomId}/sessions — lịch sử session (public) */
  getRoomSessions: (roomId: number, params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<StreamSession>>(`/rooms/${roomId}/sessions`, { params }),

  /** GET /vods — danh sách VOD public (public) */
  getPublicVods: (params?: {
    page?: number;
    size?: number;
    categoryId?: number;
    sort?: PublicVodSort;
    streamerId?: number;
  }) =>
    httpClient.get<PaginatedResponse<PublicVodItem>>("/vods", {
      params,
      skipAuth: true,
    }),

  /** GET /rooms/me/sessions — lịch sử session của tôi (JWT) */
  getMySessions: (params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<StreamSession>>("/rooms/me/sessions", { params }),

  /** GET /rooms/me/sessions/vod-pending — session chưa DONE (JWT) */
  getMyPendingVodSessions: (params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<StreamSession>>("/rooms/me/sessions/vod-pending", { params }),

  /** GET /sessions/{sessionId} — chi tiết một session (public) */
  getSessionById: (sessionId: number) =>
    httpClient.get<StreamSession>(`/sessions/${sessionId}`),

  /** GET /sessions/{sessionId}/chats — lấy toàn bộ chat của session (public) */
  getSessionChats: (sessionId: number) =>
    httpClient.get<ChatMessageResponse[]>(`/sessions/${sessionId}/chats`, { skipAuth: true }),

  /** GET /rooms/{roomId}/chats — lịch sử chat 50 tin gần nhất (public) */
  getChatHistory: (roomId: number) =>
    httpClient.get<ChatMessageResponse[]>(`/rooms/${roomId}/chats`, { skipAuth: true }),

  /** GET /rooms/{roomId}/recent-chat — 30 tin gần nhất (public) */
  getRecentChat: (roomId: number) =>
    httpClient.get<ChatMessageResponse[]>(`/rooms/${roomId}/recent-chat`, { skipAuth: true }),

  /** GET /rooms/{roomId}/blocked-words - streamer JWT */
  getBlockedWords: (roomId: number) =>
    httpClient.get<BlockedWord[]>(`/rooms/${roomId}/blocked-words`),

  /** POST /rooms/{roomId}/blocked-words - streamer JWT */
  createBlockedWord: (roomId: number, data: Required<UpsertBlockedWordRequest>) =>
    httpClient.post<BlockedWord>(`/rooms/${roomId}/blocked-words`, data),

  /** PATCH /rooms/{roomId}/blocked-words/{blockedWordId} - streamer JWT */
  updateBlockedWord: (roomId: number, blockedWordId: number, data: UpsertBlockedWordRequest) =>
    httpClient.patch<BlockedWord>(`/rooms/${roomId}/blocked-words/${blockedWordId}`, data),

  /** DELETE /rooms/{roomId}/blocked-words/{blockedWordId} - streamer JWT */
  deleteBlockedWord: (roomId: number, blockedWordId: number) =>
    httpClient.delete<void>(`/rooms/${roomId}/blocked-words/${blockedWordId}`),

  /** POST /rooms/me/sessions/{sessionId}/retry-vod - JWT */
  retryVodUpload: (sessionId: number) =>
    httpClient.post(`/rooms/me/sessions/${sessionId}/retry-vod`),

  /** POST /rooms/me/sessions/{sessionId}/deploy-vod - JWT */
  deployVod: (sessionId: number) =>
    httpClient.post(`/rooms/me/sessions/${sessionId}/deploy-vod`),

  /** PATCH /rooms/me/sessions/{sessionId}/draft-vod - JWT */
  draftVod: (sessionId: number) =>
    httpClient.patch(`/rooms/me/sessions/${sessionId}/draft-vod`),

  /** PATCH /rooms/me/sessions/{sessionId}/delete-vod - JWT */
  deleteVod: (sessionId: number) =>
    httpClient.patch<void>(`/rooms/me/sessions/${sessionId}/delete-vod`),
};
