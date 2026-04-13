import { useState } from "react";
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
import { httpClient } from "@/shared/api/httpClient";
import { useAuth } from "@/app/providers/AuthContext";

export interface ReportItem {
  reportedUserId: number;
  roomId: number;
  reason: string;
}

export const reportService = {
  report: (data: ReportItem) => httpClient.post("/reports", data),
};

interface ReportModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  reportedUserId: number;
  roomId: number;
}

const REPORT_REASONS = [
  "Nội dung bạo lực hoặc phản cảm",
  "Quấy rối, bắt nạt",
  "Gian lận, lừa đảo",
  "Spam, tin nhắn rác",
  "Phát ngôn gây thù ghét",
  "Khác",
];

export function ReportModal({ isOpen, onOpenChange, reportedUserId, roomId }: ReportModalProps) {
  const { isAuthenticated } = useAuth();
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("Bạn cần đăng nhập để thực hiện báo cáo.");
      return;
    }

    const finalReason = reason === "Khác" ? otherReason : reason;
    if (!finalReason) {
      toast.error("Vui lòng chọn hoặc nhập lý do.");
      return;
    }

    setIsSubmitting(true);
    try {
      await reportService.report({
        reportedUserId,
        roomId,
        reason: finalReason,
      });
      toast.success("Báo cáo của bạn đã được gửi. Đội ngũ kiểm duyệt sẽ xử lý sớm nhất.");
      onOpenChange(false);
      setReason("");
      setOtherReason("");
    } catch {
      toast.error("Gửi báo cáo thất bại. Xin thử lại.");
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
          <DialogTitle className="text-xl font-bold text-center">Báo cáo vi phạm</DialogTitle>
          <DialogDescription className="text-center mt-2">
            Giúp cộng đồng an toàn hơn bằng cách báo cáo nội dung vi phạm tiêu chuẩn.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid gap-3">
            <Label className="text-sm font-semibold">Vui lòng chọn lý do báo cáo:</Label>
            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    reason === r ? "border-red-500 bg-red-500/10" : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    className="w-4 h-4 text-red-600 bg-background border-border focus:ring-red-600 focus:ring-2"
                    value={r}
                    checked={reason === r}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <span className="text-sm font-medium">{r}</span>
                </label>
              ))}
            </div>

            {reason === "Khác" && (
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Nhập lý do cụ thể của bạn..."
                className="w-full mt-2 min-h-[80px] p-3 text-sm bg-background border border-border rounded-md focus:ring-red-500 focus:border-red-500 resize-none"
                required
              />
            )}
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Gửi Báo Cáo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
