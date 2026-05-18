import { useCallback, useEffect, useRef, useState } from "react";
import {
  assistantService,
  type AssistantCitation,
  type AssistantContext,
} from "@/shared/api/assistant.service";
import { extractApiErrorMessage } from "@/shared/api/httpClient";

export interface VideoAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  citations?: AssistantCitation[];
  requestId?: string;
}

interface UseVideoAssistantOptions {
  roomId: number;
  sessionId: number;
  videoId: number;
  getCurrentTimeSeconds?: () => number;
}

export function useVideoAssistant({
  roomId,
  sessionId,
  videoId,
  getCurrentTimeSeconds,
}: UseVideoAssistantOptions) {
  const [messages, setMessages] = useState<VideoAssistantMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const nextId = useCallback((prefix: string) => {
    seqRef.current += 1;
    return `${prefix}-${Date.now()}-${seqRef.current}`;
  }, []);

  useEffect(() => {
    setMessages([]);
    setQuestion("");
    setIsAsking(false);
    setError(null);
    seqRef.current = 0;
  }, [sessionId]);

  const reset = useCallback(() => {
    setMessages([]);
    setQuestion("");
    setError(null);
  }, []);

  const ask = useCallback(
    async (rawQuestion?: string) => {
      const trimmedQuestion = (rawQuestion ?? question).trim();
      if (!trimmedQuestion || isAsking) return false;

      const context: AssistantContext = {
        roomId,
        videoId,
        sessionId,
      };

      const currentTimeSeconds = getCurrentTimeSeconds?.();
      if (typeof currentTimeSeconds === "number" && Number.isFinite(currentTimeSeconds)) {
        context.currentTimeSeconds = Math.max(0, Math.floor(currentTimeSeconds));
      }

      const userMessage: VideoAssistantMessage = {
        id: nextId("user"),
        role: "user",
        content: trimmedQuestion,
        createdAt: new Date(),
      };

      setMessages((current) => [...current, userMessage]);
      setQuestion("");
      setError(null);
      setIsAsking(true);

      try {
        const response = await assistantService.ask({
          question: trimmedQuestion,
          context,
        });

        const answer = response.data.answer?.trim();
        if (!answer) {
          setError("AI did not return an answer for this video.");
          return false;
        }

        const assistantMessage: VideoAssistantMessage = {
          id: nextId("assistant"),
          role: "assistant",
          content: answer,
          createdAt: new Date(),
          citations: response.data.citations,
          requestId: response.data.requestId,
        };

        setMessages((current) => [...current, assistantMessage]);
        return true;
      } catch (askError) {
        setError(extractApiErrorMessage(askError));
        return false;
      } finally {
        setIsAsking(false);
      }
    },
    [getCurrentTimeSeconds, isAsking, nextId, question, roomId, sessionId, videoId],
  );

  return {
    messages,
    question,
    setQuestion,
    isAsking,
    error,
    clearError: () => setError(null),
    ask,
    reset,
  };
}
