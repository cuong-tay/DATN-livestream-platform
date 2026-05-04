import { useMemo, useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Label,
} from "@/shared/ui";
import { toast } from "sonner";
import { reportService, type CreateReportRequest } from "@/shared/api/report.service";
import { useAuth } from "@/app/providers/AuthContext";
import { useI18n, type TranslationKey } from "@/shared/i18n";

interface ReportModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  reportedUserId: number;
  roomId: number;
}

const REPORT_REASON_KEYS: TranslationKey[] = [
  "report.reasonViolence",
  "report.reasonHarassment",
  "report.reasonFraud",
  "report.reasonSpam",
  "report.reasonHate",
  "report.reasonOther",
];

export function ReportModal({ isOpen, onOpenChange, reportedUserId, roomId }: ReportModalProps) {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();
  const [reasonKey, setReasonKey] = useState<TranslationKey | "">("");
  const [otherReason, setOtherReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportReasons = useMemo(
    () => REPORT_REASON_KEYS.map((key) => ({ key, label: t(key) })),
    [t],
  );
  const isOtherReason = reasonKey === "report.reasonOther";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error(t("report.loginRequired"));
      return;
    }

    const finalReason = (isOtherReason ? otherReason : reasonKey ? t(reasonKey) : "").trim();
    if (!finalReason) {
      toast.error(t("report.reasonRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateReportRequest = {
        reportedUserId,
        roomId,
        reason: finalReason,
      };
      await reportService.create(payload);
      toast.success(t("report.success"));
      onOpenChange(false);
      setReasonKey("");
      setOtherReason("");
    } catch {
      toast.error(t("report.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background border-border shadow-2xl">
        <DialogHeader className="flex flex-col items-center pt-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <Flag className="w-8 h-8 text-red-500" />
          </div>
          <DialogTitle className="text-xl font-bold text-center">{t("report.title")}</DialogTitle>
          <DialogDescription className="text-center mt-2">
            {t("report.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid gap-3">
            <Label className="text-sm font-semibold">{t("report.chooseReason")}</Label>
            <div className="flex flex-col gap-2">
              {reportReasons.map((reason) => (
                <label
                  key={reason.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    reasonKey === reason.key ? "border-red-500 bg-red-500/10" : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    className="w-4 h-4 text-red-600 bg-background border-border focus:ring-red-600 focus:ring-2"
                    value={reason.key}
                    checked={reasonKey === reason.key}
                    onChange={(e) => setReasonKey(e.target.value as TranslationKey)}
                  />
                  <span className="text-sm font-medium">{reason.label}</span>
                </label>
              ))}
            </div>

            {isOtherReason && (
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder={t("report.otherPlaceholder")}
                className="w-full mt-2 min-h-[80px] p-3 text-sm bg-background border border-border rounded-md focus:ring-red-500 focus:border-red-500 resize-none"
                required
              />
            )}
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("report.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("report.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
