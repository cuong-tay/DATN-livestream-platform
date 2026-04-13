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
import { roomService, type RoomLiveItem, type StreamSession } from "@/shared/api/room.service";
import { followService } from "@/shared/api/follow.service";
import { useAuth } from "@/app/providers/AuthContext";
import { formatViewerCount } from "@/shared/lib/formatters";

export function ChannelPage() {
  const { streamer = "" } = useParams();
  const streamerId = Number(streamer);
  const { isAuthenticated } = useAuth();

  const [rooms, setRooms] = useState<RoomLiveItem[]>([]);
  const [sessions, setSessions] = useState<StreamSession[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const liveRoom = rooms.find(
    (r) => r.status === "LIVE" || r.status === "RECONNECTING",
  );

  // ── Fetch channel data ───────────────────────────────────────────────
  useEffect(() => {
    if (!streamerId || isNaN(streamerId)) {
      setError("Channel không hợp lệ");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    Promise.allSettled([
      // All live rooms — filter for this streamer's rooms
      roomService.getLiveRooms({ page: 0, size: 50 }),
      // Follower count
      followService.getFollowerCount(streamerId),
      // Follow status (only if authenticated)
      isAuthenticated
        ? followService.getFollowStatus(streamerId)
        : Promise.resolve(null),
    ]).then(([roomsResult, followerResult, followStatusResult]) => {
      // Rooms
      if (roomsResult.status === "fulfilled") {
        const streamerRooms = roomsResult.value.data.content.filter(
          (r) => r.streamerId === streamerId,
        );
        setRooms(streamerRooms);

        // Fetch sessions for the first room found
        if (streamerRooms.length > 0) {
          roomService
            .getRoomSessions(streamerRooms[0].roomId, { page: 0, size: 5 })
            .then((res) => setSessions(res.data.content))
            .catch(() => {});
        }
      }

      // Followers
      if (followerResult.status === "fulfilled") {
        setFollowerCount(followerResult.value.data.followerCount);
      }

      // Follow status
      if (followStatusResult?.status === "fulfilled" && followStatusResult.value) {
        setIsFollowing(followStatusResult.value.data.following);
      }

      setIsLoading(false);
    });
  }, [streamerId, isAuthenticated]);

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
          <h1 className="text-3xl font-bold mb-3">Channel Not Found</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-purple-600 px-5 py-2.5 font-semibold hover:bg-purple-700 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ── Derive display data ──────────────────────────────────────────────
  const streamerName = rooms[0]?.streamerUsername || `Streamer #${streamerId}`;
  const primaryCategory = rooms[0]?.categoryName || "—";

  return (
    <div className="min-h-screen">
      {/* ── Hero banner ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[#2d2d31]">
        <div className="absolute inset-0">
          <div className="h-full w-full bg-gradient-to-br from-purple-900/60 via-[#0e0e10]/80 to-[#0e0e10]" />
        </div>

        <div className="relative mx-auto max-w-[1920px] px-4 pt-10 pb-8 sm:pt-12 sm:pb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs text-gray-200 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-purple-300" />
            Creator Spotlight
          </div>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-2xl font-bold shadow-lg shadow-purple-900/50">
                {streamerName[0]}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{streamerName}</h1>
                <p className="mt-1 text-sm text-gray-400">
                  {followerCount.toLocaleString()} followers · {rooms.length} rooms
                </p>
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
                {isFollowing ? "Following" : "Follow"}
              </button>
              <button className="inline-flex items-center gap-2 rounded-md bg-[#2d2d31]/90 px-4 py-2 font-semibold text-white hover:bg-[#3d3d41] transition">
                <Share2 className="h-4 w-4" />
                Share Channel
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[#2d2d31] bg-black/35 p-3 backdrop-blur-sm">
              <p className="text-xs text-gray-400">Rooms</p>
              <p className="mt-1 text-xl font-bold">{rooms.length}</p>
            </div>
            <div className="rounded-lg border border-[#2d2d31] bg-black/35 p-3 backdrop-blur-sm">
              <p className="text-xs text-gray-400">Followers</p>
              <p className="mt-1 text-xl font-bold">{formatViewerCount(followerCount)}</p>
            </div>
            <div className="rounded-lg border border-[#2d2d31] bg-black/35 p-3 backdrop-blur-sm">
              <p className="text-xs text-gray-400">Primary Category</p>
              <p className="mt-1 text-xl font-bold">{primaryCategory}</p>
            </div>
            <div className="rounded-lg border border-[#2d2d31] bg-black/35 p-3 backdrop-blur-sm">
              <p className="text-xs text-gray-400">Status</p>
              <p className={`mt-1 flex items-center text-xl font-bold ${liveRoom ? "text-red-400" : "text-gray-500"}`}>
                <Dot className="h-5 w-5" />
                {liveRoom ? "Live" : "Offline"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1920px] px-4 py-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
          {/* Live streams */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {liveRoom ? `Live From ${streamerName}` : `${streamerName}'s Rooms`}
              </h2>
              <Link to="/browse" className="text-sm text-purple-400 hover:text-purple-300 transition">
                Explore More Channels
              </Link>
            </div>

            {rooms.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Streamer chưa tạo phòng stream nào.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {rooms.map((room) => (
                  <StreamCard key={room.roomId} room={room} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* VOD sessions */}
            <div className="rounded-xl border border-[#2d2d31] bg-[#18181b] p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Video className="h-4 w-4 text-purple-400" />
                Past Sessions (VOD)
              </h3>

              {sessions.length === 0 ? (
                <p className="text-sm text-gray-500">Chưa có sessions nào.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-md bg-[#101013] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{session.title}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.durationMinutes}m
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            Peak: {session.maxCcv}
                          </span>
                        </div>
                      </div>
                      {session.vodUrl && (
                        <a
                          href={session.vodUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-xs text-purple-400 hover:text-purple-300 flex-shrink-0"
                        >
                          <PlayCircle className="h-5 w-5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Channel info */}
            <div className="rounded-xl border border-[#2d2d31] bg-[#18181b] p-4">
              <h3 className="mb-3 font-semibold">Channel Snapshot</h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-gray-300">
                  <Users className="h-4 w-4 text-gray-400" />
                  {followerCount.toLocaleString()} followers
                </p>
                <p className="flex items-center gap-2 text-gray-300">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  {sessions.length} past sessions
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
