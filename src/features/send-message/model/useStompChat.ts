import { useState, useEffect, useRef, useCallback } from "react";

import type { ChatMessage } from "@/entities/message/model/types";
import { roomService, type ChatMessageResponse } from "@/shared/api/room.service";
import { CHAT_COLORS, CHAT_MAX_MESSAGES } from "@/shared/lib/constants";
import { useAuth } from "@/app/providers/AuthContext";
import {
  ensureStompConnection,
  getStompConnectionState,
  onStompConnectionChange,
  publishMessage,
  subscribeToTopic,
} from "@/shared/lib/stompClient";

interface UseStompChatReturn {
  messages: ChatMessage[];
  newMessage: string;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  sendMessage: (e: React.FormEvent) => void;
  askBot: (question: string) => boolean;
  botLoading: boolean;
  botAlert: string | null;
  clearBotAlert: () => void;
  chatAlert: string | null;
  clearChatAlert: () => void;
  isConnected: boolean;
  isChatInputDisabled: boolean;
  chatTimeoutRemainingSeconds: number;
}

interface ChatAlertPayload {
  type?: string;
  message?: string;
  durationMinutes?: number | null;
  messageId?: string;
  removedContent?: string;
  blockedWords?: string[];
}

type ChatWirePayload = Partial<ChatMessageResponse> & {
  answer?: string;
  message?: string;
};

interface PendingChatPublish {
  destination: string;
  body: string;
}

const AI_MODERATION_CHECK_MS = 7_000;
type BrowserTimerId = number;

/** Pick a random chat colour for incoming messages */
function randomColor(): string {
  return CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)];
}

function normalizeMessageType(messageType?: string, fallback?: string): string | undefined {
  const normalized = messageType?.trim();
  return normalized ? normalized.toUpperCase() : fallback;
}

function normalizeEventType(messageType?: string): string {
  return messageType?.trim().toUpperCase() ?? "";
}

function readMessageText(payload: ChatWirePayload): string {
  return payload.content ?? payload.answer ?? payload.message ?? "";
}

function readMessageId(payload: ChatWirePayload | ChatAlertPayload): string | undefined {
  const messageId = payload.messageId?.trim();
  return messageId || undefined;
}

function upsertMessage(currentMessages: ChatMessage[], incomingMessage: ChatMessage): ChatMessage[] {
  const existingIndex = currentMessages.findIndex((message) => message.id === incomingMessage.id);
  if (existingIndex !== -1) {
    const nextMessages = [...currentMessages];
    nextMessages[existingIndex] = {
      ...incomingMessage,
      color: nextMessages[existingIndex].color || incomingMessage.color,
    };
    return nextMessages.slice(-CHAT_MAX_MESSAGES);
  }

  return [...currentMessages.slice(-(CHAT_MAX_MESSAGES - 1)), incomingMessage];
}

function removeMessageById(currentMessages: ChatMessage[], messageId: string): ChatMessage[] {
  return currentMessages.filter((message) => message.id !== messageId);
}

/** Map a REST history message to the UI ChatMessage shape */
function mapHistoryMessage(msg: ChatMessageResponse, idx: number): ChatMessage {
  const rawTimestamp = msg.timestamp ?? msg.createdAt;
  const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : new Date();
  const messageType = normalizeMessageType(msg.messageType);
  return {
    id: msg.messageId || `hist-${idx}-${rawTimestamp ?? "unknown"}`,
    username: msg.senderName || (messageType === "BOT" ? "AI Bot" : "Anonymous"),
    message: readMessageText(msg),
    timestamp: parsedTimestamp,
    color: messageType === "BOT" ? "#22d3ee" : randomColor(),
    messageType,
  };
}

function mapIncomingMessage(
  payload: ChatWirePayload,
  id: string,
  fallbackMessageType?: string,
): ChatMessage {
  const rawTimestamp = payload.timestamp ?? payload.createdAt;
  const messageType = normalizeMessageType(payload.messageType, fallbackMessageType);
  return {
    id: readMessageId(payload) ?? id,
    username: payload.senderName || (messageType === "BOT" ? "AI Bot" : "Anonymous"),
    message: readMessageText(payload),
    timestamp: rawTimestamp ? new Date(rawTimestamp) : new Date(),
    color: messageType === "BOT" ? "#22d3ee" : randomColor(),
    messageType,
  };
}

