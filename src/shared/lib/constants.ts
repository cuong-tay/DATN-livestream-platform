// ─── App-wide Constants ───────────────────────────────────────────────────────
// Store magic numbers, colour tokens, or configuration values that are used in
// more than one place. Avoids scattered hard-coded strings / numbers.

/** Twitch-style brand purple used throughout the UI */
export const BRAND_COLOR = "#9147ff";

/** Chat colours assigned round-robin to incoming usernames */
export const CHAT_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B739",
  "#52B788",
] as const;

/** How often (ms) the simulated chat sends a new message */
export const CHAT_INTERVAL_MS = 3_000;

/** Maximum messages kept in the chat window at once */
export const CHAT_MAX_MESSAGES = 20;
