import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Clock3, Flag, Loader2, RefreshCw } from "lucide-react";
import { reportService, type ReportItem } from "@/shared/api/report.service";
import { extractApiErrorMessage } from "@/shared/api/httpClient";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { useI18nFormatters } from "@/shared/i18n";
import { parseChatTimestamp } from "@/shared/lib/formatters";

const PAGE_SIZE = 20;

function statusLabel(status: ReportItem["status"]): string {
  switch (status) {
    case "PENDING":
      return "Chờ xử lý";
    case "RESOLVED":
      return "Đã xử lý";
    case "DISMISSED":
      return "Đã bác";
    default:
      return status;
  }
}

function resolvedActionLabel(action: ReportItem["resolvedAction"]): string {
  switch (action) {
    case "WARN_STREAMER":
      return "Streamer đã bị cảnh cáo";
    case "BAN_STREAMER":
      return "Streamer đã bị ban";
    case "DISMISS":
      return "Report bị bác";
    default:
      return "Chưa có kết quả";
  }
}

function statusVariant(status: ReportItem["status"]): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "RESOLVED":
      return "default";
    case "DISMISSED":
      return "outline";
    default:
      return "outline";
  }
}

export function MyReportsPage() {
  const { formatDate } = useI18nFormatters();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveTotalPages = Math.max(totalPages, 1);
  const hasPrevPage = page > 0;
  const hasNextPage = page + 1 < effectiveTotalPages;

  const formatDateTime = useMemo(
    () => (value: string | null | undefined) => {
      if (!value) return "Chưa có";
      const date = parseChatTimestamp(value);
      if (Number.isNaN(date.getTime())) return value;
      return formatDate(date, {
        dateStyle: "short",
        timeStyle: "short",
        hour12: false,
      });
    },
    [formatDate],
  );

  const loadReports = async (mode: "full" | "refresh" = "full") => {
    if (mode === "full") {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const response = await reportService.getMyReports({ page, size: PAGE_SIZE });
      setReports(response.data.content ?? []);
      setTotalPages(response.data.totalPages ?? 0);
      setTotalElements(response.data.totalElements ?? 0);
    } catch (loadError) {
      setError(extractApiErrorMessage(loadError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadReports("full");
  }, [page]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
              <Flag className="h-3.5 w-3.5" />
              Báo cáo của tôi
            </p>
            <h1 className="text-3xl font-bold">Lịch sử report đã gửi</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Theo dõi trạng thái xử lý các report live, VOD hoặc channel bạn đã gửi.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              void loadReports("refresh");
            }}
            disabled={isLoading || isRefreshing}
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Làm mới
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Tổng report: {totalElements}</CardTitle>
            <CardDescription>Report mới sẽ ở trạng thái chờ xử lý cho đến khi admin cảnh cáo, ban hoặc bác.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex min-h-48 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : reports.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
                Bạn chưa gửi report nào.
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant={statusVariant(report.status)}>{statusLabel(report.status)}</Badge>
                          <Badge variant="outline">{resolvedActionLabel(report.resolvedAction)}</Badge>
                          <span className="text-xs text-muted-foreground">Report #{report.id}</span>
                        </div>
                        <h2 className="line-clamp-1 font-semibold">
                          {report.roomTitle || `Room #${report.roomId}`}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Streamer: {report.streamerUsername || report.reportedUsername}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm">{report.reason}</p>
                      </div>

                      <div className="shrink-0 text-sm text-muted-foreground sm:text-right">
                        <p className="flex items-center gap-1 sm:justify-end">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatDateTime(report.createdAt)}
                        </p>
                        <p className="mt-1">
                          {report.sessionId ? `Session #${report.sessionId}` : `Room #${report.roomId}`}
                        </p>
                      </div>
                    </div>

                    {report.adminNote && (
                      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">Ghi chú admin: </span>
                        {report.adminNote}
                      </div>
                    )}

                    {report.resolvedAt && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Xử lý bởi {report.resolvedByUsername ?? "admin"} lúc {formatDateTime(report.resolvedAt)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">
                Trang {Math.min(page + 1, effectiveTotalPages)} / {effectiveTotalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(current - 1, 0))} disabled={!hasPrevPage || isLoading}>
                  Trước
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((current) => current + 1)} disabled={!hasNextPage || isLoading}>
                  Sau
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link to="/" className="inline-flex text-sm font-semibold text-primary hover:underline">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