function isBotUnavailableAlert(payload: ChatAlertPayload): boolean {
  const normalizedType = payload.type?.toUpperCase() ?? "";
  if (
    normalizedType.includes("BLOCK") ||
    normalizedType.includes("MODERATION") ||
    normalizedType.includes("TIMEOUT")
  ) {
    return false;
  }

  return normalizedType.includes("UNAVAILABLE") || normalizedType.includes("BOT");
}

/**
 * Real-time chat via STOMP over SockJS.
 * - On mount: fetches recent messages via REST, then connects WebSocket.
 * - Publishes to `/app/chat.sendMessage`.
 * - Subscribes to `/topic/room/{roomId}`.
 */
export function useStompChat(roomId: number | null, sessionId?: number | null): UseStompChatReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [botLoading, setBotLoading] = useState(false);
  const [botAlert, setBotAlert] = useState<string | null>(null);
  const [chatAlert, setChatAlert] = useState<string | null>(null);
  const [chatTimeoutUntil, setChatTimeoutUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isConnected, setIsConnected] = useState(
    getStompConnectionState() === "connected",
  );
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);
  const pendingChatPublishesRef = useRef<PendingChatPublish[]>([]);
  const moderationTimersRef = useRef(new Map<string, BrowserTimerId>());

  const nextId = () => {
    seqRef.current += 1;
    return `msg-${Date.now()}-${seqRef.current}`;
  };

  const clearModerationTimer = useCallback((messageId: string) => {
    const timerId = moderationTimersRef.current.get(messageId);
    if (!timerId) return;

    window.clearTimeout(timerId);
    moderationTimersRef.current.delete(messageId);
  }, []);

  const scheduleModerationCheckClear = useCallback(
    (messageId: string) => {
      clearModerationTimer(messageId);

      const timerId = window.setTimeout(() => {
        moderationTimersRef.current.delete(messageId);
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === messageId && message.moderationStatus === "checking"
              ? { ...message, moderationStatus: undefined }
              : message,
          ),
        );
      }, AI_MODERATION_CHECK_MS);

      moderationTimersRef.current.set(messageId, timerId);
    },
    [clearModerationTimer],
  );

  const clearAllModerationTimers = useCallback(() => {
    moderationTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    moderationTimersRef.current.clear();
  }, []);

  const chatTimeoutRemainingSeconds = chatTimeoutUntil
    ? Math.max(0, Math.ceil((chatTimeoutUntil - now) / 1000))
    : 0;
  const isChatInputDisabled = chatTimeoutRemainingSeconds > 0;

  // ── Fetch REST history on mount ────────────────────────────────────────
  useEffect(() => {
    clearAllModerationTimers();
    setMessages([]);
    setBotLoading(false);
    setBotAlert(null);
    setChatAlert(null);
    setChatTimeoutUntil(null);
    setNow(Date.now());

    if (!roomId) return;

    roomService
      .getRecentChat(roomId)
      .then((res) => {
        const history = res.data.map(mapHistoryMessage);
        setMessages(history.slice(-CHAT_MAX_MESSAGES));
      })
      .catch(() => {
        // History unavailable — start with empty chat
      });
  }, [clearAllModerationTimers, roomId]);

  useEffect(() => clearAllModerationTimers, [clearAllModerationTimers]);

  useEffect(() => {
    if (!chatTimeoutUntil) return;

    const tick = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= chatTimeoutUntil) {
        setChatTimeoutUntil(null);
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1_000);
    return () => window.clearInterval(intervalId);
  }, [chatTimeoutUntil]);

  // ── Shared STOMP WebSocket connection ──────────────────────────────────
  useEffect(() => {
    const unsubscribe = onStompConnectionChange((state) => {
      setIsConnected(state === "connected");
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isConnected || pendingChatPublishesRef.current.length === 0) return;

    const queuedPublishes = pendingChatPublishesRef.current;
    pendingChatPublishesRef.current = [];

    for (const queuedPublish of queuedPublishes) {
      const didPublish = publishMessage(queuedPublish.destination, queuedPublish.body);
      if (!didPublish) {
        pendingChatPublishesRef.current.push(queuedPublish);
        ensureStompConnection();
        continue;
      }
    }
  }, [isConnected]);

  useEffect(() => {
    if (!roomId) return;

    return subscribeToTopic(`/topic/room/${roomId}`, (frame) => {
      try {
        const payload = JSON.parse(frame.body) as ChatWirePayload;
        const eventType = normalizeEventType(payload.messageType);

        if (eventType === "CHAT_REMOVED") {
          const messageId = readMessageId(payload);
          if (messageId) {
            clearModerationTimer(messageId);
            setMessages((prev) => removeMessageById(prev, messageId));
          }
          return;
        }

        if (eventType && eventType !== "CHAT" && eventType !== "BOT") {
          return;
        }

        const incoming = mapIncomingMessage(payload, nextId());
        if (incoming.messageType === "BOT") {
          setBotLoading(false);
        }
        if (!incoming.message.trim()) return;
        const shouldShowModerationCheck = incoming.messageType === "CHAT";
        const messageToRender: ChatMessage = shouldShowModerationCheck
          ? { ...incoming, moderationStatus: "checking" }
          : incoming;
        setMessages((prev) => upsertMessage(prev, messageToRender));
        if (shouldShowModerationCheck) {
          scheduleModerationCheckClear(incoming.id);
        }
      } catch {
        // Malformed message — skip
      }
    });
  }, [clearModerationTimer, roomId, scheduleModerationCheckClear]);

  useEffect(() => {
    if (!roomId) return;

    const unsubscribeBotReplies = subscribeToTopic("/user/queue/bot-replies", (frame) => {
      try {
        const payload = JSON.parse(frame.body) as ChatWirePayload;
        const incoming = mapIncomingMessage(payload, nextId(), "BOT");
        setBotLoading(false);
        if (!incoming.message.trim()) return;
        setMessages((prev) => upsertMessage(prev, incoming));
      } catch {
        // Malformed private bot reply - skip
        setBotLoading(false);
        setBotAlert("AI Bot is currently unavailable.");
      }
    });

    const unsubscribeAlerts = subscribeToTopic("/user/queue/alerts", (frame) => {
      try {
        const payload = JSON.parse(frame.body) as ChatAlertPayload;
        if (isBotUnavailableAlert(payload)) {
          setBotAlert(payload.message ?? "AI Bot is currently unavailable.");
        } else {
          const messageId = readMessageId(payload);
          const alertType = normalizeEventType(payload.type);

          setChatAlert(payload.message ?? "Your chat message was blocked.");
          if (messageId) {
            clearModerationTimer(messageId);
            setMessages((prev) => removeMessageById(prev, messageId));
          }
          const timeoutMinutes = Number(payload.durationMinutes);
          if (alertType === "CHAT_TIMEOUT" && Number.isFinite(timeoutMinutes) && timeoutMinutes > 0) {
            setChatTimeoutUntil(Date.now() + timeoutMinutes * 60_000);
          }
        }
        setBotLoading(false);
      } catch {
        setChatAlert("Your chat message was blocked.");
        setBotLoading(false);
      }
    });

    return () => {
      unsubscribeBotReplies();
      unsubscribeAlerts();
    };
  }, [clearModerationTimer, roomId]);

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !roomId || isChatInputDisabled) return;

      const senderName = user?.username || "Anonymous";
      const content = newMessage.trim();
      setChatAlert(null);

      const body = JSON.stringify({
        roomId,
        sessionId: sessionId ?? undefined,
        userId: user?.userId,
        senderName,
        content,
      });

      const didPublish = publishMessage("/app/chat.sendMessage", body);

      if (!didPublish) {
        pendingChatPublishesRef.current.push({
          destination: "/app/chat.sendMessage",
          body,
        });
        ensureStompConnection();
        setNewMessage("");
        return;
      }

      setNewMessage("");
    },
    [isChatInputDisabled, newMessage, roomId, sessionId, user],
  );

  const askBot = useCallback(
    (question: string) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || !roomId || botLoading || isChatInputDisabled) return false;

      const body = JSON.stringify({
        roomId,
        sessionId: sessionId ?? undefined,
        userId: user?.userId,
        senderName: user?.username || "Anonymous",
        question: trimmedQuestion,
        content: trimmedQuestion,
        message: trimmedQuestion,
      });

      const didPublish = publishMessage("/app/chat.askBot", body);

      if (!didPublish) {
        pendingChatPublishesRef.current.push({
          destination: "/app/chat.askBot",
          body,
        });
        ensureStompConnection();
      }

      setBotAlert(null);
      setBotLoading(true);
      setNewMessage("");
      return true;
    },
    [botLoading, isChatInputDisabled, roomId, sessionId, user],
  );

  const clearBotAlert = useCallback(() => {
    setBotAlert(null);
  }, []);

  const clearChatAlert = useCallback(() => {
    setChatAlert(null);
  }, []);

  return {
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
  };
}
