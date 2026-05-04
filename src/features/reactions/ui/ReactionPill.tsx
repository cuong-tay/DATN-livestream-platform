import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers/AuthContext";
import type { ReactionKind, ReactionState } from "@/shared/api/reaction.service";
import { useRoomReactions, useSessionReactions } from "../model/useRoomReactions";

interface ReactionPillBaseProps {
  likeCount: number;
  currentReaction: ReactionState;
  isLoading: boolean;
  pendingReaction: ReactionKind | null;
  onLike: () => Promise<void>;
  onDislike: () => Promise<void>;
  className?: string;
}

interface RoomReactionPillProps {
  roomId: number | null;
  className?: string;
}

interface SessionReactionPillProps {
  sessionId: number | null;
  className?: string;
  fallbackLikeCount?: number;
}

function formatCount(value: number) {
  return value.toLocaleString("vi-VN");
}

function ReactionPillBase({
  likeCount,
  currentReaction,
  isLoading,
  pendingReaction,
  onLike,
  onDislike,
  className,
}: ReactionPillBaseProps) {
  const likeActive = currentReaction === "LIKE";
  const dislikeActive = currentReaction === "DISLIKE";
  const disabled = isLoading || pendingReaction !== null;
  const wrapperClassName = className ? ` ${className}` : "";

  return (
    <div
      className={`inline-flex h-11 items-center overflow-hidden rounded-full border border-[#3a3a3e] bg-[#27272a] shadow-[0_4px_12px_rgba(0,0,0,0.28)]${wrapperClassName}`}
    >
      <button
        type="button"
        onClick={() => void onLike()}
        disabled={disabled}
        aria-pressed={likeActive}
        className={`flex h-full items-center gap-2.5 px-5 text-sm font-semibold transition-colors duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-65 ${
          likeActive
            ? "bg-[#3a3a3f] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
            : "text-white/90 hover:bg-[#323236]"
        }`}
      >
        <ThumbsUp className="h-[18px] w-[18px]" strokeWidth={2.35} />
        <span>{isLoading ? "--" : formatCount(likeCount)}</span>
      </button>

      <span className="h-6 w-px bg-[#47474d]" />

      <button
        type="button"
        onClick={() => void onDislike()}
        disabled={disabled}
        aria-pressed={dislikeActive}
        className={`flex h-full items-center px-[18px] transition-colors duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-65 ${
          dislikeActive
            ? "bg-[#3a3a3f] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
            : "text-gray-300 hover:bg-[#323236]"
        }`}
      >
        <ThumbsDown className="h-[18px] w-[18px]" strokeWidth={2.35} />
      </button>
    </div>
  );
}

export function RoomReactionPill({ roomId, className }: RoomReactionPillProps) {
  const { isAuthenticated } = useAuth();
  const {
    likeCount,
    currentReaction,
    isLoading,
    pendingReaction,
    toggleLike,
    toggleDislike,
  } = useRoomReactions(roomId);

  const onLike = async () => {
    if (!isAuthenticated) {
      toast.error("Vui long dang nhap de tha cam xuc.");
      return;
    }
    try {
      await toggleLike();
    } catch {
      toast.error("Khong the cap nhat cam xuc. Vui long thu lai.");
    }
  };

  const onDislike = async () => {
    if (!isAuthenticated) {
      toast.error("Vui long dang nhap de tha cam xuc.");
      return;
    }
    try {
      await toggleDislike();
    } catch {
      toast.error("Khong the cap nhat cam xuc. Vui long thu lai.");
    }
  };

  return (
    <ReactionPillBase
      likeCount={likeCount}
      currentReaction={currentReaction}
      isLoading={isLoading}
      pendingReaction={pendingReaction}
      onLike={onLike}
      onDislike={onDislike}
      className={className}
    />
  );
}

export function SessionReactionPill({
  sessionId,
  className,
  fallbackLikeCount = 0,
}: SessionReactionPillProps) {
  const { isAuthenticated } = useAuth();
  const {
    likeCount,
    currentReaction,
    isLoading,
    pendingReaction,
    toggleLike,
    toggleDislike,
  } = useSessionReactions(sessionId);

  const displayLikeCount = isLoading ? fallbackLikeCount : likeCount;

  const onLike = async () => {
    if (!isAuthenticated) {
      toast.error("Vui long dang nhap de tha cam xuc.");
      return;
    }
    try {
      await toggleLike();
    } catch {
      toast.error("Khong the cap nhat cam xuc. Vui long thu lai.");
    }
  };

  const onDislike = async () => {
    if (!isAuthenticated) {
      toast.error("Vui long dang nhap de tha cam xuc.");
      return;
    }
    try {
      await toggleDislike();
    } catch {
      toast.error("Khong the cap nhat cam xuc. Vui long thu lai.");
    }
  };

  return (
    <ReactionPillBase
      likeCount={displayLikeCount}
      currentReaction={currentReaction}
      isLoading={isLoading}
      pendingReaction={pendingReaction}
      onLike={onLike}
      onDislike={onDislike}
      className={className}
    />
  );
}
