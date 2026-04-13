import { useState, useEffect } from "react";
import { 
  Video, 
  Settings, 
  BarChart3, 
  Key, 
  Copy, 
  Eye, 
  EyeOff, 
  Check,
  Loader2,
  Play,
  Square,
  Edit2,
  Radio,
  History
} from "lucide-react";
import { roomService, type RoomLiveItem, type CreateRoomResponse, type StreamSession } from "@/shared/api/room.service";
import { useCategories, type CategoryItem } from "@/entities/category";
import { 
  Button, 
  Input, 
  Label, 
  Separator, 
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

export function DashboardPage() {
  const { categories } = useCategories();
  
  const [room, setRoom] = useState<RoomLiveItem | null>(null);
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

  // ── Load thông tin phòng ban đầu ──────────────────────────────────────
  const fetchMyRoom = async () => {
    try {
      const res = await roomService.getMyRooms({ page: 0, size: 1 });
      if (res.data.content.length > 0) {
        const myRoom = res.data.content[0];
        setRoom(myRoom);
        setEditTitle(myRoom.title);
        // Find category ID fallback
        const cat = categories.find(c => c.name === myRoom.categoryName);
        if (cat) setEditCategoryId(cat.id);
      }
    } catch {
      toast.error("Không thể tải thông tin phòng");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSessions = async () => {
    setIsSessionsLoading(true);
    try {
      const res = await roomService.getMySessions({ page: 0, size: 10 });
      setSessions(res.data.content);
    } catch {
      // Có thể bỏ qua lỗi nhẹ
    } finally {
      setIsSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (categories.length > 0) {
       fetchMyRoom();
       fetchSessions();
    }
  }, [categories]);

  // ── Polling: Liên tục cập nhật trạng thái Live ───────────────────────
  // Khi OBS bắt đầu stream, BE sẽ chuyển status sang LIVE. Frontend cần biết việc đó.
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    
    if (room) {
      intervalId = setInterval(async () => {
        try {
          const res = await roomService.getMyRooms({ page: 0, size: 1 });
          if (res.data.content.length > 0) {
            setRoom(res.data.content[0]);
          }
        } catch {
          // silent error for polling
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
      toast.success("Cập nhật thông tin thành công");
      setIsEditModalOpen(false);
      fetchMyRoom(); // Lấy lại dữ liệu mới nhất
    } catch {
      toast.error("Cập nhật thất bại");
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Tạo phòng mới (nếu chưa có) ────────────────────────────────────────
  const handleCreateRoom = async () => {
    setIsUpdating(true);
    try {
      const res = await roomService.createRoom({ 
        title: "My First Stream", 
        categoryId: categories[0]?.id || 1 
      });
      fetchMyRoom();
      toast.success("Đã kích hoạt tính năng Livestream!");
    } catch {
      toast.error("Không thể tạo phòng");
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
      toast.success("Đã kết thúc buổi Stream!");
      fetchMyRoom(); // Lấy lại dữ liệu phòng để đổi trạng thái
      fetchSessions(); // Cập nhật lại lịch sử livestream (VODs)
    } catch {
      toast.error("Không thể kết thúc Stream ngay lúc này, vui lòng thử lại sau.");
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success("Đã sao chép vào bộ nhớ tạm");
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Nếu chưa đăng ký phòng, hiển thị màn hình onboard
  if (!room) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-background text-foreground">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Video className="text-primary w-10 h-10" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Sẵn sàng để trở thành Streamer?</h3>
        <p className="text-muted-foreground mb-8 max-w-sm text-center">
          Kích hoạt phòng của bạn để tiến vào Studio điều khiển trực tiếp ngay bây giờ.
        </p>
        <Button onClick={handleCreateRoom} disabled={isUpdating} size="lg" className="px-8">
          {isUpdating ? <Loader2 className="animate-spin mr-2" /> : null}
          Bắt đầu ngay bây giờ
        </Button>
      </div>
    );
  }

  const isLive = room.status === "LIVE" || room.status === "RECONNECTING";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0f0f0f] text-gray-100">
      
      {/* ── Main Studio Area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        
        {/* Top Header Bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-[#212121] border-b border-[#3d3d3d] shadow-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isLive ? 'bg-red-500/20' : 'bg-gray-700'}`}>
              <Radio className={`w-5 h-5 ${isLive ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
            </div>
            <div>
              <h1 className="text-lg font-bold">Studio Trực Tiếp</h1>
              <p className="text-xs text-gray-400 font-mono">
                Status: <span className={isLive ? "text-green-400" : ""}>{room.status}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {isLive && (
              <div className="flex items-center gap-6 bg-black/40 px-4 py-2 rounded-xl">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Người xem</span>
                  <span className="text-lg font-bold text-white flex items-center gap-1">
                    <Eye className="w-4 h-4 text-red-500" /> {room.viewers || 0}
                  </span>
                </div>
              </div>
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
              {isLive ? "Dừng phát trực tiếp" : "Sẵn sàng phát (Chờ OBS)"}
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 max-w-6xl w-full mx-auto flex flex-col gap-6">
          
          {/* Video Preview Box */}
          <div className="w-full aspect-video bg-black rounded-lg border border-[#3d3d3d] shadow-2xl relative overflow-hidden group">
            {isLive ? (
               <VideoPlayer hlsUrl={room.hlsUrl} isLive={true} />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#18181b] to-black">
                    <div className="w-24 h-24 mb-4 rounded-full bg-[#2d2d2d] flex items-center justify-center shadow-inner">
                      <Video className="w-10 h-10 text-gray-500" />
                    </div>
                    <p className="text-xl font-bold mb-2">Đang chờ sự kiện phát trực tiếp</p>
                    <p className="text-sm text-gray-400 max-w-md text-center">
                      Vui lòng kết nối phần mềm phát trực tiếp (như OBS, Streamlabs) bằng Stream Key phía dưới để bắt đầu.
                    </p>
                </div>
            )}
          </div>

          {/* Settings & Analytics Tabs */}
          <Tabs defaultValue="settings" className="w-full mt-4">
            <TabsList className="bg-transparent border-b border-[#3d3d3d] w-full justify-start rounded-none h-auto p-0 space-x-6">
              <TabsTrigger 
                value="settings" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white rounded-none pb-3 px-0 text-gray-400 hover:text-gray-200"
              >
                Cài đặt sự kiện phát trực tiếp
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white rounded-none pb-3 px-0 text-gray-400 hover:text-gray-200"
              >
                Số liệu phân tích
              </TabsTrigger>
              <TabsTrigger 
                value="vods" 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white rounded-none pb-3 px-0 text-gray-400 hover:text-gray-200"
              >
                Nội dung VOD & Lịch sử
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="pt-6">
              <div className="bg-[#18181b] border border-[#3d3d3d] rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-8">
                
                {/* Left Col: Stream Settings */}
                <div className="flex-1 space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">Tiêu đề</h3>
                      <p className="text-xl font-bold text-white mb-4">{room.title}</p>
                      
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">Danh mục</h3>
                      <span className="inline-flex items-center px-3 py-1 rounded-md bg-[#3d3d3d] text-sm text-gray-200">
                        {room.categoryName}
                      </span>
                    </div>
                    
                    <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="bg-[#2d2d2d] border-[#4d4d4d] hover:bg-[#3d3d3d] text-white">
                          <Edit2 className="w-4 h-4 mr-2" /> Chỉnh sửa
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px] bg-[#18181b] border-[#3d3d3d] text-white">
                        <DialogHeader>
                          <DialogTitle>Chỉnh sửa chi tiết buổi Live</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleUpdateRoom} className="space-y-4 mt-4">
                          <div className="grid gap-2">
                            <Label htmlFor="title" className="text-gray-300">Tiêu đề</Label>
                            <Input 
                              id="title" 
                              value={editTitle} 
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="bg-[#2d2d2d] border-[#4d4d4d] text-white"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="category" className="text-gray-300">Danh mục</Label>
                            <select
                              id="category"
                              value={editCategoryId}
                              onChange={(e) => setEditCategoryId(Number(e.target.value))}
                              className="flex h-10 w-full rounded-md border border-[#4d4d4d] bg-[#2d2d2d] px-3 py-2 text-sm text-white"
                            >
                              <option value={0}>Chọn danh mục</option>
                              {categories.map((cat: CategoryItem) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isUpdating} className="bg-white text-black hover:bg-gray-200">
                              {isUpdating && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                              Lưu
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
                      URL máy chủ
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
                      Mã sự kiện phát (Stream Key)
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input 
                          type={showStreamKey ? "text" : "password"} 
                          readOnly 
                          value={(room as any).streamKey || "sk_hidden_contact_api"} 
                          className="font-mono text-sm bg-black border-[#4d4d4d] pr-10" 
                        />
                        <button 
                          type="button"
                          onClick={() => setShowStreamKey(!showStreamKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                        >
                          {showStreamKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button 
                        variant="secondary" 
                        size="icon" 
                        className="bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white shrink-0"
                        onClick={() => copyToClipboard((room as any).streamKey || "")}
                      >
                        {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Sử dụng URL mạng và Stream key này làm nguồn cấu hình trong OBS Studio của bạn.</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="pt-6">
               <div className="bg-[#18181b] border border-[#3d3d3d] rounded-xl p-8 text-center text-gray-400">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Số liệu phân tích chi tiết sẽ được hiển thị sau khi cài đặt Data Analytic API.</p>
               </div>
            </TabsContent>

            <TabsContent value="vods" className="pt-6">
               <div className="bg-[#18181b] border border-[#3d3d3d] rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-[#3d3d3d] bg-[#212121]">
                     <h2 className="font-semibold text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-400" /> 
                        Sự kiện phát trực tiếp kề trước
                     </h2>
                  </div>
                  
                  {isSessionsLoading ? (
                     <div className="flex flex-col items-center justify-center p-12">
                        <Loader2 className="w-8 h-8 text-white animate-spin mb-4" />
                        <p className="text-gray-400">Đang tải dữ liệu lịch sử...</p>
                     </div>
                  ) : sessions.length === 0 ? (
                     <div className="flex flex-col items-center justify-center p-16 text-center text-gray-400">
                        <Video className="w-12 h-12 text-[#3d3d3d] mb-4" />
                        <p className="text-lg font-medium text-gray-300">Bạn chưa có sự kiện nào được ghi lại</p>
                        <p className="text-sm mt-2 max-w-sm">Các sự kiện phát trực tiếp cũ cũng như bản ghi video xem lại (VOD) sẽ xuất hiện tại đây sau khi bạn kết thúc luồng.</p>
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
                                      <h4 className="font-bold text-gray-100 line-clamp-1">{s.title || "Buổi Stream chưa rõ tên"}</h4>
                                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                          <span>{new Date(s.startedAt).toLocaleString("vi-VN", { hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit', year: 'numeric'})}</span>
                                          <span className="w-1 h-1 bg-gray-600 rounded-full" />
                                          <span className="flex items-center gap-1"><Eye className="w-3 h-3"/> Max {s.maxCcv || 0} n.xem</span>
                                      </div>
                                  </div>
                               </div>
                               <div>
                                  {s.vodUrl ? (
                                      <Button variant="outline" size="sm" className="bg-transparent border-[#4d4d4d] text-gray-300 hover:text-white" asChild>
                                          <a href={s.vodUrl} target="_blank" rel="noreferrer">
                                             <Play className="w-3 h-3 mr-2" />
                                             Xem lại Video
                                          </a>
                                      </Button>
                                  ) : (
                                      <div className="text-xs text-gray-500 bg-[#2d2d2d] px-3 py-1.5 rounded-md border border-[#3d3d3d]">Đang xử lý Video</div>
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
            <h2 className="font-semibold text-sm uppercase tracking-widest text-gray-300">Trò chuyện qua buổi live</h2>
         </div>
         <div className="flex-1 overflow-hidden">
            {/* Tái sử dụng component ChatBoard ở chế độ Dashboard */}
            <ChatBoard roomId={room.roomId} />
         </div>
      </div>
      
    </div>
  );
}
