import { httpClient } from "./httpClient";
import type { AxiosProgressEvent } from "axios";
import { AVATAR_UPLOAD_ENDPOINT, AVATAR_UPLOAD_FIELD } from "./apiConfig";

const OTP_REQUEST_TIMEOUT_MS = 45_000;

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  userId: number;
  username: string;
  email: string;
  avatarUrl?: string | null;
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

export interface UserResponse {
  userId: number;
  email: string;
  username: string;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
}

export interface UpdateProfileRequest {
  username: string;
  avatarUrl?: string | null;
}

export interface UpdateProfileOptions {
  onUploadProgress?: (event: AxiosProgressEvent) => void;
}

export interface UploadAvatarOptions {
  onUploadProgress?: (event: AxiosProgressEvent) => void;
}

export type VerificationAction = "CHANGE_EMAIL" | "CHANGE_PASSWORD";

export interface VerificationRequest {
  action: VerificationAction;
  newEmail?: string;
}

export interface VerificationResponse {
  action: VerificationAction;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
  delivery: string;
}

export interface UpdateEmailRequest {
  newEmail: string;
  otp: string;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  otp: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResetRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export interface MessageResponse {
  message?: string;
}

// ── API Error shape ──────────────────────────────────────────────────────────

export interface ApiError {
  timestamp: string;
  status: number;
  message: string;
  errors?: Record<string, string | string[]>;
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

  /** POST multipart avatar upload endpoint (JWT) */
  uploadAvatar: async (file: File, options?: UploadAvatarOptions): Promise<UserResponse> => {
    const formData = new FormData();
    formData.append(AVATAR_UPLOAD_FIELD, file);

    const response = await httpClient.post<UserResponse>(
      AVATAR_UPLOAD_ENDPOINT,
      formData,
      {
        onUploadProgress: options?.onUploadProgress,
      },
    );

    if (!response.data?.avatarUrl?.trim()) {
      throw new Error("Upload avatar thành công nhưng backend không trả avatar URL hợp lệ.");
    }

    return response.data;
  },

  /** PUT /auth/me — update profile (JWT) */
  updateMe: (data: UpdateProfileRequest, options?: UpdateProfileOptions) =>
    httpClient.put<UserResponse>("/auth/me", data, {
      onUploadProgress: options?.onUploadProgress,
    }),

  /** POST /auth/me/verification/request — request OTP for sensitive actions (JWT) */
  requestVerification: (data: VerificationRequest) =>
    httpClient.post<VerificationResponse>("/auth/me/verification/request", data, {
      timeout: OTP_REQUEST_TIMEOUT_MS,
    }),

  /** PUT /auth/me/email — update email with OTP (JWT) */
  updateEmail: (data: UpdateEmailRequest) =>
    httpClient.put<UserResponse>("/auth/me/email", data),

  /** PUT /auth/me/password — update password with OTP (JWT) */
  updatePassword: (data: UpdatePasswordRequest) =>
    httpClient.put<MessageResponse>("/auth/me/password", data),

  /** POST /auth/forgot-password/request — send OTP for forgot password (public) */
  forgotPasswordRequest: (data: ForgotPasswordRequest) =>
    httpClient.post<MessageResponse>("/auth/forgot-password/request", data, {
      skipAuth: true,
      timeout: OTP_REQUEST_TIMEOUT_MS,
    }),

  /** POST /auth/forgot-password/reset — verify OTP and reset password (public) */
  forgotPasswordReset: (data: ForgotPasswordResetRequest) =>
    httpClient.post<MessageResponse>("/auth/forgot-password/reset", data, {
      skipAuth: true,
      timeout: OTP_REQUEST_TIMEOUT_MS,
    }),
};
