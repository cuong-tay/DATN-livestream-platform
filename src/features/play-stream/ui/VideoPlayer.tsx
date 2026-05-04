import { useState, useRef, useEffect, type RefObject } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  Eye,
  AlertCircle,
  Radio,
  Check,
} from "lucide-react";
import { formatViewerCount } from "@/shared/lib/formatters";
import Hls from "hls.js";

const MANIFEST_GRACE_PERIOD_MS = 20_000;
const MAX_EARLY_MANIFEST_RETRIES = 8;
const DEBUG_STREAM = import.meta.env.VITE_DEBUG_STREAM === "true";
const PLAYBACK_RATES = [0.5, 1, 2, 4] as const;

interface QualityOption {
  label: string;
  levelIndex: number;
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "00:00";
  }

  const seconds = Math.floor(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

function buildQualityLabel(level: { height?: number; width?: number; bitrate?: number }): string {
  if (level.height) {
    return `${level.height}p`;
  }
  if (level.width) {
    return `${level.width}w`;
  }
  if (level.bitrate) {
    return `${Math.round(level.bitrate / 1000)} kbps`;
  }
  return "Mặc định";
}

interface VideoPlayerProps {
  /** HLS URL (e.g. http://…/hls/sk_abc123.m3u8) */
  hlsUrl?: string | null;
  /** Fallback thumbnail when stream is not live */
  thumbnail?: string;
  /** Realtime viewer count to display in the badge */
  viewCount?: number;
  /** Whether the room is currently live */
  isLive?: boolean;
  /**
   * Optional external ref to the <video> element.
   * When provided, HLS setup is skipped here — the caller’s hook (useWatchRoom) manages it.
   */
  videoRef?: RefObject<HTMLVideoElement>;
  /** Fatal playback error message supplied by the caller’s hook */
  hlsErrorExternal?: string | null;
  /** Optional callback to sync currentTime */
  onTimeUpdate?: (time: number) => void;
}

export function VideoPlayer({
  hlsUrl,
  thumbnail,
  viewCount = 0,
  isLive = false,
  videoRef: externalVideoRef,
  hlsErrorExternal,
  onTimeUpdate,
}: VideoPlayerProps) {
  // When an external ref is passed the hook owns HLS; otherwise maintain the
  // internal fallback so the component still works standalone (e.g. in dashboard
  // preview or VOD player without a hook).
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef ?? internalVideoRef;
  const hlsRef = useRef<Hls | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const playbackStartAtRef = useRef(0);
  const manifestRetryCountRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(70);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([
    { label: "Auto", levelIndex: -1 },
  ]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [generatedPoster, setGeneratedPoster] = useState<string | null>(null);
  const [hlsErrorInternal, setHlsErrorInternal] = useState<string | null>(null);
  const debugStream = (message: string, data?: Record<string, unknown>) => {
    if (!DEBUG_STREAM) return;
    console.info("[stream-debug][VideoPlayer] " + message, data ?? {});
  };

  // Use external error (from hook) when present, otherwise fall back to internal
  const hlsError = hlsErrorExternal ?? hlsErrorInternal;
  const canSeek = !isLive && duration > 0;
  const effectivePoster = thumbnail ?? generatedPoster ?? undefined;

  // ── Close settings popover on outside click ─────────────────────────
  useEffect(() => {
    if (!showSettings) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!settingsRef.current) return;
      if (!settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [showSettings]);

  // ── Sync playback speed ─────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate, videoRef]);

  // ── Track play state and timeline ───────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncVideoState = () => {
      setCurrentTime(video.currentTime || 0);
      onTimeUpdate?.(video.currentTime || 0);
      setDuration(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
      setIsPlaying(!video.paused && !video.ended);
    };

    syncVideoState();

    video.addEventListener("timeupdate", syncVideoState);
    video.addEventListener("loadedmetadata", syncVideoState);
    video.addEventListener("durationchange", syncVideoState);
    video.addEventListener("play", syncVideoState);
    video.addEventListener("pause", syncVideoState);
    video.addEventListener("ended", syncVideoState);

    return () => {
      video.removeEventListener("timeupdate", syncVideoState);
      video.removeEventListener("loadedmetadata", syncVideoState);
      video.removeEventListener("durationchange", syncVideoState);
      video.removeEventListener("play", syncVideoState);
      video.removeEventListener("pause", syncVideoState);
      video.removeEventListener("ended", syncVideoState);
    };
  }, [videoRef, hlsUrl]);

  // ── Generate fallback poster from VOD first frames ──────────────────
  useEffect(() => {
    setGeneratedPoster(null);
  }, [hlsUrl, thumbnail]);

  useEffect(() => {
    if (thumbnail || isLive || !hlsUrl) return;
    const video = videoRef.current;
    if (!video) return;

    const captureFrame = () => {
      if (!video.videoWidth || !video.videoHeight) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameDataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setGeneratedPoster(frameDataUrl);
      } catch {
        // Some remote streams disallow canvas extraction due to CORS.
      }
    };

    const handleLoadedData = () => {
      captureFrame();
    };

    video.addEventListener("loadeddata", handleLoadedData, { once: true });

    return () => {
      video.removeEventListener("loadeddata", handleLoadedData);
    };
  }, [thumbnail, isLive, hlsUrl, videoRef]);

  // ── Attach HLS.js only when no external ref is provided ──────────────
  useEffect(() => {
    // If the caller supplied an external ref they manage HLS via useWatchRoom
    if (externalVideoRef) return;

    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    playbackStartAtRef.current = Date.now();
    manifestRetryCountRef.current = 0;

    setHlsErrorInternal(null);
    setQualityOptions([{ label: "Auto", levelIndex: -1 }]);
    setSelectedQuality(-1);
    setShowSettings(false);

    let removeNativeMetadataListener: (() => void) | null = null;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      debugStream("loadSource", { hlsUrl });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_LOADING, (_event, data) => {
        debugStream("manifest_loading", { manifestUrl: data.url });
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        debugStream("manifest_parsed", { hlsUrl });
        setHlsErrorInternal(null);
        manifestRetryCountRef.current = 0;

        const levels = hls.levels
          .map((level, index) => ({
            index,
            height: level.height,
            bitrate: level.bitrate,
            label: buildQualityLabel(level),
          }))
          .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);

        setQualityOptions([
          { label: "Auto", levelIndex: -1 },
          ...levels.map((level) => ({ label: level.label, levelIndex: level.index })),
        ]);

        video.play().catch(() => {
          // Autoplay blocked — user needs to click play
          setIsPlaying(false);
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
        if (data.fatal) {
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
                  setHlsErrorInternal(
                    `Đang chờ Nginx tạo HLS playlist đầu tiên… (thử ${retryNo}/${MAX_EARLY_MANIFEST_RETRIES}, status=${statusCode ?? "n/a"})`,
                  );
                  if (retryNo <= MAX_EARLY_MANIFEST_RETRIES) {
                    hls.startLoad();
                    break;
                  }

                  setHlsErrorInternal(
                    `Manifest HLS chưa sẵn sàng sau ${retryNo} lần thử đầu (status=${statusCode ?? "n/a"}). Kiểm tra backend/Nginx và stream key.`,
                  );
                  break;
                }

                setHlsErrorInternal(
                  `Không tải được HLS từ server (details=${data.details}, status=${statusCode ?? "n/a"}).`,
                );
              }
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setHlsErrorInternal("Lỗi giải mã media. Đang thử khôi phục…");
              hls.recoverMediaError();
              break;
            default:
              setHlsErrorInternal(`Không thể phát stream (type=${data.type}, details=${data.details})`);
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      video.src = hlsUrl;
      const handleLoadedMetadata = () => {
        video.play().catch(() => setIsPlaying(false));
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      removeNativeMetadataListener = () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      };
    }

    return () => {
      if (removeNativeMetadataListener) {
        removeNativeMetadataListener();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl, externalVideoRef, videoRef]);

  // ── Sync volume & mute state ─────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume / 100;
    video.muted = isMuted;
  }, [volume, isMuted]);

  // ── Play / Pause toggle ──────────────────────────────────────────────
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // ── Fullscreen ───────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  const handleSeek = (nextTime: number) => {
    const video = videoRef.current;
    if (!video || !canSeek) return;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const applyPlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
  };

  const applyQuality = (levelIndex: number) => {
    setSelectedQuality(levelIndex);

    const hls = hlsRef.current;
    if (!hls) return;

    if (levelIndex === -1) {
      hls.currentLevel = -1;
      hls.nextLevel = -1;
      return;
    }

    hls.currentLevel = levelIndex;
    hls.nextLevel = levelIndex;
  };

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
      {/* Video element — hidden if no hlsUrl, show thumbnail instead */}
      {hlsUrl ? (
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black cursor-pointer"
          playsInline
          autoPlay
          poster={effectivePoster}
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        />
      ) : thumbnail ? (
        <img
          src={thumbnail}
          alt="Stream"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
          <span className="text-muted-foreground text-sm">Stream offline</span>
        </div>
      )}

      {/* HLS error overlay */}
      {hlsError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="flex items-center gap-2 text-yellow-400 text-sm">
            <AlertCircle className="h-5 w-5" />
            <span>{hlsError}</span>
          </div>
        </div>
      )}

      {/* Live + viewer badges */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
        {isLive && (
          <div className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-2 animate-pulse shadow-md">
            <Radio className="w-3.5 h-3.5" />
            LIVE
          </div>
        )}
        {viewCount > 0 && (
          <div className="bg-black/70 text-white px-3 py-1 rounded text-sm flex items-center gap-2 backdrop-blur-sm shadow-md">
            <Eye className="w-4 h-4" />
            {formatViewerCount(viewCount)}
          </div>
        )}
      </div>

      {/* Controls – visible on hover */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-20">
        {!isLive && (
          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => handleSeek(Number(e.target.value))}
              disabled={!canSeek}
              className="w-full h-1.5 cursor-pointer appearance-none rounded-lg bg-gray-600"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-gray-300">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="p-2 hover:bg-white/20 rounded transition"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 hover:bg-white/20 rounded transition"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex-1" />

          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className="p-2 hover:bg-white/20 rounded transition"
              aria-label="Player settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            {showSettings && (
              <div className="absolute bottom-12 right-0 z-30 w-56 rounded-md border border-[#3d3d3d] bg-[#111214] shadow-xl">
                <div className="border-b border-[#2d2d31] px-3 py-2 text-xs font-semibold text-gray-300">
                  Tốc độ phát
                </div>
                <div className="flex flex-wrap gap-2 px-3 py-2">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => applyPlaybackRate(rate)}
                      className={`rounded px-2 py-1 text-xs transition ${
                        playbackRate === rate
                          ? "bg-purple-600 text-white"
                          : "bg-[#1d1f23] text-gray-300 hover:bg-[#2d2f34]"
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                <div className="border-y border-[#2d2d31] px-3 py-2 text-xs font-semibold text-gray-300">
                  Độ nét
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto px-2 py-2">
                  {qualityOptions.map((option) => (
                    <button
                      key={`${option.label}-${option.levelIndex}`}
                      type="button"
                      onClick={() => applyQuality(option.levelIndex)}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition ${
                        selectedQuality === option.levelIndex
                          ? "bg-purple-600/25 text-purple-200"
                          : "text-gray-300 hover:bg-[#2d2f34]"
                      }`}
                    >
                      <span>{option.label}</span>
                      {selectedQuality === option.levelIndex && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}

                  {qualityOptions.length <= 1 && (
                    <p className="px-2 py-1 text-[11px] text-gray-500">
                      Nguồn video hiện không có nhiều mức chất lượng.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-white/20 rounded transition"
          >
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
