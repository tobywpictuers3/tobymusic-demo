import { Badge } from "@/components/safe-ui/badge";
import { Message } from "@/lib/types";
import { getMessageType } from "@/lib/messages";

interface MessageTypeBadgeProps {
  message: Message;
}

export const MessageTypeBadge = ({ message }: MessageTypeBadgeProps) => {
  const type = getMessageType(message);
  
  switch (type) {
    case 'broadcast':
      return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">לכולן</Badge>;
    case 'group':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">קבוצה</Badge>;
    case 'direct-teacher':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">לתשומת לב המורה</Badge>;
    case 'direct-student':
      return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">פרטי</Badge>;
  }
};
