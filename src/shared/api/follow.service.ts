import { httpClient } from "./httpClient";
import type { PaginatedResponse } from "./room.service";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FollowStatusResponse {
  following: boolean;
}

export interface FollowerCountResponse {
  userId: number;
  followerCount: number;
}

export interface FollowUser {
  userId: number;
  username: string;
  avatarUrl: string | null;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const followService = {
  /** POST /users/{streamerId}/follow (JWT) */
  follow: (streamerId: number) =>
    httpClient.post(`/users/${streamerId}/follow`),

  /** DELETE /users/{streamerId}/follow (JWT) */
  unfollow: (streamerId: number) =>
    httpClient.delete(`/users/${streamerId}/follow`),

  /** GET /users/{streamerId}/follow-status (JWT) */
  getFollowStatus: (streamerId: number) =>
    httpClient.get<FollowStatusResponse>(`/users/${streamerId}/follow-status`),

  /** GET /users/{userId}/follower-count (public) */
  getFollowerCount: (userId: number) =>
    httpClient.get<FollowerCountResponse>(`/users/${userId}/follower-count`),

  /** GET /users/{userId}/followers (public) */
  getFollowers: (userId: number, params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<FollowUser>>(`/users/${userId}/followers`, { params }),

  /** GET /users/{userId}/following (public) */
  getFollowing: (userId: number, params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<FollowUser>>(`/users/${userId}/following`, { params }),
};
