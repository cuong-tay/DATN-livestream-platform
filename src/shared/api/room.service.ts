import { httpClient } from "./httpClient";

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
  viewers?: number;
}

export interface RoomDetail extends RoomLiveItem {
  streamKey?: string;
}

export interface CreateRoomRequest {
  title: string;
  categoryId: number;
}

export interface CreateRoomResponse {
  roomId: number;
  title: string;
  streamerName: string;
  categoryName: string;
  streamKey: string;
  status: RoomStatus;
}

export type VodStatus = "PENDING" | "UPLOADING" | "DONE" | "FAILED";

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
  roomId: number;
  senderName: string;
  content: string;
  timestamp?: string;
  createdAt?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const roomService = {
  /** GET /rooms/live — danh sách phòng đang LIVE (public) */
  getLiveRooms: (params?: { categoryId?: number; page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<RoomLiveItem>>("/rooms/live", { params }),

  /** GET /rooms/{roomId} — chi tiết một phòng (public) */
  getRoomById: (roomId: number) =>
    httpClient.get<RoomDetail>(`/rooms/${roomId}`),

  /** POST /rooms — tạo phòng mới (JWT) */
  createRoom: (data: CreateRoomRequest) =>
    httpClient.post<CreateRoomResponse>("/rooms", data),

  /** PUT /rooms/me — cập nhật phòng của tôi (JWT) */
  updateMyRoom: (data: { title?: string; categoryId?: number }) =>
    httpClient.put("/rooms/me", data),

  /** PATCH /rooms/{roomId}/end — kết thúc stream (JWT) */
  endStream: (roomId: number) =>
    httpClient.patch(`/rooms/${roomId}/end`),

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
    httpClient.get<ChatMessageResponse[]>(`/sessions/${sessionId}/chats`),

  /** GET /rooms/{roomId}/chats — lịch sử chat 50 tin gần nhất (public) */
  getChatHistory: (roomId: number) =>
    httpClient.get<ChatMessageResponse[]>(`/rooms/${roomId}/chats`),

  /** POST /rooms/me/sessions/{sessionId}/retry-vod — thử upload lại VOD (JWT) */
  retryVodUpload: (sessionId: number) =>
    httpClient.post(`/rooms/me/sessions/${sessionId}/retry-vod`),
};
