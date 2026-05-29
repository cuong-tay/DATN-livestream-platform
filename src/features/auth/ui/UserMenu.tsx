import {
  LogOut,
  Laptop,
  Moon,
  Settings,
  ShieldAlert,
  Sun,
  User,
  Video,
  Wallet,
  MonitorPlay,
  Languages,
  Flag,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/shared/ui";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import type { UserProfile } from "@/entities/user";
import { useAuth } from "@/app/providers/AuthContext";
import { languageLabels, useI18n, useI18nFormatters, type LanguageCode } from "@/shared/i18n";

type ThemeMode = "light" | "dark" | "system";

const themeLabels: Record<LanguageCode, { label: string; modes: Record<ThemeMode, string> }> = {
  en: {
    label: "Theme",
    modes: { light: "Light", dark: "Dark", system: "System" },
  },
  vi: {
    label: "Giao dien",
    modes: { light: "Sang", dark: "Toi", system: "Theo he thong" },
  },
  es: {
    label: "Tema",
    modes: { light: "Claro", dark: "Oscuro", system: "Sistema" },
  },
};

function normalizeTheme(value: string | undefined): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

interface UserMenuProps {
  user: UserProfile;
}

export function UserMenu({ user }: UserMenuProps) {
  const { logout } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const { formatNumber } = useI18nFormatters();
  const { theme, setTheme } = useTheme();
  const activeTheme = normalizeTheme(theme);
  const themeCopy = themeLabels[language];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-2 hover:bg-accent hover:text-accent-foreground rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary text-foreground">
          <User className="w-5 h-5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 bg-background border-border text-foreground rounded-lg shadow-xl shadow-black/10 p-1"
      >
        <DropdownMenuLabel className="flex items-center gap-3 p-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            {user.avatar ? (
              <img src={user.avatar} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="font-bold text-lg text-primary-foreground">{user.username[0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-base leading-none mb-1 text-foreground">
              {user.username}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {t("menu.online")}
            </span>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="bg-border mb-1" />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
            <Link to={`/channel/${user.userId}`} className="flex w-full items-center">
              <MonitorPlay className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{t("menu.channel")}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
            <Link to="/dashboard" className="flex w-full items-center">
              <Video className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{t("menu.dashboard")}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
            <Link to="/reports/me" className="flex w-full items-center">
              <Flag className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>Báo cáo của tôi</span>
            </Link>
          </DropdownMenuItem>
          {user.role === "ADMIN" && (
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <Link to="/admin" className="flex w-full items-center">
                <ShieldAlert className="w-4 h-4 mr-2 text-muted-foreground" />
                <span>{t("menu.admin")}</span>
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="flex justify-between cursor-pointer focus:bg-accent focus:text-accent-foreground">

            <div className="flex items-center">
              <Wallet className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{t("menu.wallet")}</span>
            </div>
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              {formatNumber(user.balance ?? 0)} {t("common.bits")}
            </span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="bg-border my-1" />

        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <Moon className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{themeCopy.label}: {themeCopy.modes[activeTheme]}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="bg-background border-border text-foreground z-50">
                <DropdownMenuRadioGroup value={activeTheme} onValueChange={(val) => setTheme(val)}>
                  <DropdownMenuRadioItem value="light">
                    <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
                    {themeCopy.modes.light}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {themeCopy.modes.dark}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Laptop className="mr-2 h-4 w-4 text-muted-foreground" />
                    {themeCopy.modes.system}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <Languages className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{t("menu.lang")}: {languageLabels[language]}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="bg-background border-border text-foreground z-50">
                <DropdownMenuRadioGroup value={language} onValueChange={(val) => setLanguage(val as LanguageCode)}>
                  <DropdownMenuRadioItem value="vi">{languageLabels.vi}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="en">{languageLabels.en}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="es">{languageLabels.es}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem asChild className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
            <Link to="/settings" className="flex w-full items-center">
              <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{t("menu.settings")}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="bg-border my-1" />

        <DropdownMenuItem 
          onClick={logout}
          className="cursor-pointer focus:bg-destructive focus:text-destructive-foreground text-destructive transition-colors"
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span>{t("menu.logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
