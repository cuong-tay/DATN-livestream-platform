import { httpClient } from "./httpClient";
import type { PaginatedResponse } from "./room.service";

export interface CreateReportRequest {
  sessionId?: number | null;
  roomId?: number | null;
  reason: string;
}

export interface ReportItem {
  id: number;
  reportId: number;
  reporterId?: number;
  reporterUsername: string;
  streamerId?: number;
  streamerUsername: string;
  reportedUsername: string;
  sessionId?: number | null;
  roomId: number;
  roomTitle?: string | null;
  reason: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  resolvedAction?: ReportResolvedAction | null;
  createdAt: string;
  updatedAt?: string | null;
  resolvedAt: string | null;
  resolvedById?: number | null;
  resolvedByUsername?: string | null;
  adminNote?: string | null;
}

export type ReportStatus = ReportItem["status"];
export type AdminResolveAction = "WARN_STREAMER" | "BAN_STREAMER";
export type ReportResolvedAction = AdminResolveAction | "DISMISS";

export interface GetAdminReportsParams {
  status?: ReportStatus;
  page?: number;
  size?: number;
}

export interface ModerateReportRequest {
  status: Exclude<ReportStatus, "PENDING">;
  action?: AdminResolveAction;
  adminNote?: string;
}

export interface ResolveReportRequest {
  action: AdminResolveAction;
  adminNote?: string;
}

export interface DismissReportRequest {
  adminNote?: string;
}

type ApiReportItem = Omit<ReportItem, "id" | "reportId" | "reportedUsername" | "resolvedAt"> & {
  id?: number;
  reportId?: number;
  reportedUsername?: string;
  resolvedAt?: string | null;
};

function normalizeReport(report: ApiReportItem): ReportItem {
  const reportId = report.reportId ?? report.id ?? 0;
  const streamerUsername = report.streamerUsername ?? report.reportedUsername ?? "";

  return {
    ...report,
    id: reportId,
    reportId,
    streamerUsername,
    reportedUsername: report.reportedUsername ?? streamerUsername,
    resolvedAt: report.resolvedAt ?? (report.status === "PENDING" ? null : report.updatedAt ?? null),
    adminNote: report.adminNote ?? null,
  };
}

function normalizeReportPage(page: PaginatedResponse<ApiReportItem>): PaginatedResponse<ReportItem> {
  return {
    ...page,
    content: page.content.map(normalizeReport),
  };
}

export const reportService = {
  /** POST /reports - submit report for live, VOD/replay, or channel (JWT). */
  create: async (data: CreateReportRequest) => {
    const response = await httpClient.post<ApiReportItem>("/reports", data);
    return { ...response, data: normalizeReport(response.data) };
  },

  /** GET /reports/me - current user's submitted reports (JWT). */
  getMyReports: async (params?: { page?: number; size?: number }) => {
    const response = await httpClient.get<PaginatedResponse<ApiReportItem>>("/reports/me", { params });
    return { ...response, data: normalizeReportPage(response.data) };
  },

  /** GET /reports - admin report list (JWT ADMIN). */
  getAdminReports: async (params?: GetAdminReportsParams) => {
    const response = await httpClient.get<PaginatedResponse<ApiReportItem>>("/reports", { params });
    return { ...response, data: normalizeReportPage(response.data) };
  },

  /** GET /reports/{id} - admin detail before moderation (JWT ADMIN). */
  getById: async (reportId: number) => {
    const response = await httpClient.get<ApiReportItem>(`/reports/${reportId}`);
    return { ...response, data: normalizeReport(response.data) };
  },

  /** PUT /reports/{id}/resolve - resolve report with WARN or BAN_STREAMER (JWT ADMIN). */
  resolve: async (reportId: number, data: ResolveReportRequest) => {
    const response = await httpClient.put<ApiReportItem>(`/reports/${reportId}/resolve`, data);
    return { ...response, data: normalizeReport(response.data) };
  },

  /** PUT /reports/{id}/dismiss - dismiss report (JWT ADMIN). */
  dismiss: async (reportId: number, data?: DismissReportRequest) => {
    const response = await httpClient.put<ApiReportItem>(`/reports/${reportId}/dismiss`, data ?? {});
    return { ...response, data: normalizeReport(response.data) };
  },

  /** Compatibility adapter for the existing admin screen. */
  moderate: (reportId: number, data: ModerateReportRequest) => {
    if (data.status === "DISMISSED") {
      return reportService.dismiss(reportId);
    }

    return reportService.resolve(reportId, {
      action: data.action ?? "WARN_STREAMER",
      adminNote: data.adminNote,
    });
  },
};
