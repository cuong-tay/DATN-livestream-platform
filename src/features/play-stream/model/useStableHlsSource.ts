import { useEffect, useState } from "react";

export interface StableHlsSource {
  sessionId: number;
  hlsUrl: string;
  normalizedUrl: string;
  isStale: boolean;
}

export function normalizeHlsUrl(hlsUrl?: string | null): string | null {
  const trimmedUrl = hlsUrl?.trim();
  if (!trimmedUrl) return null;

  try {
    const baseUrl =
      typeof window !== "undefined" ? window.location.href : "https://local.invalid";
    const parsedUrl = new URL(trimmedUrl, baseUrl);
    return `${parsedUrl.origin}${parsedUrl.pathname}`;
  } catch {
    const [pathWithoutQuery] = trimmedUrl.split(/[?#]/);
    return pathWithoutQuery || null;
  }
}

export function useStableHlsSource(
  sessionId: number | null | undefined,
  hlsUrl: string | null | undefined,
  isLive: boolean,
): StableHlsSource | null {
  const [source, setSource] = useState<StableHlsSource | null>(null);

  useEffect(() => {
    if (!isLive || !sessionId) {
      setSource(null);
      return;
    }

    const normalizedUrl = normalizeHlsUrl(hlsUrl);
    if (!normalizedUrl || !hlsUrl) {
      setSource((previousSource) =>
        previousSource?.sessionId === sessionId
          ? { ...previousSource, isStale: true }
          : null,
      );
      return;
    }

    setSource((previousSource) => {
      if (
        previousSource?.sessionId === sessionId &&
        previousSource.normalizedUrl === normalizedUrl
      ) {
        return {
          ...previousSource,
          isStale: false,
        };
      }

      return {
        sessionId,
        hlsUrl,
        normalizedUrl,
        isStale: false,
      };
    });
  }, [hlsUrl, isLive, sessionId]);

  return source;
}
