import { useParams, Link } from "react-router-dom";
import { Heart, Share2, Flag, Users, ChevronDown, Loader2, AlertCircle, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";
import { VideoPlayer } from "@/features/play-stream";
import { ChatBoard } from "@/widgets/chat-board";
import { DonateModal } from "@/features/donate";
import { ReportModal } from "@/features/report";
import { roomService, type RoomLiveItem } from "@/shared/api/room.service";
import { followService } from "@/shared/api/follow.service";
import { useAuth } from "@/app/providers/AuthContext";
import { useViewHeartbeat } from "@/shared/lib/hooks/useViewHeartbeat";

export function StreamPage() {
  const { streamId } = useParams();
  const roomId = streamId ? Number(streamId) : null;
  const { isAuthenticated } = useAuth();

  const [room, setRoom] = useState<RoomLiveItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState<number>(0);

  const [isDonateOpen, setIsDonateOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const isLive = room?.status === "LIVE" || room?.status === "RECONNECTING";

  // ── Heartbeat — track viewer watch time ──────────────────────────────
  useViewHeartbeat(isLive ? roomId : null);

  // ── Fetch room details ───────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    setIsLoading(true);

    roomService
      .getRoomById(roomId)
      .then((res) => setRoom(res.data))
      .catch(() => setError("Không tìm thấy stream"))
      .finally(() => setIsLoading(false));
  }, [roomId]);

  // ── Fetch follow status + follower count ─────────────────────────────
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
        .catch(() => {});
    }
  }, [room, isAuthenticated]);

  // ── Follow / Unfollow toggle ─────────────────────────────────────────
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

  // ── Loading state ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Error / not found ────────────────────────────────────────────────
  if (error || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Stream not found</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Link to="/" className="text-purple-500 hover:text-purple-400">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-0">
          {/* ── Main content ──────────────────────────────────────── */}
          <div className="lg:border-r border-[#2d2d31]">
            {/* Player */}
            <div className="bg-black">
              <VideoPlayer
                hlsUrl={room.hlsUrl}
                isLive={isLive}
              />
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
                    {followerCount.toLocaleString()} followers
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDonateOpen(true)}
                    className="px-4 py-2 rounded font-bold transition flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white shadow-lg shadow-pink-500/20"
                  >
                    <DollarSign className="w-4 h-4" />
                    Donate
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
                        Following
                      </>
                    ) : (
                      "Follow"
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
                    Live
                  </div>
                )}
              </div>
            </div>

            {/* About */}
            <div className="p-4 border-b border-[#2d2d31]">
              <button className="w-full flex items-center justify-between text-left">
                <h3 className="font-semibold">About this stream</h3>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="p-4 flex gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-[#2d2d31] hover:bg-[#3d3d41] rounded transition">
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <button 
                onClick={() => setIsReportOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#2d2d31] hover:bg-[#3d3d41] rounded transition text-red-400 hover:text-red-300"
              >
                <Flag className="w-4 h-4" />
                Report
              </button>
            </div>
          </div>

          {/* ── Chat (desktop) ────────────────────────────────────── */}
          <div className="h-[calc(100vh-3.5rem)] sticky top-14 hidden lg:block">
            <ChatBoard roomId={roomId!} />
          </div>
        </div>

        {/* Chat (mobile) */}
        <div className="lg:hidden border-t border-[#2d2d31] h-[500px]">
          <ChatBoard roomId={roomId!} />
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
         reportedUserId={room.streamerId} 
         roomId={roomId!} 
      />
    </div>
  );
}
