import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Clock3, Loader2, PlayCircle } from "lucide-react";
import { roomService, type StreamSession } from "@/shared/api/room.service";
import { extractApiErrorMessage } from "@/shared/api/httpClient";
import { VideoPlayer } from "@/features/play-stream";
import { ReplayChatBoard } from "@/widgets/chat-board";
import { Avatar, AvatarFallback } from "@/shared/ui";
import { SessionReactionPill } from "@/features/reactions";
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

export function VodPage() {
  const { t } = useI18n();
  const { formatDate, formatNumber } = useI18nFormatters();

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
  const [relatedSessions, setRelatedSessions] = useState<StreamSession[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

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
    if (!session?.roomId || !session?.id) return;

    setIsRelatedLoading(true);
    roomService
      .getRoomSessions(session.roomId, { page: 0, size: 20 })
      .then((res) => {
        const items = res.data.content
          .filter((item) => item.id !== session.id && item.vodStatus === "DONE" && Boolean(item.vodUrl))
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        setRelatedSessions(items);
      })
      .catch(() => {
        setRelatedSessions([]);
      })
      .finally(() => setIsRelatedLoading(false));
  }, [session?.roomId, session?.id]);

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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <main className="flex min-h-0 flex-1">
        <div className="container relative mx-auto flex flex-1 flex-col gap-4 overflow-y-auto p-4 lg:p-6 lg:pb-10">
          <div className="md:col-span-2 space-y-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/90 ring-1 ring-border/20">
              <VideoPlayer hlsUrl={session.vodUrl} isLive={false} onTimeUpdate={setCurrentTime} />
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

                <SessionReactionPill
                  sessionId={parsedSessionId}
                  fallbackLikeCount={session.likeCount ?? 0}
                  className="ml-auto"
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{t("vod.savedAt", { date: formatSessionTime(session.startedAt) })}</span>
                <span>|</span>
                <span>{t("vod.duration", { duration: session.durationMinutes > 0 ? t("vod.durationMinutes", { count: formatNumber(session.durationMinutes) }) : t("vod.durationUpdating") })}</span>
              </div>
            </div>
          </div>
        </div>

        <aside className="hidden w-[420px] shrink-0 overflow-y-auto border-l border-border/50 bg-background px-4 py-3 xl:block 2xl:w-[500px]">
          <section className="overflow-hidden rounded-xl border border-white/15 bg-[#0f0f0f]">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold tracking-wide text-foreground">{t("vod.replayChat")}</h2>
            </div>

            <div className="h-[52vh] min-h-[360px] max-h-[560px] overflow-hidden">
              <ReplayChatBoard sessionId={session.id} currentTime={currentTime} sessionStart={session.startedAt} />
            </div>
          </section>

          <section className="mt-5">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                className="shrink-0 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
              >
                {t("vod.filterAll")}
              </button>
              <button
                type="button"
                className="shrink-0 rounded-lg bg-[#272727] px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-[#3f3f3f]"
              >
                {t("vod.filterFromStreamer", { name: streamerName })}
              </button>
              <button
                type="button"
                className="shrink-0 rounded-lg bg-[#272727] px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-[#3f3f3f]"
              >
                {t("vod.filterRecommended")}
              </button>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{t("vod.relatedTitle")}</p>
              <span className="text-xs text-muted-foreground">{t("vod.videoCount", { count: formatNumber(relatedSessions.length) })}</span>
            </div>

            <div className="space-y-3">
              {isRelatedLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("vod.relatedLoading")}
                </div>
              ) : relatedSessions.length === 0 ? (
                <div className="rounded-lg bg-[#272727] p-4 text-sm text-muted-foreground">
                  {t("vod.relatedEmpty")}
                </div>
              ) : (
                relatedSessions.map((item) => {
                  const itemTitle = normalizeViText(item.title) || t("vod.defaultTitle");
                  const itemDuration = item.durationMinutes > 0 ? t("vod.durationMinutes", { count: formatNumber(item.durationMinutes) }) : t("vod.durationUpdating");

                  return (
                    <Link
                      key={item.id}
                      to={`/vod/${item.id}`}
                      className="group grid grid-cols-[168px_1fr] gap-3 rounded-lg p-1.5 transition hover:bg-white/[0.06]"
                    >
                      <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-neutral-700 via-neutral-900 to-black">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <PlayCircle className="h-7 w-7 text-white/85 transition group-hover:scale-110" />
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-medium text-white">
                          {itemDuration}
                        </div>
                      </div>

                      <div className="min-w-0 py-0.5">
                        <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                          {itemTitle}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{streamerName}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3 w-3" />
                          {formatSessionTime(item.startedAt)}
                        </p>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
