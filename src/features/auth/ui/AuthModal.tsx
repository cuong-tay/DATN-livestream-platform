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
  Label,
  Separator,
} from "@/shared/ui";
import { AlertCircle, Github, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/app/providers/AuthContext";

// ── Props ────────────────────────────────────────────────────────────────────

interface AuthModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
}

// ── Component ────────────────────────────────────────────────────────────────

export function AuthModal({
  isOpen,
  onOpenChange,
  defaultTab = "login",
}: AuthModalProps) {
  const { login, register } = useAuth();
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

  // ── Reset state khi chuyển tab ─────────────────────────────────────────
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as "login" | "register");
    setErrorMessage(null);
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
        err instanceof Error ? err.message : "Đăng nhập thất bại",
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
        err instanceof Error ? err.message : "Đăng ký thất bại",
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
      "Google login chưa được cấu hình. Vui lòng đăng nhập bằng email.",
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground p-6 shadow-2xl gap-0">
        <DialogHeader className="mb-6 flex flex-col items-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <Play className="w-6 h-6 text-primary-foreground fill-current" />
          </div>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {activeTab === "login" ? "Welcome back" : "Create an account"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-2 text-center">
            {activeTab === "login"
              ? "Đăng nhập để theo dõi streamer yêu thích"
              : "Đăng ký để bắt đầu trải nghiệm livestream"}
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
              Log In
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="rounded-md data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground transition-all font-semibold"
            >
              Sign Up
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
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
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
                    Password
                  </Label>
                  <a
                    href="#"
                    className="text-xs text-primary hover:text-primary/80 font-medium"
                  >
                    Forgot password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
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
                    Đang đăng nhập…
                  </span>
                ) : (
                  "Log In"
                )}
              </Button>
            </form>
          </TabsContent>

          {/* ── Register tab ─────────────────────────────────────────── */}
          <TabsContent value="register">
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-email" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="reg-email"
                  type="email"
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
                  Choose a Username
                </Label>
                <Input
                  id="username"
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
                  Password
                </Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="bg-background border-input focus-visible:ring-primary h-11 text-foreground"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-semibold mt-4"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tạo tài khoản…
                  </span>
                ) : (
                  "Sign Up"
                )}
              </Button>
            </form>
          </TabsContent>

          {/* ── Social separator ──────────────────────────────────────── */}
          <div className="mt-6 mb-4 relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full bg-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
