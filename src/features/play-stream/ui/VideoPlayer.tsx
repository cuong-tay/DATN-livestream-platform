import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  Eye,
  AlertCircle,
} from "lucide-react";
import { formatViewerCount } from "@/shared/lib/formatters";
import Hls from "hls.js";

interface VideoPlayerProps {
  /** HLS URL (e.g. http://…/hls/sk_abc123.m3u8) */
  hlsUrl?: string | null;
  /** Fallback thumbnail when stream is not live */
  thumbnail?: string;
  /** Number of concurrent viewers */
  viewers?: number;
  /** Whether the room is currently live */
  isLive?: boolean;
}

export function VideoPlayer({
  hlsUrl,
  thumbnail,
  viewers = 0,
  isLive = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(70);
  const [hlsError, setHlsError] = useState<string | null>(null);

  // ── Attach HLS.js when hlsUrl changes ────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setHlsError(null);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          // Autoplay blocked — user needs to click play
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setHlsError("Lỗi kết nối. Đang thử kết nối lại…");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setHlsError("Không thể phát stream");
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      video.src = hlsUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => setIsPlaying(false));
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl]);

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

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
      {/* Video element — hidden if no hlsUrl, show thumbnail instead */}
      {hlsUrl ? (
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
          playsInline
          autoPlay
          poster={thumbnail}
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
          <div className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        )}
        {viewers > 0 && (
          <div className="bg-black/80 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
            <Eye className="w-4 h-4" />
            {formatViewerCount(viewers)} viewers
          </div>
        )}
      </div>

      {/* Controls – visible on hover */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
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

          <button className="p-2 hover:bg-white/20 rounded transition">
            <Settings className="w-5 h-5" />
          </button>
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
