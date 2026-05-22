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
}

interface ChatAlertPayload {
  type?: string;
  message?: string;
  durationMinutes?: number | null;
}

type ChatWirePayload = Partial<ChatMessageResponse> & {
  answer?: string;
  message?: string;
};

const LOCAL_MESSAGE_TTL_MS = 10_000;

interface PendingChatPublish {
  body: string;
  localMessage?: ChatMessage;
  localEchoAdded: boolean;
}

/** Pick a random chat colour for incoming messages */
function randomColor(): string {
  return CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)];
}

function normalizeMessageType(messageType?: string, fallback?: string): string | undefined {
  return messageType?.trim() || fallback;
}

function readMessageText(payload: ChatWirePayload): string {
  return payload.content ?? payload.answer ?? payload.message ?? "";
}

function appendMessageWithLocalEchoDedupe(
  currentMessages: ChatMessage[],
  incomingMessage: ChatMessage,
): ChatMessage[] {
  const incomingText = incomingMessage.message.trim();
  const incomingUsername = incomingMessage.username.trim();
  const incomingTime = incomingMessage.timestamp.getTime();

  const matchingLocalIndex = currentMessages.findIndex((message) => {
    if (!message.id.startsWith("local-")) return false;
    if (message.message.trim() !== incomingText) return false;
    if (message.username.trim() !== incomingUsername) return false;

    return Math.abs(incomingTime - message.timestamp.getTime()) <= LOCAL_MESSAGE_TTL_MS;
  });

  if (matchingLocalIndex === -1) {
    return [...currentMessages.slice(-(CHAT_MAX_MESSAGES - 1)), incomingMessage];
  }

  const nextMessages = [...currentMessages];
  nextMessages[matchingLocalIndex] = incomingMessage;
  return nextMessages.slice(-CHAT_MAX_MESSAGES);
}

/** Map a REST history message to the UI ChatMessage shape */
function mapHistoryMessage(msg: ChatMessageResponse, idx: number): ChatMessage {
  const rawTimestamp = msg.timestamp ?? msg.createdAt;
  const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : new Date();
  const messageType = normalizeMessageType(msg.messageType);
  return {
    id: `hist-${idx}-${rawTimestamp ?? "unknown"}`,
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
    id,
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
 * - On mount: fetches the last 50 messages via REST, then connects WebSocket.
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
  const [isConnected, setIsConnected] = useState(
    getStompConnectionState() === "connected",
  );
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);
  const pendingChatPublishesRef = useRef<PendingChatPublish[]>([]);

  const nextId = () => {
    seqRef.current += 1;
    return `msg-${Date.now()}-${seqRef.current}`;
  };

  // ── Fetch REST history on mount ────────────────────────────────────────
  useEffect(() => {
    setMessages([]);
    setBotLoading(false);
    setBotAlert(null);
    setChatAlert(null);

    if (!roomId) return;

    roomService
      .getChatHistory(roomId)
      .then((res) => {
        const history = res.data.map(mapHistoryMessage);
        setMessages(history.slice(-CHAT_MAX_MESSAGES));
      })
      .catch(() => {
        // History unavailable — start with empty chat
      });
  }, [roomId]);

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
      const didPublish = publishMessage("/app/chat.sendMessage", queuedPublish.body);
      if (!didPublish) {
        pendingChatPublishesRef.current.push(queuedPublish);
        ensureStompConnection();
        continue;
      }

      if (queuedPublish.localMessage && !queuedPublish.localEchoAdded) {
        setMessages((prev) =>
          appendMessageWithLocalEchoDedupe(prev, queuedPublish.localMessage!),
        );
      }
    }
  }, [isConnected]);

  useEffect(() => {
    if (!roomId) return;

    return subscribeToTopic(`/topic/room/${roomId}`, (frame) => {
      try {
        const payload = JSON.parse(frame.body) as ChatWirePayload;
        const incoming = mapIncomingMessage(payload, nextId());
        if (payload.messageType === "BOT") {
          setBotLoading(false);
        }
        if (!incoming.message.trim()) return;
        setMessages((prev) => appendMessageWithLocalEchoDedupe(prev, incoming));
      } catch {
        // Malformed message — skip
      }
    });
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    const unsubscribeBotReplies = subscribeToTopic("/user/queue/bot-replies", (frame) => {
      try {
        const payload = JSON.parse(frame.body) as ChatWirePayload;
        const incoming = mapIncomingMessage(payload, nextId(), "BOT");
        setBotLoading(false);
        if (!incoming.message.trim()) return;
        setMessages((prev) => appendMessageWithLocalEchoDedupe(prev, incoming));
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
          setChatAlert(payload.message ?? "Your chat message was blocked.");
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
  }, [roomId]);

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
      if (!newMessage.trim() || !roomId) return;

      const senderName = user?.username || "Anonymous";
      const content = newMessage.trim();
      const localMessage: ChatMessage | undefined = !sessionId
        ? {
            id: `local-${nextId()}`,
            username: senderName,
            message: content,
            timestamp: new Date(),
            color: CHAT_COLORS[0],
            messageType: "CHAT",
          }
        : undefined;
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
        const localEchoAdded = Boolean(localMessage);

        if (localMessage) {
          setMessages((prev) => appendMessageWithLocalEchoDedupe(prev, localMessage));
        }

        pendingChatPublishesRef.current.push({
          body,
          localMessage,
          localEchoAdded,
        });
        ensureStompConnection();
        setNewMessage("");
        return;
      }

      if (localMessage) {
        setMessages((prev) => appendMessageWithLocalEchoDedupe(prev, localMessage));
      }

      setNewMessage("");
    },
    [newMessage, roomId, sessionId, user],
  );

  const askBot = useCallback(
    (question: string) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || !roomId || !isConnected || botLoading) return false;

      const didPublish = publishMessage(
        "/app/chat.askBot",
        JSON.stringify({
          roomId,
          sessionId: sessionId ?? undefined,
          userId: user?.userId,
          senderName: user?.username || "Anonymous",
          question: trimmedQuestion,
          content: trimmedQuestion,
          message: trimmedQuestion,
        }),
      );

      if (!didPublish) {
        return false;
      }

      setBotAlert(null);
      setBotLoading(true);
      setNewMessage("");
      return true;
    },
    [botLoading, roomId, sessionId, user, isConnected],
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
  };
}
