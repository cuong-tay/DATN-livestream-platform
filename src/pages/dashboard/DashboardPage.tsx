import { useState, useEffect } from "react";
import { 
  Video, 
  BarChart3, 
  Copy, 
  Eye, 
  EyeOff, 
  Check,
  Loader2,
  Play,
  Square,
  Edit2,
  Radio,
  History,
  RefreshCw,
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { roomService, type RoomDetail, type RoomLiveItem, type StreamSession } from "@/shared/api/room.service";
import { extractApiErrorMessage } from "@/shared/api/httpClient";
import { statisticsService, type StatsDashboard } from "@/shared/api/statistics.service";
import { useStreamContext } from "@/app/providers/StreamContext";
import { useCategories, type CategoryItem } from "@/entities/category";
import { 
  Button, 
  Input, 
  Label, 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "@/shared/ui";
import { toast } from "sonner";
import { VideoPlayer } from "@/features/play-stream";
import { ChatBoard } from "@/widgets/chat-board";
import { Link } from "react-router-dom";
import { useI18n, useI18nFormatters } from "@/shared/i18n";

const STREAM_KEY_STORAGE_KEY = "roomStreamKeys";

function readStreamKeyCache(): Record<string, string> {
  try {
    const rawValue = localStorage.getItem(STREAM_KEY_STORAGE_KEY);
    return rawValue ? (JSON.parse(rawValue) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function getCachedStreamKey(roomId: number): string | undefined {
  return readStreamKeyCache()[String(roomId)];
}

function cacheStreamKey(roomId: number, streamKey?: string): string | undefined {
  if (!streamKey) {
    return undefined;
  }

  const nextCache = { ...readStreamKeyCache(), [String(roomId)]: streamKey };
  localStorage.setItem(STREAM_KEY_STORAGE_KEY, JSON.stringify(nextCache));
  return streamKey;
}

async function writeToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function isActiveRoomStatus(status?: string): boolean {
  return status === "PENDING" || status === "LIVE" || status === "RECONNECTING";
}

function pickCurrentRoom(rooms: RoomLiveItem[]): RoomLiveItem | undefined {
  return rooms.find((item) => isActiveRoomStatus(item.status));
}

export function DashboardPage() {
  const { t } = useI18n();
  const { formatDate, formatNumber, formatCurrency } = useI18nFormatters();
  const { categories } = useCategories();
  const { syncActiveRoom, clearActiveRoom } = useStreamContext();
  
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // States cho form cập nhật
  const [editTitle, setEditTitle] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<number>(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [showStreamKey, setShowStreamKey] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Lịch sử phiên Live (VOD)
  const [sessions, setSessions] = useState<StreamSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [stats, setStats] = useState<StatsDashboard | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isRefreshingStudio, setIsRefreshingStudio] = useState(false);

  // Create room dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomCategoryId, setNewRoomCategoryId] = useState(0);

  // Controlled tab
  const [activeStudioTab, setActiveStudioTab] = useState("settings");

  // ── Load thông tin phòng ban đầu ──────────────────────────────────────
  const fetchMyRoom = async () => {
    try {
      const res = await roomService.getMyRooms({ page: 0, size: 20 });
      const active = pickCurrentRoom(res.data.content);

      if (!active) {
        setRoom(null);
        clearActiveRoom();
        return;
      }

      const cachedStreamKey = getCachedStreamKey(active.roomId);
      const nextRoom: RoomDetail = {
        ...active,
        streamKey: cachedStreamKey,
      };

      setRoom(nextRoom);
      syncActiveRoom(nextRoom);
      setEditTitle(active.title);
      const cat = categories.find(c => c.name === active.categoryName);
      if (cat) setEditCategoryId(cat.id);
    } catch (error) {
      toast.error(t("dashboard.toast.loadRoomFailed", { message: extractApiErrorMessage(error) }));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSessions = async () => {
    setIsSessionsLoading(true);
    try {
      const res = await roomService.getMySessions({ page: 0, size: 10 });
      setSessions(res.data.content);
    } catch (error) {
      console.warn("[rooms] getMySessions failed", extractApiErrorMessage(error));
    } finally {
      setIsSessionsLoading(false);
    }
  };

  const fetchStats = async () => {
    setIsStatsLoading(true);
    try {
      const res = await statisticsService.getMyDashboard();
      setStats(res.data);
    } catch (error) {
      console.warn("[statistics] getMyDashboard failed", extractApiErrorMessage(error));
    } finally {
      setIsStatsLoading(false);
    }
  };

  const refreshStudioData = async () => {
    setIsRefreshingStudio(true);
    try {
      await Promise.all([fetchMyRoom(), fetchSessions(), fetchStats()]);
      toast.success(t("dashboard.toast.refreshSuccess"));
    } catch {
      // individual handlers already surface specific errors
    } finally {
      setIsRefreshingStudio(false);
    }
  };

  useEffect(() => {
    if (categories.length > 0) {
       fetchMyRoom();
       fetchSessions();
       fetchStats();
    }
  }, [categories]);

  useEffect(() => {
    const hasPendingVod = sessions.some(
      (session) => session.vodStatus === "PENDING" || session.vodStatus === "UPLOADING",
    );

    if (!hasPendingVod) {
      return;
    }

    const pollPendingVodSessions = async () => {
      try {
        const pendingRes = await roomService.getMyPendingVodSessions({ page: 0, size: 20 });
        const pendingSessions = pendingRes.data.content;
        const pendingMap = new Map(pendingSessions.map((session) => [session.id, session]));
        const inProgressPendingIds = new Set(
          pendingSessions
            .filter((session) => session.vodStatus === "PENDING" || session.vodStatus === "UPLOADING")
            .map((session) => session.id),
        );

        const hasSessionFinishedVod = sessions.some(
          (session) =>
            (session.vodStatus === "PENDING" || session.vodStatus === "UPLOADING") &&
            !inProgressPendingIds.has(session.id),
        );

        if (hasSessionFinishedVod) {
          await fetchSessions();
          return;
        }

        setSessions((prev) => prev.map((session) => pendingMap.get(session.id) ?? session));
      } catch (error) {
        console.warn("[rooms] getMyPendingVodSessions failed", extractApiErrorMessage(error));
        await fetchSessions();
      }
    };

    void pollPendingVodSessions();

    const intervalId = setInterval(() => {
      void pollPendingVodSessions();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [sessions]);

  // ── Polling: Liên tục cập nhật trạng thái Live ───────────────────────
  // Khi OBS bắt đầu stream, BE sẽ chuyển status sang LIVE. Frontend cần biết việc đó.
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    
    if (room?.roomId) {
      intervalId = setInterval(async () => {
        try {
          const res = await roomService.getMyRooms({ page: 0, size: 20 });
          const active = pickCurrentRoom(res.data.content);

          if (!active) {
            setRoom(null);
            clearActiveRoom();
            return;
          }

          const cachedStreamKey = getCachedStreamKey(active.roomId);
          setRoom((prev) => ({
            ...active,
            streamKey: cachedStreamKey ?? prev?.streamKey,
          }));
        } catch (error) {
          console.warn("[rooms] polling failed", extractApiErrorMessage(error));
        }
      }, 5000); // Check every 5 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [room?.roomId]);


  // ── Cập nhật thông tin phòng ──────────────────────────────────────────
  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await roomService.updateMyRoom({ title: editTitle, categoryId: editCategoryId });
      toast.success(t("dashboard.toast.updateSuccess"));
      setIsEditModalOpen(false);
      fetchMyRoom(); // Lấy lại dữ liệu mới nhất
    } catch (error) {
      toast.error(t("dashboard.toast.updateFailed", { message: extractApiErrorMessage(error) }));
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Tạo phòng mới (nếu chưa có) ───────────────────────────────────────
  const handleCreateRoom = async () => {    const title = newRoomTitle.trim() || t("dashboard.createDialog.defaultTitle");
    const categoryId = newRoomCategoryId || categories[0]?.id || 1;
    setIsCreateDialogOpen(false);    setIsUpdating(true);
    try {
      const createRes = await roomService.createRoom({
        title,
        categoryId,
      });

      const createPayload = createRes.data;
      console.log("[createRoom] response", createPayload);
      toast.info(
        createPayload.streamKey
          ? t("dashboard.toast.createDebugWithKey", { streamKey: createPayload.streamKey })
          : t("dashboard.toast.createDebugNoKey", { response: JSON.stringify(createPayload) }),
        { duration: 8000 },
      );

      cacheStreamKey(createRes.data.roomId, createRes.data.streamKey);
      await fetchMyRoom();
      toast.success(t("dashboard.toast.createSuccess"));
    } catch (error) {
      const message = extractApiErrorMessage(error);
      console.error("[createRoom] failed", message, error);
      toast.error(t("dashboard.toast.createFailed", { message }));
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Ép kết thúc Stream thủ công ───────────────────────────────────────
  const handleEndStream = async () => {
    if (!room?.roomId) return;
    setIsUpdating(true);
    try {
      await roomService.endStream(room.roomId);
      toast.success(t("dashboard.toast.endSuccess"));
      setRoom(null);
      clearActiveRoom();
      await Promise.all([
        fetchMyRoom(),
        fetchSessions(),
        fetchStats(),
      ]);
    } catch (error) {
      toast.error(t("dashboard.toast.endFailed", { message: extractApiErrorMessage(error) }));
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text) {
      toast.error(t("dashboard.toast.noStreamKeyFromApi"));
      return;
    }
    try {
      await writeToClipboard(text);
      setIsCopied(true);
      toast.success(t("dashboard.toast.copySuccess"));
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error(t("dashboard.toast.copyFailed"));
    }
  };

  const toggleStreamKeyVisibility = () => {
    if (!room?.streamKey) {
      toast.error(t("dashboard.toast.noStreamKeyToShow"));
      return;
    }
    setShowStreamKey((prev) => !prev);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-var(--app-header-offset))] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Nếu chưa đăng ký phòng, hiển thị màn hình onboard
  if (!room) {
    return (
      <div className="h-[calc(100vh-var(--app-header-offset))] flex flex-col items-center justify-center bg-background text-foreground">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Video className="text-primary w-10 h-10" />
        </div>
        <h3 className="text-2xl font-bold mb-2">{t("dashboard.onboarding.title")}</h3>
        <p className="text-muted-foreground mb-8 max-w-sm text-center">
          {t("dashboard.onboarding.description")}
        </p>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={isUpdating} size="lg" className="px-8">
              {isUpdating ? <Loader2 className="animate-spin mr-2" /> : null}
              {t("dashboard.onboarding.start")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px] bg-[#18181b] border-[#3d3d3d] text-white">
            <DialogHeader>
              <DialogTitle>{t("dashboard.createDialog.title")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); void handleCreateRoom(); }}
              className="space-y-4 mt-4"
            >
              <div className="grid gap-2">
                <Label htmlFor="create-title" className="text-gray-300">{t("dashboard.createDialog.streamTitle")}</Label>
                <Input
                  id="create-title"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder={t("dashboard.createDialog.titlePlaceholder")}
                  className="bg-[#2d2d2d] border-[#4d4d4d] text-white"
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-category" className="text-gray-300">{t("dashboard.createDialog.category")}</Label>
                <select
                  id="create-category"
                  value={newRoomCategoryId}
                  onChange={(e) => setNewRoomCategoryId(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-[#4d4d4d] bg-[#2d2d2d] px-3 py-2 text-sm text-white"
                >
                  <option value={0}>{t("dashboard.createDialog.chooseCategory")}</option>
                  {categories.map((cat: CategoryItem) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="text-gray-400"
                >
                  {t("actions.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating || !newRoomTitle.trim()}
                  className="bg-white text-black hover:bg-gray-200"
                >
                  {isUpdating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                  {t("dashboard.createDialog.create")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Button
          onClick={() => void refreshStudioData()}
          variant="outline"
          disabled={isRefreshingStudio}
          size="lg"
          className="mt-3 px-8"
        >
          {isRefreshingStudio ? <Loader2 className="animate-spin mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {t("dashboard.onboarding.checkExisting")}
        </Button>
      </div>
    );
  }

  const isLive = room.status === "LIVE" || room.status === "RECONNECTING";
  const hasPlaybackUrl = Boolean(room.hlsUrl);
  const hasStreamKey = Boolean(room.streamKey);
  const chart30Days = Array.isArray(stats?.chart30Days) ? stats.chart30Days : [];

  return (
    <div className="flex h-[calc(100vh-var(--app-header-offset))] overflow-hidden bg-[#0f0f0f] text-gray-100">
      
      {/* ── Main Studio Area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        
        {/* Top Header Bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-[#212121] border-b border-[#3d3d3d] shadow-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isLive ? 'bg-red-500/20' : 'bg-gray-700'}`}>
              <Radio className={`w-5 h-5 ${isLive ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
            </div>
            <div>
              <h1 className="text-lg font-bold">{t("dashboard.studio.title")}</h1>
              <p className="text-xs text-gray-400 font-mono">
                {t("dashboard.studio.status")}: <span className={isLive ? "text-green-400" : ""}>{room.status}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {isLive && (
              <div className="flex items-center gap-6 bg-black/40 px-4 py-2 rounded-xl">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">{t("dashboard.metrics.viewers")}</span>
                  <span className="text-lg font-bold text-white flex items-center gap-1">
                    <Eye className="w-4 h-4 text-red-500" /> {room.viewers || 0}
                  </span>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => void refreshStudioData()}
              disabled={isRefreshingStudio}
              className="border-[#4d4d4d] bg-transparent text-white hover:bg-[#2d2d2d]"
            >
              {isRefreshingStudio ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {t("dashboard.studio.refresh")}
            </Button>

            {isLive && (
              <Button asChild variant="outline" className="border-[#4d4d4d] bg-transparent text-white hover:bg-[#2d2d2d]">
                <Link to={`/stream/${room.roomId}`}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t("dashboard.studio.viewAsViewer")}
                </Link>
              </Button>
            )}
            
            <Button 
              variant={isLive ? "destructive" : "secondary"} 
              onClick={isLive ? handleEndStream : undefined}
              disabled={isUpdating}
              className={`font-bold transition-all ${!isLive ? "bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white" : ""}`}
            >
              {isUpdating && isLive ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (
                 isLive ? <Square className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />
              )}
              {isLive ? t("dashboard.studio.endStream") : t("dashboard.studio.waitingObs")}
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 max-w-6xl w-full mx-auto flex flex-col gap-6">
          
          {/* Video Preview Box */}
          <div className="w-full aspect-video bg-black rounded-lg border border-[#3d3d3d] shadow-2xl relative overflow-hidden group">
            {isLive && hasPlaybackUrl ? (
               <VideoPlayer hlsUrl={room.hlsUrl} isLive={true} />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#18181b] to-black">
                    <div className="w-24 h-24 mb-4 rounded-full bg-[#2d2d2d] flex items-center justify-center shadow-inner">
                      <Video className="w-10 h-10 text-gray-500" />
                    </div>
                    <p className="text-xl font-bold mb-2">
                      {isLive ? t("dashboard.preview.waitingHls") : t("dashboard.preview.waitingEvent")}
                    </p>
                    <p className="text-sm text-gray-400 max-w-md text-center">
                      {isLive
                        ? t("dashboard.preview.hlsHint")
                        : t("dashboard.preview.obsHint")}
                    </p>
                </div>
            )}
          </div>

          {/* VOD failed alert */}
          {sessions.some((s) => s.vodStatus === "FAILED") && (
            <div className="flex items-center justify-between rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  {t("dashboard.vodAlert", { count: formatNumber(sessions.filter((s) => s.vodStatus === "FAILED").length) })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveStudioTab("vods")}
                className="ml-4 whitespace-nowrap text-red-400 underline hover:text-red-300"
              >
                {t("dashboard.manageVideos")}
              </button>
            </div>
          )}

          {/* Settings & Analytics Tabs */}
          <Tabs value={activeStudioTab} onValueChange={setActiveStudioTab} className="w-full mt-4">
            <TabsList className="bg-transparent border-b border-[#3d3d3d] w-full justify-start rounded-none h-auto p-0 space-x-6">
              <TabsTrigger 
                value="settings" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white rounded-none pb-3 px-0 text-gray-400 hover:text-gray-200"
              >
                {t("dashboard.tabs.settings")}
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white rounded-none pb-3 px-0 text-gray-400 hover:text-gray-200"
              >
                {t("dashboard.tabs.analytics")}
              </TabsTrigger>
              <TabsTrigger 
                value="vods" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white rounded-none pb-3 px-0 text-gray-400 hover:text-gray-200"
              >
                {t("dashboard.tabs.replays")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="pt-6">
              <div className="bg-[#18181b] border border-[#3d3d3d] rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-8">
                
                {/* Left Col: Stream Settings */}
                <div className="flex-1 space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("dashboard.settings.title")}</h3>
                      <p className="text-xl font-bold text-white mb-4">{room.title}</p>
                      
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">{t("dashboard.settings.category")}</h3>
                      <span className="inline-flex items-center px-3 py-1 rounded-md bg-[#3d3d3d] text-sm text-gray-200">
                        {room.categoryName}
                      </span>
                    </div>
                    
                    <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="bg-[#2d2d2d] border-[#4d4d4d] hover:bg-[#3d3d3d] text-white">
                          <Edit2 className="w-4 h-4 mr-2" /> {t("dashboard.settings.edit")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px] bg-[#18181b] border-[#3d3d3d] text-white">
                        <DialogHeader>
                          <DialogTitle>{t("dashboard.editDialog.title")}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleUpdateRoom} className="space-y-4 mt-4">
                          <div className="grid gap-2">
                            <Label htmlFor="title" className="text-gray-300">{t("dashboard.settings.title")}</Label>
                            <Input 
                              id="title" 
                              value={editTitle} 
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="bg-[#2d2d2d] border-[#4d4d4d] text-white"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="category" className="text-gray-300">{t("dashboard.settings.category")}</Label>
                            <select
                              id="category"
                              value={editCategoryId}
                              onChange={(e) => setEditCategoryId(Number(e.target.value))}
                              className="flex h-10 w-full rounded-md border border-[#4d4d4d] bg-[#2d2d2d] px-3 py-2 text-sm text-white"
                            >
                              <option value={0}>{t("dashboard.createDialog.chooseCategory")}</option>
                              {categories.map((cat: CategoryItem) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isUpdating} className="bg-white text-black hover:bg-gray-200">
                              {isUpdating && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                              {t("actions.save")}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Right Col: Connection Info */}
                <div className="w-full md:w-[400px] bg-[#212121] p-5 rounded-lg border border-[#3d3d3d] space-y-5">
                  <div className="grid gap-2">
                    <Label className="text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                      {t("dashboard.connection.serverUrl")}
                    </Label>
                    <div className="flex gap-2">
                      <Input readOnly value="rtmp://localhost:1935/live" className="font-mono text-sm bg-black border-[#4d4d4d]" />
                      <Button variant="secondary" size="icon" className="bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white shrink-0" onClick={() => copyToClipboard("rtmp://localhost:1935/live")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label className="text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center justify-between">
                      {t("dashboard.connection.streamKey")}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input 
                          type={showStreamKey ? "text" : "password"} 
                          readOnly 
                          value={room.streamKey || t("dashboard.connection.noStreamKey")} 
                          className="font-mono text-sm bg-black border-[#4d4d4d] pr-10" 
                        />
                        <button 
                          type="button"
                          onClick={toggleStreamKeyVisibility}
                          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-gray-400 hover:text-white transition"
                        >
                          {showStreamKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button 
                        variant="secondary" 
                        size="icon" 
                        className="bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white shrink-0"
                        onClick={() => copyToClipboard(room.streamKey || "")}
                      >
                        {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {hasStreamKey
                        ? t("dashboard.connection.hasKeyHint")
                        : t("dashboard.connection.noKeyHint")}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="pt-6">
               <div className="bg-[#18181b] border border-[#3d3d3d] rounded-xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-[#2d2d2d]">
                      <BarChart3 className="w-5 h-5 text-gray-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{t("dashboard.analytics.title")}</h3>
                    </div>
                  </div>

                  {isStatsLoading && !stats ? (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("dashboard.analytics.loading")}
                    </div>
                  ) : stats ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                        <div className="rounded-lg border border-[#3d3d3d] bg-[#212121] p-4">
                          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{t("dashboard.analytics.followers")}</p>
                          <p className="text-2xl font-bold text-white">{formatNumber(stats.totalFollowers)}</p>
                        </div>
                        <div className="rounded-lg border border-[#3d3d3d] bg-[#212121] p-4">
                          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{t("dashboard.analytics.donations")}</p>
                          <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalDonationsReceived, "VND", { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="rounded-lg border border-[#3d3d3d] bg-[#212121] p-4">
                          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{t("dashboard.analytics.totalStreams")}</p>
                          <p className="text-2xl font-bold text-white">{formatNumber(stats.totalStreams)}</p>
                        </div>
                        <div className="rounded-lg border border-[#3d3d3d] bg-[#212121] p-4">
                          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{t("dashboard.analytics.watchMinutes")}</p>
                          <p className="text-2xl font-bold text-white">{formatNumber(stats.totalWatchMinutes)}</p>
                        </div>
                        <div className="rounded-lg border border-[#3d3d3d] bg-[#212121] p-4">
                          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{t("dashboard.analytics.peakCcv")}</p>
                          <p className="text-2xl font-bold text-white">{formatNumber(stats.allTimePeakCcv)}</p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#3d3d3d] bg-[#212121] p-4">
                        <h4 className="font-semibold text-white mb-3">{t("dashboard.analytics.last30Days")}</h4>
                        {chart30Days.length === 0 ? (
                          <p className="text-sm text-gray-400">{t("dashboard.analytics.noChartData")}</p>
                        ) : (
                          <div className="space-y-2">
                            {chart30Days.slice(-5).map((item) => (
                              <div key={item.date} className="flex items-center justify-between text-sm text-gray-300">
                                <span>{item.date}</span>
                                <span>{formatNumber(item.viewers)} {t("dashboard.analytics.viewers")}</span>
                                <span>{formatCurrency(item.donations, "VND", { maximumFractionDigits: 0 })}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-[#3d3d3d] bg-[#212121] p-6 text-center text-gray-400">
                      {t("dashboard.analytics.loadFailed")}
                    </div>
                  )}
               </div>
            </TabsContent>

            <TabsContent value="vods" className="pt-6">
               <div className="bg-[#18181b] border border-[#3d3d3d] rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-[#3d3d3d] bg-[#212121]">
                     <h2 className="font-semibold text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-400" /> 
                        {t("dashboard.history.title")}
                     </h2>
                  </div>
                  
                  {isSessionsLoading ? (
                     <div className="flex flex-col items-center justify-center p-12">
                        <Loader2 className="w-8 h-8 text-white animate-spin mb-4" />
                        <p className="text-gray-400">{t("dashboard.history.loading")}</p>
                     </div>
                  ) : sessions.length === 0 ? (
                     <div className="flex flex-col items-center justify-center p-16 text-center text-gray-400">
                        <Video className="w-12 h-12 text-[#3d3d3d] mb-4" />
                        <p className="text-lg font-medium text-gray-300">{t("dashboard.history.emptyTitle")}</p>
                        <p className="text-sm mt-2 max-w-sm">{t("dashboard.history.emptyDescription")}</p>
                     </div>
                  ) : (
                     <div className="divide-y divide-[#3d3d3d]">
                        {sessions.map((s) => (
                           <div key={s.id} className="p-4 flex items-center justify-between hover:bg-[#2d2d2d] transition-colors group">
                               <div className="flex items-center gap-4">
                                  <div className="w-24 h-14 bg-black rounded shrink-0 flex items-center justify-center border border-[#3d3d3d] text-gray-500 overflow-hidden relative">
                                      <Video className="w-6 h-6" />
                                      {s.durationMinutes > 0 && <span className="absolute bottom-1 right-1 bg-black/80 px-1 rounded text-[10px] text-white">{s.durationMinutes}m</span>}
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-gray-100 line-clamp-1">{s.title || t("dashboard.history.untitled")}</h4>
                                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                          <span>{formatDate(s.startedAt, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                                          <span className="w-1 h-1 bg-gray-600 rounded-full" />
                                          <span className="flex items-center gap-1"><Eye className="w-3 h-3"/> {t("dashboard.history.maxViewers", { count: formatNumber(s.maxCcv || 0) })}</span>
                                      </div>
                                  </div>
                               </div>
                               <div>
                                  {s.vodStatus === "DONE" && s.vodUrl ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-transparent border-[#4d4d4d] text-gray-300 hover:text-white"
                                        asChild
                                      >
                                        <Link to={`/vod/${s.id}`}>
                                          <Play className="w-3 h-3 items-center mr-2" />
                                          {t("dashboard.history.watchReplay")}
                                        </Link>
                                      </Button>
                                  ) : s.vodStatus === "FAILED" ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-transparent border-red-800 text-red-400 hover:text-white hover:border-red-600"
                                        onClick={async () => {
                                          try {
                                            await roomService.retryVodUpload(s.id);
                                            toast.success(t("dashboard.toast.retryVodSuccess"));
                                            setTimeout(fetchSessions, 3000);
                                          } catch {
                                            toast.error(t("dashboard.toast.retryVodFailed"));
                                          }
                                        }}
                                      >
                                        {t("dashboard.history.retryUpload")}
                                      </Button>
                                  ) : s.vodStatus === "UPLOADING" ? (
                                      <div className="text-xs text-blue-400 bg-[#2d2d2d] px-3 py-1.5 rounded-md border border-blue-900 flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" /> {t("dashboard.history.uploading")}
                                      </div>
                                  ) : (
                                      <div className="text-xs text-gray-500 bg-[#2d2d2d] px-3 py-1.5 rounded-md border border-[#3d3d3d]">{t("dashboard.history.processing")}</div>
                                  )}
                               </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Right Sidebar: Real-time Chat ────────────────────────────────────── */}
      <div className="w-[340px] bg-[#18181b] border-l border-[#3d3d3d] flex flex-col hidden xl:flex shrink-0">
         <div className="p-4 border-b border-[#3d3d3d] bg-[#212121]">
            <h2 className="font-semibold text-sm uppercase tracking-widest text-gray-300">{t("dashboard.chat.title")}</h2>
         </div>
         <div className="flex-1 overflow-hidden">
            {/* Tái sử dụng component ChatBoard ở chế độ Dashboard */}
            <ChatBoard roomId={room.roomId} />
         </div>
      </div>
    </div>
  );
}
