import { useParams, Link } from "react-router-dom";
import { Heart, Share2, Flag, Users, ChevronDown, Loader2, AlertCircle, DollarSign } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { VideoPlayer, useWatchRoom } from "@/features/play-stream";
import { ChatBoard } from "@/widgets/chat-board";
import { DonateModal } from "@/features/donate";
import { ReportModal } from "@/features/report";
import { RoomReactionPill, SessionReactionPill } from "@/features/reactions";
import { hasActiveLiveSession, roomService, type RoomDetail } from "@/shared/api/room.service";
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

  const [isDonateOpen, setIsDonateOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDesktopChatLayout, setIsDesktopChatLayout] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(DESKTOP_CHAT_MEDIA_QUERY).matches
      : false,
  );

  const isLive = hasActiveLiveSession(room);
  const isEnded = room?.status === "ENDED";
  const hasPlaybackUrl = Boolean(room?.hlsUrl);

  // â”€â”€ Video ref + all-in-one watch hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const videoRef = useRef<HTMLVideoElement>(null);
  const { viewCount, error: watchError } = useWatchRoom(
    isLive ? roomId : null,
    isLive ? room?.activeSessionId ?? null : null,
    isLive ? room?.hlsUrl : null,
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
    if (!roomId || !isLive) return;
    const intervalId = setInterval(() => {
      roomService
        .getRoomById(roomId)
        .then((res) => setRoom(res.data))
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(intervalId);
  }, [roomId, isLive]);

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
    <div className="min-h-screen">
      <div className="max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-0">
          {/* â”€â”€ Main content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="lg:border-r border-[#2d2d31]">
            {/* Player */}
            <div className="bg-black">
              {isEnded ? (
                <div className="relative aspect-video bg-gradient-to-br from-slate-950 to-slate-900 flex flex-col items-center justify-center text-center px-6 gap-6">
                  <div className="w-20 h-20 rounded-full bg-[#1a1a1a] border border-[#3d3d3d] flex items-center justify-center">
                    <AlertCircle className="h-9 w-9 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold mb-2">{t("stream.endedTitle")}</p>
                    <p className="text-sm text-muted-foreground mb-6">
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
                    </div>
                  </div>
                </div>
              ) : isLive && !hasPlaybackUrl ? (
                <div className="relative aspect-video bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center text-center px-6">
                  <div>
                    <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-4" />
                    <p className="text-lg font-semibold mb-2">{t("stream.waitingHlsTitle")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("stream.waitingHlsDescription")}
                    </p>
                  </div>
                </div>
              ) : (
                <VideoPlayer
                  hlsUrl={room.hlsUrl}
                  isLive={isLive}
                  videoRef={videoRef}
                  viewCount={viewCount}
                  hlsErrorExternal={watchError}
                />
              )}
            </div>

            {/* Stream info */}
            <div className="p-4 border-b border-[#2d2d31]">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                  {room.streamerAvatarUrl ? (
                    <img src={room.streamerAvatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    <span className="text-lg">{room.streamerUsername[0]}</span>
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
                    className={`px-6 py-2 rounded font-semibold transition flex items-center gap-2 disabled:opacity-50 ${
                      isFollowing
                        ? "bg-[#2d2d31] hover:bg-[#3d3d41]"
                        : "bg-purple-600 hover:bg-purple-700"
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
                <span className="px-2 py-1 bg-[#2d2d31] rounded">
                  {room.categoryName}
                </span>
                {isLive && (
                  <div className="flex items-center gap-1 text-gray-400">
                    <Users className="w-4 h-4" />
                    {t("stream.live")}
                  </div>
                )}
              </div>
            </div>

            {/* About */}
            <div className="p-4 border-b border-[#2d2d31]">
              <button className="w-full flex items-center justify-between text-left">
                <h3 className="font-semibold">{t("stream.about")}</h3>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="p-4 flex flex-wrap items-center gap-2">
              {room.activeSessionId ? (
                <SessionReactionPill sessionId={room.activeSessionId} />
              ) : (
                <RoomReactionPill roomId={roomId} />
              )}
              <button className="flex items-center gap-2 px-4 py-2 bg-[#2d2d31] hover:bg-[#3d3d41] rounded-full transition">
                <Share2 className="w-4 h-4" />
                {t("stream.share")}
              </button>
              <button 
                onClick={() => setIsReportOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#2d2d31] hover:bg-[#3d3d41] rounded-full transition text-red-400 hover:text-red-300"
              >
                <Flag className="w-4 h-4" />
                {t("stream.report")}
              </button>
            </div>
          </div>

          {/* â”€â”€ Chat (desktop) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="h-[calc(100vh-var(--app-header-offset))] sticky top-[var(--app-header-offset)] hidden lg:block">
            {isDesktopChatLayout && (
              <ChatBoard roomId={roomId!} sessionId={room.activeSessionId ?? null} />
            )}
          </div>
        </div>

        {/* Chat (mobile) */}
        <div className="lg:hidden border-t border-[#2d2d31] h-[500px]">
          {!isDesktopChatLayout && (
            <ChatBoard roomId={roomId!} sessionId={room.activeSessionId ?? null} />
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
