import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Clock3, Download, Flag, Loader2, PlayCircle, RotateCcw, Share2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  roomService,
  type RecommendationReason,
  type RecommendedVodItem,
  type StreamSession,
} from "@/shared/api/room.service";
import { extractApiErrorMessage } from "@/shared/api/httpClient";
import { VideoPlayer } from "@/features/play-stream";
import { VodThumbnail } from "@/features/vod-thumbnail";
import { ReplayChatBoard } from "@/widgets/chat-board";
import { Avatar, AvatarFallback } from "@/shared/ui";
import { SessionReactionPill } from "@/features/reactions";
import { ReportModal } from "@/features/report";
import { VideoAssistantPanel } from "@/features/video-assistant";
import { useAuth } from "@/app/providers/AuthContext";
import { useI18n, useI18nFormatters } from "@/shared/i18n";

function normalizeViText(value: string | null | undefined): string {
  if (!value) return "";

  const looksMojibake = /(?:Ã.|áº|á»|Â)/.test(value);
  if (!looksMojibake) return value;

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return decoded.includes("�") ? value : decoded;
  } catch {
    return value;
  }
}

function makeDownloadFileName(title: string, url: string): string {
  const extensionFromUrl = new URL(url, window.location.href).pathname.split(".").pop();
  const extension =
    extensionFromUrl && extensionFromUrl.length <= 5 ? extensionFromUrl : "m3u8";
  const safeTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u1EF9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${safeTitle || "video-replay"}.${extension}`;
}

function triggerBrowserDownload(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

type RecommendationFilter = "ALL" | RecommendationReason;

const RECOMMENDATION_LIMIT = 12;
const END_SCREEN_ITEM_LIMIT = 3;

export function VodPage() {
  const { t } = useI18n();
  const { formatDate, formatNumber } = useI18nFormatters();
  const { user, isAuthenticated } = useAuth();

  const formatSessionTime = (value: string): string =>
    formatDate(value, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const { sessionId } = useParams<{ sessionId: string }>();
  const parsedSessionId = sessionId ? Number(sessionId) : null;

  const [session, setSession] = useState<StreamSession | null>(null);
  const [streamerAvatarUrl, setStreamerAvatarUrl] = useState<string | null>(null);
  const [streamerId, setStreamerId] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedVodItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [playerResetKey, setPlayerResetKey] = useState(0);
  const [recommendationFilter, setRecommendationFilter] = useState<RecommendationFilter>("ALL");

  useEffect(() => {
    const fetchSession = async () => {
      if (!parsedSessionId) {
        setError(t("vod.invalidSession"));
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const res = await roomService.getSessionById(parsedSessionId);
        setSession(res.data);
        setStreamerAvatarUrl(res.data.streamerAvatarUrl ?? null);
        setStreamerId(null);
      } catch (err) {
        setError(extractApiErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchSession();
  }, [parsedSessionId]);

  useEffect(() => {
    if (!session?.roomId || (streamerAvatarUrl && streamerId !== null)) return;

    roomService
      .getRoomById(session.roomId)
      .then((res) => {
        setStreamerAvatarUrl(res.data.streamerAvatarUrl ?? null);
        setStreamerId(res.data.streamerId ?? null);
      })
      .catch(() => {});
  }, [session?.roomId, streamerAvatarUrl, streamerId]);

  useEffect(() => {
    if (!session?.id || session.vodStatus !== "DONE" || !session.vodUrl) {
      setRecommendations([]);
      setIsRecommendationsLoading(false);
      return;
    }

    let cancelled = false;
    setIsRecommendationsLoading(true);
    roomService
      .getSessionRecommendations(session.id, { limit: RECOMMENDATION_LIMIT })
      .then((res) => {
        if (!cancelled) setRecommendations(res.data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      })
      .finally(() => {
        if (!cancelled) setIsRecommendationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.id, session?.vodStatus, session?.vodUrl]);

  useEffect(() => {
    setIsAssistantOpen(false);
    setShowEndScreen(false);
    setRecommendationFilter("ALL");
    setCurrentTime(0);
  }, [parsedSessionId]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">{t("vod.loading")}</div>;
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-destructive">
        {t("vod.notFound", { error: error ?? "" })}
      </div>
    );
  }

  const streamerName = normalizeViText(session.streamerUsername?.trim()) || `Streamer #${session.roomId}`;
  const streamerInitial = streamerName.charAt(0).toUpperCase();
  const sessionTitle = normalizeViText(session.title) || t("vod.defaultTitle");
  const isOwnVod = Boolean(streamerId && user?.userId === streamerId);
  const canUseVideoAssistant = session.vodStatus === "DONE" && Boolean(session.vodUrl);
  const filteredRecommendations =
    recommendationFilter === "ALL"
      ? recommendations
      : recommendations.filter((item) => item.reason === recommendationFilter);
  const endScreenRecommendations = filteredRecommendations.slice(0, END_SCREEN_ITEM_LIMIT);
  const sameChannelCount = recommendations.filter((item) => item.reason === "SAME_CHANNEL").length;
  const similarTopicCount = recommendations.filter((item) => item.reason === "SIMILAR_TOPIC").length;

  const getRecommendationReasonLabel = (reason: RecommendationReason): string =>
    reason === "SAME_CHANNEL" ? t("vod.reasonSameChannel") : t("vod.reasonSimilarTopic");

  const getRecommendationDuration = (item: RecommendedVodItem): string =>
    item.durationMinutes > 0
      ? t("vod.durationMinutes", { count: formatNumber(item.durationMinutes) })
      : t("vod.durationUpdating");

  const renderRecommendationFilters = () => {
    const filters: Array<{ value: RecommendationFilter; label: string; count: number }> = [
      { value: "ALL", label: t("vod.filterAll"), count: recommendations.length },
      {
        value: "SAME_CHANNEL",
        label: t("vod.filterFromStreamer", { name: streamerName }),
        count: sameChannelCount,
      },
      { value: "SIMILAR_TOPIC", label: t("vod.filterRecommended"), count: similarTopicCount },
    ];

    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => {
          const isActive = recommendationFilter === filter.value;

          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setRecommendationFilter(filter.value)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {filter.label}
              <span className="ml-2 text-xs opacity-75">{formatNumber(filter.count)}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderRecommendationCard = (item: RecommendedVodItem, variant: "sidebar" | "overlay") => {
    const itemTitle = normalizeViText(item.title) || t("vod.defaultTitle");
    const itemStreamerName =
      normalizeViText(item.streamerUsername?.trim()) || `Streamer #${item.roomId}`;
    const itemDuration = getRecommendationDuration(item);
    const reasonLabel = getRecommendationReasonLabel(item.reason);
    const isOverlay = variant === "overlay";

    return (
      <Link
        key={item.sessionId}
        to={`/vod/${item.sessionId}`}
        onClick={() => setShowEndScreen(false)}
        className={
          isOverlay
            ? "group min-w-0 rounded-lg bg-white/5 p-1.5 transition hover:bg-white/12"
            : "group grid grid-cols-[136px_1fr] gap-3 rounded-lg p-1.5 transition hover:bg-accent/70 sm:grid-cols-[168px_1fr]"
        }
      >
        <div className={isOverlay ? "space-y-2" : "contents"}>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
            <VodThumbnail vodUrl={item.vodUrl} title={itemTitle} className="h-full w-full" />
            <div className="absolute bottom-1.5 right-1.5 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {itemDuration}
            </div>
            <div className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {reasonLabel}
            </div>
          </div>

          <div className={isOverlay ? "min-w-0 px-1 pb-1" : "min-w-0 py-0.5"}>
            <p className={`${isOverlay ? "text-sm" : "text-sm"} line-clamp-2 font-semibold leading-5 text-foreground`}>
              {itemTitle}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{itemStreamerName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{t("channel.views", { count: formatNumber(item.viewCount) })}</span>
              <span className="hidden sm:inline">|</span>
              <span>{item.categoryName}</span>
              <span className="flex items-center gap-1">
                <Clock3 className="h-3 w-3" />
                {formatSessionTime(item.startedAt)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  const replayCurrentVideo = () => {
    setShowEndScreen(false);
    setCurrentTime(0);
    setPlayerResetKey((value) => value + 1);
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: sessionTitle,
          text: `${sessionTitle} - ${streamerName}`,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("vod.shareCopied"));
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        return;
      }

      toast.error(t("vod.shareFailed"));
    }
  };

  const handleDownload = async () => {
    if (!session.vodUrl) {
      toast.error(t("vod.downloadUnavailable"));
      return;
    }

    const fileName = makeDownloadFileName(sessionTitle, session.vodUrl);
    triggerBrowserDownload(session.vodUrl, fileName);
    toast.message(t("vod.downloadOpened"));
  };

  const renderAssistantPanel = () => (
    <VideoAssistantPanel
      roomId={session.roomId}
      sessionId={session.id}
      videoId={session.id}
      title={sessionTitle}
      isEnabled={canUseVideoAssistant}
      isAuthenticated={isAuthenticated}
      disabledReason={t("vod.assistant.unavailable")}
      getCurrentTimeSeconds={() => currentTime}
      onClose={() => setIsAssistantOpen(false)}
    />
  );

  const renderReplayChatPanel = () => (
    <section className="h-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-surface px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">{t("vod.replayChat")}</h2>
      </div>

      <div className="h-[52vh] min-h-[360px] max-h-[560px] overflow-hidden">
        <ReplayChatBoard sessionId={session.id} currentTime={currentTime} sessionStart={session.startedAt} />
      </div>
    </section>
  );

  const renderRelatedVideosPanel = () => (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="mb-3">{renderRecommendationFilters()}</div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t("vod.recommendationsTitle")}</p>
        <span className="text-xs text-muted-foreground">{t("vod.videoCount", { count: formatNumber(filteredRecommendations.length) })}</span>
      </div>

      <div className="space-y-3">
        {isRecommendationsLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("vod.relatedLoading")}
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            {t("vod.recommendationsEmpty")}
          </div>
        ) : (
          filteredRecommendations.map((item) => renderRecommendationCard(item, "sidebar"))
        )}
      </div>
    </section>
  );

  const renderEndScreenOverlay = () => (
    <div className="absolute inset-0 z-40 flex flex-col bg-black/95 px-4 py-4 text-white sm:px-6 sm:py-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            <h2 className="truncate text-lg font-bold sm:text-2xl">{t("vod.endScreenTitle")}</h2>
          </div>
          <p className="mt-1 text-xs text-white/65 sm:text-sm">{t("vod.endScreenSubtitle")}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowEndScreen(false)}
          className="rounded p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label={t("vod.closeRecommendations")}
          title={t("vod.closeRecommendations")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-3">{renderRecommendationFilters()}</div>

      <div className="min-h-0 flex-1">
        {isRecommendationsLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-white/70">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("vod.relatedLoading")}
          </div>
        ) : endScreenRecommendations.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-center text-sm text-white/70">
            {t("vod.recommendationsEmpty")}
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-3">
            {endScreenRecommendations.map((item) => renderRecommendationCard(item, "overlay"))}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <span className="text-xs text-white/60">
          {t("vod.videoCount", { count: formatNumber(filteredRecommendations.length) })}
        </span>
        <button
          type="button"
          onClick={replayCurrentVideo}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          <RotateCcw className="h-4 w-4" />
          {t("vod.replayVideo")}
        </button>
      </div>
    </div>
  );

  const renderDefaultSidebar = () => (
    <div className="space-y-5">
      {renderReplayChatPanel()}
      {renderRelatedVideosPanel()}
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <main className="flex min-h-0 flex-1">
        <div className="container relative mx-auto flex flex-1 flex-col gap-4 overflow-y-auto p-4 lg:p-6 lg:pb-10">
          <div className="md:col-span-2 space-y-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/90 ring-1 ring-border/20">
              <VideoPlayer
                key={playerResetKey}
                hlsUrl={session.vodUrl}
                isLive={false}
                onTimeUpdate={setCurrentTime}
                onEnded={() => setShowEndScreen(true)}
                onPlay={() => setShowEndScreen(false)}
              />
              {showEndScreen && renderEndScreenOverlay()}
            </div>

            <div className="space-y-4 rounded-xl border border-border/50 bg-card p-4 shadow-sm sm:p-5 md:p-6">
              <h1 className="text-xl font-bold">{sessionTitle}</h1>

              <div className="flex flex-wrap items-center gap-3">
                {streamerId ? (
                  <Link to={`/channel/${streamerId}`} className="contents">
                    <Avatar size="lg" className="bg-muted">
                      {streamerAvatarUrl ? (
                        <img src={streamerAvatarUrl} alt={streamerName} className="h-full w-full object-cover" />
                      ) : (
                        <AvatarFallback>{streamerInitial}</AvatarFallback>
                      )}
                    </Avatar>
                  </Link>
                ) : (
                  <Avatar size="lg" className="bg-muted">
                    {streamerAvatarUrl ? (
                      <img src={streamerAvatarUrl} alt={streamerName} className="h-full w-full object-cover" />
                    ) : (
                      <AvatarFallback>{streamerInitial}</AvatarFallback>
                    )}
                  </Avatar>
                )}

                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("vod.streamer")}</p>
                  {streamerId ? (
                    <Link
                      to={`/channel/${streamerId}`}
                      className="font-semibold text-purple-400 transition hover:text-purple-300"
                    >
                      {streamerName}
                    </Link>
                  ) : (
                    <p className="font-semibold">{streamerName}</p>
                  )}
                </div>

                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <SessionReactionPill
                    sessionId={parsedSessionId}
                    fallbackLikeCount={session.likeCount ?? 0}
                  />

                  <button
                    type="button"
                    onClick={() => setIsAssistantOpen(true)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isAssistantOpen
                        ? "bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-400/30 dark:text-cyan-100"
                        : "bg-muted text-foreground hover:bg-accent"
                    }`}
                    aria-expanded={isAssistantOpen}
                  >
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    {t("vod.assistant.open")}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleShare()}
                    className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
                  >
                    <Share2 className="h-4 w-4" />
                    {t("vod.share")}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDownload()}
                    disabled={!session.vodUrl}
                    className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {t("vod.download")}
                  </button>

                  {!isOwnVod && (
                    <button
                      type="button"
                      onClick={() => setIsReportOpen(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-500/20 dark:text-red-200"
                    >
                      <Flag className="h-4 w-4" />
                      {t("report.open")}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{t("vod.savedAt", { date: formatSessionTime(session.startedAt) })}</span>
                <span>|</span>
                <span>{t("vod.duration", { duration: session.durationMinutes > 0 ? t("vod.durationMinutes", { count: formatNumber(session.durationMinutes) }) : t("vod.durationUpdating") })}</span>
              </div>
            </div>

            {isAssistantOpen && (
              <div className="xl:hidden">
                {renderAssistantPanel()}
              </div>
            )}
          </div>
        </div>

        <aside className="hidden w-[420px] shrink-0 overflow-y-auto border-l border-border bg-surface px-4 py-3 xl:block 2xl:w-[500px]">
          {isAssistantOpen ? renderAssistantPanel() : renderDefaultSidebar()}
        </aside>
      </main>

      <ReportModal
        isOpen={isReportOpen}
        onOpenChange={setIsReportOpen}
        sessionId={session.id}
        roomId={session.roomId}
      />
    </div>
  );
}
