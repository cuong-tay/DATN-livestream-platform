import { httpClient } from "./httpClient";
import type { PaginatedResponse } from "./room.service";

export interface CreateReportRequest {
  reportedUserId: number;
  roomId: number;
  reason: string;
}

export interface ReportItem {
  id: number;
  reporterUsername: string;
  reportedUsername: string;
  roomId: number;
  reason: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  resolvedAt: string | null;
  adminNote: string | null;
}

export type ReportStatus = ReportItem["status"];

export interface GetAdminReportsParams {
  status?: ReportStatus;
  page?: number;
  size?: number;
}

export interface ModerateReportRequest {
  status: Exclude<ReportStatus, "PENDING">;
  adminNote?: string;
}

export const reportService = {
  /** POST /reports — nộp report (JWT) */
  create: (data: CreateReportRequest) =>
    httpClient.post<ReportItem>("/reports", data),

  /** GET /reports — danh sách report cho admin (JWT ADMIN) */
  getAdminReports: (params?: GetAdminReportsParams) =>
    httpClient.get<PaginatedResponse<ReportItem>>("/reports", { params }),

  /** PATCH /reports/{id}/status — duyệt/từ chối report (JWT ADMIN) */
  moderate: (reportId: number, data: ModerateReportRequest) =>
    httpClient.patch<ReportItem>(`/reports/${reportId}/status`, data),
};