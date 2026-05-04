import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock3,
  ImagePlus,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/AuthContext";
import {
  authService,
  type UserResponse,
  type VerificationAction,
  type VerificationResponse,
} from "@/shared/api/auth.service";
import { extractApiErrorMessage } from "@/shared/api/httpClient";
import { useI18n } from "@/shared/i18n";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Progress,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui";

type SettingsTab = "profile" | "email" | "password";

interface VerificationUiState {
  action: VerificationAction;
  delivery: string;
  expiresAt: number;
  resendAvailableAt: number;
}

const OTP_LENGTH = 6;
const AVATAR_MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function toVerificationUiState(response: VerificationResponse): VerificationUiState {
  const now = Date.now();

  return {
    action: response.action,
    delivery: response.delivery,
    expiresAt: now + response.expiresInSeconds * 1000,
    resendAvailableAt: now + response.resendCooldownSeconds * 1000,
  };
}

function sanitizeOtpInput(rawValue: string): string {
  return rawValue.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export function SettingsPage() {
  const { t } = useI18n();
  const { user, isLoading, syncUserProfile } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const [profileUsername, setProfileUsername] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [localAvatarPreviewUrl, setLocalAvatarPreviewUrl] = useState<string | null>(null);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarProgressLabel, setAvatarProgressLabel] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailVerification, setEmailVerification] = useState<VerificationUiState | null>(null);
  const [isRequestingEmailOtp, setIsRequestingEmailOtp] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordOtp, setPasswordOtp] = useState("");
  const [passwordVerification, setPasswordVerification] = useState<VerificationUiState | null>(null);
  const [isRequestingPasswordOtp, setIsRequestingPasswordOtp] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [tickNow, setTickNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTickNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    setProfileUsername(user.username ?? "");
    setProfileAvatarUrl(user.avatar ?? "");
    setSelectedAvatarFile(null);
    setIsRemovingAvatar(false);
    setAvatarProgress(0);
    setAvatarProgressLabel(null);
  }, [user]);

  useEffect(() => {
    if (!selectedAvatarFile) {
      setLocalAvatarPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedAvatarFile);
    setLocalAvatarPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedAvatarFile]);

  const emailOtpExpiresInSeconds = useMemo(
    () => (emailVerification ? Math.max(0, Math.ceil((emailVerification.expiresAt - tickNow) / 1000)) : 0),
    [emailVerification, tickNow],
  );

  const emailOtpCooldownSeconds = useMemo(
    () =>
      emailVerification
        ? Math.max(0, Math.ceil((emailVerification.resendAvailableAt - tickNow) / 1000))
        : 0,
    [emailVerification, tickNow],
  );

  const passwordOtpExpiresInSeconds = useMemo(
    () => (passwordVerification ? Math.max(0, Math.ceil((passwordVerification.expiresAt - tickNow) / 1000)) : 0),
    [passwordVerification, tickNow],
  );

  const passwordOtpCooldownSeconds = useMemo(
    () =>
      passwordVerification
        ? Math.max(0, Math.ceil((passwordVerification.resendAvailableAt - tickNow) / 1000))
        : 0,
    [passwordVerification, tickNow],
  );

  const draftAvatarPreview = useMemo(() => {
    if (localAvatarPreviewUrl) {
      return localAvatarPreviewUrl;
    }

    if (isRemovingAvatar) {
      return null;
    }

    const normalizedAvatar = profileAvatarUrl.trim();
    return normalizedAvatar.length > 0 ? normalizedAvatar : user?.avatar ?? null;
  }, [isRemovingAvatar, localAvatarPreviewUrl, profileAvatarUrl, user?.avatar]);

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!selectedFile) {
      return;
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.has(selectedFile.type)) {
      toast.error(t("settings.toast.avatarUnsupported"));
      return;
    }

    if (selectedFile.size > AVATAR_MAX_FILE_SIZE_BYTES) {
      toast.error(t("settings.toast.avatarTooLarge"));
      return;
    }

    setSelectedAvatarFile(selectedFile);
    setIsRemovingAvatar(false);
    setAvatarProgress(0);
    setAvatarProgressLabel(t("settings.toast.avatarSelected"));
  };

  const handleRemoveAvatar = () => {
    setSelectedAvatarFile(null);
    setIsRemovingAvatar(true);
    setAvatarProgress(0);
    setAvatarProgressLabel(t("settings.toast.avatarRemovePending"));
  };

  const handleCancelAvatarRemoval = () => {
    setIsRemovingAvatar(false);
    setAvatarProgress(0);
    setAvatarProgressLabel(null);
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) return;

    const normalizedUsername = profileUsername.trim();
    if (!normalizedUsername) {
      toast.error(t("settings.toast.usernameRequired"));
      return;
    }

    const shouldTrackAvatarProgress = isRemovingAvatar || Boolean(selectedAvatarFile);

    setIsSavingProfile(true);

    try {
      let nextAvatarUrl: string | null;
      const normalizedAvatarInput = profileAvatarUrl.trim();
      let shouldCallUpdateProfileApi = true;
      let resolvedProfileData: UserResponse | null = null;

      if (isRemovingAvatar) {
        setAvatarProgress(20);
        setAvatarProgressLabel(t("settings.toast.avatarDeleting"));
        nextAvatarUrl = null;
      } else if (selectedAvatarFile) {
        setAvatarProgress(5);
        setAvatarProgressLabel(t("settings.toast.avatarUploading"));

        const uploadedProfile = await authService.uploadAvatar(selectedAvatarFile, {
          onUploadProgress: (event) => {
            if (!event.total || event.total <= 0) {
              return;
            }

            const ratio = Math.min(1, Math.max(0, event.loaded / event.total));
            setAvatarProgress(Math.max(5, Math.min(90, Math.round(5 + ratio * 85))));
            setAvatarProgressLabel(t("settings.toast.avatarUploadingProgress", { percent: Math.round(ratio * 100) }));
          },
        });

        nextAvatarUrl = uploadedProfile.avatarUrl;
        setAvatarProgress(92);
        setAvatarProgressLabel(t("settings.toast.avatarSyncing"));

        resolvedProfileData = uploadedProfile;
        syncUserProfile(uploadedProfile);
        setProfileAvatarUrl(uploadedProfile.avatarUrl ?? "");

        // /auth/me/avatar already persists avatarUrl in DB. Only call /auth/me if username changed.
        shouldCallUpdateProfileApi = normalizedUsername !== uploadedProfile.username;
      } else {
        if (!normalizedAvatarInput) {
          nextAvatarUrl = null;
        } else {
          if (!isPublicHttpUrl(normalizedAvatarInput)) {
            toast.error(t("settings.toast.invalidAvatarUrl"));
            return;
          }
          nextAvatarUrl = normalizedAvatarInput;
        }
      }

      if (shouldCallUpdateProfileApi) {
        const response = await authService.updateMe({
          username: normalizedUsername,
          avatarUrl: nextAvatarUrl,
        });
        resolvedProfileData = response.data;
      }

      if (!resolvedProfileData) {
        throw new Error(t("settings.toast.profileSyncFailed"));
      }

      if (shouldTrackAvatarProgress) {
        setAvatarProgress(98);
        setAvatarProgressLabel(t("settings.toast.profileFinishing"));
      }

      if (shouldTrackAvatarProgress) {
        setAvatarProgress(100);
        setAvatarProgressLabel(t("settings.toast.avatarComplete"));
      }

      syncUserProfile(resolvedProfileData);
      setProfileUsername(resolvedProfileData.username);
      setProfileAvatarUrl(resolvedProfileData.avatarUrl ?? "");
      setSelectedAvatarFile(null);
      setIsRemovingAvatar(false);
      toast.success(t("settings.toast.profileSuccess"));

      if (shouldTrackAvatarProgress) {
        window.setTimeout(() => {
          setAvatarProgress(0);
          setAvatarProgressLabel(null);
        }, 1200);
      }
    } catch (error) {
      if (shouldTrackAvatarProgress) {
        setAvatarProgress(0);
      }
      toast.error(extractApiErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRequestEmailOtp = async () => {
    const normalizedNewEmail = newEmail.trim();

    if (!normalizedNewEmail) {
      toast.error(t("settings.toast.emailRequiredBeforeOtp"));
      return;
    }

    if (emailOtpCooldownSeconds > 0) {
      toast.error(t("settings.toast.otpCooldown", { seconds: emailOtpCooldownSeconds }));
      return;
    }

    setIsRequestingEmailOtp(true);

    try {
      const response = await authService.requestVerification({
        action: "CHANGE_EMAIL",
        newEmail: normalizedNewEmail,
      });

      setEmailVerification(toVerificationUiState(response.data));
      toast.success(t("settings.toast.emailOtpSent"));
    } catch (error) {
      toast.error(extractApiErrorMessage(error));
    } finally {
      setIsRequestingEmailOtp(false);
    }
  };

  const handleUpdateEmail = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedNewEmail = newEmail.trim();
    if (!normalizedNewEmail) {
      toast.error(t("settings.toast.emailRequired"));
      return;
    }

    if (emailOtp.length !== OTP_LENGTH) {
      toast.error(t("settings.toast.emailOtpInvalid"));
      return;
    }

    setIsUpdatingEmail(true);

    try {
      const response = await authService.updateEmail({
        newEmail: normalizedNewEmail,
        otp: emailOtp,
      });

      syncUserProfile(response.data);
      setNewEmail(response.data.email);
      setEmailOtp("");
      setEmailVerification(null);
      toast.success(t("settings.toast.emailSuccess"));
    } catch (error) {
      toast.error(extractApiErrorMessage(error));
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleRequestPasswordOtp = async () => {
    if (passwordOtpCooldownSeconds > 0) {
      toast.error(t("settings.toast.otpCooldown", { seconds: passwordOtpCooldownSeconds }));
      return;
    }

    setIsRequestingPasswordOtp(true);

    try {
      const response = await authService.requestVerification({
        action: "CHANGE_PASSWORD",
      });

      setPasswordVerification(toVerificationUiState(response.data));
      toast.success(t("settings.toast.passwordOtpSent"));
    } catch (error) {
      toast.error(extractApiErrorMessage(error));
    } finally {
      setIsRequestingPasswordOtp(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t("settings.toast.passwordFieldsRequired"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("settings.toast.passwordMismatch"));
      return;
    }

    if (passwordOtp.length !== OTP_LENGTH) {
      toast.error(t("settings.toast.passwordOtpInvalid"));
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const response = await authService.updatePassword({
        currentPassword,
        newPassword,
        confirmPassword,
        otp: passwordOtp,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOtp("");
      setPasswordVerification(null);
      toast.success(response.data.message || t("settings.toast.passwordSuccess"));
    } catch (error) {
      toast.error(extractApiErrorMessage(error));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <div className="h-full w-full bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-sky-500/15" />
        </div>

        <div className="relative mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-8 sm:py-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              {t("settings.badge")}
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{t("settings.title")}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="border-border bg-background/70 backdrop-blur-sm">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("settings.backHome")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 xl:grid-cols-[320px_1fr]">
        <Card className="border-border bg-card/95">
          <CardHeader>
            <CardTitle className="text-lg">{t("settings.currentInfoTitle")}</CardTitle>
            <CardDescription>{t("settings.currentInfoDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {draftAvatarPreview ? (
                <img
                  src={draftAvatarPreview}
                  alt={user.username}
                  className="h-14 w-14 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
                  {user.username[0]?.toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate font-semibold">{user.username}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <Separator />

            <div className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
              <p className="mb-2 font-semibold text-foreground">{t("settings.otpNoteTitle")}</p>
              <ul className="space-y-1.5">
                <li>{t("settings.otpNoteDigits")}</li>
                <li>{t("settings.otpNoteCooldown")}</li>
                <li>{t("settings.otpNoteRequired")}</li>
              </ul>
            </div>

            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              <p className="font-semibold">{t("settings.mailConfigNote")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/95">
          <CardContent className="p-4 sm:p-6">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)}>
              <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-xl bg-secondary/70 p-1">
                <TabsTrigger value="profile" className="rounded-lg py-2.5 data-[state=active]:bg-background">
                  <UserRound className="mr-2 h-4 w-4" />
                  {t("settings.tabs.profile")}
                </TabsTrigger>
                <TabsTrigger value="email" className="rounded-lg py-2.5 data-[state=active]:bg-background">
                  <Mail className="mr-2 h-4 w-4" />
                  {t("settings.tabs.email")}
                </TabsTrigger>
                <TabsTrigger value="password" className="rounded-lg py-2.5 data-[state=active]:bg-background">
                  <Lock className="mr-2 h-4 w-4" />
                  {t("settings.tabs.password")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="mt-6">
                <div className="rounded-xl border border-border bg-background/40 p-4 sm:p-5">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold">{t("settings.profile.title")}</h2>
                  </div>

                  <form className="space-y-4" onSubmit={handleSaveProfile}>
                    <div className="space-y-2">
                      <Label htmlFor="profile-username">{t("settings.profile.username")}</Label>
                      <Input
                        id="profile-username"
                        value={profileUsername}
                        onChange={(event) => setProfileUsername(event.target.value)}
                        placeholder={t("settings.profile.usernamePlaceholder")}
                        disabled={isSavingProfile}
                        required
                      />
                    </div>

                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                    />

                    <div className="rounded-2xl border border-border bg-gradient-to-br from-cyan-500/5 via-background to-emerald-500/5 p-4 sm:p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          {draftAvatarPreview ? (
                            <img
                              src={draftAvatarPreview}
                              alt={t("settings.profile.avatarPreviewAlt")}
                              className="h-20 w-20 rounded-2xl border border-border object-cover shadow-sm"
                            />
                          ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-border bg-background/70">
                              <UploadCloud className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}

                          <div className="space-y-1">
                            <p className="font-semibold">{t("settings.profile.avatarTitle")}</p>
                            <p className="text-xs text-muted-foreground">{t("settings.profile.avatarHelp")}</p>
                            {selectedAvatarFile && (
                              <p className="text-xs text-cyan-300">
                                {t("settings.profile.selectedFile", {
                                  name: selectedAvatarFile.name,
                                  size: formatFileSize(selectedAvatarFile.size),
                                })}
                              </p>
                            )}
                            {isRemovingAvatar && (
                              <p className="text-xs text-amber-300">
                                {t("settings.profile.removePending")}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={isSavingProfile}
                          >
                            <ImagePlus className="mr-2 h-4 w-4" />
                            {draftAvatarPreview ? t("settings.profile.changeImage") : t("settings.profile.chooseImage")}
                          </Button>

                          {(draftAvatarPreview || selectedAvatarFile || isRemovingAvatar) && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={isRemovingAvatar ? handleCancelAvatarRemoval : handleRemoveAvatar}
                              disabled={isSavingProfile}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {isRemovingAvatar ? t("settings.profile.cancelRemove") : t("settings.profile.removeAvatar")}
                            </Button>
                          )}
                        </div>
                      </div>

                      {avatarProgressLabel && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{avatarProgressLabel}</span>
                            <span className="font-semibold text-foreground">{avatarProgress}%</span>
                          </div>
                          <Progress value={avatarProgress} className="h-2.5" />
                        </div>
                      )}

                      <div className="mt-4 space-y-2">
                        <Label htmlFor="profile-avatar-url">{t("settings.profile.avatarUrl")}</Label>
                        <Input
                          id="profile-avatar-url"
                          value={profileAvatarUrl}
                          onChange={(event) => setProfileAvatarUrl(event.target.value)}
                          placeholder={t("settings.profile.avatarUrlPlaceholder")}
                          disabled={isSavingProfile || isRemovingAvatar || Boolean(selectedAvatarFile)}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("settings.profile.avatarUrlHelp")}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isSavingProfile} className="min-w-[180px]">
                        {isSavingProfile ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("settings.profile.saving")}
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            {t("settings.profile.save")}
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </TabsContent>

              <TabsContent value="email" className="mt-6 space-y-4">
                <div className="rounded-xl border border-border bg-background/40 p-4 sm:p-5">
                  <h2 className="text-lg font-semibold">{t("settings.email.stepRequest")}</h2>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor="new-email">{t("settings.email.newEmail")}</Label>
                    <Input
                      id="new-email"
                      type="email"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                      placeholder={t("settings.email.placeholder")}
                      disabled={isRequestingEmailOtp}
                    />
                  </div>

                  {emailVerification && (
                    <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
                      <p className="font-medium">{t("settings.email.otpSentTo", { delivery: emailVerification.delivery })}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs">
                        <Clock3 className="h-3.5 w-3.5" />
                        {t("settings.otp.expiresIn", { time: formatCountdown(emailOtpExpiresInSeconds) })}
                      </p>
                      <p className="mt-1 text-xs">{t("settings.otp.resendIn", { time: formatCountdown(emailOtpCooldownSeconds) })}</p>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void handleRequestEmailOtp()}
                      disabled={isRequestingEmailOtp || emailOtpCooldownSeconds > 0}
                    >
                      {isRequestingEmailOtp ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("settings.otp.sending")}
                        </>
                      ) : emailOtpCooldownSeconds > 0 ? (
                        t("settings.otp.resendAfterSeconds", { seconds: emailOtpCooldownSeconds })
                      ) : (
                        t("settings.email.sendOtp")
                      )}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background/40 p-4 sm:p-5">
                  <h2 className="text-lg font-semibold">{t("settings.email.stepUpdate")}</h2>

                  <form className="mt-4 space-y-4" onSubmit={handleUpdateEmail}>
                    <div className="space-y-2">
                      <Label htmlFor="email-otp">{t("settings.email.otpLabel")}</Label>
                      <Input
                        id="email-otp"
                        value={emailOtp}
                        onChange={(event) => setEmailOtp(sanitizeOtpInput(event.target.value))}
                        placeholder={t("common.otpPlaceholder")}
                        inputMode="numeric"
                        maxLength={OTP_LENGTH}
                        disabled={isUpdatingEmail}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isUpdatingEmail || !newEmail.trim()}>
                        {isUpdatingEmail ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("settings.email.updating")}
                          </>
                        ) : (
                          t("settings.email.update")
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </TabsContent>

              <TabsContent value="password" className="mt-6 space-y-4">
                <div className="rounded-xl border border-border bg-background/40 p-4 sm:p-5">
                  <h2 className="text-lg font-semibold">{t("settings.password.stepRequest")}</h2>

                  {passwordVerification && (
                    <div className="mt-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-sm text-indigo-100">
                      <p className="font-medium">{t("settings.email.otpSentTo", { delivery: passwordVerification.delivery })}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs">
                        <Clock3 className="h-3.5 w-3.5" />
                        {t("settings.otp.expiresIn", { time: formatCountdown(passwordOtpExpiresInSeconds) })}
                      </p>
                      <p className="mt-1 text-xs">{t("settings.otp.resendIn", { time: formatCountdown(passwordOtpCooldownSeconds) })}</p>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void handleRequestPasswordOtp()}
                      disabled={isRequestingPasswordOtp || passwordOtpCooldownSeconds > 0}
                    >
                      {isRequestingPasswordOtp ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("settings.otp.sending")}
                        </>
                      ) : passwordOtpCooldownSeconds > 0 ? (
                        t("settings.otp.resendAfterSeconds", { seconds: passwordOtpCooldownSeconds })
                      ) : (
                        t("settings.password.sendOtp")
                      )}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background/40 p-4 sm:p-5">
                  <h2 className="text-lg font-semibold">{t("settings.password.stepUpdate")}</h2>

                  <form className="mt-4 space-y-4" onSubmit={handleUpdatePassword}>
                    <div className="space-y-2">
                      <Label htmlFor="current-password">{t("settings.password.current")}</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        disabled={isUpdatingPassword}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">{t("settings.password.new")}</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        disabled={isUpdatingPassword}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">{t("settings.password.confirm")}</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        disabled={isUpdatingPassword}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password-otp">{t("settings.password.otpLabel")}</Label>
                      <Input
                        id="password-otp"
                        value={passwordOtp}
                        onChange={(event) => setPasswordOtp(sanitizeOtpInput(event.target.value))}
                        placeholder={t("common.otpPlaceholder")}
                        inputMode="numeric"
                        maxLength={OTP_LENGTH}
                        disabled={isUpdatingPassword}
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isUpdatingPassword}>
                        {isUpdatingPassword ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("settings.password.updating")}
                          </>
                        ) : (
                          t("settings.password.update")
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </TabsContent>
            </Tabs>

            <Separator className="my-6" />

            <div className="flex justify-end">
              <Button asChild variant="outline">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("settings.backHome")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
