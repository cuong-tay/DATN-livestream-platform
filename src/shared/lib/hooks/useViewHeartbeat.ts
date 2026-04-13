import { useEffect, useRef } from "react";
import { viewHistoryService } from "@/shared/api/viewHistory.service";

const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Sends a heartbeat to the backend every 60 seconds while the viewer
 * is actively watching a stream. Stops when the component unmounts.
 */
export function useViewHeartbeat(roomId: number | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!roomId) return;

    // Send an immediate heartbeat when the viewer first lands on the page
    viewHistoryService.sendHeartbeat(roomId).catch(() => {
      // silently ignore — heartbeat is best-effort
    });

    intervalRef.current = setInterval(() => {
      viewHistoryService.sendHeartbeat(roomId).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [roomId]);
}
