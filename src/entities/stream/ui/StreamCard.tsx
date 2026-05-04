// ─── StreamCard ───────────────────────────────────────────────────────────────
// Entity UI: displays a live room as a clickable card.
// Accepts the API shape (RoomLiveItem) directly.

import { Link } from "react-router-dom";
import type { RoomLiveItem } from "@/shared/api/room.service";


interface StreamCardProps {
  room: RoomLiveItem;
}

export function StreamCard({ room }: StreamCardProps) {
  const isLive = room.status === "LIVE" || room.status === "RECONNECTING";
  const streamerName =
    typeof room.streamerUsername === "string" && room.streamerUsername.trim().length > 0
      ? room.streamerUsername
      : "Streamer";
  const streamerInitial = streamerName.charAt(0).toUpperCase();
  const streamTitle =
    typeof room.title === "string" && room.title.trim().length > 0
      ? room.title
      : "Untitled stream";
  const categoryName =
    typeof room.categoryName === "string" && room.categoryName.trim().length > 0
      ? room.categoryName
      : "Unknown category";

  return (
    <Link to={`/stream/${room.roomId}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-lg mb-2">
        {/* Thumbnail — streamer avatar or placeholder gradient */}
        {room.streamerAvatarUrl ? (
          <img
            src={room.streamerAvatarUrl}
            alt={streamTitle}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-700 via-purple-900 to-slate-900 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <span className="text-4xl font-bold text-white/30">
              {streamerInitial}
            </span>
          </div>
        )}

        {isLive && (
          <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold">
            LIVE
          </div>
        )}
        {/* Viewer count overlay is hidden until we have real-time viewer data */}
      </div>

      <div className="flex gap-2">
        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
          {room.streamerAvatarUrl ? (
            <img src={room.streamerAvatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
          ) : (
            <span className="text-sm">{streamerInitial}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm line-clamp-2 mb-0.5 group-hover:text-purple-400 transition">
            {streamTitle}
          </h3>
          <p className="text-sm text-gray-400">{streamerName}</p>
          <p className="text-xs text-gray-500">{categoryName}</p>
        </div>
      </div>
    </Link>
  );
}
