import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  Eye,
  Film,
  Heart,
  Loader2,
  Search,
  Tv,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StreamCard } from "@/entities/stream";
import { CategoryCard, useCategories } from "@/entities/category";
import { useLiveRooms } from "@/entities/stream";
import { VodThumbnail } from "@/features/vod-thumbnail";
import {
  roomService,
  type PublicVodItem,
  type PublicVodSort,
} from "@/shared/api/room.service";
import {
  searchService,
  type SearchType,
  type UnifiedSearchResponse,
} from "@/shared/api/search.service";
import { useI18n, useI18nFormatters, type TranslationKey } from "@/shared/i18n";

const SEARCH_TYPES: SearchType[] = ["ALL", "CHANNEL", "LIVE", "VOD"];
const SEARCH_TYPE_LABEL_KEYS: Record<SearchType, TranslationKey> = {
  ALL: "browse.filters.all",
  CHANNEL: "browse.filters.channel",
  LIVE: "browse.filters.live",
  VOD: "browse.filters.replay",
};
const VOD_SORTS: Array<{ value: PublicVodSort; labelKey: TranslationKey }> = [
  { value: "latest", labelKey: "browse.sort.latest" },
  { value: "popular", labelKey: "browse.sort.popular" },
  { value: "views", labelKey: "browse.sort.views" },
];

function normalizeSearchType(rawValue: string | null): SearchType {
  if (!rawValue) return "ALL";

  const upperValue = rawValue.toUpperCase();
  return SEARCH_TYPES.includes(upperValue as SearchType)
    ? (upperValue as SearchType)
    : "ALL";
}

function normalizeSearchLimit(rawValue: string | null): number {
  if (!rawValue) return 8;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return 8;

  return Math.min(30, Math.max(1, Math.round(parsed)));
}

