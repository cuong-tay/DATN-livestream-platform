const CHAT_DEBUG_STORAGE_KEY = "debugChat";

function readLocalStorageFlag(key: string): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function isChatDebugEnabled(): boolean {
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
