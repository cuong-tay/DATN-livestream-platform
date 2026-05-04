import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { roomService, type RoomDetail, type RoomLiveItem } from "@/shared/api/room.service";
import { useAuth } from "./AuthContext";

const ACTIVE_ROOM_STORAGE_KEY = "activeLiveRoom";

interface StreamContextValue {
  activeRoom: RoomDetail | null;
  hasActiveStream: boolean;
  syncActiveRoom: (room: RoomDetail | null) => void;
  refreshActiveRoom: () => Promise<void>;
  clearActiveRoom: () => void;
}

const StreamContext = createContext<StreamContextValue | null>(null);

function isActiveRoomStatus(status?: string): boolean {
  return status === "PENDING" || status === "LIVE" || status === "RECONNECTING";
}

function pickCurrentRoom(rooms: RoomLiveItem[]): RoomLiveItem | undefined {
  return rooms.find((room) => isActiveRoomStatus(room.status));
}

function readStoredRoom(): RoomDetail | null {
  try {
    const rawValue = localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY);
    return rawValue ? (JSON.parse(rawValue) as RoomDetail) : null;
  } catch {
    return null;
  }
}

function writeStoredRoom(room: RoomDetail | null): void {
  if (!room) {
    localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(room));
}

export function StreamProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [activeRoom, setActiveRoom] = useState<RoomDetail | null>(() => readStoredRoom());

  const syncActiveRoom = useCallback((room: RoomDetail | null) => {
    const nextRoom = room && isActiveRoomStatus(room.status) ? room : null;
    setActiveRoom(nextRoom);
    writeStoredRoom(nextRoom);
  }, []);

  const clearActiveRoom = useCallback(() => {
    setActiveRoom(null);
    writeStoredRoom(null);
  }, []);

  const refreshActiveRoom = useCallback(async () => {
    if (!isAuthenticated) {
      clearActiveRoom();
      return;
    }

    try {
      const res = await roomService.getMyRooms({ page: 0, size: 20 });
      const currentRoom = pickCurrentRoom(res.data.content);

      if (!currentRoom || !isActiveRoomStatus(currentRoom.status)) {
        clearActiveRoom();
        return;
      }

      syncActiveRoom({
        ...activeRoom,
        ...currentRoom,
        streamKey: activeRoom?.roomId === currentRoom.roomId ? activeRoom.streamKey : undefined,
      });
    } catch {
      // Best-effort global state refresh
    }
  }, [activeRoom, clearActiveRoom, isAuthenticated, syncActiveRoom]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      clearActiveRoom();
      return;
    }

    refreshActiveRoom();
  }, [clearActiveRoom, isAuthLoading, isAuthenticated, refreshActiveRoom]);

  useEffect(() => {
    if (!isAuthenticated || !activeRoom || !isActiveRoomStatus(activeRoom.status)) {
      return;
    }

    const intervalId = setInterval(() => {
      void refreshActiveRoom();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [activeRoom, isAuthenticated, refreshActiveRoom]);

  const value = useMemo<StreamContextValue>(
    () => ({
      activeRoom,
      hasActiveStream: Boolean(activeRoom && isActiveRoomStatus(activeRoom.status)),
      syncActiveRoom,
      refreshActiveRoom,
      clearActiveRoom,
    }),
    [activeRoom, clearActiveRoom, refreshActiveRoom, syncActiveRoom],
  );

  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>;
}

export function useStreamContext(): StreamContextValue {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error("useStreamContext must be used within <StreamProvider>");
  }
  return context;
}
