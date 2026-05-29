import { AlertTriangle, Ban, Bot, MoreVertical, Shield, Smile, Wifi, WifiOff, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useStompChat } from "@/features/send-message/model/useStompChat";
import { formatChatTime } from "@/shared/lib/formatters";

interface ChatBoardProps {
  roomId: number | null;
  sessionId?: number | null;
  streamerId?: number;
}

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/shared/ui";
import { useAuth } from "@/app/providers/AuthContext";
import { toast } from "sonner";
import { useI18n } from "@/shared/i18n";

const SEND_ICON_URL = "https://api.iconify.design/lucide:send-horizontal.svg?color=%23ffffff";
const BOT_PREFIX_PATTERN = /^@bot\b\s*/i;
const QUICK_EMOJIS = ["😀", "😂", "😍", "🔥", "👏", "❤️", "👍", "🎉", "😮", "😭", "😎", "💯"] as const;
const EMOJI_GROUPS = [
  {
    label: "Popular",
    emojis: QUICK_EMOJIS,
  },
  {
    label: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "😮", "😭", "😡", "🤔", "😴", "🤯"],
  },
  {
    label: "Hands",
    emojis: ["👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "✌️", "👌", "🤌", "👋", "🤙"],
  },
  {
    label: "Live",
    emojis: ["🔥", "💯", "❤️", "💜", "✨", "🎉", "🏆", "⚡", "🚀", "🎮", "🎧", "🎤"],
  },
] as const;

