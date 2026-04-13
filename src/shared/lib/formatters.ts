// ─── Shared Formatter Utilities ──────────────────────────────────────────────
// Pure helper functions used across multiple components. Add any new
// display-formatting logic here rather than inlining it in components.

/**
 * Converts a raw viewer number into a compact display string.
 * @example formatViewerCount(12543) → "12.5K"
 */
export function formatViewerCount(viewers: number): string {
  if (viewers >= 1_000_000) {
    return `${(viewers / 1_000_000).toFixed(1)}M`;
  }
  if (viewers >= 1_000) {
    return `${(viewers / 1_000).toFixed(1)}K`;
  }
  return viewers.toString();
}

/**
 * Formats a Date object into a HH:MM chat timestamp string.
 * @example formatChatTime(new Date()) → "14:05"
 */
export function formatChatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}
