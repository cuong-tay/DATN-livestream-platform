import { useCallback, useEffect, useRef, useState } from "react";
import { assistantService, type AssistantContext } from "@/shared/api/assistant.service";
import { extractApiErrorMessage } from "@/shared/api/httpClient";

export interface VideoAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  requestId?: string;
}

interface UseVideoAssistantOptions {
  roomId: number;
  sessionId: number;
  videoId: number;
  getCurrentTimeSeconds?: () => number;
}

const SOURCE_HEADING_PATTERN =
  /^\s*(?:nguồn(?:\s+tham\s+khảo)?|nguon(?:\s+tham\s+khao)?|sources?|references?|fuentes?)\s*:?\s*$/iu;
const SOURCE_HEADING_WITH_CONTENT_PATTERN =
  /^\s*(?:nguồn(?:\s+tham\s+khảo)?|nguon(?:\s+tham\s+khao)?|sources?|references?|fuentes?)\s*[:：]\s*\S+/iu;
const SOURCE_ITEM_PATTERN =
  /^\s*(?:[-*]\s*)?(?:nguồn|nguon|source|reference|fuente)\s*(?:\[\d+\]|\d+)?\s*[:.)-]\s+\S+/iu;
const NUMBERED_SOURCE_ITEM_PATTERN = /^\s*(?:[-*]\s*)?(?:\[\d+\]|\d+[\).:-])\s+\S+/u;
const URL_PATTERN = /^\s*https?:\/\//iu;

function isSourceTailLine(line: string): boolean {
  return (
    SOURCE_ITEM_PATTERN.test(line) ||
    NUMBERED_SOURCE_ITEM_PATTERN.test(line) ||
    URL_PATTERN.test(line)
  );
}

function stripAssistantSourceReferences(rawAnswer: string): string {
  const answer = rawAnswer
    .replace(/\s*\[(?:\d+(?:\s*,\s*\d+)*)\]/g, "")
    .replace(/\s*\((?:nguồn|nguon|source|reference|fuente)\s*\d+\)/giu, "")
    .trim();

  const lines = answer.split(/\r?\n/);
  const sourceSectionIndex = lines.findIndex((line, index) => {
    const isSourceHeading =
      SOURCE_HEADING_PATTERN.test(line) || SOURCE_HEADING_WITH_CONTENT_PATTERN.test(line);
    if (!isSourceHeading) return false;

    const tailLines = lines.slice(index + 1).filter((tailLine) => tailLine.trim().length > 0);
    return tailLines.length === 0 || tailLines.every(isSourceTailLine);
  });

  if (sourceSectionIndex > -1) {
    return lines.slice(0, sourceSectionIndex).join("\n").trim();
  }

  let sourceBlockStart = lines.length;
  let hasSourceItem = false;

  while (sourceBlockStart > 0) {
    const previousLine = lines[sourceBlockStart - 1];
    if (previousLine.trim().length === 0) {
      sourceBlockStart -= 1;
      continue;
    }

    if (!SOURCE_ITEM_PATTERN.test(previousLine)) {
      break;
    }

    hasSourceItem = true;
    sourceBlockStart -= 1;
  }

  if (hasSourceItem) {
    return lines.slice(0, sourceBlockStart).join("\n").trim();
  }

  return answer;
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

        const answer = stripAssistantSourceReferences(response.data.answer ?? "");
        if (!answer) {
          setError("AI did not return an answer for this video.");
          return false;
        }

        const assistantMessage: VideoAssistantMessage = {
          id: nextId("assistant"),
          role: "assistant",
          content: answer,
          createdAt: new Date(),
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
