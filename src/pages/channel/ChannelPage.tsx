import { Link, useParams } from "react-router-dom";
import {
  CalendarDays,
  Dot,
  Heart,
  PlayCircle,
  Share2,
  Sparkles,
  Users,
  Video,
  Loader2,
  AlertCircle,
  Clock,
  Eye,
} from "lucide-react";
import { useEffect, useState } from "react";
import { StreamCard } from "@/entities/stream";
import { roomService, type PublicVodItem, type RoomLiveItem, type StreamSession } from "@/shared/api/room.service";
import { followService } from "@/shared/api/follow.service";
import { userService, type PublicUserProfile } from "@/shared/api/user.service";
import { useAuth } from "@/app/providers/AuthContext";
import { formatViewerCount } from "@/shared/lib/formatters";
import { hasHttpStatus } from "@/shared/api/httpClient";
import Hls from "hls.js";
import { useI18n, useI18nFormatters } from "@/shared/i18n";

const VOD_THUMBNAIL_CAPTURE_TIMEOUT_MS = 12_000;
const VOD_THUMBNAIL_TARGET_WIDTH = 720;
const VOD_THUMBNAIL_QUALITY = 0.9;
const VOD_THUMBNAIL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const VOD_THUMBNAIL_CACHE_MAX_ITEMS = 24;
const VOD_THUMBNAIL_STORAGE_KEY = "vod-thumbnail-cache:v1";

interface PersistedThumbnailEntry {
  vodUrl: string;
  dataUrl: string;
  updatedAt: number;
}

const vodThumbnailCache = new Map<string, string>();
let persistedThumbnailEntries: PersistedThumbnailEntry[] = [];
let hasInitializedPersistedThumbnailCache = false;

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isValidThumbnailEntry(entry: unknown): entry is PersistedThumbnailEntry {
  if (!entry || typeof entry !== "object") {
    return false;
  }

  const candidate = entry as Partial<PersistedThumbnailEntry>;

  return (
    typeof candidate.vodUrl === "string" &&
    candidate.vodUrl.length > 0 &&
    typeof candidate.dataUrl === "string" &&
    candidate.dataUrl.startsWith("data:image/") &&
    typeof candidate.updatedAt === "number" &&
    Number.isFinite(candidate.updatedAt)
  );
}

function savePersistedThumbnailCache(): void {
  if (!canUseLocalStorage()) return;

  let persisted = false;
  while (!persisted) {
    try {
      window.localStorage.setItem(VOD_THUMBNAIL_STORAGE_KEY, JSON.stringify(persistedThumbnailEntries));
      persisted = true;
    } catch {
      if (persistedThumbnailEntries.length === 0) {
        try {
          window.localStorage.removeItem(VOD_THUMBNAIL_STORAGE_KEY);
        } catch {
          // ignore
        }
        return;
      }

      persistedThumbnailEntries.pop();
    }
  }
}

