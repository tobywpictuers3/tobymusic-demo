import { useState, useEffect } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Star, X } from 'lucide-react';
import { getStarredMessages, markMessageAsRead, toggleMessageStar } from '@/lib/messages';
import { Message } from '@/lib/types';

interface StarredMessagesBannerProps {
  studentId: string;
}

export default function StarredMessagesBanner({ studentId }: StarredMessagesBannerProps) {
  const [starredMessages, setStarredMessages] = useState<Message[]>([]);

  useEffect(() => {
    loadStarredMessages();
  }, [studentId]);

  const loadStarredMessages = () => {
    const messages = getStarredMessages(studentId);
    setStarredMessages(messages);
  };

  const handleMessageRead = (messageId: string) => {
    // Mark as read
    markMessageAsRead(messageId, studentId, true);
    // Remove star
    toggleMessageStar(messageId, studentId);
    // Reload messages
    loadStarredMessages();
  };

  if (starredMessages.length === 0) return null;

  return (
    <div className="mb-4 space-y-2" dir="rtl">
      {starredMessages.map(message => (
        <Alert 
          key={message.id} 
          variant="default" 
          className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 shadow-lg"
        >
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          <AlertTitle className="text-lg font-bold mb-2 flex items-center justify-between">
            <span>{message.subject}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleMessageRead(message.id)}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription className="text-base">
            <div className="mb-3 whitespace-pre-wrap">{message.content}</div>
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>מאת: {message.senderName}</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleMessageRead(message.id)}
                className="text-xs"
              >
                סמן כנקרא והסר כוכב
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
