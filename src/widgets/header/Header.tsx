import { Link, useLocation } from "react-router-dom";
import { Search, Menu, Bell, Video } from "lucide-react";
import { useState } from "react";
import { UserMenu, AuthModal } from "@/features/auth";
import { NotificationBell } from "@/widgets/notification-bell/NotificationBell";
import { useAuth } from "@/app/providers/AuthContext";
import { useI18n } from "@/shared/i18n";

export function Header() {
  const { t } = useI18n();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  return (
    <header className="fixed top-0 left-0 right-0 bg-background border-b border-border z-50">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-lg text-primary-foreground">▶</span>
            </div>
            <span className="font-bold text-lg hidden sm:block text-foreground">LiveStream</span>
          </Link>

          <nav className="hidden md:flex items-center gap-4">
            <Link
              to="/browse"
              className={`px-3 py-1.5 rounded hover:bg-accent hover:text-accent-foreground transition text-foreground ${
                location.pathname.startsWith("/browse") ? "bg-accent" : ""
              }`}
            >
              {t("header.browse")}
            </Link>
          </nav>
        </div>

        <div className="flex-1 max-w-md mx-4 hidden sm:block">
          <div className="relative">
            <input
              type="text"
              placeholder={t("header.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary text-foreground border border-border rounded px-3 py-1.5 pr-10 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link 
              to="/livestream/new" 
              className="p-2 hover:bg-accent hover:text-accent-foreground rounded text-foreground transition-colors" 
              title={t("header.goLive")}
            >
              <Video className="w-5 h-5" />
            </Link>
          ) : (
            <button 
              onClick={() => { setAuthTab("login"); setAuthOpen(true); }}
              className="p-2 hover:bg-accent hover:text-accent-foreground rounded text-foreground transition-colors" 
              title={t("header.loginToLive")}
            >
              <Video className="w-5 h-5" />
            </button>
          )}

          <NotificationBell />
          
          {isAuthenticated && user ? (
            <UserMenu user={user} />
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setAuthTab("login"); setAuthOpen(true); }}
                className="px-4 py-1.5 hover:bg-accent hover:text-accent-foreground text-foreground rounded-md text-sm font-semibold transition hidden sm:block"
              >
                {t("header.logIn")}
              </button>
              <button 
                onClick={() => { setAuthTab("register"); setAuthOpen(true); }}
                className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-semibold transition"
              >
                {t("header.signUp")}
              </button>
            </div>
          )}

          <button className="p-2 hover:bg-accent hover:text-accent-foreground rounded text-foreground md:hidden">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      <AuthModal 
        isOpen={isAuthOpen} 
        onOpenChange={setAuthOpen} 
        defaultTab={authTab}
      />
    </header>
  );
}
