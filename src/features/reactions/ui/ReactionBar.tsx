import { ThumbsDown, ThumbsUp, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers/AuthContext";
import type { ReactionKind, ReactionState } from "@/shared/api/reaction.service";
import { useRoomReactions, useSessionReactions } from "../model/useRoomReactions";

interface ReactionBarBaseProps {
  likeCount: number;
  dislikeCount: number;
  currentReaction: ReactionState;
  isLoading: boolean;
  isConnected?: boolean;
  pendingReaction: ReactionKind | null;
  onLike: () => void;
  onDislike: () => void;
  label: string;
  subtitle: string;
}

interface RoomReactionBarProps {
  roomId: number | null;
}

interface SessionReactionBarProps {
  sessionId: number | null;
}

function formatCount(value: number) {
  return value.toLocaleString("vi-VN");
}

function ReactionBarBase({
  likeCount,
  dislikeCount,
  currentReaction,
  isLoading,
  isConnected,
  pendingReaction,
  onLike,
  onDislike,
  label,
  subtitle,
}: ReactionBarBaseProps) {
  const total = likeCount + dislikeCount;
  const likeRatio = total > 0 ? Math.round((likeCount / total) * 100) : 50;

  const likeActive = currentReaction === "LIKE";
  const dislikeActive = currentReaction === "DISLIKE";

  const likeButtonClasses = likeActive
    ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200 shadow-[0_10px_30px_rgba(16,185,129,0.25)]"
    : "border-border/70 bg-white/5 text-muted-foreground hover:border-emerald-400/40 hover:bg-emerald-500/10";

  const dislikeButtonClasses = dislikeActive
    ? "border-rose-400/60 bg-rose-500/15 text-rose-200 shadow-[0_10px_30px_rgba(244,63,94,0.25)]"
    : "border-border/70 bg-white/5 text-muted-foreground hover:border-rose-400/40 hover:bg-rose-500/10";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-slate-950/80 via-slate-900/60 to-slate-800/60 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),transparent_45%),radial-gradient(circle_at_bottom,_rgba(244,63,94,0.12),transparent_45%)]" />
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {typeof isConnected === "boolean" && (
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                isConnected
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-400/40 bg-amber-500/10 text-amber-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {isConnected ? "Realtime" : "Reconnecting"}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onLike}
            disabled={isLoading || pendingReaction !== null}
            aria-pressed={likeActive}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${likeButtonClasses}`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-200">
              <ThumbsUp className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">Like</p>
              <p className="text-xs text-muted-foreground">An lan nua de bo</p>
            </div>
            <span className="ml-auto text-lg font-bold text-foreground">
              {isLoading ? "—" : formatCount(likeCount)}
            </span>
          </button>

          <button
            type="button"
            onClick={onDislike}
            disabled={isLoading || pendingReaction !== null}
            aria-pressed={dislikeActive}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${dislikeButtonClasses}`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-200">
              <ThumbsDown className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">Dislike</p>
              <p className="text-xs text-muted-foreground">An lan nua de bo</p>
            </div>
            <span className="ml-auto text-lg font-bold text-foreground">
              {isLoading ? "—" : formatCount(dislikeCount)}
            </span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tong cam xuc</span>
            <span>{formatCount(total)}</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400"
              style={{ width: `${likeRatio}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-rose-400 via-rose-500 to-rose-400"
              style={{ width: `${100 - likeRatio}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Like ratio {likeRatio}%</span>
            {currentReaction ? (
              <span className="text-foreground">
                Ban da {currentReaction === "LIKE" ? "like" : "dislike"}
              </span>
            ) : (
              <span>Chua co cam xuc</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RoomReactionBar({ roomId }: RoomReactionBarProps) {
  const { isAuthenticated } = useAuth();
  const {
    likeCount,
    dislikeCount,
    currentReaction,
    isLoading,
    pendingReaction,
    isConnected,
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
    <ReactionBarBase
      likeCount={likeCount}
      dislikeCount={dislikeCount}
      currentReaction={currentReaction}
      isLoading={isLoading}
      isConnected={isConnected}
      pendingReaction={pendingReaction}
      onLike={onLike}
      onDislike={onDislike}
      label="Live reactions"
      subtitle="Cap nhat theo thoi gian thuc."
    />
  );
}

export function SessionReactionBar({ sessionId }: SessionReactionBarProps) {
  const { isAuthenticated } = useAuth();
  const {
    likeCount,
    dislikeCount,
    currentReaction,
    isLoading,
    pendingReaction,
    toggleLike,
    toggleDislike,
  } = useSessionReactions(sessionId);

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
    <ReactionBarBase
      likeCount={likeCount}
      dislikeCount={dislikeCount}
      currentReaction={currentReaction}
      isLoading={isLoading}
      pendingReaction={pendingReaction}
      onLike={onLike}
      onDislike={onDislike}
      label="Session reactions"
      subtitle="Danh cho VOD hoac session cu."
    />
  );
}
