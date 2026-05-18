import type { FormEvent } from "react";
import { useEffect, useRef } from "react";
import {
  AlertCircle,
  Loader2,
  Lock,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { Button, Textarea } from "@/shared/ui";
import { useI18n, type TranslationKey } from "@/shared/i18n";
import { useVideoAssistant } from "../model/useVideoAssistant";

const QUICK_PROMPTS = [
  "vod.assistant.promptSummary",
  "vod.assistant.promptKeyPoints",
  "vod.assistant.promptHighlights",
  "vod.assistant.promptRelated",
] satisfies TranslationKey[];

interface VideoAssistantPanelProps {
  roomId: number;
  sessionId: number;
  videoId: number;
  title: string;
  isEnabled: boolean;
  isAuthenticated: boolean;
  disabledReason?: string;
  getCurrentTimeSeconds?: () => number;
  onClose?: () => void;
}

export function VideoAssistantPanel({
  roomId,
  sessionId,
  videoId,
  title,
  isEnabled,
  isAuthenticated,
  disabledReason,
  getCurrentTimeSeconds,
  onClose,
}: VideoAssistantPanelProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const canAsk = isEnabled && isAuthenticated;
  const {
    messages,
    question,
    setQuestion,
    isAsking,
    error,
    clearError,
    ask,
    reset,
  } = useVideoAssistant({
    roomId,
    sessionId,
    videoId,
    getCurrentTimeSeconds,
  });

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isAsking, error]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canAsk || !question.trim()) return;
    void ask();
  };

  const askPrompt = (prompt: string) => {
    if (!canAsk || isAsking) return;
    void ask(prompt);
  };

  const blockedMessage = !isEnabled
    ? disabledReason ?? t("vod.assistant.unavailable")
    : t("vod.assistant.loginRequired");

  return (
    <section className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0f0f0f] text-white">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            {t("vod.assistant.title")}
          </h2>
          <p className="mt-1 line-clamp-1 text-xs text-white/45">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={reset}
            disabled={messages.length === 0 || isAsking}
            className="text-white/65 hover:bg-white/10 hover:text-white"
            aria-label={t("vod.assistant.resetAria")}
            title={t("vod.assistant.reset")}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="text-white/75 hover:bg-white/10 hover:text-white"
              aria-label={t("vod.assistant.closePanel")}
              title={t("vod.assistant.closePanel")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex min-h-[260px] flex-col justify-center">
            <Sparkles className="mb-5 h-8 w-8 text-white" />
            <p className="text-sm font-semibold text-white">
              {t("vod.assistant.emptyGreeting")}
            </p>
            <p className="mt-5 text-sm font-semibold text-white/85">
              {t("vod.assistant.emptyPromptIntro")}
            </p>
            <div className="mt-4 flex flex-col items-end gap-2">
              {QUICK_PROMPTS.map((promptKey) => (
                <button
                  key={promptKey}
                  type="button"
                  onClick={() => askPrompt(t(promptKey))}
                  disabled={!canAsk || isAsking}
                  className="max-w-full rounded-full border border-white/20 px-4 py-2 text-right text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t(promptKey)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[88%] rounded-2xl bg-white px-3 py-2 text-sm font-medium text-black"
                    : "max-w-[92%] rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-50"
                }
              >
                {message.role === "assistant" && (
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t("vod.assistant.name")}
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                {message.role === "assistant" &&
                  message.citations &&
                  message.citations.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-cyan-500/20 pt-2">
                      {message.citations.map((citation, index) => (
                        <div
                          key={`${message.id}-${citation.type ?? "source"}-${citation.id ?? index}`}
                          className="rounded bg-black/20 px-2 py-1 text-xs text-cyan-100/80"
                        >
                          {citation.title || citation.type || t("vod.assistant.sourceFallback", { count: index + 1 })}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            ))}
            {isAsking && (
              <div className="flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                {t("vod.assistant.thinking")}
              </div>
            )}
          </div>
        )}

        {!canAsk && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{blockedMessage}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
            <span className="min-w-0 flex-1">{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="font-semibold text-red-200 hover:text-white"
            >
              {t("vod.assistant.closeError")}
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2 rounded-2xl bg-[#272727] px-3 py-2">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canAsk && question.trim()) {
                  void ask();
                }
              }
            }}
            disabled={!canAsk || isAsking}
            rows={1}
            placeholder={t("vod.assistant.placeholder")}
            className="max-h-28 min-h-9 resize-none border-0 bg-transparent px-0 py-2 text-sm text-white shadow-none focus-visible:ring-0 disabled:opacity-60"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={!canAsk || !question.trim() || isAsking}
            className="mb-0.5 rounded-full bg-white text-black hover:bg-white/90"
            aria-label={t("vod.assistant.sendAria")}
          >
            {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-white/40">
          {t("vod.assistant.disclaimer")}
        </p>
      </form>
    </section>
  );
}
