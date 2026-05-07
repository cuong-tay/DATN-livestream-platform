import { Smile, MoreVertical, Wifi, WifiOff } from "lucide-react";
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
import { Shield, Ban } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/shared/i18n";

const SEND_ICON_URL = "https://api.iconify.design/lucide:send-horizontal.svg?color=%23ffffff";
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
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    newMessage,
    messagesContainerRef,
    setNewMessage,
    sendMessage,
    isConnected,
  } = useStompChat(roomId, sessionId);

  const handleBanUser = (username: string) => {
    // Backend still needs a real ban endpoint or userId in STOMP payload.
    toast.success(t("chat.banSuccess", { username }));
  };

  const appendEmoji = (emoji: string) => {
    setNewMessage((current) => `${current}${emoji}`);
    setIsEmojiPickerOpen(false);
  };

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

  return (
    <div className="flex flex-col h-full bg-[#18181b]">
      {/* Header */}
      <div className="border-b border-[#2d2d31] p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
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
          <button className="p-1 hover:bg-[#2d2d31] rounded">
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
          <div className="text-center text-gray-500 text-sm py-8">
            <p>{t("chat.empty")}</p>
            <p className="text-xs mt-1">{t("chat.emptyHint")}</p>
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={`${msg.id}-${index}`} className="text-sm leading-relaxed group flex items-start justify-between">
            <div>
               <span className="text-xs text-gray-500 mr-2">
                 {formatChatTime(msg.timestamp)}
               </span>
               <span style={{ color: msg.color }} className="font-semibold">
                 {msg.username}
               </span>
               <span className="text-gray-300">: {msg.message}</span>
            </div>
            
            {isStreamer && msg.username !== user?.username && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#2d2d31] rounded text-gray-400 mt-0.5">
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
        ))}
      </div>

      {/* Input */}
      <div className="relative border-t border-[#2d2d31] p-3">
        {isEmojiPickerOpen && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-[68px] right-3 z-50 max-h-[360px] w-[min(360px,calc(100%-24px))] overflow-y-auto rounded border border-[#464649] bg-[#202024] p-2 shadow-2xl"
          >
            {EMOJI_GROUPS.map((group) => (
              <div key={group.label} className="mb-2 last:mb-0">
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {group.label}
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {group.emojis.map((emoji) => (
                    <button
                      key={`${group.label}-${emoji}`}
                      type="button"
                      onClick={() => appendEmoji(emoji)}
                      className="flex h-8 w-8 items-center justify-center rounded text-lg transition hover:bg-[#34343a]"
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
        <form onSubmit={sendMessage} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isConnected ? t("chat.placeholder") : t("chat.connecting")}
              disabled={!isConnected}
              className="w-full bg-[#2d2d31] border border-[#464649] rounded px-3 py-2 pr-10 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50"
            />
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={() => setIsEmojiPickerOpen((current) => !current)}
              disabled={!isConnected}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition hover:bg-[#464649] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              title="Emoji"
              aria-label="Emoji"
              aria-expanded={isEmojiPickerOpen}
            >
              <Smile className="h-4 w-4" />
            </button>
          </div>
          <button
            type="submit"
            disabled={!isConnected || !newMessage.trim()}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded transition flex items-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title={t("chat.send")}
            aria-label={t("chat.send")}
          >
            <img
              src={SEND_ICON_URL}
              alt=""
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            />
            <span className="hidden sm:inline">{t("chat.send")}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
