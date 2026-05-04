import { httpClient } from "./httpClient";

export type SearchType = "ALL" | "CHANNEL" | "LIVE" | "VOD";

export interface SearchChannelItem {
  userId: number;
  username: string;
  avatarUrl: string | null;
}

export interface SearchLiveItem {
  roomId: number;
  title: string;
  streamerId: number;
  streamerUsername: string;
  streamerAvatarUrl: string | null;
  categoryName: string | null;
}

export interface SearchVodItem {
  sessionId: number;
  roomId: number;
  title: string;
  streamerId: number;
  streamerUsername: string;
  vodUrl: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface UnifiedSearchResponse {
  keyword: string;
  type: SearchType;
  limit: number;
  channels: SearchChannelItem[];
  lives: SearchLiveItem[];
  vods: SearchVodItem[];
}

interface SearchParams {
  q: string;
  type?: SearchType;
  limit?: number;
}

const SEARCH_TYPES: SearchType[] = ["ALL", "CHANNEL", "LIVE", "VOD"];

function normalizeSearchType(type?: string): SearchType {
  if (!type) return "ALL";
  const upperType = type.toUpperCase();
  return SEARCH_TYPES.includes(upperType as SearchType)
    ? (upperType as SearchType)
    : "ALL";
}

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return 8;
  const parsedLimit = Math.round(limit as number);
  return Math.min(30, Math.max(1, parsedLimit));
}

export const searchService = {
  /** GET /search — unified public search */
  search: ({ q, type = "ALL", limit = 8 }: SearchParams) => {
    const keyword = q.trim();

    if (!keyword) {
      return Promise.reject(new Error("Từ khóa tìm kiếm không được để trống"));
    }

    return httpClient.get<UnifiedSearchResponse>("/search", {
      params: {
        q: keyword,
        type: normalizeSearchType(type),
        limit: normalizeLimit(limit),
      },
      skipAuth: true,
    });
  },
};
