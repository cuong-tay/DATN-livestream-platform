const CHAT_DEBUG_STORAGE_KEY = "debugChat";

function readLocalStorageFlag(key: string): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function readUrlDebugFlag(): boolean | null {
  try {
    if (typeof window === "undefined") return null;

    const value = new URLSearchParams(window.location.search).get("debugChat");
    if (value === "1" || value === "true") {
      localStorage.setItem(CHAT_DEBUG_STORAGE_KEY, "true");
      return true;
    }
    if (value === "0" || value === "false") {
      localStorage.removeItem(CHAT_DEBUG_STORAGE_KEY);
      return false;
    }

    return null;
  } catch {
    return null;
  }
}

export function isChatDebugEnabled(): boolean {
  const urlFlag = readUrlDebugFlag();
  if (urlFlag !== null) return urlFlag;

  return import.meta.env.VITE_DEBUG_CHAT === "true" || readLocalStorageFlag(CHAT_DEBUG_STORAGE_KEY);
}

export function chatDebug(scope: string, message: string, data?: Record<string, unknown>) {
  if (!isChatDebugEnabled()) return;

  console.info(`[chat-debug][${scope}] ${message}`, data ?? {});
}

export function chatDebugWarn(scope: string, message: string, data?: Record<string, unknown>) {
  if (!isChatDebugEnabled()) return;

  console.warn(`[chat-debug][${scope}] ${message}`, data ?? {});
}

export function chatDebugError(scope: string, message: string, data?: Record<string, unknown>) {
  if (!isChatDebugEnabled()) return;

  console.error(`[chat-debug][${scope}] ${message}`, data ?? {});
}
