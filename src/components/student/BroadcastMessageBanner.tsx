import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getMessagesForStudent, markMessageAsRead } from "@/lib/messages";
import { Message } from "@/lib/types";
import { Megaphone, X } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface BroadcastMessageBannerProps {
  studentId: string;
}

export default function BroadcastMessageBanner({ studentId }: BroadcastMessageBannerProps) {
  const [broadcastMessages, setBroadcastMessages] = useState<Message[]>([]);

  useEffect(() => {
    loadBroadcastMessages();
  }, [studentId]);

  const loadBroadcastMessages = () => {
    const messages = getMessagesForStudent(studentId);
    // Filter for unread broadcast messages (messages sent to all students)
    const broadcasts = messages.filter(m => 
      !m.isRead?.[studentId] && 
      m.recipientIds.includes('all') &&
      m.senderId !== studentId
    );
    setBroadcastMessages(broadcasts);
  };

  const handleDismiss = (messageId: string) => {
    markMessageAsRead(messageId, studentId, true);
    loadBroadcastMessages();
  };

  if (broadcastMessages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {broadcastMessages.map(message => (
        <Alert 
          key={message.id} 
          className="border-primary bg-primary/10 animate-in slide-in-from-top"
        >
          <Megaphone className="h-5 w-5 text-primary" />
          <AlertTitle className="flex items-center justify-between">
            <span className="text-lg font-bold">{message.subject}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {format(new Date(message.createdAt), 'dd/MM/yyyy HH:mm', { locale: he })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleDismiss(message.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </AlertTitle>
          <AlertDescription className="mt-2 whitespace-pre-wrap">
            {message.content}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
