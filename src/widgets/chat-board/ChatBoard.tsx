import { Send, Smile, MoreVertical, Wifi, WifiOff } from "lucide-react";
import { useStompChat } from "@/features/send-message/model/useStompChat";
import { formatChatTime } from "@/shared/lib/formatters";

interface ChatBoardProps {
  roomId: number | null;
  streamerId?: number;
}

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/shared/ui";
import { useAuth } from "@/app/providers/AuthContext";
import { Shield, Ban } from "lucide-react";
import { toast } from "sonner";

export function ChatBoard({ roomId, streamerId }: ChatBoardProps) {
  const { user } = useAuth();
  const isStreamer = Boolean(user && streamerId && user.userId === streamerId);

  const {
    messages,
    newMessage,
    messagesContainerRef,
    setNewMessage,
    sendMessage,
    isConnected,
  } = useStompChat(roomId);

  const handleBanUser = (username: string) => {
    // Gọi API Ban User (sẽ cần API backend hỗ trợ ban bằng username hoặc nhúng userId vào STOMP msg)
    toast.success(`Đã chặn người dùng ${username} khỏi phòng Chat!`);
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b]">
      {/* Header */}
      <div className="border-b border-[#2d2d31] p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            Stream Chat
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-yellow-400" />
            )}
            {isStreamer && (
              <span title="Streamer Mode (Mod)">
                <Shield className="w-4 h-4 text-purple-500 ml-1" />
              </span>
            )}
          </h3>
          <button className="p-1 hover:bg-[#2d2d31] rounded">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Message list */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2"
      >
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            <p>Chưa có tin nhắn nào.</p>
            <p className="text-xs mt-1">Hãy là người đầu tiên chat!</p>
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={`${msg.id}-${index}`} className="text-sm leading-relaxed group flex items-start justify-between">
            <div>
               <span className="text-xs text-gray-500 mr-2">
                 {formatChatTime(msg.timestamp)}
               </span>
               <span style={{ color: msg.color }} className="font-semibold">
                 {msg.username}
               </span>
               <span className="text-gray-300">: {msg.message}</span>
            </div>
            
            {isStreamer && msg.username !== user?.username && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#2d2d31] rounded text-gray-400 mt-0.5">
                    <MoreVertical className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#18181b] border-[#2d2d31] text-white">
                  <DropdownMenuItem 
                     onClick={() => handleBanUser(msg.username)}
                     className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer text-xs"
                  >
                     <Ban className="w-3 h-3 mr-2" /> Cấm chat (Ban)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-[#2d2d31] p-3">
        <form onSubmit={sendMessage} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isConnected ? "Send a message..." : "Đang kết nối..."}
              disabled={!isConnected}
              className="w-full bg-[#2d2d31] border border-[#464649] rounded px-3 py-2 pr-10 focus:outline-none focus:border-purple-500 text-sm disabled:opacity-50"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[#464649] rounded"
            >
              <Smile className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <button
            type="submit"
            disabled={!isConnected || !newMessage.trim()}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Chat</span>
          </button>
        </form>
      </div>
    </div>
  );
}
