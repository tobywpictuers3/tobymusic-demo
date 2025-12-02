import { useState } from "react";
import { Button } from "@/components/safe-ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/safe-ui/popover";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

const COMMON_EMOJIS = [
  '😊', '😍', '🔥', '👏', '💪', '🎵', '⭐', '❤️', '💔', '😢',
  '😴', '🤔', '😎', '🙏', '👍', '👎', '✨', '🎉', '🎊', '🌟',
  '💫', '🌈', '☀️', '🌙', '🇮🇱', '🎹', '🎸', '🎺', '🎻', '🥁',
  '📚', '✅', '❌', '⚠️', '💬', '📝', '📅', '🕐', '💯', '🆒',
  '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😋',
  '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤨', '😐',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  trigger?: React.ReactNode;
  className?: string;
}

export default function EmojiPicker({ onSelect, trigger, className }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button 
            type="button" 
            variant="ghost" 
            size="icon"
            className={cn("h-8 w-8", className)}
          >
            <Smile className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="grid grid-cols-10 gap-1">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="h-8 w-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
              onClick={() => handleSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { COMMON_EMOJIS };
