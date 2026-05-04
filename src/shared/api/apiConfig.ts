const DEFAULT_API_BASE_URL = "https://api.cuongtay.me/api/v1";

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeApiBaseUrl(rawValue?: string): string {
  if (!rawValue?.trim()) {
    return DEFAULT_API_BASE_URL;
  }

  const normalizedValue = trimTrailingSlashes(rawValue.trim());
  const parsedUrl = new URL(normalizedValue);

  if (!parsedUrl.pathname || parsedUrl.pathname === "/") {
    parsedUrl.pathname = "/api/v1";
  }

  return trimTrailingSlashes(parsedUrl.toString());
}

function buildWsUrl(rawValue: string | undefined, apiBaseUrl: string): string {
  if (rawValue?.trim()) {
    return trimTrailingSlashes(rawValue.trim());
  }

  const apiUrl = new URL(apiBaseUrl);
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.pathname = `${trimTrailingSlashes(apiUrl.pathname)}/ws`;

  return trimTrailingSlashes(apiUrl.toString());
}

function buildSockJsUrl(rawValue: string | undefined, apiBaseUrl: string): string {
  if (rawValue?.trim()) {
    const socketUrl = new URL(trimTrailingSlashes(rawValue.trim()));
    socketUrl.protocol = socketUrl.protocol === "wss:" ? "https:" : "http:";
    return trimTrailingSlashes(socketUrl.toString());
  }

  const apiUrl = new URL(apiBaseUrl);
  apiUrl.protocol = apiUrl.protocol === "https:" ? "https:" : "http:";
  apiUrl.pathname = `${trimTrailingSlashes(apiUrl.pathname)}/ws`;

  return trimTrailingSlashes(apiUrl.toString());
}

function normalizeApiEndpoint(rawValue: string | undefined, fallbackPath: string): string {
  if (!rawValue?.trim()) {
    return fallbackPath;
  }

  const normalizedValue = rawValue.trim();

  if (/^https?:\/\//i.test(normalizedValue)) {
    return trimTrailingSlashes(normalizedValue);
  }

  return normalizedValue.startsWith("/") ? normalizedValue : `/${normalizedValue}`;
}

function normalizeFormFieldName(rawValue: string | undefined, fallbackField: string): string {
  const normalizedValue = rawValue?.trim();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : fallbackField;
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
export const WS_URL = buildWsUrl(import.meta.env.VITE_WS_URL, API_BASE_URL);
export const SOCKJS_URL = buildSockJsUrl(import.meta.env.VITE_WS_URL, API_BASE_URL);
export const AVATAR_UPLOAD_ENDPOINT = normalizeApiEndpoint(
  import.meta.env.VITE_AVATAR_UPLOAD_ENDPOINT,
  "/auth/me/avatar",
);
export const AVATAR_UPLOAD_FIELD = normalizeFormFieldName(import.meta.env.VITE_AVATAR_UPLOAD_FIELD, "file");