import { httpClient } from "./httpClient";
import type { PaginatedResponse, StreamSession } from "./room.service";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  streamerId: number;
  streamerUsername: string;
  value: number;
}

export interface LeaderboardResponse {
  content: LeaderboardEntry[];
}

export interface LeaderboardParams {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  size?: number;
}

export interface StatsDashboard {
  totalFollowers: number;
  totalDonationsReceived: number;
  totalStreams: number;
  totalWatchMinutes: number;
  allTimePeakCcv: number;
  chart30Days: { date: string; viewers: number; donations: number }[];
  recentSessions: StreamSession[];
}

export interface StatsSession {
  sessionId: number;
  title: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  peakCcv: number;
  totalWatchMinutes: number;
  totalDonations: number;
}

export type PaginatedStatsSession = PaginatedResponse<StatsSession>;

// ── Service ──────────────────────────────────────────────────────────────────

export const statisticsService = {
  /** GET /statistics/leaderboard/top-ccv — Top Peak CCV (public) */
  getLeaderboardTopCcv: (params: LeaderboardParams) =>
    httpClient.get<LeaderboardResponse>("/statistics/leaderboard/top-ccv", { params }),

  /** GET /statistics/leaderboard/top-donations — Top Donations (public) */
  getLeaderboardTopDonations: (params: LeaderboardParams) =>
    httpClient.get<LeaderboardResponse>("/statistics/leaderboard/top-donations", { params }),

  /** GET /statistics/leaderboard/top-watchtime — Top Watch Time (public) */
  getLeaderboardTopWatchtime: (params: LeaderboardParams) =>
    httpClient.get<LeaderboardResponse>("/statistics/leaderboard/top-watchtime", { params }),

  /** GET /statistics/me — Creator Studio dashboard stats (JWT) */
  getMyDashboard: () =>
    httpClient.get<StatsDashboard>("/statistics/me"),

  /** GET /statistics/me/sessions — Sessions with stats (JWT) */
  getMySessions: (params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedStatsSession>("/statistics/me/sessions", { params }),
};
