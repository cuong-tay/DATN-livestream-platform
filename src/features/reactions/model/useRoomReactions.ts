import { useCallback, useEffect, useState } from "react";
import {
  reactionService,
  type ReactionCountResponse,
  type ReactionKind,
  type ReactionState,
  type ReactionToggleResponse,
} from "@/shared/api/reaction.service";
import {
  getStompConnectionState,
  onStompConnectionChange,
  subscribeToTopic,
} from "@/shared/lib/stompClient";

interface ReactionStateData {
  counts: ReactionCountResponse | null;
  currentReaction: ReactionState;
}

interface UseReactionResult {
  roomId: number | null;
  sessionId: number | null;
  likeCount: number;
  dislikeCount: number;
  currentReaction: ReactionState;
  isLoading: boolean;
  isMutating: boolean;
  pendingReaction: ReactionKind | null;
  isConnected?: boolean;
  refresh: () => Promise<void>;
  toggleLike: () => Promise<void>;
  toggleDislike: () => Promise<void>;
}

function applyToggleResponse(
  previous: ReactionStateData,
  payload: ReactionToggleResponse,
  fallbackRoomId: number | null,
): ReactionStateData {
  const roomId = previous.counts?.roomId ?? fallbackRoomId ?? 0;

  return {
    counts: {
      roomId,
      sessionId: payload.sessionId,
      likeCount: payload.likeCount,
      dislikeCount: payload.dislikeCount,
    },
    currentReaction: payload.currentReaction,
  };
}

function applyCountResponse(
  previous: ReactionStateData,
  payload: ReactionCountResponse,
): ReactionStateData {
  return {
    counts: {
      roomId: payload.roomId,
      sessionId: payload.sessionId,
      likeCount: payload.likeCount,
      dislikeCount: payload.dislikeCount,
    },
    currentReaction: previous.currentReaction,
  };
}

export function useRoomReactions(roomId: number | null): UseReactionResult {
  const [state, setState] = useState<ReactionStateData>({
    counts: null,
    currentReaction: null,
  });
  const [isLoading, setIsLoading] = useState(Boolean(roomId));
  const [isMutating, setIsMutating] = useState(false);
  const [pendingReaction, setPendingReaction] = useState<ReactionKind | null>(null);
  const [isConnected, setIsConnected] = useState(
    getStompConnectionState() === "connected",
  );

  const refresh = useCallback(async () => {
    if (!roomId) {
      setState({ counts: null, currentReaction: null });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await reactionService.getRoomCounts(roomId);
      setState((prev) => applyCountResponse(prev, response.data));
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    setState({ counts: null, currentReaction: null });
    void refresh();
  }, [refresh, roomId]);

  useEffect(() => {
    const unsubscribe = onStompConnectionChange((status) => {
      setIsConnected(status === "connected");
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!roomId) return;

    return subscribeToTopic(`/topic/room/${roomId}/reactions`, (frame) => {
      try {
        const payload = JSON.parse(frame.body) as ReactionCountResponse;
        setState((prev) => applyCountResponse(prev, payload));
      } catch {
        // Ignore malformed payloads.
      }
    });
  }, [roomId]);

  const toggleLike = useCallback(async () => {
    if (!roomId || isMutating) return;

    setIsMutating(true);
    setPendingReaction("LIKE");
    try {
      const response = await reactionService.likeRoom(roomId);
      setState((prev) => applyToggleResponse(prev, response.data, roomId));
    } finally {
      setIsMutating(false);
      setPendingReaction(null);
    }
  }, [roomId, isMutating]);

  const toggleDislike = useCallback(async () => {
    if (!roomId || isMutating) return;

    setIsMutating(true);
    setPendingReaction("DISLIKE");
    try {
      const response = await reactionService.dislikeRoom(roomId);
      setState((prev) => applyToggleResponse(prev, response.data, roomId));
    } finally {
      setIsMutating(false);
      setPendingReaction(null);
    }
  }, [roomId, isMutating]);

  const likeCount = state.counts?.likeCount ?? 0;
  const dislikeCount = state.counts?.dislikeCount ?? 0;
  const sessionId = state.counts?.sessionId ?? null;

  return {
    roomId,
    sessionId,
    likeCount,
    dislikeCount,
    currentReaction: state.currentReaction,
    isLoading,
    isMutating,
    pendingReaction,
    isConnected,
    refresh,
    toggleLike,
    toggleDislike,
  };
}

export function useSessionReactions(sessionId: number | null): UseReactionResult {
  const [state, setState] = useState<ReactionStateData>({
    counts: null,
    currentReaction: null,
  });
  const [isLoading, setIsLoading] = useState(Boolean(sessionId));
  const [isMutating, setIsMutating] = useState(false);
  const [pendingReaction, setPendingReaction] = useState<ReactionKind | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setState({ counts: null, currentReaction: null });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await reactionService.getSessionCounts(sessionId);
      setState((prev) => applyCountResponse(prev, response.data));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setState({ counts: null, currentReaction: null });
    void refresh();
  }, [refresh, sessionId]);

  const toggleLike = useCallback(async () => {
    if (!sessionId || isMutating) return;

    setIsMutating(true);
    setPendingReaction("LIKE");
    try {
      const response = await reactionService.likeSession(sessionId);
      setState((prev) => applyToggleResponse(prev, response.data, prev.counts?.roomId ?? null));
    } finally {
      setIsMutating(false);
      setPendingReaction(null);
    }
  }, [sessionId, isMutating]);

  const toggleDislike = useCallback(async () => {
    if (!sessionId || isMutating) return;

    setIsMutating(true);
    setPendingReaction("DISLIKE");
    try {
      const response = await reactionService.dislikeSession(sessionId);
      setState((prev) => applyToggleResponse(prev, response.data, prev.counts?.roomId ?? null));
    } finally {
      setIsMutating(false);
      setPendingReaction(null);
    }
  }, [sessionId, isMutating]);

  const likeCount = state.counts?.likeCount ?? 0;
  const dislikeCount = state.counts?.dislikeCount ?? 0;
  const roomId = state.counts?.roomId ?? null;

  return {
    roomId,
    sessionId,
    likeCount,
    dislikeCount,
    currentReaction: state.currentReaction,
    isLoading,
    isMutating,
    pendingReaction,
    refresh,
    toggleLike,
    toggleDislike,
  };
}
