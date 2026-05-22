const DEFAULT_API_BASE_URL = "https://api.cuongtay.me/api/v1";
const DEFAULT_HLS_BASE_URL = "https://api.cuongtay.me/hls";
const DEFAULT_RTMP_SERVER = "rtmp://rtmp.cuongtay.me/live";

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

function normalizeAbsoluteBaseUrl(rawValue: string | undefined, fallbackUrl: string): string {
  const value = rawValue?.trim() || fallbackUrl;
  return trimTrailingSlashes(new URL(value).toString());
}

function buildWsUrl(rawValue: string | undefined, apiBaseUrl: string): string {
  if (rawValue?.trim()) {
    const socketUrl = new URL(trimTrailingSlashes(rawValue.trim()));
    socketUrl.protocol =
      socketUrl.protocol === "https:" || socketUrl.protocol === "wss:" ? "wss:" : "ws:";
    return trimTrailingSlashes(socketUrl.toString());
  }

  const apiUrl = new URL(apiBaseUrl);
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.pathname = "/ws";
  apiUrl.search = "";
  apiUrl.hash = "";

  return trimTrailingSlashes(apiUrl.toString());
}

function buildSockJsUrl(rawValue: string | undefined, apiBaseUrl: string): string {
  if (rawValue?.trim()) {
    const socketUrl = new URL(trimTrailingSlashes(rawValue.trim()));
    socketUrl.protocol =
      socketUrl.protocol === "https:" || socketUrl.protocol === "wss:" ? "https:" : "http:";
    return trimTrailingSlashes(socketUrl.toString());
  }

  const apiUrl = new URL(apiBaseUrl);
  apiUrl.protocol = apiUrl.protocol === "https:" ? "https:" : "http:";
  apiUrl.pathname = "/ws";
  apiUrl.search = "";
  apiUrl.hash = "";

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
export const HLS_BASE_URL = normalizeAbsoluteBaseUrl(import.meta.env.VITE_HLS_BASE_URL, DEFAULT_HLS_BASE_URL);
export const RTMP_SERVER = normalizeAbsoluteBaseUrl(import.meta.env.VITE_RTMP_SERVER, DEFAULT_RTMP_SERVER);
export const AVATAR_UPLOAD_ENDPOINT = normalizeApiEndpoint(
  import.meta.env.VITE_AVATAR_UPLOAD_ENDPOINT,
  "/auth/me/avatar",
);
export const AVATAR_UPLOAD_FIELD = normalizeFormFieldName(import.meta.env.VITE_AVATAR_UPLOAD_FIELD, "file");
