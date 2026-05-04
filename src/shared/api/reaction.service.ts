import { httpClient } from "./httpClient";

export type ReactionKind = "LIKE" | "DISLIKE";
export type ReactionState = ReactionKind | null;

export interface ReactionToggleResponse {
  sessionId: number;
  likeCount: number;
  dislikeCount: number;
  currentReaction: ReactionState;
}

export interface ReactionCountResponse {
  roomId: number;
  sessionId: number;
  likeCount: number;
  dislikeCount: number;
}

export const reactionService = {
  /** POST /rooms/{roomId}/reactions/like — toggle like (JWT) */
  likeRoom: (roomId: number) =>
    httpClient.post<ReactionToggleResponse>(`/rooms/${roomId}/reactions/like`),

  /** POST /rooms/{roomId}/reactions/dislike — toggle dislike (JWT) */
  dislikeRoom: (roomId: number) =>
    httpClient.post<ReactionToggleResponse>(`/rooms/${roomId}/reactions/dislike`),

  /** POST /sessions/{sessionId}/reactions/like — toggle like (JWT) */
  likeSession: (sessionId: number) =>
    httpClient.post<ReactionToggleResponse>(`/sessions/${sessionId}/reactions/like`),

  /** POST /sessions/{sessionId}/reactions/dislike — toggle dislike (JWT) */
  dislikeSession: (sessionId: number) =>
    httpClient.post<ReactionToggleResponse>(`/sessions/${sessionId}/reactions/dislike`),

  /** GET /rooms/{roomId}/reactions — counts (public) */
  getRoomCounts: (roomId: number) =>
    httpClient.get<ReactionCountResponse>(`/rooms/${roomId}/reactions`, { skipAuth: true }),

  /** GET /sessions/{sessionId}/reactions — counts (public) */
  getSessionCounts: (sessionId: number) =>
    httpClient.get<ReactionCountResponse>(`/sessions/${sessionId}/reactions`, { skipAuth: true }),
};
