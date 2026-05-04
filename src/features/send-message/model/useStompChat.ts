import { useState, useEffect, useRef, useCallback } from "react";

import type { ChatMessage } from "@/entities/message/model/types";
import { roomService, type ChatMessageResponse } from "@/shared/api/room.service";
import { CHAT_COLORS, CHAT_MAX_MESSAGES, BRAND_COLOR } from "@/shared/lib/constants";
import { useAuth } from "@/app/providers/AuthContext";
import {
  getStompConnectionState,
  onStompConnectionChange,
  publishMessage,
  subscribeToTopic,
} from "@/shared/lib/stompClient";

interface UseStompChatReturn {
  messages: ChatMessage[];
  newMessage: string;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  setNewMessage: (msg: string) => void;
  sendMessage: (e: React.FormEvent) => void;
  isConnected: boolean;
}

/** Pick a random chat colour for incoming messages */
function randomColor(): string {
  return CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)];
}

/** Map a REST history message to the UI ChatMessage shape */
function mapHistoryMessage(msg: ChatMessageResponse, idx: number): ChatMessage {
  const rawTimestamp = msg.timestamp ?? msg.createdAt;
  const parsedTimestamp = rawTimestamp ? new Date(rawTimestamp) : new Date();
  return {
    id: `hist-${idx}-${rawTimestamp ?? "unknown"}`,
    username: msg.senderName,
    message: msg.content,
    timestamp: parsedTimestamp,
    color: randomColor(),
  };
}

/**
 * Real-time chat via STOMP over SockJS.
 * - On mount: fetches the last 50 messages via REST, then connects WebSocket.
 * - Publishes to `/app/chat.sendMessage`.
 * - Subscribes to `/topic/room/{roomId}`.
 */
export function useStompChat(roomId: number | null): UseStompChatReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isConnected, setIsConnected] = useState(
    getStompConnectionState() === "connected",
  );
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  const nextId = () => {
    seqRef.current += 1;
    return `msg-${Date.now()}-${seqRef.current}`;
  };

  // ── Fetch REST history on mount ────────────────────────────────────────
  useEffect(() => {
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
    if (!roomId) return;

    return subscribeToTopic(`/topic/room/${roomId}`, (frame) => {
      try {
        const payload = JSON.parse(frame.body) as ChatMessageResponse;
        const rawTimestamp = payload.timestamp ?? payload.createdAt;
        const incoming: ChatMessage = {
          id: nextId(),
          username: payload.senderName,
          message: payload.content,
          timestamp: rawTimestamp ? new Date(rawTimestamp) : new Date(),
          color: randomColor(),
        };
        setMessages((prev) => [...prev.slice(-(CHAT_MAX_MESSAGES - 1)), incoming]);
      } catch {
        // Malformed message — skip
      }
    });
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
      if (!newMessage.trim() || !roomId || !isConnected) return;

      const senderName = user?.username || "Anonymous";

      const didPublish = publishMessage(
        "/app/chat.sendMessage",
        JSON.stringify({
          roomId,
          senderName,
          content: newMessage.trim(),
        }),
      );

      if (!didPublish) {
        return;
      }

      // Optimistic UI — show the message immediately
      const optimistic: ChatMessage = {
        id: nextId(),
        username: senderName,
        message: newMessage.trim(),
        timestamp: new Date(),
        color: BRAND_COLOR,
      };
      setMessages((prev) => [...prev.slice(-(CHAT_MAX_MESSAGES - 1)), optimistic]);
      setNewMessage("");
    },
    [newMessage, roomId, user, isConnected],
  );

  return {
    messages,
    newMessage,
    messagesContainerRef,
    setNewMessage,
    sendMessage,
    isConnected,
  };
}