function initializePersistedThumbnailCache(): void {
  if (hasInitializedPersistedThumbnailCache || !canUseLocalStorage()) {
    return;
  }

  hasInitializedPersistedThumbnailCache = true;

  try {
    const rawValue = window.localStorage.getItem(VOD_THUMBNAIL_STORAGE_KEY);
    if (!rawValue) {
      persistedThumbnailEntries = [];
      return;
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      persistedThumbnailEntries = [];
      return;
    }

    const now = Date.now();
    const normalizedEntries = parsed
      .filter(isValidThumbnailEntry)
      .filter((entry) => now - entry.updatedAt <= VOD_THUMBNAIL_CACHE_TTL_MS)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, VOD_THUMBNAIL_CACHE_MAX_ITEMS);

    persistedThumbnailEntries = normalizedEntries;

    for (const entry of normalizedEntries) {
      vodThumbnailCache.set(entry.vodUrl, entry.dataUrl);
    }

    if (normalizedEntries.length !== parsed.length) {
      savePersistedThumbnailCache();
    }
  } catch {
    persistedThumbnailEntries = [];
    try {
      window.localStorage.removeItem(VOD_THUMBNAIL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

function getCachedVodThumbnail(vodUrl: string): string | null {
  const inMemory = vodThumbnailCache.get(vodUrl);
  if (inMemory) {
    return inMemory;
  }

  initializePersistedThumbnailCache();

  const persisted = persistedThumbnailEntries.find((entry) => entry.vodUrl === vodUrl);
  if (!persisted) {
    return null;
  }

  vodThumbnailCache.set(vodUrl, persisted.dataUrl);
  return persisted.dataUrl;
}

function cacheVodThumbnail(vodUrl: string, dataUrl: string): void {
  vodThumbnailCache.set(vodUrl, dataUrl);

  initializePersistedThumbnailCache();

  persistedThumbnailEntries = persistedThumbnailEntries
    .filter((entry) => entry.vodUrl !== vodUrl)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  persistedThumbnailEntries.unshift({
    vodUrl,
    dataUrl,
    updatedAt: Date.now(),
  });

  if (persistedThumbnailEntries.length > VOD_THUMBNAIL_CACHE_MAX_ITEMS) {
    persistedThumbnailEntries = persistedThumbnailEntries.slice(0, VOD_THUMBNAIL_CACHE_MAX_ITEMS);
  }

  savePersistedThumbnailCache();
}

async function captureVodThumbnail(vodUrl: string): Promise<string | null> {
  const cached = getCachedVodThumbnail(vodUrl);
  if (cached) {
    return cached;
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let hls: Hls | null = null;
    let settled = false;
    let shouldCaptureOnSeek = false;

    const finalize = (thumbnailUrl: string | null) => {
      if (settled) return;
      settled = true;

      window.clearTimeout(timeoutId);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);

      if (hls) {
        hls.destroy();
        hls = null;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();

      if (thumbnailUrl) {
        cacheVodThumbnail(vodUrl, thumbnailUrl);
      }

      resolve(thumbnailUrl);
    };

    const captureFrame = () => {
      if (!video.videoWidth || !video.videoHeight) {
        finalize(null);
        return;
      }

      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, VOD_THUMBNAIL_TARGET_WIDTH / video.videoWidth);
        const thumbnailWidth = Math.max(1, Math.round(video.videoWidth * scale));
        const thumbnailHeight = Math.max(1, Math.round(video.videoHeight * scale));

        canvas.width = thumbnailWidth;
        canvas.height = thumbnailHeight;
        const context = canvas.getContext("2d");

        if (!context) {
          finalize(null);
          return;
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", VOD_THUMBNAIL_QUALITY);
        finalize(dataUrl);
      } catch {
        finalize(null);
      }
    };

    const handleLoadedData = () => {
      const finiteDuration = Number.isFinite(video.duration) && video.duration > 0;
      if (finiteDuration) {
        const targetTime = Math.min(1, Math.max(video.duration * 0.1, 0.2));
        if (Math.abs(video.currentTime - targetTime) > 0.05) {
          shouldCaptureOnSeek = true;
          try {
            video.currentTime = targetTime;
            return;
          } catch {
            shouldCaptureOnSeek = false;
          }
        }
      }

      captureFrame();
    };

    const handleSeeked = () => {
      if (!shouldCaptureOnSeek) return;
      shouldCaptureOnSeek = false;
      captureFrame();
    };

    const handleError = () => {
      finalize(null);
    };

    const timeoutId = window.setTimeout(() => {
      finalize(null);
    }, VOD_THUMBNAIL_CAPTURE_TIMEOUT_MS);

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          finalize(null);
        }
      });

      hls.loadSource(vodUrl);
      hls.attachMedia(video);
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = vodUrl;
      return;
    }

    finalize(null);
  });
}

