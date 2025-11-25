import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getMessagesForStudent, getMessagesForAdmin } from "@/lib/messages";
import { Message } from "@/lib/types";

interface UnreadMessagesTooltipProps {
  userId: string;
  children: React.ReactNode;
}

export function UnreadMessagesTooltip({ userId, children }: UnreadMessagesTooltipProps) {
  const [unreadMessages, setUnreadMessages] = useState<Message[]>([]);

  useEffect(() => {
    const updateMessages = () => {
      const messages = userId === 'admin' 
        ? getMessagesForAdmin(false)
        : getMessagesForStudent(userId, false);
      
      const unread = messages
        .filter(m => !m.isRead?.[userId] && !m.isDraft)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      
      setUnreadMessages(unread);
    };

    updateMessages();
    const interval = setInterval(updateMessages, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  if (unreadMessages.length === 0) {
    return <>{children}</>;
  }

  const formatTime = (createdAt: string): string => {
    const date = new Date(createdAt);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold text-sm mb-2">הודעות אחרונות שלא נקראו:</p>
            {unreadMessages.map((msg) => (
              <div key={msg.id} className="text-xs border-b border-border pb-1 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-medium truncate flex-1">{msg.subject}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{formatTime(msg.createdAt)}</span>
                </div>
                <div className="text-muted-foreground truncate">
                  מאת: {msg.senderName}
                </div>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
