import { useState, useEffect, useRef } from "react";
import type { ChatMessage } from "@/entities/message/model/types";
import { generateMockChatMessages } from "@/shared/api/mockData";
import { BRAND_COLOR, CHAT_INTERVAL_MS, CHAT_MAX_MESSAGES } from "@/shared/lib/constants";

interface UseChatReturn {
  messages: ChatMessage[];
  newMessage: string;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  setNewMessage: (msg: string) => void;
  sendMessage: (e: React.FormEvent) => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageSeqRef = useRef(0);

  const nextMessageId = () => {
    messageSeqRef.current += 1;
    return `msg-${Date.now()}-${messageSeqRef.current}`;
  };

  // Seed initial messages then simulate live traffic
  useEffect(() => {
    const initial = generateMockChatMessages();
    const normalizedInitial = initial
      .slice(-CHAT_MAX_MESSAGES)
      .map((message) => ({
        ...message,
        id: nextMessageId(),
      }));
    setMessages(normalizedInitial);

    const interval = setInterval(() => {
      const pool = generateMockChatMessages();
      const random = pool[Math.floor(Math.random() * pool.length)];
      const nextRealtimeMessage: ChatMessage = {
        ...random,
        id: nextMessageId(),
      };
      setMessages((prev) => [
        ...prev.slice(-(CHAT_MAX_MESSAGES - 1)),
        nextRealtimeMessage,
      ]);
    }, CHAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to the latest message
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: nextMessageId(),
      username: "You",
      message: newMessage,
      timestamp: new Date(),
      color: BRAND_COLOR,
    };

    setMessages((prev) => [...prev.slice(-(CHAT_MAX_MESSAGES - 1)), userMessage]);
    setNewMessage("");
  };

  return {
    messages,
    newMessage,
    messagesContainerRef,
    setNewMessage,
    sendMessage,
  };
}
