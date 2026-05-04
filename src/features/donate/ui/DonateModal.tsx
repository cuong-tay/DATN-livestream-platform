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
import { useI18n } from "@/shared/i18n";

interface DonateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  streamerId: number;
  streamerUsername: string;
}

const PRESET_AMOUNTS = [10000, 20000, 50000, 100000];

export function DonateModal({ isOpen, onOpenChange, streamerId, streamerUsername }: DonateModalProps) {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();
  const [amount, setAmount] = useState<number>(10000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error(t("donate.loginRequired"));
      return;
    }

    const finalAmount = customAmount ? parseInt(customAmount.replace(/[^0-9]/g, ""), 10) : amount;
    if (!finalAmount || finalAmount < 10000) {
      toast.error(t("donate.minAmount"));
      return;
    }

    setIsSubmitting(true);
    try {
      await donationService.donate({
        streamerId,
        amount: finalAmount,
        message,
      });
      toast.success(t("donate.success"));
      onOpenChange(false);
      setMessage("");
      setCustomAmount("");
    } catch {
      toast.error(t("donate.failed"));
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
          <DialogTitle className="text-xl font-bold">{t("donate.title", { username: streamerUsername })}</DialogTitle>
          <DialogDescription className="text-center mt-2">
            {t("donate.description")}
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
              <span className="bg-background px-2 text-muted-foreground">{t("donate.customSeparator")}</span>
            </div>
          </div>

          {/* Custom Amount */}
          <div className="grid gap-2">
            <Label htmlFor="customAmount">{t("donate.customAmount")}</Label>
            <Input
              id="customAmount"
              type="text"
              placeholder={t("donate.customPlaceholder")}
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
            <Label htmlFor="message">{t("donate.message")}</Label>
            <Input
              id="message"
              type="text"
              placeholder={t("donate.messagePlaceholder")}
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
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {t("donate.processing")}</>
              ) : (
                t("donate.submit")
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground mt-3">
              {t("donate.warning")}
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
