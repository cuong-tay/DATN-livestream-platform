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
  hlsUrl: string;
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

export interface StreamSession {
  id: number;
  roomId: number;
  title: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  maxCcv: number;
  vodUrl: string | null;
}

export interface ChatMessageResponse {
  roomId: number;
  senderName: string;
  content: string;
  timestamp: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const roomService = {
  /** GET /rooms/live — danh sách phòng đang LIVE (public) */
  getLiveRooms: (params?: { categoryId?: number; page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<RoomLiveItem>>("/rooms/live", { params }),

  /** GET /rooms/{roomId} — chi tiết một phòng (public) */
  getRoomById: (roomId: number) =>
    httpClient.get<RoomLiveItem>(`/rooms/${roomId}`),

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

  /** GET /rooms/me/sessions — lịch sử session của tôi (JWT) */
  getMySessions: (params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<StreamSession>>("/rooms/me/sessions", { params }),

  /** GET /rooms/{roomId}/chats — lịch sử chat 50 tin gần nhất (public) */
  getChatHistory: (roomId: number) =>
    httpClient.get<ChatMessageResponse[]>(`/rooms/${roomId}/chats`),
};
