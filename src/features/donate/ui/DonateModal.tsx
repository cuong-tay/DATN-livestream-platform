import { useState } from "react";
import { Loader2, HeartHandshake } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  Button, 
  Input, 
  Label,
  Separator
} from "@/shared/ui";
import { donationService } from "@/shared/api/donation.service";
import { toast } from "sonner";
import { useAuth } from "@/app/providers/AuthContext";

interface DonateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  streamerId: number;
  streamerUsername: string;
}

const PRESET_AMOUNTS = [10000, 20000, 50000, 100000];

export function DonateModal({ isOpen, onOpenChange, streamerId, streamerUsername }: DonateModalProps) {
  const { isAuthenticated } = useAuth();
  const [amount, setAmount] = useState<number>(10000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("Vui lòng đăng nhập để gửi tiền ủng hộ.");
      return;
    }

    const finalAmount = customAmount ? parseInt(customAmount.replace(/[^0-9]/g, ""), 10) : amount;
    if (!finalAmount || finalAmount < 10000) {
      toast.error("Số tiền ủng hộ tối thiểu là 10,000đ.");
      return;
    }

    setIsSubmitting(true);
    try {
      await donationService.donate({
        streamerId,
        amount: finalAmount,
        message,
      });
      toast.success("Cảm ơn bạn đã ủng hộ Streamer!");
      onOpenChange(false);
      setMessage("");
      setCustomAmount("");
    } catch {
      toast.error("Giao dịch không thành công. Hãy thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountClick = (preset: number) => {
    setAmount(preset);
    setCustomAmount("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background border-border shadow-2xl">
        <DialogHeader className="flex flex-col items-center pt-4">
          <div className="w-16 h-16 bg-pink-500/10 rounded-full flex items-center justify-center mb-4">
            <HeartHandshake className="w-8 h-8 text-pink-500" />
          </div>
          <DialogTitle className="text-xl font-bold">Ủng hộ {streamerUsername}</DialogTitle>
          <DialogDescription className="text-center mt-2">
            Tiếp thêm động lực cho streamer bằng một khoản quyên góp nhỏ.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Preset Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {PRESET_AMOUNTS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={amount === preset && !customAmount ? "default" : "outline"}
                className={amount === preset && !customAmount ? "bg-pink-600 hover:bg-pink-700 text-white" : ""}
                onClick={() => handleAmountClick(preset)}
              >
                {preset.toLocaleString("vi-VN")} đ
              </Button>
            ))}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Hoặc nhập số tiền khác</span>
            </div>
          </div>

          {/* Custom Amount */}
          <div className="grid gap-2">
            <Label htmlFor="customAmount">Số tiền tùy chọn (VNĐ)</Label>
            <Input
              id="customAmount"
              type="text"
              placeholder="Ví dụ: 150000"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setAmount(0);
              }}
              className="font-mono"
            />
          </div>

          {/* Message */}
          <div className="grid gap-2">
            <Label htmlFor="message">Lời nhắn (Tùy chọn)</Label>
            <Input
              id="message"
              type="text"
              placeholder="Gửi lời động viên đến streamer..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="h-10"
              maxLength={150}
            />
          </div>

          <div className="pt-2">
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-lg shadow-pink-500/20"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Đang xử lý giao dịch...</>
              ) : (
                "Gửi Ủng Hộ Ngay"
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground mt-3">
              Giao dịch này là không thể hoàn tác. Vui lòng kiểm tra kỹ số tiền.
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