function VodThumbnail({ vodUrl, title }: { vodUrl: string; title: string }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() => getCachedVodThumbnail(vodUrl));

  useEffect(() => {
    const cached = getCachedVodThumbnail(vodUrl);
    if (cached) {
      setThumbnailUrl(cached);
      return;
    }

    let cancelled = false;

    captureVodThumbnail(vodUrl).then((capturedThumbnail) => {
      if (!cancelled && capturedThumbnail) {
        setThumbnailUrl(capturedThumbnail);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [vodUrl]);

  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt={title}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <PlayCircle className="h-12 w-12 text-white/60 transition group-hover:scale-110 group-hover:text-white" />
    </div>
  );
}

export function ChannelPage() {
  const { t } = useI18n();
  const { formatNumber } = useI18nFormatters();
  const { streamer = "" } = useParams();
  const streamerId = Number(streamer);
  const { isAuthenticated, logout, user } = useAuth();

  const [rooms, setRooms] = useState<RoomLiveItem[]>([]);
  const [sessions, setSessions] = useState<StreamSession[]>([]);
  const [publicVods, setPublicVods] = useState<PublicVodItem[]>([]);
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [isPublicVodsLoading, setIsPublicVodsLoading] = useState(false);
  const [publicVodsError, setPublicVodsError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"home" | "videos">("home");

  const liveRoom = rooms.find(
    (r) => r.status === "LIVE" || r.status === "RECONNECTING",
  );
  const isOwnChannel = Boolean(isAuthenticated && user?.userId === streamerId);

  // ── Fetch channel data ───────────────────────────────────────────────
  useEffect(() => {
    if (!streamerId || isNaN(streamerId)) {
      setError(t("channel.invalid"));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    Promise.allSettled([
      // All live rooms — filter for this streamer's rooms
      roomService.getLiveRooms({ page: 0, size: 50 }),
      // Public streamer profile
      userService.getPublicProfile(streamerId),
      // Follower count
      followService.getFollowerCount(streamerId),
      // Follow status (only if authenticated)
      isAuthenticated
        ? followService.getFollowStatus(streamerId)
        : Promise.resolve(null),
      // Own channel fallback: get room list via account when streamer is offline
      isOwnChannel
        ? roomService.getMyRooms({ page: 0, size: 20 })
        : Promise.resolve(null),
    ]).then(([roomsResult, profileResult, followerResult, followStatusResult, myRoomsResult]) => {
      // Rooms
      let streamerRooms: RoomLiveItem[] = [];

      if (roomsResult.status === "fulfilled") {
        streamerRooms = roomsResult.value.data.content.filter(
          (r) => r.streamerId === streamerId,
        );
      }

      if (
        streamerRooms.length === 0 &&
        isOwnChannel &&
        myRoomsResult?.status === "fulfilled" &&
        myRoomsResult.value
      ) {
        streamerRooms = myRoomsResult.value.data.content;
      }

      setRooms(streamerRooms);
      setSessions([]);

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value.data);
      } else {
        setProfile(null);
      }

      if (profileResult.status === "rejected" && hasHttpStatus(profileResult.reason, 404)) {
        setError(t("channel.notFoundMessage"));
        setIsLoading(false);
        return;
      }

      // Followers
      if (followerResult.status === "fulfilled") {
        setFollowerCount(followerResult.value.data.followerCount);
      } else if (profileResult.status === "fulfilled") {
        setFollowerCount(profileResult.value.data.followerCount ?? 0);
      }

      // Follow status
      if (followStatusResult?.status === "fulfilled" && followStatusResult.value) {
        setIsFollowing(followStatusResult.value.data.following);
      } else if (followStatusResult?.status === "rejected") {
        if (hasHttpStatus(followStatusResult.reason, 403) || hasHttpStatus(followStatusResult.reason, 401)) {
          logout();
        }
      }

      if (myRoomsResult?.status === "rejected") {
        if (hasHttpStatus(myRoomsResult.reason, 403) || hasHttpStatus(myRoomsResult.reason, 401)) {
          logout();
        }
      }

      setIsLoading(false);
    });
  }, [streamerId, isAuthenticated, isOwnChannel, logout, t]);

  // ── Trang chủ: room sessions cho luồng đang trực tiếp ────────────────
  useEffect(() => {
    if (activeSection !== "home") return;

    const roomForSessionList =
      rooms.find((r) => r.status === "LIVE" || r.status === "RECONNECTING" || r.status === "PENDING") ?? rooms[0];

    if (!roomForSessionList) return;

    // Warm-up request so the live area reflects current session state from backend.
    roomService.getRoomSessions(roomForSessionList.roomId, { page: 0, size: 1 }).catch(() => {});
  }, [activeSection, rooms]);

  // ── Video phát trực tiếp: lấy VOD công khai hoặc VOD của chủ kênh ──
  useEffect(() => {
    if (activeSection !== "videos") return;

    if (isOwnChannel && isAuthenticated) {
      setPublicVods([]);
      setPublicVodsError(null);
      setIsPublicVodsLoading(false);
      setIsSessionsLoading(true);

      roomService
        .getMySessions({ page: 0, size: 20 })
        .then((res) => {
          const doneVodSessions = res.data.content.filter(
            (session) => session.vodStatus === "DONE" && Boolean(session.vodUrl),
          );
          setSessions(doneVodSessions);
        })
        .catch((sessionsError) => {
          if (hasHttpStatus(sessionsError, 403) || hasHttpStatus(sessionsError, 401)) {
            logout();
          }
          setSessions([]);
        })
        .finally(() => setIsSessionsLoading(false));

      return;
    }

    setSessions([]);
    setIsSessionsLoading(false);
    setIsPublicVodsLoading(true);
    setPublicVodsError(null);

    roomService
      .getPublicVods({ page: 0, size: 20, streamerId })
      .then((res) => {
        setPublicVods(res.data.content.filter((vod) => Boolean(vod.vodUrl)));
      })
      .catch(() => {
        setPublicVods([]);
        setPublicVodsError(t("errors.loadFailed"));
      })
      .finally(() => setIsPublicVodsLoading(false));
  }, [activeSection, isOwnChannel, isAuthenticated, logout, streamerId, t]);

  // ── Follow / Unfollow ────────────────────────────────────────────────
  const handleFollowToggle = async () => {
    if (!isAuthenticated || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await followService.unfollow(streamerId);
        setIsFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      } else {
        await followService.follow(streamerId);
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch {
      // ignore
    } finally {
      setFollowLoading(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-lg text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-3">{t("channel.notFoundTitle")}</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-purple-600 px-5 py-2.5 font-semibold hover:bg-purple-700 transition"
          >
            {t("channel.backHome")}
          </Link>
        </div>
      </div>
    );
  }

  // ── Derive display data ──────────────────────────────────────────────
  const streamerName =
    profile?.username ||
    rooms[0]?.streamerUsername ||
    (isOwnChannel ? user?.username : null) ||
    `Streamer #${streamerId}`;
  const streamerAvatarUrl =
    profile?.avatarUrl ?? rooms[0]?.streamerAvatarUrl ?? (isOwnChannel ? user?.avatar ?? null : null);
  const streamerBio = profile?.bio?.trim() ?? "";
  const displayedFollowerCount = followerCount || profile?.followerCount || 0;
  const streamerInitial = streamerName.trim().charAt(0).toUpperCase() || "?";
  const primaryCategory = rooms[0]?.categoryName || t("common.noData");
  const vodCount = isOwnChannel ? sessions.length : publicVods.length;

  return (
    <div className="min-h-screen">
      {/* ── Hero banner ─────────────────────────────────────────────── */}
      <section className="relative border-b border-[#2d2d31]">
        <div className="relative h-44 overflow-hidden sm:h-56">
          <div className="absolute inset-0 bg-gradient-to-r from-[#13131a] via-[#2b2045] to-[#0e0e10]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.15),_transparent_55%)]" />
          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-gray-200 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-sky-200" />
            {t("channel.spotlight")}
          </div>
        </div>

        <div className="relative mx-auto max-w-[1920px] px-4">
          <div className="-mt-12 pb-6 sm:-mt-14">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="relative h-24 w-24 shrink-0">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-[#0e0e10] bg-[#1f1f24] shadow-lg shadow-black/60">
                    {streamerAvatarUrl ? (
                      <img
                        src={streamerAvatarUrl}
                        alt={t("channel.avatarAlt", { name: streamerName })}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-semibold text-white">{streamerInitial}</span>
                    )}
                  </div>
                  <span
                    className={`absolute -bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${
                      liveRoom ? "bg-red-500/20 text-red-300" : "bg-slate-700/50 text-slate-300"
                    }`}
                  >
                    <Dot className="h-4 w-4" />
                    {liveRoom ? t("channel.live") : t("channel.offline")}
                  </span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{streamerName}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                    <span>{formatNumber(displayedFollowerCount)} {t("channel.followers")}</span>
                    <span className="text-gray-600">•</span>
                    <span>{t("channel.liveRoomsCount", { count: formatNumber(rooms.length) })}</span>
                  </div>
                  {streamerBio && (
                    <p className="max-w-3xl text-sm text-gray-300">
                      {streamerBio}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleFollowToggle}
                  disabled={!isAuthenticated || followLoading}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 font-semibold transition disabled:opacity-50 ${
                    isFollowing
                      ? "bg-[#2d2d31] text-white hover:bg-[#3d3d41]"
                      : "bg-purple-600 text-white hover:bg-purple-700"
                  }`}
                >
                  {followLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Heart className={`h-4 w-4 ${isFollowing ? "fill-current" : ""}`} />
                  )}
                  {isFollowing ? t("channel.following") : t("channel.follow")}
                </button>
                <button className="inline-flex items-center gap-2 rounded-md bg-[#2d2d31]/90 px-4 py-2 font-semibold text-white hover:bg-[#3d3d41] transition">
                  <Share2 className="h-4 w-4" />
                  {t("channel.share")}
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-[#2d2d31] bg-black/40 p-3 backdrop-blur-sm">
                <p className="text-xs text-gray-400">{t("channel.liveRooms")}</p>
                <p className="mt-1 text-xl font-bold">{rooms.length}</p>
              </div>
              <div className="rounded-lg border border-[#2d2d31] bg-black/40 p-3 backdrop-blur-sm">
                <p className="text-xs text-gray-400">{t("channel.followersLabel")}</p>
                <p className="mt-1 text-xl font-bold">{formatViewerCount(displayedFollowerCount)}</p>
              </div>
              <div className="rounded-lg border border-[#2d2d31] bg-black/40 p-3 backdrop-blur-sm">
                <p className="text-xs text-gray-400">{t("channel.liveCategory")}</p>
                <p className="mt-1 text-xl font-bold">{primaryCategory}</p>
              </div>
              <div className="rounded-lg border border-[#2d2d31] bg-black/40 p-3 backdrop-blur-sm">
                <p className="text-xs text-gray-400">{t("channel.status")}</p>
                <p className={`mt-1 flex items-center text-xl font-bold ${liveRoom ? "text-red-400" : "text-gray-500"}`}>
                  <Dot className="h-5 w-5" />
                  {liveRoom ? t("channel.live") : t("channel.offline")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1920px] px-4 pt-6">
        <div className="inline-flex rounded-lg border border-[#2d2d31] bg-[#18181b] p-1">
          <button
            type="button"
            onClick={() => setActiveSection("home")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeSection === "home" ? "bg-purple-600 text-white" : "text-gray-300 hover:bg-[#2d2d31]"
            }`}
          >
            {t("channel.tabs.home")}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("videos")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeSection === "videos" ? "bg-purple-600 text-white" : "text-gray-300 hover:bg-[#2d2d31]"
            }`}
          >
            {t("channel.tabs.videos")}
          </button>
        </div>
      </section>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1920px] px-4 py-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
          {activeSection === "home" ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {liveRoom ? t("channel.liveNowTitle", { name: streamerName }) : t("channel.offlineTitle", { name: streamerName })}
                </h2>
                <Link to="/browse" className="text-sm text-purple-400 hover:text-purple-300 transition">
                  {t("channel.exploreMore")}
                </Link>
              </div>

              {rooms.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>{t("channel.empty.noLiveRooms")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {rooms.map((room) => (
                    <StreamCard key={room.roomId} room={room} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{t("channel.tabs.videos")}</h2>
              </div>

              {isOwnChannel ? (
                isSessionsLoading ? (
                  <div className="rounded-xl border border-[#2d2d31] bg-[#18181b] p-6 text-sm text-gray-400 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("channel.loadingVideos")}
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="rounded-xl border border-[#2d2d31] bg-[#18181b] p-6 text-sm text-gray-500">
                    {t("channel.empty.noUploadedVideos")}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {sessions.map((session) => (
                      <Link
                        key={session.id}
                        to={`/vod/${session.id}`}
                        className="group block text-left"
                      >
                        <div className="relative mb-2 aspect-video overflow-hidden rounded-lg border border-[#2d2d31] bg-gradient-to-br from-slate-800 via-slate-900 to-black">
                          {session.vodUrl ? (
                            <VodThumbnail
                              vodUrl={session.vodUrl}
                              title={session.title || t("channel.untitledStream")}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <PlayCircle className="h-12 w-12 text-white/60 transition group-hover:scale-110 group-hover:text-white" />
                            </div>
                          )}
                          <div className="absolute left-2 top-2 rounded bg-purple-600 px-2 py-0.5 text-xs font-bold text-white">
                            {t("channel.replayBadge")}
                          </div>
                          {session.durationMinutes > 0 && (
                            <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-[11px] text-white">
                              {t("channel.durationMinutes", { count: session.durationMinutes })}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-600 text-sm font-semibold text-white">
                            {streamerAvatarUrl ? (
                              <img
                                src={streamerAvatarUrl}
                                alt={t("channel.avatarAlt", { name: streamerName })}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              streamerInitial
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="mb-0.5 line-clamp-2 text-sm font-semibold transition group-hover:text-purple-400">
                              {session.title || t("channel.untitledStream")}
                            </p>
                            <p className="text-sm text-gray-400">{streamerName}</p>
                            <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {t("channel.durationMinutes", { count: session.durationMinutes })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {t("channel.peak", { count: formatNumber(session.maxCcv ?? 0) })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              ) : isPublicVodsLoading ? (
                <div className="rounded-xl border border-[#2d2d31] bg-[#18181b] p-6 text-sm text-gray-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("channel.loadingVideos")}
                </div>
              ) : publicVodsError ? (
                <div className="rounded-xl border border-[#2d2d31] bg-[#18181b] p-6 text-sm text-gray-500">
                  {publicVodsError}
                </div>
              ) : publicVods.length === 0 ? (
                <div className="rounded-xl border border-[#2d2d31] bg-[#18181b] p-6 text-sm text-gray-500">
                  {t("channel.empty.noUploadedVideos")}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {publicVods.map((vod) => (
                    <Link
                      key={vod.sessionId}
                      to={`/vod/${vod.sessionId}`}
                      className="group block text-left"
                    >
                      <div className="relative mb-2 aspect-video overflow-hidden rounded-lg border border-[#2d2d31] bg-gradient-to-br from-slate-800 via-slate-900 to-black">
                        {vod.vodUrl ? (
                          <VodThumbnail
                            vodUrl={vod.vodUrl}
                            title={vod.title || t("channel.untitledStream")}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <PlayCircle className="h-12 w-12 text-white/60 transition group-hover:scale-110 group-hover:text-white" />
                          </div>
                        )}
                        <div className="absolute left-2 top-2 rounded bg-purple-600 px-2 py-0.5 text-xs font-bold text-white">
                          {t("channel.replayBadge")}
                        </div>
                        {vod.durationMinutes > 0 && (
                          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-[11px] text-white">
                            {t("channel.durationMinutes", { count: vod.durationMinutes })}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-600 text-sm font-semibold text-white">
                          {streamerAvatarUrl ? (
                            <img
                              src={streamerAvatarUrl}
                              alt={t("channel.avatarAlt", { name: streamerName })}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            streamerInitial
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="mb-0.5 line-clamp-2 text-sm font-semibold transition group-hover:text-purple-400">
                            {vod.title || t("channel.untitledStream")}
                          </p>
                          <p className="text-sm text-gray-400">{streamerName}</p>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {t("channel.durationMinutes", { count: vod.durationMinutes })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {t("channel.views", { count: formatNumber(vod.viewCount) })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sidebar */}
          <aside className="space-y-4">
            {activeSection === "home" && (
              <div className="rounded-xl border border-[#2d2d31] bg-[#18181b] p-4">
                <h3 className="mb-2 flex items-center gap-2 font-semibold">
                  <Video className="h-4 w-4 text-purple-400" />
                  {t("channel.videoSectionTitle")}
                </h3>
                <p className="text-sm text-gray-500 mb-3">
                  {t("channel.videoSectionDescription")}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSection("videos")}
                  className="text-sm text-purple-400 hover:text-purple-300 transition"
                >
                  {t("channel.openVideos")}
                </button>
              </div>
            )}

            {/* Channel info */}
            {streamerBio && (
              <div className="rounded-xl border border-[#2d2d31] bg-[#18181b] p-4">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                  {t("channel.about")}
                </h3>
                <p className="text-sm text-gray-300 whitespace-pre-line">
                  {streamerBio}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-[#2d2d31] bg-[#18181b] p-4">
              <h3 className="mb-3 font-semibold">{t("channel.snapshot")}</h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-gray-300">
                  <Users className="h-4 w-4 text-gray-400" />
                  {formatNumber(displayedFollowerCount)} {t("channel.followers")}
                </p>
                <p className="flex items-center gap-2 text-gray-300">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  {t("channel.pastSessions", { count: formatNumber(vodCount) })}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

    </div>
  );
}
