import axios from "axios";
import type { AxiosError } from "axios";
import type { AxiosRequestConfig } from "axios";

import { API_BASE_URL } from "./apiConfig";

declare module "axios" {
  interface AxiosRequestConfig {
    skipAuth?: boolean;
  }
}

const DEBUG_VOD_API = import.meta.env.VITE_DEBUG_VOD_API === "true";

type TimedAxiosRequestConfig = AxiosRequestConfig & {
  metadata?: {
    requestStartedAt: number;
  };
};

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

export function extractApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string }>;

  if (axiosError.response?.data?.message) {
    return axiosError.response.data.message;
  }

  if (axiosError.response?.status) {
    return `HTTP ${axiosError.response.status} tại ${axiosError.config?.url || "API"}`;
  }

  const isTimeoutError =
    axiosError.code === "ECONNABORTED" ||
    (typeof axiosError.message === "string" && axiosError.message.toLowerCase().includes("timeout"));

  if (isTimeoutError) {
    return "Backend phản hồi chậm hơn thời gian chờ của frontend. Vui lòng thử lại sau vài giây.";
  }

  if (axiosError.request && !axiosError.response) {
    return "Request không tới được backend. Khả năng cao là CORS, backend chưa chạy, sai base URL, hoặc browser chặn preflight.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return axiosError.message || "Lỗi không xác định khi gọi API.";
}

export function hasHttpStatus(error: unknown, status: number): boolean {
  const axiosError = error as AxiosError;
  return axiosError.response?.status === status;
}

// ── Request interceptor: gắn Bearer token vào mọi request ────────────────
httpClient.interceptors.request.use(
  (config) => {
    const timedConfig = config as TimedAxiosRequestConfig;
    timedConfig.metadata = { requestStartedAt: Date.now() };

    const isFormDataRequest =
      typeof FormData !== "undefined" &&
      typeof config.data !== "undefined" &&
      config.data instanceof FormData;

    // Let the browser generate multipart boundary automatically.
    if (isFormDataRequest && config.headers) {
      const headers = config.headers as {
        delete?: (headerName: string) => void;
        set?: (headerName: string, value: string | undefined) => void;
        [key: string]: unknown;
      };

      if (typeof headers.delete === "function") {
        headers.delete("Content-Type");
      } else if (typeof headers.set === "function") {
        headers.set("Content-Type", undefined);
      } else {
        delete headers["Content-Type"];
      }
    }

    const token = localStorage.getItem("accessToken");
    if (token && config.headers && !config.skipAuth) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (
      DEBUG_VOD_API &&
      (config.url?.includes("/sessions") || config.url?.includes("/retry-vod"))
    ) {
      console.info("[vod-api] request", {
        method: config.method?.toUpperCase(),
        url: config.baseURL ? `${config.baseURL}${config.url || ""}` : config.url,
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: xử lý 401 Unauthorized ─────────────────────────
httpClient.interceptors.response.use(
  (response) => {
    const config = response.config as TimedAxiosRequestConfig;
    const elapsedMs = config.metadata?.requestStartedAt
      ? Date.now() - config.metadata.requestStartedAt
      : undefined;

    if (
      DEBUG_VOD_API &&
      (response.config.url?.includes("/sessions") || response.config.url?.includes("/retry-vod"))
    ) {
      console.info("[vod-api] response", {
        method: response.config.method?.toUpperCase(),
        url: response.config.baseURL
          ? `${response.config.baseURL}${response.config.url || ""}`
          : response.config.url,
        status: response.status,
        elapsedMs,
        data: response.data,
      });
    }

    return response;
  },
  (error) => {
    const axiosError = error as AxiosError;
    const timedConfig = axiosError.config as TimedAxiosRequestConfig | undefined;
    const elapsedMs = timedConfig?.metadata?.requestStartedAt
      ? Date.now() - timedConfig.metadata.requestStartedAt
      : undefined;

    console.error("[httpClient] request failed", {
      method: axiosError.config?.method,
      url: axiosError.config?.baseURL
        ? `${axiosError.config.baseURL}${axiosError.config.url || ""}`
        : axiosError.config?.url,
      status: axiosError.response?.status,
      code: axiosError.code,
      message: extractApiErrorMessage(error),
      response: axiosError.response?.data,
      elapsedMs,
    });

    if (
      DEBUG_VOD_API &&
      (axiosError.config?.url?.includes("/sessions") || axiosError.config?.url?.includes("/retry-vod"))
    ) {
      console.error("[vod-api] failed", {
        method: axiosError.config?.method?.toUpperCase(),
        url: axiosError.config?.baseURL
          ? `${axiosError.config.baseURL}${axiosError.config.url || ""}`
          : axiosError.config?.url,
        status: axiosError.response?.status,
        elapsedMs,
        response: axiosError.response?.data,
      });
    }

    if (error.response?.status === 401) {
      // Token hết hạn hoặc không hợp lệ → clear & reload
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");

      // Dispatch custom event để AuthContext có thể lắng nghe
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
    return Promise.reject(error);
  },
);
