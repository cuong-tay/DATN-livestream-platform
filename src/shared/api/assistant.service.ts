import { httpClient } from "./httpClient";

export interface AssistantContext {
  roomId?: number;
  channelId?: number;
  videoId?: number;
  sessionId?: number;
  currentTimeSeconds?: number;
}

export interface AssistantAskRequest {
  question: string;
  context?: AssistantContext;
}

export interface AssistantCitation {
  type?: string;
  id?: string | number;
  title?: string;
  url?: string;
}

export interface AssistantAskResponse {
  answer: string;
  citations?: AssistantCitation[];
  usedLiveContext?: boolean;
  requestId?: string;
}

export const assistantService = {
  ask: (data: AssistantAskRequest) =>
    httpClient.post<AssistantAskResponse>("/assistant/ask", data),
};
