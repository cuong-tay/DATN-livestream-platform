import { httpClient } from "./httpClient";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  userId: number;
  username: string;
  email: string;
  role: "USER" | "ADMIN";
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}

// ── API Error shape ──────────────────────────────────────────────────────────

export interface ApiError {
  timestamp: string;
  status: number;
  message: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const authService = {
  /** POST /auth/login */
  login: (data: LoginRequest) =>
    httpClient.post<AuthResponse>("/auth/login", data),

  /** POST /auth/register */
  register: (data: RegisterRequest) =>
    httpClient.post<AuthResponse>("/auth/register", data),

  /** POST /auth/google */
  loginWithGoogle: (data: GoogleLoginRequest) =>
    httpClient.post<AuthResponse>("/auth/google", data),
};
