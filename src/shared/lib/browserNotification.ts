import { useCallback, useEffect, useState } from "react";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

const PERMISSION_DISMISSED_KEY = "notif_permission_dismissed";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function currentPermission(): PermissionState {
  if (!isSupported()) return "unsupported";
  return Notification.permission as PermissionState;
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(PERMISSION_DISMISSED_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(PERMISSION_DISMISSED_KEY, String(Date.now()));
  } catch {
    // storage unavailable
  }
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<PermissionState>(currentPermission);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const perm = currentPermission();
    setPermission(perm);
    setShowPrompt(perm === "default" && !wasDismissedRecently());
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported()) return "unsupported" as const;

    try {
      const result = await Notification.requestPermission();
      const mapped = result as PermissionState;
      setPermission(mapped);
      setShowPrompt(false);
      return mapped;
    } catch {
      setPermission("denied");
      setShowPrompt(false);
      return "denied" as const;
    }
  }, []);

  const dismissPrompt = useCallback(() => {
    markDismissed();
    setShowPrompt(false);
  }, []);

  return { permission, showPrompt, requestPermission, dismissPrompt };
}

export function showBrowserNotification(
  title: string,
  options?: NotificationOptions & { onClick?: () => void },
): void {
  if (!isSupported() || Notification.permission !== "granted") return;

  try {
    const notification = new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options,
    });

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }

    setTimeout(() => notification.close(), 8_000);
  } catch {
    // Notification constructor can throw in some environments
  }
}

const NOTIFICATION_SOUND_URL = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZeLfXN1f4eLjImDfHh8goiLi4eDfnt+g4iKi4iEgH5+goaJi4mGg4B/gYSHiYqIhoOBgIGEh4mJiIaDgYGChYeJiYeGg4KCg4WIiYiHhYOCg4OGh4mIh4WEg4OEhoiIiIaFhIODhYaIiIeGhYSEhIWHiIiHhoWEhISFh4eHh4aFhISEhYeHh4eGhYWEhYWGh4eHhoaFhYWFhoeHh4aGhYWFhYaHh4eGhoWFhYWGhoeHhoaGhYaFhoaHh4aGhoWGhoaGh4eGhoaFhoaGhoeHhoaGhoaGhoaGh4aGhoaGhoaGhoaGhoaGhoaG";

export function playNotificationSound(): void {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch {
    // Audio playback failed
  }
}
