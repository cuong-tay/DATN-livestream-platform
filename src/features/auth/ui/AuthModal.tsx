import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Label,
  Separator,
} from "@/shared/ui";
import {
  AlertCircle,
  ArrowLeft,
  Github,
  KeyRound,
  Loader2,
  MailCheck,
  Play,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/AuthContext";
import { authService } from "@/shared/api/auth.service";
import { extractApiErrorMessage } from "@/shared/api/httpClient";
import { useI18n } from "@/shared/i18n";

// ── Props ────────────────────────────────────────────────────────────────────

interface AuthModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
}

type ForgotPasswordStep = "request" | "reset";

const OTP_LENGTH = 6;
const FORGOT_OTP_COOLDOWN_SECONDS = 60;
const PASSWORD_MIN_LENGTH = 8;

function sanitizeOtpValue(rawValue: string): string {
  return rawValue.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

// ── Component ────────────────────────────────────────────────────────────────

export function AuthModal({
  isOpen,
  onOpenChange,
  defaultTab = "login",
}: AuthModalProps) {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"login" | "register">(defaultTab);

  // ── Login form state ───────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ── Register form state ────────────────────────────────────────────────
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // ── Shared state ───────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Forgot password flow state ────────────────────────────────────────
  const [isForgotPasswordFlow, setIsForgotPasswordFlow] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] =
    useState<ForgotPasswordStep>("request");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotResendAvailableAt, setForgotResendAvailableAt] = useState(0);
  const [isRequestingForgotOtp, setIsRequestingForgotOtp] = useState(false);
  const [isResettingForgotPassword, setIsResettingForgotPassword] =
    useState(false);
  const [tickNow, setTickNow] = useState(() => Date.now());

  const forgotCooldownSeconds = useMemo(
    () =>
      Math.max(
        0,
        Math.ceil((forgotResendAvailableAt - tickNow) / 1000),
      ),
    [forgotResendAvailableAt, tickNow],
  );

  const resetForgotPasswordState = () => {
    setForgotPasswordStep("request");
    setForgotEmail("");
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotResendAvailableAt(0);
    setIsRequestingForgotOtp(false);
    setIsResettingForgotPassword(false);
  };

  const closeForgotPasswordFlow = () => {
    setIsForgotPasswordFlow(false);
    resetForgotPasswordState();
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTickNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setErrorMessage(null);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(false);
    setIsForgotPasswordFlow(false);
    resetForgotPasswordState();
  }, [defaultTab, isOpen]);

  // ── Reset state khi chuyển tab ─────────────────────────────────────────
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as "login" | "register");
    setErrorMessage(null);

    if (tab !== "login") {
      closeForgotPasswordFlow();
    }
  };

  // ── Login handler ──────────────────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      // Reset form & close modal on success
      setEmail("");
      setPassword("");
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : t("auth.loginFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Register handler ───────────────────────────────────────────────────
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await register({
        username: regUsername,
        email: regEmail,
        password: regPassword,
      });
      // Reset form & close modal on success
      setRegEmail("");
      setRegUsername("");
      setRegPassword("");
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : t("auth.registerFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Google login handler (placeholder – needs Google Identity setup) ───
  const handleGoogleLogin = () => {
    // TODO: Integrate Google Identity Services to get `idToken`,
    // then call loginWithGoogle(idToken). Requires VITE_GOOGLE_CLIENT_ID env var.
    setErrorMessage(
      t("auth.googleNotConfigured"),
    );
  };

  // ── Forgot password handlers ──────────────────────────────────────────
  const handleOpenForgotPassword = () => {
    setErrorMessage(null);
    setIsForgotPasswordFlow(true);
    setForgotPasswordStep("request");
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");

    const normalizedLoginEmail = email.trim();
    if (normalizedLoginEmail) {
      setForgotEmail(normalizedLoginEmail);
    }
  };

  const handleRequestForgotOtp = async (
    e?: React.FormEvent,
    fromResend = false,
  ) => {
    e?.preventDefault();

    const normalizedEmail = forgotEmail.trim();
    if (!normalizedEmail) {
      setErrorMessage(t("auth.emailRequired"));
      return;
    }

    if (forgotCooldownSeconds > 0) {
      setErrorMessage(t("auth.otpCooldown", { seconds: forgotCooldownSeconds }));
      return;
    }

    setErrorMessage(null);
    setIsRequestingForgotOtp(true);

    try {
      const response = await authService.forgotPasswordRequest({
        email: normalizedEmail,
      });

      setForgotPasswordStep("reset");
      setForgotResendAvailableAt(
        Date.now() + FORGOT_OTP_COOLDOWN_SECONDS * 1000,
      );

      toast.success(
        response.data.message ||
          (fromResend
            ? t("auth.otpResent")
            : t("auth.otpSent")),
      );
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error));
    } finally {
      setIsRequestingForgotOtp(false);
    }
  };

  const handleResetForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = forgotEmail.trim();

    if (!normalizedEmail) {
      setErrorMessage(t("auth.invalidRecoveryEmail"));
      return;
    }

    if (forgotOtp.length !== OTP_LENGTH) {
      setErrorMessage(t("auth.otpRequired"));
      return;
    }

    if (forgotNewPassword.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage(t("auth.passwordMin"));
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMessage(t("auth.passwordConfirmMismatch"));
      return;
    }

    setErrorMessage(null);
    setIsResettingForgotPassword(true);

    try {
      const response = await authService.forgotPasswordReset({
        email: normalizedEmail,
        otp: forgotOtp,
        newPassword: forgotNewPassword,
      });

      toast.success(
        response.data.message ||
          t("auth.resetSuccess"),
      );

      setEmail(normalizedEmail);
      setPassword("");
      closeForgotPasswordFlow();
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error));
    } finally {
      setIsResettingForgotPassword(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground p-6 shadow-2xl gap-0">
        <DialogHeader className="mb-6 flex flex-col items-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <Play className="w-6 h-6 text-primary-foreground fill-current" />
          </div>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {activeTab === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-2 text-center">
            {activeTab === "login"
              ? t("auth.loginSubtitle")
              : t("auth.registerSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 bg-secondary p-1 mb-6 rounded-lg pointer-events-auto">
            <TabsTrigger
              value="login"
              className="rounded-md data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground transition-all font-semibold"
            >
              {t("auth.login")}
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="rounded-md data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground transition-all font-semibold"
            >
              {t("auth.signUp")}
            </TabsTrigger>
          </TabsList>

          {/* ── Error banner ─────────────────────────────────────────── */}
          {errorMessage && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ── Login tab ────────────────────────────────────────────── */}
          <TabsContent value="login">
            {isForgotPasswordFlow ? (
              <div className="space-y-4 rounded-xl border border-border bg-secondary/25 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {t("auth.forgotTitle")}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("auth.forgotDescription")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={closeForgotPasswordFlow}
                    disabled={isRequestingForgotOtp || isResettingForgotPassword}
                    className="h-8 px-2 text-xs"
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                    {t("auth.back")}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div
                    className={`rounded-md border px-2.5 py-2 font-medium ${
                      forgotPasswordStep === "request"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {t("auth.stepRequestOtp")}
                  </div>
                  <div
                    className={`rounded-md border px-2.5 py-2 font-medium ${
                      forgotPasswordStep === "reset"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {t("auth.stepResetPassword")}
                  </div>
                </div>

                {forgotPasswordStep === "request" ? (
                  <form
                    id="forgot-password-request-form"
                    onSubmit={(e) => void handleRequestForgotOtp(e)}
                    className="space-y-3"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email" className="text-foreground">
                        {t("auth.recoveryEmail")}
                      </Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        autoComplete="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="bg-background border-input focus-visible:ring-primary h-11 text-foreground"
                        required
                        disabled={isRequestingForgotOtp}
                      />
                    </div>

                    <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary/90">
                      {t("auth.otpHelp")}

                    </div>

                    <Button
                      type="submit"
                      disabled={isRequestingForgotOtp || forgotCooldownSeconds > 0}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-semibold"
                    >
                      {isRequestingForgotOtp ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("auth.sendingOtp")}
                        </span>
                      ) : forgotCooldownSeconds > 0 ? (
                        t("auth.resendIn", { seconds: forgotCooldownSeconds })
                      ) : (
                        <span className="flex items-center gap-2">
                          <MailCheck className="h-4 w-4" />
                          {t("auth.sendForgotOtp")}
                        </span>
                      )}
                    </Button>
                  </form>
                ) : (
                  <form
                    id="forgot-password-reset-form"
                    onSubmit={handleResetForgotPassword}
                    className="space-y-3"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="forgot-reset-email" className="text-foreground">
                        {t("auth.otpEmail")}
                      </Label>
                      <Input
                        id="forgot-reset-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="bg-background border-input focus-visible:ring-primary h-11 text-foreground"
                        required
                        disabled={isResettingForgotPassword}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-foreground">{t("auth.otpCode")}</Label>
                      <InputOTP
                        value={forgotOtp}
                        onChange={(value) => setForgotOtp(sanitizeOtpValue(value))}
                        maxLength={OTP_LENGTH}
                        containerClassName="justify-start"
                        disabled={isResettingForgotPassword}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="forgot-new-password" className="text-foreground">
                        {t("auth.newPassword")}
                      </Label>
                      <Input
                        id="forgot-new-password"
                        type="password"
                        autoComplete="new-password"
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        className="bg-background border-input focus-visible:ring-primary h-11 text-foreground"
                        minLength={PASSWORD_MIN_LENGTH}
                        required
                        disabled={isResettingForgotPassword}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="forgot-confirm-password"
                        className="text-foreground"
                      >
                        {t("auth.confirmNewPassword")}
                      </Label>
                      <Input
                        id="forgot-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        className="bg-background border-input focus-visible:ring-primary h-11 text-foreground"
                        minLength={PASSWORD_MIN_LENGTH}
                        required
                        disabled={isResettingForgotPassword}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={(e) =>
                          void handleRequestForgotOtp(e, true)
                        }
                        disabled={
                          isRequestingForgotOtp ||
                          isResettingForgotPassword ||
                          forgotCooldownSeconds > 0
                        }
                        className="h-9 px-3 text-xs"
                      >
                        {isRequestingForgotOtp
                          ? t("auth.resendingOtp")
                          : forgotCooldownSeconds > 0
                            ? t("auth.resendIn", { seconds: forgotCooldownSeconds })
                            : t("auth.resendOtp")}
                      </Button>

                      <Button
                        type="submit"
                        disabled={isResettingForgotPassword}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 font-semibold"
                      >
                        {isResettingForgotPassword ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t("auth.resettingPassword")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4" />
                            {t("auth.resetPassword")}
                          </span>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <form id="login-form" onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    {t("auth.email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="bg-background border-input focus-visible:ring-primary h-11 text-foreground"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground">
                      {t("auth.password")}
                    </Label>
                    <Button
                      type="button"
                      variant="link"
                      onClick={handleOpenForgotPassword}
                      className="h-auto p-0 text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      {t("auth.forgotPassword")}
                    </Button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    form="login-form"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background border-input focus-visible:ring-primary h-11 text-foreground"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-semibold mt-2"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("auth.loggingIn")}
                    </span>
                  ) : (
                    t("auth.login")
                  )}
                </Button>
              </form>
            )}
          </TabsContent>

          {/* ── Register tab ─────────────────────────────────────────── */}
          <TabsContent value="register">
            <form id="register-form" onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-email" className="text-foreground">
                  {t("auth.email")}
                </Label>
                <Input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="bg-background border-input focus-visible:ring-primary h-11 text-foreground"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground">
                  {t("auth.chooseUsername")}
                </Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Streamer123"
                  className="bg-background border-input focus-visible:ring-primary h-11 text-foreground"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password" className="text-foreground">
                  {t("auth.password")}
                </Label>
                <Input
                  id="reg-password"
                  type="password"
                  form="register-form"
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
                  className="bg-background border-input focus-visible:ring-primary h-11 text-foreground"
                  minLength={8}
                  required
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  {t("auth.passwordHint")}
                </p>
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-semibold mt-4"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("auth.creatingAccount")}
                  </span>
                ) : (
                  t("auth.signUp")
                )}
              </Button>
            </form>
          </TabsContent>

          {/* ── Social separator ──────────────────────────────────────── */}
          {!(activeTab === "login" && isForgotPasswordFlow) && (
            <>
              <div className="mt-6 mb-4 relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full bg-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("auth.orContinueWith")}
                  </span>
                </div>
              </div>

              {/* ── Social buttons ────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  type="button"
                  disabled={isSubmitting}
                  className="bg-transparent border-input hover:bg-accent text-foreground h-11"
                >
                  <Github className="mr-2 h-4 w-4" />
                  Github
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleGoogleLogin}
                  className="bg-transparent border-input hover:bg-accent text-foreground h-11 flex items-center"
                >
                  <svg
                    className="mr-2 h-4 w-4"
                    version="1.1"
                    viewBox="0 0 48 48"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  Google
                </Button>
              </div>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
