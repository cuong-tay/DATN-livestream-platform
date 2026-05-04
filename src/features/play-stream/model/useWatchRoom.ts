import { useEffect, useRef, useState, type RefObject } from "react";
import Hls from "hls.js";
import { roomService } from "@/shared/api/room.service";
import { viewHistoryService } from "@/shared/api/viewHistory.service";

const HEARTBEAT_INTERVAL_MS = 60_000;
const VIEWER_POLL_INTERVAL_MS = 10_000;
const MANIFEST_GRACE_PERIOD_MS = 20_000;
const MAX_EARLY_MANIFEST_RETRIES = 8;
const DEBUG_STREAM = import.meta.env.VITE_DEBUG_STREAM === "true";

interface UseWatchRoomResult {
  /** Current viewer count polled from the backend */
  viewCount: number;
  /** Fatal playback error message, or null if none */
  error: string | null;
}

/**
 * All-in-one hook for the viewer side of a live room:
 *   - Attaches HLS.js (or native HLS on Safari) to the provided videoRef
 *   - Polls viewer count every 10 s
 *   - Sends a watch heartbeat every 60 s
 *   - Cleans up everything on unmount or when hlsUrl changes
 *
 * @param roomId  numeric room ID (null = skip everything)
 * @param hlsUrl  full HLS URL returned by the backend (null = show offline state)
 * @param videoRef  ref attached to the <video> element
 */
export function useWatchRoom(
  roomId: number | null,
  hlsUrl: string | null | undefined,
  videoRef: RefObject<HTMLVideoElement>,
): UseWatchRoomResult {
  const hlsRef = useRef<Hls | null>(null);
  const playbackStartAtRef = useRef(0);
  const manifestRetryCountRef = useRef(0);
  const [viewCount, setViewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const debugStream = (message: string, data?: Record<string, unknown>) => {
    if (!DEBUG_STREAM) return;
    console.info("[stream-debug][useWatchRoom] " + message, data ?? {});
  };

  // ── HLS attach / detach ───────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    // Destroy any previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    playbackStartAtRef.current = Date.now();
    manifestRetryCountRef.current = 0;
    setError(null);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
      });

      debugStream("loadSource", { hlsUrl, roomId });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_LOADING, (_event, data) => {
        debugStream("manifest_loading", { manifestUrl: data.url });
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        debugStream("manifest_parsed", { hlsUrl });
        setError(null);
        manifestRetryCountRef.current = 0;
        video.play().catch(() => {
          // Autoplay blocked by browser; user must interact first
        });
      });

      hls.on(Hls.Events.FRAG_LOADING, (_event, data) => {
        debugStream("segment_loading", {
          segmentUrl: data.frag?.url,
          sequence: data.frag?.sn,
          level: data.frag?.level,
        });
      });

      hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
        debugStream("segment_loaded", {
          segmentUrl: data.frag?.url,
          sequence: data.frag?.sn,
          sizeBytes: data.frag?.stats?.total,
          durationSec: data.frag?.duration,
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        debugStream("hls_error", {
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          statusCode: data.response?.code,
          requestUrl: data.url,
        });
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            {
              const statusCode = data.response?.code;
              const isManifestError =
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT;
              const inGracePeriod = Date.now() - playbackStartAtRef.current < MANIFEST_GRACE_PERIOD_MS;
              const canRetryEarlyManifest = isManifestError && inGracePeriod;

              if (canRetryEarlyManifest) {
                manifestRetryCountRef.current += 1;
                const retryNo = manifestRetryCountRef.current;
                setError(
                  `Đang chờ Nginx tạo HLS playlist đầu tiên… (thử ${retryNo}/${MAX_EARLY_MANIFEST_RETRIES}, status=${statusCode ?? "n/a"})`,
                );
                if (retryNo <= MAX_EARLY_MANIFEST_RETRIES) {
                  hls.startLoad();
                  break;
                }

                setError(
                  `Manifest HLS vẫn chưa sẵn sàng sau ${retryNo} lần thử đầu (status=${statusCode ?? "n/a"}). Khả năng cao backend/Nginx chưa tạo .m3u8 hoặc đường dẫn stream chưa đúng.`,
                );
                break;
              }

              setError(
                `Không tải được HLS từ server (details=${data.details}, status=${statusCode ?? "n/a"}).`,
              );
            }
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            setError("Lỗi giải mã media. Đang thử khôi phục…");
            hls.recoverMediaError();
            break;
          default:
            setError(`Không thể phát stream (type=${data.type}, details=${data.details}).`);
            hls.destroy();
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = hlsUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => {});
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl, videoRef]);

  // ── Viewer count polling ──────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    const poll = () => {
      roomService
        .getRoomById(roomId)
        .then((res) => setViewCount(res.data.viewers ?? 0))
        .catch(() => {});
    };

    poll(); // immediate
    const id = setInterval(poll, VIEWER_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [roomId]);

  // ── Heartbeat ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    viewHistoryService.sendHeartbeat(roomId).catch(() => {});
    const id = setInterval(() => {
      viewHistoryService.sendHeartbeat(roomId).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(id);
  }, [roomId]);

  return { viewCount, error };
}
