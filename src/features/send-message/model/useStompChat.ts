import { useState, useEffect, useRef, useCallback } from "react";

import type { ChatMessage } from "@/entities/message/model/types";
import { roomService, type ChatMessageResponse } from "@/shared/api/room.service";
import { CHAT_COLORS, CHAT_MAX_MESSAGES } from "@/shared/lib/constants";
import { parseChatTimestamp } from "@/shared/lib/formatters";
import { useAuth } from "@/app/providers/AuthContext";
import {
  ensureStompConnection,
  getStompConnectionState,
  onStompConnectionChange,
  publishMessage,
  subscribeToTopic,
} from "@/shared/lib/stompClient";
import { chatDebug, chatDebugError, chatDebugWarn } from "@/shared/lib/chatDebug";

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
  isChatClosed: boolean;
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

function previewText(value?: string, maxLength = 120): string {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength)}...`;
}

function summarizeChatPayload(payload: ChatWirePayload): Record<string, unknown> {
  return {
    roomId: payload.roomId,
    sessionId: payload.sessionId,
    messageId: payload.messageId,
    messageType: payload.messageType,
    senderName: payload.senderName,
    contentPreview: previewText(readMessageText(payload)),
    blockedWords: payload.blockedWords,
  };
}

function summarizeChatAlert(payload: ChatAlertPayload): Record<string, unknown> {
  return {
    type: payload.type,
    messageId: payload.messageId,
    durationMinutes: payload.durationMinutes,
    removedContentPreview: previewText(payload.removedContent),
    blockedWords: payload.blockedWords,
    messagePreview: previewText(payload.message),
  };
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

function normalizeSessionId(sessionId: unknown): number | null {
  if (sessionId == null) return null;

  const numericSessionId =
    typeof sessionId === "number" ? sessionId : Number(String(sessionId));

  return Number.isFinite(numericSessionId) ? numericSessionId : null;
}

function isPayloadForActiveSession(
  payload: Pick<ChatWirePayload, "sessionId">,
  activeSessionId: number | null,
): boolean {
  if (activeSessionId == null) return false;

  const payloadSessionId = normalizeSessionId(payload.sessionId);
  return payloadSessionId == null || payloadSessionId === activeSessionId;
}

/** Map a REST history message to the UI ChatMessage shape */
function mapHistoryMessage(msg: ChatMessageResponse, idx: number): ChatMessage {
  const rawTimestamp = msg.timestamp ?? msg.createdAt;
  const messageType = normalizeMessageType(msg.messageType);
  return {
    id: msg.messageId || `hist-${idx}-${rawTimestamp ?? "unknown"}`,
    username: msg.senderName || (messageType === "BOT" ? "AI Bot" : "Anonymous"),
    message: readMessageText(msg),
    timestamp: parseChatTimestamp(rawTimestamp),
    color: messageType === "BOT" ? "#22d3ee" : randomColor(),
    sessionId: normalizeSessionId(msg.sessionId),
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
    timestamp: parseChatTimestamp(rawTimestamp),
    color: messageType === "BOT" ? "#22d3ee" : randomColor(),
    sessionId: normalizeSessionId(payload.sessionId),
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
 * Source of truth:
 * - History: GET `/sessions/{sessionId}/chats` for the active live session.
 * - Realtime: `/topic/room/{roomId}` with backend-created `messageId`.
 * - Send: `/app/chat.sendMessage` with `{ roomId, sessionId, senderName, content }`.
 */
export function useStompChat(roomId: number | null, sessionId?: number | null): UseStompChatReturn {
  const { user } = useAuth();
  const activeSessionId = sessionId ?? null;
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
  const isChatClosed = activeSessionId == null;
  const isChatInputDisabled = isChatClosed || chatTimeoutRemainingSeconds > 0;

  // ── Fetch REST history on mount ────────────────────────────────────────
  useEffect(() => {
    clearAllModerationTimers();
    pendingChatPublishesRef.current = [];
    setMessages([]);
    setBotLoading(false);
    setBotAlert(null);
    setChatAlert(null);
    setChatTimeoutUntil(null);
    setNow(Date.now());

    if (!roomId || !activeSessionId) {
      return;
    }

    roomService
      .getSessionChats(activeSessionId)
      .then((res) => {
        const history = res.data.map(mapHistoryMessage);
        chatDebug("useStompChat", "loaded session chat", {
          roomId,
          sessionId: activeSessionId,
          count: history.length,
        });
        setMessages(history.slice(-CHAT_MAX_MESSAGES));
      })
      .catch((error) => {
        chatDebugWarn("useStompChat", "failed to load session chat", {
          roomId,
          sessionId: activeSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        // History unavailable — start with empty chat
      });
  }, [activeSessionId, clearAllModerationTimers, roomId]);

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
      chatDebug("useStompChat", "connection state changed", { state });
      setIsConnected(state === "connected");
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isConnected || pendingChatPublishesRef.current.length === 0) return;

    const queuedPublishes = pendingChatPublishesRef.current;
    pendingChatPublishesRef.current = [];

    for (const queuedPublish of queuedPublishes) {
      chatDebug("useStompChat", "flush queued publish", {
        destination: queuedPublish.destination,
      });
      const didPublish = publishMessage(queuedPublish.destination, queuedPublish.body);
      if (!didPublish) {
        chatDebugWarn("useStompChat", "requeue publish after failed flush", {
          destination: queuedPublish.destination,
        });
        pendingChatPublishesRef.current.push(queuedPublish);
        ensureStompConnection();
        continue;
      }
    }
  }, [isConnected]);

  useEffect(() => {
    if (!roomId || !activeSessionId) return;

    return subscribeToTopic(`/topic/room/${roomId}`, (frame) => {
      try {
        const payload = JSON.parse(frame.body) as ChatWirePayload;
        const eventType = normalizeEventType(payload.messageType);
        chatDebug("useStompChat", "room event received", summarizeChatPayload(payload));

        if (payload.roomId != null && Number(payload.roomId) !== roomId) {
          chatDebug("useStompChat", "ignored room event for another room", summarizeChatPayload(payload));
          return;
        }

        if (!isPayloadForActiveSession(payload, activeSessionId)) {
          chatDebug("useStompChat", "ignored room event for another session", summarizeChatPayload(payload));
          return;
        }

        if (eventType === "CHAT_REMOVED") {
          const messageId = readMessageId(payload);
          if (messageId) {
            clearModerationTimer(messageId);
            setMessages((prev) => removeMessageById(prev, messageId));
            chatDebug("useStompChat", "removed chat message from room event", {
              roomId,
              sessionId: activeSessionId,
              messageId,
              blockedWords: payload.blockedWords,
            });
          } else {
            chatDebugWarn("useStompChat", "CHAT_REMOVED without messageId", summarizeChatPayload(payload));
          }
          return;
        }

        if (eventType && eventType !== "CHAT" && eventType !== "BOT") {
          chatDebug("useStompChat", "ignored non-chat room event", summarizeChatPayload(payload));
          return;
        }

        if (eventType === "CHAT" && !readMessageId(payload)) {
          chatDebugWarn("useStompChat", "CHAT event without messageId", summarizeChatPayload(payload));
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
      } catch (error) {
        chatDebugError("useStompChat", "malformed room event", {
          roomId,
          body: frame.body,
          error: error instanceof Error ? error.message : String(error),
        });
        // Malformed message — skip
      }
    });
  }, [activeSessionId, clearModerationTimer, roomId, scheduleModerationCheckClear]);

  useEffect(() => {
    if (!roomId || !activeSessionId) return;

    const unsubscribeBotReplies = subscribeToTopic("/user/queue/bot-replies", (frame) => {
      try {
        const payload = JSON.parse(frame.body) as ChatWirePayload;
        chatDebug("useStompChat", "bot reply received", summarizeChatPayload(payload));
        if (!isPayloadForActiveSession(payload, activeSessionId)) {
          chatDebug("useStompChat", "ignored bot reply for another session", summarizeChatPayload(payload));
          return;
        }
        const incoming = mapIncomingMessage(payload, nextId(), "BOT");
        setBotLoading(false);
        if (!incoming.message.trim()) return;
        setMessages((prev) => upsertMessage(prev, incoming));
      } catch (error) {
        chatDebugError("useStompChat", "malformed bot reply", {
          body: frame.body,
          error: error instanceof Error ? error.message : String(error),
        });
        // Malformed private bot reply - skip
        setBotLoading(false);
        setBotAlert("AI Bot is currently unavailable.");
      }
    });

    const unsubscribeAlerts = subscribeToTopic("/user/queue/alerts", (frame) => {
      try {
        const payload = JSON.parse(frame.body) as ChatAlertPayload;
        chatDebug("useStompChat", "private alert received", summarizeChatAlert(payload));
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
      } catch (error) {
        chatDebugError("useStompChat", "malformed private alert", {
          body: frame.body,
          error: error instanceof Error ? error.message : String(error),
        });
        setChatAlert("Your chat message was blocked.");
        setBotLoading(false);
      }
    });

    return () => {
      unsubscribeBotReplies();
      unsubscribeAlerts();
    };
  }, [activeSessionId, clearModerationTimer, roomId]);

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
      if (!newMessage.trim() || !roomId || !activeSessionId || isChatInputDisabled) return;

      const senderName = user?.username || "Anonymous";
      const content = newMessage.trim();
      setChatAlert(null);

      const body = JSON.stringify({
        roomId,
        sessionId: activeSessionId,
        senderName,
        content,
      });

      chatDebug("useStompChat", "send chat message", {
        roomId,
        sessionId: activeSessionId,
        senderName,
        contentPreview: previewText(content),
      });
      const didPublish = publishMessage("/app/chat.sendMessage", body);

      if (!didPublish) {
        chatDebugWarn("useStompChat", "chat publish queued", {
          roomId,
          destination: "/app/chat.sendMessage",
        });
        pendingChatPublishesRef.current.push({
          destination: "/app/chat.sendMessage",
          body,
        });
        ensureStompConnection();
        setNewMessage("");
        return;
      }

      chatDebug("useStompChat", "chat publish accepted by STOMP client", {
        roomId,
        destination: "/app/chat.sendMessage",
      });
      setNewMessage("");
    },
    [activeSessionId, isChatInputDisabled, newMessage, roomId, user],
  );

  const askBot = useCallback(
    (question: string) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || !roomId || !activeSessionId || botLoading || isChatInputDisabled) return false;

      const body = JSON.stringify({
        roomId,
        sessionId: activeSessionId,
        userId: user?.userId,
        senderName: user?.username || "Anonymous",
        question: trimmedQuestion,
        content: trimmedQuestion,
        message: trimmedQuestion,
      });

      chatDebug("useStompChat", "send bot question", {
        roomId,
        sessionId: activeSessionId,
        senderName: user?.username || "Anonymous",
        questionPreview: previewText(trimmedQuestion),
      });
      const didPublish = publishMessage("/app/chat.askBot", body);

      if (!didPublish) {
        chatDebugWarn("useStompChat", "bot question publish queued", {
          roomId,
          destination: "/app/chat.askBot",
        });
        pendingChatPublishesRef.current.push({
          destination: "/app/chat.askBot",
          body,
        });
        ensureStompConnection();
      } else {
        chatDebug("useStompChat", "bot question publish accepted by STOMP client", {
          roomId,
          destination: "/app/chat.askBot",
        });
      }

      setBotAlert(null);
      setBotLoading(true);
      setNewMessage("");
      return true;
    },
    [activeSessionId, botLoading, isChatInputDisabled, roomId, user],
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
    isChatClosed,
    isChatInputDisabled,
    chatTimeoutRemainingSeconds,
  };
}
