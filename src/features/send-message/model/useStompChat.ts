import { useState, useEffect, useRef, useCallback } from "react";
import { Client } from "@stomp/stompjs";
// @ts-ignore — types will be installed via npm
import SockJS from "sockjs-client";

import type { ChatMessage } from "@/entities/message/model/types";
import { roomService, type ChatMessageResponse } from "@/shared/api/room.service";
import { CHAT_COLORS, CHAT_MAX_MESSAGES, BRAND_COLOR } from "@/shared/lib/constants";
import { useAuth } from "@/app/providers/AuthContext";

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
  return {
    id: `hist-${idx}-${msg.timestamp}`,
    username: msg.senderName,
    message: msg.content,
    timestamp: new Date(msg.timestamp),
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
  const [isConnected, setIsConnected] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<Client | null>(null);
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

  // ── STOMP WebSocket connection ─────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    const wsUrl =
      (import.meta.env.VITE_WS_URL || "/api/v1/ws");

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      connectHeaders: {
        Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
      },
      onConnect: () => {
        setIsConnected(true);

        client.subscribe(`/topic/room/${roomId}`, (frame) => {
          try {
            const payload = JSON.parse(frame.body) as ChatMessageResponse;
            const incoming: ChatMessage = {
              id: nextId(),
              username: payload.senderName,
              message: payload.content,
              timestamp: new Date(payload.timestamp),
              color: randomColor(),
            };
            setMessages((prev) => [...prev.slice(-(CHAT_MAX_MESSAGES - 1)), incoming]);
          } catch {
            // Malformed message — skip
          }
        });
      },
      onDisconnect: () => setIsConnected(false),
      onStompError: () => setIsConnected(false),
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
      setIsConnected(false);
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
      if (!newMessage.trim() || !roomId || !clientRef.current?.connected) return;

      const senderName = user?.username || "Anonymous";

      clientRef.current.publish({
        destination: "/app/chat.sendMessage",
        body: JSON.stringify({
          roomId,
          senderName,
          content: newMessage.trim(),
        }),
      });

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
    [newMessage, roomId, user],
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
