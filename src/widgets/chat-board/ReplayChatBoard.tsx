import { useEffect, useRef, useState } from "react";
import { formatChatTime } from "@/shared/lib/formatters";
import { roomService, type ChatMessageResponse } from "@/shared/api/room.service";
import { useI18n } from "@/shared/i18n";

interface ReplayChatBoardProps {
  sessionId: number;
  currentTime: number;
  sessionStart: string;
}
export function ReplayChatBoard({ sessionId, currentTime, sessionStart }: ReplayChatBoardProps) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [displayedMessages, setDisplayedMessages] = useState<ChatMessageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchChats = async () => {
      setIsLoading(true);
      try {
        const res = await roomService.getSessionChats(sessionId);
        setMessages(res.data);
      } catch (error) {
        console.error("Failed to fetch session chats", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (sessionId) {
      fetchChats();
    }
  }, [sessionId]);

  useEffect(() => {
     if (!messages.length || !sessionStart) return;

     const startMs = new Date(sessionStart).getTime();
     const newDisplayed = messages.filter((msg) => {
       const chatTimestamp = msg.timestamp ?? msg.createdAt;
       if (!chatTimestamp) return false;
       const chatMs = new Date(chatTimestamp).getTime();
       const offsetSec = (chatMs - startMs) / 1000;
       return offsetSec <= currentTime;
     });

     setDisplayedMessages(newDisplayed);
  }, [currentTime, messages, sessionStart]);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedMessages]);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center p-4">{t("chat.loadingReplay")}</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#18181b]">
      {/* Header */}
      <div className="border-b border-[#2d2d31] p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            {t("chat.replayTitle")}
          </h3>
        </div>
      </div>
      
      {/* Message list */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2 scroll-smooth"
      >
        {displayedMessages.map((msg, idx) => (
          <div key={`${msg.senderName}-${msg.timestamp ?? msg.createdAt ?? idx}-${idx}`} className="text-sm leading-relaxed group flex items-start justify-between">
             <div>
               <span className="text-xs text-gray-500 mr-2">
                 {formatChatTime(new Date(msg.timestamp ?? msg.createdAt ?? Date.now()))}
               </span>
               <span className="font-semibold text-purple-400">
                 {msg.senderName}
               </span>
               <span className="text-gray-300">: {msg.content}</span>
            </div>
          </div>
        ))}
        {displayedMessages.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            <p>{t("chat.empty")}</p>
          </div>
        )}
      </div>
      
      {/* Input */}
      <div className="border-t border-[#2d2d31] p-3">
        <div className="p-2 border border-[#464649] bg-[#2d2d31] text-center text-sm text-gray-400 rounded">
          {t("chat.replayDisabled")}
        </div>
      </div>
    </div>
  );
}
