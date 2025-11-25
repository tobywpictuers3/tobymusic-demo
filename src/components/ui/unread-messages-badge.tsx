import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getUnreadCount } from "@/lib/messages";
import { Mail } from "lucide-react";
import { UnreadMessagesTooltip } from "./unread-messages-tooltip";

interface UnreadMessagesBadgeProps {
  userId: string;
}

export function UnreadMessagesBadge({ userId }: UnreadMessagesBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      setUnreadCount(getUnreadCount(userId));
    };

    updateCount();
    const interval = setInterval(updateCount, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [userId]);

  if (unreadCount === 0) {
    return null;
  }

  return (
    <UnreadMessagesTooltip userId={userId}>
      <Badge variant="destructive" className="flex items-center gap-1 cursor-help">
        <Mail className="w-3 h-3" />
        {unreadCount}
      </Badge>
    </UnreadMessagesTooltip>
  );
}
