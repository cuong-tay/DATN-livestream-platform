import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { notificationService, type NotificationItem } from "@/shared/api/notification.service";
import { useAuth } from "@/app/providers/AuthContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  Button
} from "@/shared/ui";

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchUnreadCount = async () => {
      try {
        const res = await notificationService.getUnreadCount();
        setUnreadCount(res.data.unreadCount);
      } catch {
        // fail silently
      }
    };

    fetchUnreadCount();
    const intervalId = setInterval(fetchUnreadCount, 30000); // Check every 30s

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await notificationService.getNotifications({ page: 0, size: 10 });
      setNotifications(res.data.content);
    } catch {
      // fail silently
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
    } catch {
      // 
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // 
    }
  };

  if (!isAuthenticated) {
    return (
      <button className="p-2 text-muted-foreground opacity-50 cursor-not-allowed hidden sm:block">
        <Bell className="w-5 h-5" />
      </button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 hover:bg-accent hover:text-accent-foreground rounded-full text-foreground transition-colors focus:outline-none">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center p-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] p-0 border border-border shadow-2xl bg-card text-foreground">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <DropdownMenuLabel className="p-0 text-base font-bold">Thông báo</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="h-8 text-xs font-medium text-primary hover:text-primary/80">
              Đánh dấu tất cả đã đọc
            </Button>
          )}
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Đang tải...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Chưa có thông báo nào.</div>
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
                      {new Date(n.createdAt).toLocaleString("vi-VN", { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
