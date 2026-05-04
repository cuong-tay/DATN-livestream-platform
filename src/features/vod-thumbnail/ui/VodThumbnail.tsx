import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import Hls from "hls.js";

const CAPTURE_TIMEOUT_MS = 12_000;
const TARGET_WIDTH = 720;
const QUALITY = 0.9;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const CACHE_MAX_ITEMS = 48;
const STORAGE_KEY = "vod-thumbnail-cache:v1";

interface PersistedThumbnailEntry {
  vodUrl: string;
  dataUrl: string;
  updatedAt: number;
}

const memoryCache = new Map<string, string>();
let persistedEntries: PersistedThumbnailEntry[] = [];
let initialized = false;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isValidEntry(value: unknown): value is PersistedThumbnailEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedThumbnailEntry>;

  return (
    typeof candidate.vodUrl === "string" &&
    candidate.vodUrl.length > 0 &&
    typeof candidate.dataUrl === "string" &&
    candidate.dataUrl.startsWith("data:image/") &&
    typeof candidate.updatedAt === "number" &&
    Number.isFinite(candidate.updatedAt)
  );
}

function saveCache() {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedEntries));
  } catch {
    persistedEntries = persistedEntries.slice(0, Math.max(0, persistedEntries.length - 1));
  }
}

function initializeCache() {
  if (initialized || !canUseStorage()) return;
  initialized = true;

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return;

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return;

    const now = Date.now();
    persistedEntries = parsed
      .filter(isValidEntry)
      .filter((entry) => now - entry.updatedAt <= CACHE_TTL_MS)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, CACHE_MAX_ITEMS);

    persistedEntries.forEach((entry) => memoryCache.set(entry.vodUrl, entry.dataUrl));
  } catch {
    persistedEntries = [];
  }
}

function getCachedThumbnail(vodUrl: string): string | null {
  const cached = memoryCache.get(vodUrl);
  if (cached) return cached;

  initializeCache();
  const persisted = persistedEntries.find((entry) => entry.vodUrl === vodUrl);
  if (!persisted) return null;

  memoryCache.set(vodUrl, persisted.dataUrl);
  return persisted.dataUrl;
}

function cacheThumbnail(vodUrl: string, dataUrl: string) {
  memoryCache.set(vodUrl, dataUrl);
  initializeCache();

  persistedEntries = persistedEntries.filter((entry) => entry.vodUrl !== vodUrl);
  persistedEntries.unshift({ vodUrl, dataUrl, updatedAt: Date.now() });
  persistedEntries = persistedEntries.slice(0, CACHE_MAX_ITEMS);
  saveCache();
}

async function captureThumbnail(vodUrl: string): Promise<string | null> {
  const cached = getCachedThumbnail(vodUrl);
  if (cached) return cached;

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let hls: Hls | null = null;
    let settled = false;

    const finalize = (thumbnailUrl: string | null) => {
      if (settled) return;
      settled = true;

      window.clearTimeout(timeoutId);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleError);

      if (hls) hls.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();

      if (thumbnailUrl) cacheThumbnail(vodUrl, thumbnailUrl);
      resolve(thumbnailUrl);
    };

    const captureFrame = () => {
      if (!video.videoWidth || !video.videoHeight) {
        finalize(null);
        return;
      }

      try {
        const scale = Math.min(1, TARGET_WIDTH / video.videoWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

        const context = canvas.getContext("2d");
        if (!context) {
          finalize(null);
          return;
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finalize(canvas.toDataURL("image/jpeg", QUALITY));
      } catch {
        finalize(null);
      }
    };

    const handleLoadedData = () => captureFrame();
    const handleError = () => finalize(null);
    const timeoutId = window.setTimeout(() => finalize(null), CAPTURE_TIMEOUT_MS);

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleError);

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) finalize(null);
      });
      hls.loadSource(vodUrl);
      hls.attachMedia(video);
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = vodUrl;
      return;
    }

    finalize(null);
  });
}

interface VodThumbnailProps {
  vodUrl: string | null;
  title: string;
  className?: string;
}

export function VodThumbnail({ vodUrl, title, className = "" }: VodThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() =>
    vodUrl ? getCachedThumbnail(vodUrl) : null,
  );

  useEffect(() => {
    if (!vodUrl) {
      setThumbnailUrl(null);
      return;
    }

    const cached = getCachedThumbnail(vodUrl);
    if (cached) {
      setThumbnailUrl(cached);
      return;
    }

    let cancelled = false;
    captureThumbnail(vodUrl).then((capturedThumbnail) => {
      if (!cancelled) setThumbnailUrl(capturedThumbnail);
    });

    return () => {
      cancelled = true;
    };
  }, [vodUrl]);

  return (
    <div className={`relative overflow-hidden bg-[#171717] ${className}`}>
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-700 via-zinc-900 to-black">
          <PlayCircle className="h-10 w-10 text-white/70" />
        </div>
      )}
    </div>
  );
}