function VodCard({ vod }: { vod: PublicVodItem }) {
  const { t } = useI18n();
  const { formatDate, formatNumber } = useI18nFormatters();

  const formatDateTimeLabel = (value: string | null) => {
    if (!value) return t("browse.noDate");

    const label = formatDate(value, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return label || t("browse.invalidDate");
  };

  return (
    <Link to={`/vod/${vod.sessionId}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-[#171717]">
        <VodThumbnail vodUrl={vod.vodUrl} title={vod.title} className="h-full w-full" />
        <div className="absolute bottom-2 right-2 rounded bg-black/85 px-2 py-0.5 text-[11px] font-semibold text-white">
          {vod.durationMinutes > 0 ? `${vod.durationMinutes}m` : t("browse.replayBadge")}
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        {vod.streamerAvatarUrl ? (
          <img
            src={vod.streamerAvatarUrl}
            alt={vod.streamerUsername}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2d2d31] text-sm font-bold">
            {vod.streamerUsername[0]?.toUpperCase() ?? "?"}
          </div>
        )}

        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground group-hover:text-white">
            {vod.title || t("browse.defaultVideoTitle")}
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{vod.streamerUsername}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {formatNumber(vod.viewCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {formatNumber(vod.likeCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTimeLabel(vod.startedAt)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function BrowsePage() {
  const { t } = useI18n();
  const { formatDate, formatNumber } = useI18nFormatters();
  const [searchParams, setSearchParams] = useSearchParams();
  const { category } = useParams();
  const [contentTab, setContentTab] = useState<"live" | "videos">("live");
  const [searchData, setSearchData] = useState<UnifiedSearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<TranslationKey | null>(null);
  const [vodSort, setVodSort] = useState<PublicVodSort>("latest");
  const [publicVods, setPublicVods] = useState<PublicVodItem[]>([]);
  const [vodPage, setVodPage] = useState(0);
  const [vodTotalPages, setVodTotalPages] = useState(0);
  const [vodTotalElements, setVodTotalElements] = useState(0);
  const [isVodsLoading, setIsVodsLoading] = useState(false);
  const [vodError, setVodError] = useState<TranslationKey | null>(null);
  const [fallbackVods, setFallbackVods] = useState<PublicVodItem[]>([]);
  const [isFallbackVodsLoading, setIsFallbackVodsLoading] = useState(false);

  const keyword = (searchParams.get("q") ?? "").trim();
  const searchType = normalizeSearchType(searchParams.get("type"));
  const searchLimit = normalizeSearchLimit(searchParams.get("limit"));
  const isSearchMode = keyword.length > 0;

  const { categories, isLoading: catsLoading } = useCategories();

  // category URL param is now a numeric ID (e.g. /browse/1)
  const categoryId = category ? Number(category) : undefined;
  const selectedCategory = categoryId
    ? categories.find((c) => c.id === categoryId)
    : null;

  const { rooms, isLoading, error, hasMore, loadMore } = useLiveRooms(categoryId, 12, !isSearchMode);

  useEffect(() => {
    if (isSearchMode || !categoryId) {
      setPublicVods([]);
      setVodPage(0);
      setVodTotalPages(0);
      setVodTotalElements(0);
      setVodError(null);
      setIsVodsLoading(false);
      return;
    }

    let cancelled = false;
    setIsVodsLoading(true);
    setVodError(null);

    roomService
      .getPublicVods({ page: 0, size: 12, categoryId, sort: vodSort })
      .then((res) => {
        if (cancelled) return;
        setPublicVods(res.data.content);
        setVodPage(res.data.number);
        setVodTotalPages(res.data.totalPages);
        setVodTotalElements(res.data.totalElements);
      })
      .catch(() => {
        if (cancelled) return;
        setPublicVods([]);
        setVodTotalPages(0);
        setVodTotalElements(0);
        setVodError("browse.errors.categoryVideosLoadFailed");
      })
      .finally(() => {
        if (!cancelled) setIsVodsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, isSearchMode, vodSort]);

  useEffect(() => {
    setContentTab("live");
  }, [categoryId]);

  useEffect(() => {
    if (isSearchMode || !categoryId || isVodsLoading || publicVods.length > 0) {
      setFallbackVods([]);
      setIsFallbackVodsLoading(false);
      return;
    }

    let cancelled = false;
    setIsFallbackVodsLoading(true);

    roomService
      .getPublicVods({ page: 0, size: 8, sort: vodSort })
      .then((res) => {
        if (!cancelled) setFallbackVods(res.data.content);
      })
      .catch(() => {
        if (!cancelled) setFallbackVods([]);
      })
      .finally(() => {
        if (!cancelled) setIsFallbackVodsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, isSearchMode, isVodsLoading, publicVods.length, vodSort]);

  useEffect(() => {
    if (!isSearchMode) {
      setSearchData(null);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);

    searchService
      .search({ q: keyword, type: searchType, limit: searchLimit })
      .then((res) => {
        if (!cancelled) {
          setSearchData(res.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSearchData(null);
          setSearchError("browse.errors.searchLoadFailed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isSearchMode, keyword, searchType, searchLimit]);

  const liveSearchRooms = useMemo(
    () =>
      (searchData?.lives ?? []).map((live) => ({
        roomId: live.roomId,
        title: live.title,
        streamerId: live.streamerId,
        streamerUsername: live.streamerUsername,
        streamerAvatarUrl: live.streamerAvatarUrl,
        categoryName: live.categoryName ?? t("common.noData"),
        hlsUrl: null,
        status: "LIVE" as const,
      })),
    [searchData, t],
  );

  const categoryStreamers = useMemo(() => {
    const streamerMap = new Map<
      number,
      {
        streamerId: number;
        streamerUsername: string;
        streamerAvatarUrl: string | null;
        liveCount: number;
        vodCount: number;
      }
    >();

    rooms.forEach((room) => {
      const current = streamerMap.get(room.streamerId);
      streamerMap.set(room.streamerId, {
        streamerId: room.streamerId,
        streamerUsername: room.streamerUsername,
        streamerAvatarUrl: room.streamerAvatarUrl,
        liveCount: (current?.liveCount ?? 0) + 1,
        vodCount: current?.vodCount ?? 0,
      });
    });

    publicVods.forEach((vod) => {
      const current = streamerMap.get(vod.streamerId);
      streamerMap.set(vod.streamerId, {
        streamerId: vod.streamerId,
        streamerUsername: current?.streamerUsername ?? vod.streamerUsername,
        streamerAvatarUrl: current?.streamerAvatarUrl ?? vod.streamerAvatarUrl,
        liveCount: current?.liveCount ?? 0,
        vodCount: (current?.vodCount ?? 0) + 1,
      });
    });

    return Array.from(streamerMap.values()).sort(
      (a, b) => b.liveCount - a.liveCount || b.vodCount - a.vodCount || a.streamerUsername.localeCompare(b.streamerUsername),
    );
  }, [rooms, publicVods]);

  const channelCount = searchData?.channels.length ?? 0;
  const liveCount = searchData?.lives.length ?? 0;
  const vodCount = searchData?.vods.length ?? 0;
  const totalSearchResults = channelCount + liveCount + vodCount;

  const handleSearchTypeChange = (nextType: SearchType) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("q", keyword);
    nextParams.set("type", nextType);
    nextParams.set("limit", String(searchLimit));
    setSearchParams(nextParams);
  };

  const handleSearchLimitChange = (nextLimit: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("q", keyword);
    nextParams.set("type", searchType);
    nextParams.set("limit", String(nextLimit));
    setSearchParams(nextParams);
  };

  const loadMoreVods = async () => {
    if (!categoryId || isVodsLoading || vodPage + 1 >= vodTotalPages) return;

    setIsVodsLoading(true);
    setVodError(null);

    try {
      const nextPage = vodPage + 1;
      const res = await roomService.getPublicVods({
        page: nextPage,
        size: 12,
        categoryId,
        sort: vodSort,
      });

      setPublicVods((prev) => [...prev, ...res.data.content]);
      setVodPage(res.data.number);
      setVodTotalPages(res.data.totalPages);
      setVodTotalElements(res.data.totalElements);
    } catch {
      setVodError("browse.errors.moreVideosLoadFailed");
    } finally {
      setIsVodsLoading(false);
    }
  };

  const formatDateTimeLabel = (value: string | null) => {
    if (!value) return t("browse.noDate");

    const label = formatDate(value, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return label || t("browse.invalidDate");
  };

  if (isSearchMode) {
    return (
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <section className="border-b border-border bg-gradient-to-r from-indigo-500/15 via-sky-500/10 to-cyan-500/10">
          <div className="max-w-[1920px] mx-auto px-4 py-8 sm:py-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
              <Search className="h-3.5 w-3.5" />
              {t("browse.searchBadge")}
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {t("browse.searchTitle", { keyword })}
            </h1>

            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {searchLoading
                ? t("browse.searchLoading")
                : t("browse.searchSummary", { count: formatNumber(totalSearchResults) })}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/80 bg-card/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("browse.stats.channels")}</p>
                <p className="mt-1 text-2xl font-bold">{formatNumber(channelCount)}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-card/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("browse.stats.live")}</p>
                <p className="mt-1 text-2xl font-bold">{formatNumber(liveCount)}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-card/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("browse.stats.replays")}</p>
                <p className="mt-1 text-2xl font-bold">{formatNumber(vodCount)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sticky top-[var(--app-header-offset)] z-40 border-b border-border bg-card/95 backdrop-blur">
          <div className="max-w-[1920px] mx-auto px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {SEARCH_TYPES.map((candidateType) => (
                  <button
                    key={candidateType}
                    type="button"
                    onClick={() => handleSearchTypeChange(candidateType)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                      searchType === candidateType
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {t(SEARCH_TYPE_LABEL_KEYS[candidateType])}
                  </button>
                ))}
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                {t("browse.searchLimitPrefix")}
                <select
                  value={searchLimit}
                  onChange={(event) => handleSearchLimitChange(Number(event.target.value))}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-foreground outline-none transition focus:ring-1 focus:ring-primary"
                >
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                </select>
                {t("browse.searchLimitSuffix")}
              </label>
            </div>
          </div>
        </section>

        <section className="max-w-[1920px] mx-auto px-4 py-8">
          {searchError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{t(searchError)}</span>
            </div>
          )}

          {searchLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-3 h-5 w-1/2 animate-pulse rounded bg-secondary" />
                  <div className="mb-2 h-4 w-4/5 animate-pulse rounded bg-secondary" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
                </div>
              ))}
            </div>
          ) : totalSearchResults === 0 ? (
            <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
              <Search className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-4 text-lg font-semibold text-foreground">{t("browse.empty.searchTitle")}</p>
              <p className="mt-1 text-sm">{t("browse.empty.searchHint")}</p>
            </div>
          ) : (
            <div className="space-y-10">
              {(searchType === "ALL" || searchType === "CHANNEL") && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                      <UserRound className="h-5 w-5 text-primary" />
                      {t("browse.sections.channels")}
                    </h2>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {t("browse.resultCount", { count: formatNumber(channelCount) })}
                    </span>
                  </div>

                  {channelCount === 0 ? (
                    <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                      {t("browse.empty.channels")}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {searchData?.channels.map((channel) => (
                        <Link
                          key={channel.userId}
                          to={`/channel/${channel.userId}`}
                          className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-accent/40"
                        >
                          <div className="flex items-center gap-3">
                            {channel.avatarUrl ? (
                              <img
                                src={channel.avatarUrl}
                                alt={channel.username}
                                className="h-12 w-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
                                {channel.username[0]?.toUpperCase() ?? "?"}
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground transition group-hover:text-primary">
                                {channel.username}
                              </p>
                              <p className="text-xs text-muted-foreground">ID #{channel.userId}</p>
                            </div>
                          </div>

                          <p className="mt-3 text-sm font-medium text-primary">{t("browse.openChannel")}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {(searchType === "ALL" || searchType === "LIVE") && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                      <Tv className="h-5 w-5 text-primary" />
                      {t("browse.sections.liveRooms")}
                    </h2>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {t("browse.resultCount", { count: formatNumber(liveCount) })}
                    </span>
                  </div>

                  {liveCount === 0 ? (
                    <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                      {t("browse.empty.liveRooms")}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {liveSearchRooms.map((room) => (
                        <StreamCard key={room.roomId} room={room} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {(searchType === "ALL" || searchType === "VOD") && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                      <Film className="h-5 w-5 text-primary" />
                      {t("browse.sections.replays")}
                    </h2>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {t("browse.resultCount", { count: formatNumber(vodCount) })}
                    </span>
                  </div>

                  {vodCount === 0 ? (
                    <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                      {t("browse.empty.replays")}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {searchData?.vods.map((vod) => (
                        <Link
                          key={vod.sessionId}
                          to={`/vod/${vod.sessionId}`}
                          className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/50 hover:bg-accent/40"
                        >
                          <div className="relative aspect-video overflow-hidden bg-[#171717]">
                            <VodThumbnail vodUrl={vod.vodUrl} title={vod.title} className="h-full w-full" />
                            <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white">
                              {t("browse.replayBadge")}
                            </div>
                          </div>

                          <div className="space-y-2 p-4">
                            <p className="line-clamp-2 text-sm font-semibold text-foreground transition group-hover:text-primary">
                              {vod.title || t("browse.defaultStreamTitle")}
                            </p>
                            <p className="text-sm text-muted-foreground">{vod.streamerUsername}</p>

                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <p className="flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {t("browse.startedAt", { date: formatDateTimeLabel(vod.startedAt) })}
                              </p>
                              <p>{t("browse.endedAt", { date: formatDateTimeLabel(vod.endedAt) })}</p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Category hero banner */}
      {selectedCategory && (
        <div className="relative h-64 overflow-hidden border-b border-border">
          {selectedCategory.iconUrl ? (
            <img
              src={selectedCategory.iconUrl}
              alt={selectedCategory.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-700 via-zinc-900 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-black/20" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="max-w-[1920px] mx-auto">
              <h1 className="mb-2 text-4xl font-bold">
                {selectedCategory.name}
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                {t("browse.categoryHero")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All-categories grid */}
      {!category && (
        <div className="border-b border-border bg-card transition-colors duration-300 text-card-foreground">
          <div className="max-w-[1920px] mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold mb-4">{t("browse.title")}</h1>

            {catsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-lg bg-secondary animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {categories.map((cat) => (
                  <CategoryCard key={cat.id} category={cat} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedCategory && (
        <div className="sticky top-[var(--app-header-offset)] z-40 border-b border-border bg-background/95 backdrop-blur">
          <div className="max-w-[1920px] mx-auto space-y-3 px-4 py-3">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {categoryStreamers.length === 0 && (isLoading || isVodsLoading)
                ? Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="flex w-24 shrink-0 flex-col items-center gap-2">
                      <div className="h-14 w-14 animate-pulse rounded-full bg-secondary" />
                      <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
                    </div>
                  ))
                : categoryStreamers.map((streamer) => (
                    <Link
                      key={streamer.streamerId}
                      to={`/channel/${streamer.streamerId}`}
                      className="group flex w-24 shrink-0 flex-col items-center gap-2 text-center"
                    >
                      <div className="relative h-14 w-14 overflow-hidden rounded-full ring-2 ring-transparent transition group-hover:ring-foreground/40">
                        {streamer.streamerAvatarUrl ? (
                          <img
                            src={streamer.streamerAvatarUrl}
                            alt={streamer.streamerUsername}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-secondary text-lg font-bold">
                            {streamer.streamerUsername[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                        {streamer.liveCount > 0 && (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {t("status.live")}
                          </span>
                        )}
                      </div>
                      <span className="line-clamp-1 w-full text-xs font-medium text-muted-foreground group-hover:text-foreground">
                        {streamer.streamerUsername}
                      </span>
                    </Link>
                  ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex rounded-full bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => setContentTab("live")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    contentTab === "live" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("browse.tabs.live", { count: formatNumber(rooms.length) })}
                </button>
                <button
                  type="button"
                  onClick={() => setContentTab("videos")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    contentTab === "videos" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("browse.tabs.videos", { count: formatNumber(vodTotalElements) })}
                </button>
              </div>

              <Link
                to="/browse"
                className="shrink-0 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              >
                {t("browse.allCategories")}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stream results */}
      <div className="max-w-[1920px] mx-auto px-4 py-8">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {(!selectedCategory || contentTab === "live") && (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {t("browse.liveChannelCount", { count: formatNumber(rooms.length) })}
            </p>

            {isLoading && rooms.length === 0 ? (
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
        ) : rooms.length === 0 && !isLoading ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium mb-2">
              {selectedCategory
                ? t("browse.empty.categoryLive", { category: selectedCategory.name })
                : t("browse.empty.noLive")}
            </p>
            <p className="text-sm">{t("browse.empty.tryLater")}</p>
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
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("browse.loadMore")}
                </button>
              </div>
            )}
          </>
            )}
          </>
        )}

        {selectedCategory && contentTab === "videos" && (
          <section className="mt-12 border-t border-border pt-8">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="mt-1 text-2xl font-bold">
                  {t("browse.categoryVideosTitle", { category: selectedCategory.name })}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("browse.categoryVideosSummary", { count: formatNumber(vodTotalElements) })}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {VOD_SORTS.map((sortOption) => (
                  <button
                    key={sortOption.value}
                    type="button"
                    onClick={() => setVodSort(sortOption.value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      vodSort === sortOption.value
                        ? "bg-foreground text-background"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {t(sortOption.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {vodError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{t(vodError)}</span>
              </div>
            )}

            {isVodsLoading && publicVods.length === 0 ? (
              <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index}>
                    <div className="aspect-video animate-pulse rounded-lg bg-secondary" />
                    <div className="mt-3 flex gap-3">
                      <div className="h-9 w-9 animate-pulse rounded-full bg-secondary" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-4/5 animate-pulse rounded bg-secondary" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : publicVods.length === 0 ? (
              <div className="space-y-6">
                <div className="rounded-lg border border-border bg-card px-6 py-10 text-center text-muted-foreground">
                  <Film className="mx-auto h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-4 font-semibold text-foreground">
                    {t("browse.empty.categoryVideosTitle", { category: selectedCategory.name })}
                  </p>
                  <p className="mt-1 text-sm">
                    {t("browse.empty.categoryVideosHint")}
                  </p>
                </div>

                {(isFallbackVodsLoading || fallbackVods.length > 0) && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{t("browse.fallbackVideosTitle")}</h3>
                      <span className="text-xs text-muted-foreground">
                        {t("browse.videoCount", { count: formatNumber(fallbackVods.length) })}
                      </span>
                    </div>

                    {isFallbackVodsLoading ? (
                      <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={index}>
                            <div className="aspect-video animate-pulse rounded-lg bg-secondary" />
                            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-secondary" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {fallbackVods.map((vod) => (
                          <VodCard key={vod.sessionId} vod={vod} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {publicVods.map((vod) => (
                    <VodCard key={vod.sessionId} vod={vod} />
                  ))}
                </div>

                {vodPage + 1 < vodTotalPages && (
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={() => void loadMoreVods()}
                      disabled={isVodsLoading}
                      className="inline-flex items-center gap-2 rounded-full bg-secondary px-6 py-2.5 font-semibold text-foreground transition hover:bg-secondary/80 disabled:opacity-50"
                    >
                      {isVodsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t("browse.loadMoreVideos")}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
