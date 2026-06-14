import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { notificationService, type NotificationItem } from "@/shared/api/notification.service";
import { useAuth } from "@/app/providers/AuthContext";
import { hasHttpStatus } from "@/shared/api/httpClient";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  Button
} from "@/shared/ui";
import { useI18n } from "@/shared/i18n";
import {
  useNotificationPermission,
  useRealtimeNotifications,
  showBrowserNotification,
  playNotificationSound,
  type RealtimeNotification,
} from "@/shared/lib/browserNotification";
import { subscribeToTopic, ensureStompConnection } from "@/shared/lib/stompClient";
import { parseChatTimestamp } from "@/shared/lib/formatters";

const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
  const { isAuthenticated, logout } = useAuth();
  const { language, t } = useI18n();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bellAnimating, setBellAnimating] = useState(false);
  const prevUnreadCountRef = useRef(0);

  const {
    permission,
    showPrompt,
    requestPermission,
    dismissPrompt,
  } = useNotificationPermission();

  // STOMP connection when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      ensureStompConnection();
    }
  }, [isAuthenticated]);

  const triggerBellEffect = useCallback(() => {
    setBellAnimating(true);
    setTimeout(() => setBellAnimating(false), 1500);
  }, []);

  // STOMP realtime handler — instant notification
  const handleRealtimeNotification = useCallback(
    (payload: RealtimeNotification) => {
      setUnreadCount((prev) => prev + 1);
      prevUnreadCountRef.current += 1;

      const newItem: NotificationItem = {
        id: payload.id ?? Date.now(),
        type: (payload.type as NotificationItem["type"]) ?? "STREAM_LIVE",
        message: payload.message,
        isRead: false,
        createdAt: payload.createdAt ?? new Date().toISOString(),
      };
      setNotifications((prev) => [newItem, ...prev].slice(0, 20));

      triggerBellEffect();

      if (permission === "granted") {
        playNotificationSound();

        if (document.hidden) {
          showBrowserNotification(payload.title ?? t("notifications.title"), {
            body: payload.message,
            tag: `notif-${newItem.id}`,
            onClick: () => {
              if (payload.link) {
                window.location.href = payload.link;
              }
            },
          });
        }
      }
    },
    [permission, t, triggerBellEffect],
  );

  // STOMP subscription
  useRealtimeNotifications(
    isAuthenticated,
    subscribeToTopic,
    handleRealtimeNotification,
  );

  // Polling fallback — syncs unread count in case STOMP misses anything
  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;

    const fetchUnreadCount = async () => {
      try {
        const res = await notificationService.getUnreadCount();
        if (!isMounted) return;

        const newCount = res.data.unreadCount;
        const prevCount = prevUnreadCountRef.current;

        if (newCount > prevCount) {
          triggerBellEffect();

          if (permission === "granted" && document.hidden) {
            showBrowserNotification(t("notifications.title"), {
              body: t("notifications.newNotification", { count: newCount - prevCount }),
              tag: `notif-poll-${Date.now()}`,
            });
          }
        }

        prevUnreadCountRef.current = newCount;
        setUnreadCount(newCount);
      } catch (error) {
        if (hasHttpStatus(error, 403) || hasHttpStatus(error, 401)) {
          logout();
        }
      }
    };

    fetchUnreadCount();
    const intervalId = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isAuthenticated, logout, permission, t, triggerBellEffect]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await notificationService.getNotifications({ page: 0, size: 10 });
      setNotifications(res.data.content);
    } catch (error) {
      if (hasHttpStatus(error, 403) || hasHttpStatus(error, 401)) {
        logout();
        return;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      prevUnreadCountRef.current = Math.max(0, prevUnreadCountRef.current - 1);
    } catch (error) {
      if (hasHttpStatus(error, 403) || hasHttpStatus(error, 401)) {
        logout();
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      prevUnreadCountRef.current = 0;
    } catch (error) {
      if (hasHttpStatus(error, 403) || hasHttpStatus(error, 401)) {
        logout();
      }
    }
  };

  const handleRequestPermission = async () => {
    await requestPermission();
  };

  if (!isAuthenticated) {
    return (
      <button className="p-2 text-muted-foreground opacity-50 cursor-not-allowed hidden sm:block">
        <Bell className="w-5 h-5" />
      </button>
    );
  }

  const BellIcon = bellAnimating ? BellRing : Bell;

  return (
    <div className="relative">
      {showPrompt && permission === "default" && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[320px] rounded-lg border border-border bg-card p-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-1.5">
              <BellRing className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{t("notifications.permissionTitle")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("notifications.permissionDescription")}</p>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={handleRequestPermission}>
                  {t("notifications.permissionAllow")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={dismissPrompt}>
                  {t("notifications.permissionLater")}
                </Button>
              </div>
            </div>
            <button onClick={dismissPrompt} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <button className="relative p-2 hover:bg-accent hover:text-accent-foreground rounded-full text-foreground transition-colors focus:outline-none">
            <BellIcon className={`w-5 h-5 ${bellAnimating ? "animate-bounce text-primary" : ""}`} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center p-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[380px] p-0 border border-border shadow-2xl bg-card text-foreground">
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
            <DropdownMenuLabel className="p-0 text-base font-bold">{t("notifications.title")}</DropdownMenuLabel>
            <div className="flex items-center gap-2">
              {permission !== "granted" && permission !== "unsupported" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRequestPermission}
                  className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                  title={t("notifications.enableBrowser")}
                >
                  <BellRing className="w-3.5 h-3.5 mr-1" />
                  {t("notifications.enableBrowser")}
                </Button>
              )}
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="h-8 text-xs font-medium text-primary hover:text-primary/80">
                  {t("notifications.markAllRead")}
                </Button>
              )}
            </div>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">{t("notifications.loading")}</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">{t("notifications.empty")}</div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={`p-4 gap-3 flex cursor-default hover:bg-accent/50 transition-colors ${!n.isRead ? 'bg-primary/5' : ''}`}
                    onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                  >
                    <div className="relative mt-1">
                      <div className={`w-2 h-2 rounded-full ${!n.isRead ? 'bg-primary' : 'bg-transparent'}`} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className={`text-sm ${!n.isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                        {n.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {parseChatTimestamp(n.createdAt).toLocaleString(language === "vi" ? "vi-VN" : language, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
