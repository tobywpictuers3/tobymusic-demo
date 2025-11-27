import { Attachment } from "@/lib/types";
import { Button } from "@/components/safe-ui/button";
import { Card } from "@/components/safe-ui/card";
import { Download, X, FileText, Music, Video, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttachmentPreviewProps {
  attachment: Attachment;
  onDelete?: () => void;
  readOnly?: boolean;
}

export default function AttachmentPreview({ 
  attachment, 
  onDelete, 
  readOnly = false 
}: AttachmentPreviewProps) {
  const isImage = attachment.type?.startsWith('image/');
  const isPDF = attachment.type === 'application/pdf';
  const isAudio = attachment.type?.startsWith('audio/');
  const isVideo = attachment.type?.startsWith('video/');

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleImageClick = () => {
    if (isImage) {
      window.open(attachment.url, '_blank');
    }
  };

  return (
    <Card className={cn(
      "relative overflow-hidden border",
      isImage ? "w-20 h-20 p-0" : "p-2"
    )}>
      {/* Delete button */}
      {!readOnly && onDelete && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-1 left-1 h-5 w-5 z-10"
          onClick={onDelete}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      {/* Content based on type */}
      {isImage && (
        <div 
          className="w-full h-full cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleImageClick}
        >
          <img 
            src={attachment.url} 
            alt={attachment.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {isPDF && (
        <div className="flex flex-col items-center gap-2 p-2 min-w-[120px]">
          <FileText className="w-8 h-8 text-red-500" />
          <div className="text-xs text-center w-full">
            <div className="font-medium truncate">{attachment.name}</div>
            <div className="text-muted-foreground">{formatSize(attachment.size)}</div>
          </div>
          <Button size="sm" variant="outline" asChild>
            <a href={attachment.url} target="_blank" rel="noopener noreferrer">
              פתח
            </a>
          </Button>
        </div>
      )}

      {isAudio && (
        <div className="space-y-2 min-w-[200px]">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            <div className="text-xs truncate flex-1">{attachment.name}</div>
          </div>
          <audio controls className="w-full h-8">
            <source src={attachment.url} type={attachment.type} />
          </audio>
        </div>
      )}

      {isVideo && (
        <div className="space-y-2 min-w-[200px]">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            <div className="text-xs truncate">{attachment.name}</div>
          </div>
          <video controls className="w-full max-h-32 rounded">
            <source src={attachment.url} type={attachment.type} />
          </video>
        </div>
      )}

      {!isImage && !isPDF && !isAudio && !isVideo && (
        <div className="flex items-center gap-2 p-2 min-w-[120px]">
          <FileIcon className="w-8 h-8 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{attachment.name}</div>
            <div className="text-xs text-muted-foreground">{formatSize(attachment.size)}</div>
          </div>
        </div>
      )}

      {/* Download button (bottom right for all types) */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute bottom-1 right-1 h-5 w-5"
        asChild
      >
        <a href={attachment.url} download={attachment.name}>
          <Download className="h-3 w-3" />
        </a>
      </Button>
    </Card>
  );
}
