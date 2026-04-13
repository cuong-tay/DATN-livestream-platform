import { useState, useEffect, useCallback } from "react";
import { roomService, type RoomLiveItem } from "@/shared/api/room.service";

interface UseLiveRoomsReturn {
  rooms: RoomLiveItem[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * Fetches live rooms from the API.
 * Supports optional category filtering and "load more" pagination.
 */
export function useLiveRooms(categoryId?: number, pageSize = 12): UseLiveRoomsReturn {
  const [rooms, setRooms] = useState<RoomLiveItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset when categoryId changes
  useEffect(() => {
    setRooms([]);
    setPage(0);
    setHasMore(true);
    setError(null);
  }, [categoryId]);

  // Fetch rooms for the current page
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    roomService
      .getLiveRooms({ categoryId, page, size: pageSize })
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        setRooms((prev) => (page === 0 ? data.content : [...prev, ...data.content]));
        setHasMore(data.number + 1 < data.totalPages);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Không thể tải danh sách stream");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, page, pageSize]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage((p) => p + 1);
    }
  }, [isLoading, hasMore]);

  return { rooms, isLoading, error, hasMore, loadMore };
}
