import { useParams, Link } from "react-router-dom";
import { Heart, Share2, Flag, Users, ChevronDown, Loader2, AlertCircle, DollarSign } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useStableHlsSource, VideoPlayer, useWatchRoom } from "@/features/play-stream";
import { ChatBoard } from "@/widgets/chat-board";
import { DonateModal } from "@/features/donate";
import { ReportModal } from "@/features/report";
import { SessionReactionPill } from "@/features/reactions";
import {
  hasActiveLiveSession,
  isChatOpen,
  isEndingInProgress,
  roomService,
  type RoomDetail,
  type StreamSession,
} from "@/shared/api/room.service";
import { followService } from "@/shared/api/follow.service";
import { useAuth } from "@/app/providers/AuthContext";
import { hasHttpStatus } from "@/shared/api/httpClient";
import { useI18n } from "@/shared/i18n";

const DESKTOP_CHAT_MEDIA_QUERY = "(min-width: 1024px)";

export function StreamPage() {
  const { streamId } = useParams();
  const roomId = streamId ? Number(streamId) : null;
  const { isAuthenticated, logout } = useAuth();
  const { t } = useI18n();

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [latestEndedSession, setLatestEndedSession] = useState<StreamSession | null>(null);

  const [isDonateOpen, setIsDonateOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDesktopChatLayout, setIsDesktopChatLayout] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(DESKTOP_CHAT_MEDIA_QUERY).matches
      : false,
  );

  const isLive = hasActiveLiveSession(room);
  const isEnding = isEndingInProgress(room);
  const isEnded = room?.status === "ENDED";
  const stableHlsSource = useStableHlsSource(
    room?.activeSessionId ?? null,
    room?.hlsUrl ?? null,
    isLive,
  );
  const playbackHlsUrl = stableHlsSource?.hlsUrl ?? null;
  const hasPlaybackUrl = Boolean(playbackHlsUrl);
  const canPlayViewerStream = Boolean(playbackHlsUrl && isLive);
  const isWaitingForFreshHls = Boolean(stableHlsSource?.isStale);

  // â”€â”€ Video ref + all-in-one watch hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const videoRef = useRef<HTMLVideoElement>(null);
  const { viewCount, error: watchError } = useWatchRoom(
    canPlayViewerStream ? roomId : null,
    canPlayViewerStream ? stableHlsSource?.sessionId ?? null : null,
    playbackHlsUrl,
    videoRef,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_CHAT_MEDIA_QUERY);
    const syncChatLayout = () => setIsDesktopChatLayout(mediaQuery.matches);

    syncChatLayout();
    mediaQuery.addEventListener("change", syncChatLayout);
    return () => mediaQuery.removeEventListener("change", syncChatLayout);
  }, []);

  // â”€â”€ Fetch room details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!roomId) return;
    setIsLoading(true);

    roomService
      .getRoomById(roomId)
      .then((res) => setRoom(res.data))
      .catch(() => setError(t("stream.notFoundMessage")))
      .finally(() => setIsLoading(false));
  }, [roomId, t]);

  // â”€â”€ Poll room status má»—i 10s â€” báº¯t RECONNECTING / ENDED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!roomId || room?.status === "BANNED") return;
    const intervalId = setInterval(() => {
      roomService
        .getRoomById(roomId)
        .then((res) => setRoom(res.data))
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(intervalId);
  }, [roomId, room?.status]);

  useEffect(() => {
    if (!roomId || !isEnded) {
      setLatestEndedSession(null);
      return;
    }

    roomService
      .getRoomSessions(roomId, { page: 0, size: 1 })
      .then((res) => {
        const latestSession = res.data.content.find((session) => Boolean(session.endedAt)) ?? null;
        setLatestEndedSession(latestSession);
      })
      .catch(() => setLatestEndedSession(null));
  }, [isEnded, roomId]);

  // â”€â”€ Fetch follow status + follower count â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!room) return;

    // Follower count (public)
    followService
      .getFollowerCount(room.streamerId)
      .then((res) => setFollowerCount(res.data.followerCount))
      .catch(() => {});

    // Follow status (requires auth)
    if (isAuthenticated) {
      followService
        .getFollowStatus(room.streamerId)
        .then((res) => setIsFollowing(res.data.following))
        .catch((error) => {
          if (hasHttpStatus(error, 403) || hasHttpStatus(error, 401)) {
            logout();
          }
        });
    }
  }, [room, isAuthenticated, logout]);

  // â”€â”€ Follow / Unfollow toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleFollowToggle = async () => {
    if (!room || !isAuthenticated || followLoading) return;
    setFollowLoading(true);

    try {
      if (isFollowing) {
        await followService.unfollow(room.streamerId);
        setIsFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      } else {
        await followService.follow(room.streamerId);
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch {
      // silently fail
    } finally {
      setFollowLoading(false);
    }
  };

  // â”€â”€ Loading state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // â”€â”€ Error / not found â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (error || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t("stream.notFound")}</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Link to="/" className="text-purple-500 hover:text-purple-400">
            {t("stream.goHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-0">
          {/* â”€â”€ Main content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="border-border lg:border-r">
            {/* Player */}
            <div className="bg-black">
              {isEnding ? (
                <div className="relative flex aspect-video flex-col items-center justify-center gap-5 bg-gradient-to-br from-slate-950 to-slate-900 px-6 text-center text-white">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10">
                    <Loader2 className="h-9 w-9 animate-spin text-blue-300" />
                  </div>
                  <div>
                    <p className="mb-2 text-2xl font-bold">{t("stream.endingTitle")}</p>
                    <p className="text-sm text-gray-300">{t("stream.endingDescription")}</p>
                  </div>
                </div>
              ) : isEnded ? (
                <div className="relative flex aspect-video flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-950 to-slate-900 px-6 text-center text-white">
                  <div className="w-20 h-20 rounded-full bg-[#1a1a1a] border border-[#3d3d3d] flex items-center justify-center">
                    <AlertCircle className="h-9 w-9 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold mb-2">{t("stream.endedTitle")}</p>
                    <p className="mb-6 text-sm text-gray-300">
                      {t("stream.endedDescription")}
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Link
                        to="/"
                        className="px-5 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-semibold transition"
                      >
                        {t("stream.home")}
                      </Link>
                      <Link
                        to={`/channel/${room.streamerId}`}
                        className="px-5 py-2 rounded-md bg-[#2d2d31] hover:bg-[#3d3d41] text-white font-semibold transition"
                      >
                        {t("stream.viewChannel")}
                      </Link>
                      {latestEndedSession?.vodStatus === "DONE" && latestEndedSession.vodUrl && (
                        <Link
                          to={`/vod/${latestEndedSession.id}`}
                          className="rounded-md bg-emerald-500 px-5 py-2 font-semibold text-black transition hover:bg-emerald-400"
                        >
                          {t("stream.watchReplay")}
                        </Link>
                      )}
                    </div>
                    {latestEndedSession && latestEndedSession.vodStatus !== "DONE" && (
                      <p className="mt-4 text-xs text-gray-400">
                        {t("stream.replayProcessing")}
                      </p>
                    )}
                  </div>
                </div>
              ) : isLive && !hasPlaybackUrl ? (
                <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 px-6 text-center text-white">
                  <div>
                    <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-4" />
                    <p className="text-lg font-semibold mb-2">{t("stream.waitingHlsTitle")}</p>
                    <p className="text-sm text-gray-300">
                      {t("stream.waitingHlsDescription")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <VideoPlayer
                    hlsUrl={playbackHlsUrl}
                    isLive={canPlayViewerStream}
                    videoRef={videoRef}
                    viewCount={viewCount}
                    hlsErrorExternal={watchError}
                  />
                  {isWaitingForFreshHls && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-amber-500/15 px-4 py-2 text-center text-xs font-semibold text-amber-100 backdrop-blur-sm">
                      {t("stream.reconnectingSource")}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stream info */}
            <div className="border-b border-border p-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                  {room.streamerAvatarUrl ? (
                    <img src={room.streamerAvatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    <span className="text-lg text-white">{room.streamerUsername[0]}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold mb-1">{room.title}</h1>
                  <Link
                    to={`/channel/${room.streamerId}`}
                    className="text-purple-400 hover:text-purple-300 transition"
                  >
                    {room.streamerUsername}
                  </Link>
                  <span className="text-xs text-muted-foreground ml-2">
                    {followerCount.toLocaleString()} {t("stream.followers")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDonateOpen(true)}
                    className="px-4 py-2 rounded font-bold transition flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white shadow-lg shadow-pink-500/20"
                  >
                    <DollarSign className="w-4 h-4" />
                    {t("stream.donate")}
                  </button>
                  <button
                    onClick={handleFollowToggle}
                    disabled={!isAuthenticated || followLoading}
                    className={`flex items-center gap-2 rounded px-6 py-2 font-semibold transition disabled:opacity-70 ${
                      isFollowing
                        ? "bg-muted text-foreground hover:bg-accent"
                        : "bg-purple-600 text-white hover:bg-purple-700"
                    }`}
                  >
                    {followLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <Heart className="w-4 h-4 fill-current" />
                        {t("stream.following")}
                      </>
                    ) : (
                      t("stream.follow")
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded bg-muted px-2 py-1 text-foreground">
                  {room.categoryName}
                </span>
                {isLive && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    {t("stream.live")}
                  </div>
                )}
              </div>
            </div>

            {/* About */}
            <div className="border-b border-border p-4">
              <button className="w-full flex items-center justify-between text-left">
                <h3 className="font-semibold">{t("stream.about")}</h3>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 p-4">
              {room.activeSessionId && (
                <SessionReactionPill sessionId={room.activeSessionId} />
              )}
              <button className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-foreground transition hover:bg-accent">
                <Share2 className="w-4 h-4" />
                {t("stream.share")}
              </button>
              <button 
                onClick={() => setIsReportOpen(true)}
                className="flex items-center gap-2 rounded-full bg-red-500/10 px-4 py-2 text-red-700 transition hover:bg-red-500/20 dark:text-red-300"
              >
                <Flag className="w-4 h-4" />
                {t("stream.report")}
              </button>
            </div>
          </div>

          {/* â”€â”€ Chat (desktop) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="h-[calc(100vh-var(--app-header-offset))] sticky top-[var(--app-header-offset)] hidden lg:block">
            {isDesktopChatLayout && (
              <ChatBoard roomId={roomId!} sessionId={isChatOpen(room) ? room.activeSessionId ?? null : null} />
            )}
          </div>
        </div>

        {/* Chat (mobile) */}
        <div className="h-[500px] border-t border-border lg:hidden">
          {!isDesktopChatLayout && (
            <ChatBoard roomId={roomId!} sessionId={isChatOpen(room) ? room.activeSessionId ?? null : null} />
          )}
        </div>
      </div>

      <DonateModal 
         isOpen={isDonateOpen} 
         onOpenChange={setIsDonateOpen} 
         streamerId={room.streamerId} 
         streamerUsername={room.streamerUsername} 
      />

      <ReportModal 
         isOpen={isReportOpen} 
         onOpenChange={setIsReportOpen} 
         sessionId={room.activeSessionId ?? null}
         roomId={roomId!} 
      />
    </div>
  );
}
