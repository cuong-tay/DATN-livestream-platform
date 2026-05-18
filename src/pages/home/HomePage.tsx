import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Clock3, Eye, Loader2, PlayCircle, Radio, TrendingUp } from "lucide-react";
import { StreamCard } from "@/entities/stream";
import { CategoryCard } from "@/entities/category";
import { useLiveRooms } from "@/entities/stream";
import { useCategories } from "@/entities/category";
import { useAuth } from "@/app/providers/AuthContext";
import { followService, type FollowUser } from "@/shared/api/follow.service";
import { roomService, type PublicVodItem, type RoomLiveItem } from "@/shared/api/room.service";
import { extractApiErrorMessage } from "@/shared/api/httpClient";
import { useI18nFormatters } from "@/shared/i18n";

function VodRecommendationCard({ vod }: { vod: PublicVodItem }) {
  const { formatNumber, formatDate } = useI18nFormatters();
  const title = vod.title?.trim() || "Untitled stream";
  const startedAt = formatDate(vod.startedAt, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Link to={`/vod/${vod.sessionId}`} className="group block rounded-xl border border-border bg-card p-2 transition hover:border-primary/50 hover:bg-accent/40">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-slate-800 via-slate-950 to-black">
        <div className="absolute inset-0 flex items-center justify-center">
          <PlayCircle className="h-11 w-11 text-white/70 transition group-hover:scale-110 group-hover:text-white" />
        </div>
        <div className="absolute left-2 top-2 rounded bg-purple-600 px-2 py-0.5 text-xs font-bold text-white">
          Replay
        </div>
        {vod.durationMinutes > 0 && (
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-[11px] text-white">
            {vod.durationMinutes}m
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {vod.streamerAvatarUrl ? (
            <img src={vod.streamerAvatarUrl} alt={vod.streamerUsername} className="h-full w-full object-cover" />
          ) : (
            vod.streamerUsername[0]?.toUpperCase() ?? "?"
          )}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold transition group-hover:text-primary">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{vod.streamerUsername}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatNumber(vod.viewCount)} views
            </span>
            <span className="flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {startedAt}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const { rooms, isLoading: roomsLoading, error: roomsError, hasMore, loadMore } = useLiveRooms(undefined, 12, !isAuthenticated);
  const { categories, isLoading: catsLoading } = useCategories();

  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [followedLiveRooms, setFollowedLiveRooms] = useState<RoomLiveItem[]>([]);
  const [followedVods, setFollowedVods] = useState<PublicVodItem[]>([]);
  const [isPersonalizedLoading, setIsPersonalizedLoading] = useState(false);
  const [personalizedError, setPersonalizedError] = useState<string | null>(null);

  const followedStreamerIds = useMemo(
    () => new Set(following.map((item) => item.userId)),
    [following],
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.userId) {
      setFollowing([]);
      setFollowedLiveRooms([]);
      setFollowedVods([]);
      setPersonalizedError(null);
      setIsPersonalizedLoading(false);
      return;
    }

    let cancelled = false;
    setIsPersonalizedLoading(true);
    setPersonalizedError(null);

    followService
      .getFollowing(user.userId, { page: 0, size: 100 })
      .then(async (followingResponse) => {
        if (cancelled) return;

        const nextFollowing = followingResponse.data.content ?? [];
        setFollowing(nextFollowing);

        if (nextFollowing.length === 0) {
          setFollowedLiveRooms([]);
          setFollowedVods([]);
          return;
        }

        const streamerIds = new Set(nextFollowing.map((item) => item.userId));
        const [liveResponse, vodResponses] = await Promise.all([
          roomService.getLiveRooms({ page: 0, size: 100 }),
          Promise.allSettled(
            nextFollowing.map((streamer) =>
              roomService.getPublicVods({
                page: 0,
                size: 4,
                streamerId: streamer.userId,
                sort: "latest",
              }),
            ),
          ),
        ]);

        if (cancelled) return;

        setFollowedLiveRooms(
          liveResponse.data.content.filter((room) => streamerIds.has(room.streamerId)),
        );

        const nextVods = vodResponses
          .flatMap((result) => (result.status === "fulfilled" ? result.value.data.content : []))
          .filter((vod) => streamerIds.has(vod.streamerId))
          .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
          .slice(0, 12);

        setFollowedVods(nextVods);
      })
      .catch((error) => {
        if (cancelled) return;
        setPersonalizedError(extractApiErrorMessage(error));
        setFollowing([]);
        setFollowedLiveRooms([]);
        setFollowedVods([]);
      })
      .finally(() => {
        if (!cancelled) setIsPersonalizedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.userId]);

  const showPersonalizedHome = isAuthenticated && Boolean(user);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Categories */}
      <section className="border-b border-border bg-card text-card-foreground transition-colors duration-300">
        <div className="max-w-[1920px] mx-auto px-4 py-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Browse Categories
          </h2>

          {catsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          )}
        </div>
      </section>

      {showPersonalizedHome ? (
        <section className="max-w-[1920px] mx-auto space-y-10 px-4 py-8">
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold">
              <Radio className="h-5 w-5 text-red-500" />
              Kênh bạn theo dõi đang live
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Chỉ hiển thị phòng live từ các streamer mà tài khoản của bạn đang follow.
            </p>

            {personalizedError && (
              <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{personalizedError}</span>
              </div>
            )}

            {isPersonalizedLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index}>
                    <div className="mb-2 aspect-video animate-pulse rounded-lg bg-secondary" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
                  </div>
                ))}
              </div>
            ) : following.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
                <p className="text-lg font-medium">Bạn chưa follow kênh nào.</p>
                <p className="mt-1 text-sm">Vào trang khám phá để follow streamer, sau đó live và video của họ sẽ hiện ở đây.</p>
              </div>
            ) : followedLiveRooms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
                <p className="text-lg font-medium">Chưa có kênh bạn follow đang live.</p>
                <p className="mt-1 text-sm">Bạn vẫn có thể xem video đề xuất từ các kênh đó bên dưới.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {followedLiveRooms.map((room) => (
                  <StreamCard key={room.roomId} room={room} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold">Video đề xuất từ kênh bạn follow</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Replay mới nhất từ các streamer bạn đang theo dõi.
            </p>

            {isPersonalizedLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="aspect-video animate-pulse rounded-lg bg-secondary" />
                ))}
              </div>
            ) : followedStreamerIds.size > 0 && followedVods.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
                <p className="text-lg font-medium">Chưa có video từ các kênh bạn follow.</p>
              </div>
            ) : followedVods.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {followedVods.map((vod) => (
                  <VodRecommendationCard key={vod.sessionId} vod={vod} />
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="max-w-[1920px] mx-auto px-4 py-8">
          <h2 className="text-xl font-semibold mb-2">
            Live Channels We Think You'll Like
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Đăng nhập để trang chủ tự chuyển sang live và video từ các kênh bạn follow.
          </p>

          {roomsError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-6">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{roomsError}</span>
            </div>
          )}

          {roomsLoading && rooms.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-video rounded-lg bg-secondary animate-pulse mb-2" />
                  <div className="flex gap-2">
                    <div className="w-10 h-10 rounded-full bg-secondary animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-secondary rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-secondary rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : rooms.length === 0 && !roomsLoading ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-medium mb-2">Chưa có stream nào đang live</p>
              <p className="text-sm">Hãy quay lại sau nhé!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {rooms.map((room) => (
                  <StreamCard key={room.roomId} room={room} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMore}
                    disabled={roomsLoading}
                    className="px-6 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {roomsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Show More
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
