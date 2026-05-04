import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Menu, Video, Radio, RefreshCw } from "lucide-react";
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { UserMenu, AuthModal } from "@/features/auth";
import { NotificationBell } from "@/widgets/notification-bell/NotificationBell";
import { useAuth } from "@/app/providers/AuthContext";
import { useStreamContext } from "@/app/providers/StreamContext";
import { useI18n } from "@/shared/i18n";

export function Header() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { activeRoom, hasActiveStream, refreshActiveRoom } = useStreamContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const isCurrentlyLive = activeRoom?.status === "LIVE" || activeRoom?.status === "RECONNECTING";
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const keyword = params.get("q")?.trim() ?? "";

    if (location.pathname.startsWith("/browse")) {
      setSearchQuery(keyword);
      return;
    }

    setSearchQuery("");
  }, [location.pathname, location.search]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const keyword = searchQuery.trim();
    if (!keyword) {
      navigate("/browse");
      return;
    }

    const searchParams = new URLSearchParams({
      q: keyword,
      type: "ALL",
      limit: "8",
    });

    navigate(`/browse?${searchParams.toString()}`);
  };

  useLayoutEffect(() => {
    const headerNode = headerRef.current;
    if (!headerNode) {
      return;
    }

    const updateOffset = () => {
      const height = headerNode.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--app-header-offset",
        `${Math.ceil(height)}px`,
      );
    };

    updateOffset();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateOffset);
      return () => {
        window.removeEventListener("resize", updateOffset);
      };
    }

    const resizeObserver = new ResizeObserver(updateOffset);
    resizeObserver.observe(headerNode);
    return () => resizeObserver.disconnect();
  }, [hasActiveStream, activeRoom?.title]);

  return (
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 bg-background border-b border-border z-50"
    >
      {hasActiveStream && activeRoom && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2">
          <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
              <Radio className={`h-4 w-4 ${isCurrentlyLive ? "animate-pulse text-red-500" : "text-amber-500"}`} />
              <span className="truncate font-medium">
                {isCurrentlyLive ? t("header.activeLive") : t("header.pendingLive")}
                {activeRoom.title ? `: ${activeRoom.title}` : ""}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshActiveRoom()}
                className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/20 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black/35"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("header.refreshStatus")}
              </button>
              <Link
                to="/dashboard"
                className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                {t("header.backToStudio")}
              </Link>
            </div>
          </div>
        </div>
      )}

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
          <form className="relative" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder={t("header.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary text-foreground border border-border rounded px-3 py-1.5 pr-10 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
              aria-label={t("header.search")}
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link 
              to={hasActiveStream ? "/dashboard" : "/livestream/new"}
              className="p-2 hover:bg-accent hover:text-accent-foreground rounded text-foreground transition-colors" 
              title={hasActiveStream ? t("header.activeStreamTitle") : t("header.goLive")}
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