export function ChatBoard({ roomId, sessionId, streamerId }: ChatBoardProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const isStreamer = Boolean(user && streamerId && user.userId === streamerId);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isBotMode, setIsBotMode] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    newMessage,
    messagesContainerRef,
    setNewMessage,
    sendMessage,
    askBot,
    botLoading,
    botAlert,
    clearBotAlert,
    chatAlert,
    clearChatAlert,
    isConnected,
    isChatInputDisabled,
    chatTimeoutRemainingSeconds,
  } = useStompChat(roomId, sessionId);

  const handleBanUser = (username: string) => {
    // Backend still needs a real ban endpoint or userId in STOMP payload.
    toast.success(t("chat.banSuccess", { username }));
  };

  const appendEmoji = (emoji: string) => {
    setNewMessage((current) => `${current}${emoji}`);
    setIsEmojiPickerOpen(false);
  };

  const handleSubmit = (event: FormEvent) => {
    const botQuestion = newMessage.replace(BOT_PREFIX_PATTERN, "").trim();
    const shouldAskBot = isBotMode || BOT_PREFIX_PATTERN.test(newMessage);

    if (!shouldAskBot) {
      sendMessage(event);
      return;
    }

    event.preventDefault();
    if (askBot(botQuestion)) {
      setIsBotMode(false);
    }
  };

  const toggleBotMode = () => {
    setIsBotMode((current) => !current);
    setIsEmojiPickerOpen(false);
  };

  useEffect(() => {
    if (!botAlert) return;

    toast.error(botAlert);
    clearBotAlert();
  }, [botAlert, clearBotAlert]);

  useEffect(() => {
    if (!chatAlert) return;

    toast.error(chatAlert);
  }, [chatAlert]);

  useEffect(() => {
    if (!isEmojiPickerOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        emojiPickerRef.current?.contains(target) ||
        emojiButtonRef.current?.contains(target)
      ) {
        return;
      }

      setIsEmojiPickerOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isEmojiPickerOpen]);

  const isBotSubmit = isBotMode || BOT_PREFIX_PATTERN.test(newMessage);
  const chatTimeoutMinutes = Math.max(1, Math.ceil(chatTimeoutRemainingSeconds / 60));
  const isInputDisabled = !roomId || !user || !isConnected || isChatInputDisabled;
  const isSubmitDisabled = isInputDisabled || !newMessage.trim() || (isBotSubmit && botLoading);

  return (
    <div className="flex h-full flex-col bg-[#18181b] text-gray-100">
      {/* Header */}
      <div className="border-b border-[#2d2d31] p-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-gray-100">
            {t("chat.title")}
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-yellow-400" />
            )}
            {isStreamer && (
              <span title={t("chat.modMode")}>
                <Shield className="w-4 h-4 text-purple-500 ml-1" />
              </span>
            )}
          </h3>
          <button className="rounded p-1 text-gray-400 transition hover:bg-[#2d2d31] hover:text-white">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Message list */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2"
      >
        {messages.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">
            <p>{t("chat.empty")}</p>
            <p className="mt-1 text-xs text-gray-500">{t("chat.emptyHint")}</p>
          </div>
        )}
        {messages.map((msg, index) => {
          const isBotMessage = msg.messageType === "BOT";

          return (
            <div
              key={`${msg.id}-${index}`}
              className={`text-sm leading-relaxed group flex items-start justify-between ${
                isBotMessage ? "rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1.5" : ""
              }`}
            >
              <div className="min-w-0">
                <span className="text-xs text-gray-500 mr-2">
                  {formatChatTime(msg.timestamp)}
                </span>
                {isBotMessage && (
                  <span className="mr-1 inline-flex align-[-2px] text-cyan-300">
                    <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                )}
                <span style={{ color: msg.color }} className="font-semibold">
                  {isBotMessage ? "AI Bot" : msg.username}
                </span>
                <span className={isBotMessage ? "text-cyan-50" : "text-gray-200"}>
                  : {msg.message}
                </span>
                {msg.moderationStatus === "checking" && (
                  <span
                    className="ml-2 inline-flex items-center rounded border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-200"
                    title={t("chat.aiChecking")}
                    aria-label={t("chat.aiChecking")}
                  >
                    AI...
                  </span>
                )}
              </div>

              {isStreamer && !isBotMessage && msg.username !== user?.username && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="mt-0.5 rounded p-1 text-gray-400 opacity-0 transition hover:bg-[#2d2d31] hover:text-white group-hover:opacity-100">
                      <MoreVertical className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#18181b] border-[#2d2d31] text-white">
                    <DropdownMenuItem
                      onClick={() => handleBanUser(msg.username)}
                      className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer text-xs"
                    >
                      <Ban className="w-3 h-3 mr-2" /> {t("chat.ban")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
        {botLoading && (
          <div className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1.5 text-sm text-cyan-100">
            <span className="mr-1 inline-flex align-[-2px] text-cyan-300">
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="font-semibold text-cyan-300">AI Bot</span>
            <span className="text-cyan-50"> {t("chat.botTyping")}</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="relative border-t border-[#2d2d31] p-3">
        {isEmojiPickerOpen && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-[68px] right-3 z-50 max-h-[360px] w-[min(360px,calc(100%-24px))] overflow-y-auto rounded border border-[#464649] bg-[#202024] p-2 text-gray-100 shadow-2xl"
          >
            {EMOJI_GROUPS.map((group) => (
              <div key={group.label} className="mb-2 last:mb-0">
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {group.label}
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {group.emojis.map((emoji) => (
                    <button
                      key={`${group.label}-${emoji}`}
                      type="button"
                      onClick={() => appendEmoji(emoji)}
                      className="flex h-8 w-8 items-center justify-center rounded text-lg text-gray-100 transition hover:bg-[#34343a]"
                      aria-label={`Emoji ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {chatAlert && (
          <div className="mb-2 flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
            <span className="min-w-0 flex-1">{chatAlert}</span>
            <button
              type="button"
              onClick={clearChatAlert}
              className="rounded p-0.5 text-red-200 hover:bg-red-500/20 hover:text-white"
              aria-label="Dismiss chat alert"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                !user
                  ? t("errors.unauthorized")
                  : isChatInputDisabled
                  ? t("chat.timeoutPlaceholder", { minutes: chatTimeoutMinutes })
                  : isConnected
                  ? isBotMode
                    ? t("chat.botPlaceholder")
                    : t("chat.placeholder")
                  : t("chat.connecting")
              }
              disabled={isInputDisabled}
              className={`w-full rounded border bg-[#2d2d31] px-3 py-2 pr-20 text-sm text-gray-100 placeholder:text-gray-400 focus:outline-none disabled:text-gray-300 disabled:opacity-75 ${
                isBotMode
                  ? "border-cyan-500/60 focus:border-cyan-400"
                  : "border-[#464649] focus:border-purple-500"
              }`}
            />
            <button
              type="button"
              onClick={toggleBotMode}
              disabled={isInputDisabled || botLoading}
              className={`absolute right-9 top-1/2 -translate-y-1/2 rounded p-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isBotMode
                  ? "bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
                  : "text-gray-300 hover:bg-[#464649] hover:text-white"
              }`}
              title={t("chat.askBot")}
              aria-label={t("chat.askBot")}
              aria-pressed={isBotMode}
            >
              <Bot className="h-4 w-4" />
            </button>
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={() => setIsEmojiPickerOpen((current) => !current)}
              disabled={isInputDisabled}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-300 transition hover:bg-[#464649] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              title="Emoji"
              aria-label="Emoji"
              aria-expanded={isEmojiPickerOpen}
            >
              <Smile className="h-4 w-4" />
            </button>
          </div>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`px-4 py-2 rounded transition flex items-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              isBotSubmit ? "bg-cyan-600 hover:bg-cyan-700" : "bg-purple-600 hover:bg-purple-700"
            }`}
            title={isBotSubmit ? t("chat.askBot") : t("chat.send")}
            aria-label={isBotSubmit ? t("chat.askBot") : t("chat.send")}
          >
            <img
              src={SEND_ICON_URL}
              alt=""
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
            <span className="hidden sm:inline">
              {isBotSubmit ? t("chat.askBotShort") : t("chat.send")}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
