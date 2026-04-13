import {
  LogOut,
  Moon,
  Settings,
  User,
  Video,
  Wallet,
  MonitorPlay,
  Languages,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Switch,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/shared/ui";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type { UserProfile } from "@/entities/user";
import { useAuth } from "@/app/providers/AuthContext";
import { useI18n, type LanguageCode, translations } from "@/shared/i18n";


interface UserMenuProps {
  user: UserProfile;
}

export function UserMenu({ user }: UserMenuProps) {
  const { logout } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains("dark") || true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleTheme = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDarkMode(!isDarkMode);
  };

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
          <DropdownMenuItem className="flex justify-between cursor-pointer focus:bg-accent focus:text-accent-foreground">

            <div className="flex items-center">
              <Wallet className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{t("menu.wallet")}</span>
            </div>
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              {user.balance?.toLocaleString() || 0} Bits
            </span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="bg-border my-1" />

        <DropdownMenuGroup>
          <DropdownMenuItem 
            onClick={toggleTheme}
            className="flex justify-between cursor-pointer focus:bg-accent focus:text-accent-foreground"
          >
            <div className="flex items-center">
              <Moon className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{t("menu.darkTheme")}</span>
            </div>
            <Switch checked={isDarkMode} />
          </DropdownMenuItem>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
              <Languages className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{t("menu.lang")}: {t(`menu.lang.${language}` as keyof typeof translations["en"])}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="bg-background border-border text-foreground z-50">
                <DropdownMenuRadioGroup value={language} onValueChange={(val) => setLanguage(val as LanguageCode)}>
                  <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="vi">Tiếng Việt</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="es">Español</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
            <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
            <span>{t("menu.settings")}</span>
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
