// ─── Message – Domain Model ───────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  color: string;
  sessionId?: number | null;
  messageType?: string;
  moderationStatus?: "checking";
}
