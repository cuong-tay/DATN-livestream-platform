// ─── Stream – Domain Model ────────────────────────────────────────────────────

export interface Stream {
  id: string;
  title: string;
  streamer: string;
  category: string;
  viewers: number;
  thumbnail: string;
  isLive: boolean;
  tags: string[];
}
