import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStarredMessages, toggleMessageStar } from "@/lib/messages";
import { Message } from "@/lib/types";
import { Mail, X } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface MessageAlertProps {
  studentId: string;
}

export default function MessageAlert({ studentId }: MessageAlertProps) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [studentId]);

  const loadMessages = () => {
    const starredMessages = getStarredMessages(studentId);
    setMessages(starredMessages);
  };

  const handleDismiss = (messageId: string) => {
    toggleMessageStar(messageId, studentId);
    loadMessages();
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {messages.map(message => (
        <Card key={message.id} className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{message.subject}</h4>
                    <p className="text-sm text-muted-foreground">
                      מאת: {message.senderName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="whitespace-nowrap">
                      {format(new Date(message.createdAt), 'dd/MM HH:mm', { locale: he })}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(message.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
