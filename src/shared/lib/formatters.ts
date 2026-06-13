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
 * Formats a Date object into a HH:MM chat timestamp string in the user's local timezone.
 * @example formatChatTime(new Date()) → "14:05"
 */
export function formatChatTime(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * Parses a raw timestamp string (from the backend) into a Date object.
 * Handles ISO strings with or without timezone offset — strings without
 * a timezone designator are treated as UTC (Java/Spring Boot convention).
 */
export function parseChatTimestamp(raw: string | undefined | null): Date {
  if (!raw) return new Date();

  const trimmed = raw.trim();
  const parsed = new Date(trimmed);

  if (!Number.isNaN(parsed.getTime())) {
    const hasTimezoneInfo = /Z|[+-]\d{2}:\d{2}$/.test(trimmed);
    if (!hasTimezoneInfo && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(trimmed)) {
      return new Date(trimmed + "Z");
    }
    return parsed;
  }

  return new Date();
}
