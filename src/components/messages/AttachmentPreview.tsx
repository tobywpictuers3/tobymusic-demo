import { useState } from "react";
import { Attachment } from "@/lib/types";
import { Button } from "@/components/safe-ui/button";
import { Card } from "@/components/safe-ui/card";
import { 
  Download, 
  X, 
  FileText, 
  Music, 
  Video, 
  FileIcon,
  FileSpreadsheet,
  Presentation,
  File,
  Maximize2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/safe-ui/dialog";

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
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const isImage = attachment.type?.startsWith('image/');
  const isPDF = attachment.type === 'application/pdf';
  const isAudio = attachment.type?.startsWith('audio/');
  const isVideo = attachment.type?.startsWith('video/');
  const isWord = attachment.type?.includes('word') || 
    attachment.name?.endsWith('.doc') || 
    attachment.name?.endsWith('.docx');
  const isPowerPoint = attachment.type?.includes('presentation') || 
    attachment.name?.endsWith('.ppt') || 
    attachment.name?.endsWith('.pptx');
  const isExcel = attachment.type?.includes('spreadsheet') || 
    attachment.type?.includes('excel') ||
    attachment.name?.endsWith('.xls') || 
    attachment.name?.endsWith('.xlsx');

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    if (isWord) return <FileText className="w-8 h-8 text-blue-600" />;
    if (isPowerPoint) return <Presentation className="w-8 h-8 text-orange-600" />;
    if (isExcel) return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
    if (isPDF) return <FileText className="w-8 h-8 text-red-500" />;
    if (isAudio) return <Music className="w-8 h-8 text-purple-500" />;
    if (isVideo) return <Video className="w-8 h-8 text-pink-500" />;
    return <FileIcon className="w-8 h-8 text-muted-foreground" />;
  };

  return (
    <>
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

        {/* Image */}
        {isImage && (
          <div 
            className="w-full h-full cursor-pointer hover:opacity-80 transition-opacity group relative"
            onClick={() => setImageModalOpen(true)}
          >
            <img 
              src={attachment.url} 
              alt={attachment.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}

        {/* PDF */}
        {isPDF && (
          <div className="flex flex-col items-center gap-2 p-2 min-w-[120px]">
            {getFileIcon()}
            <div className="text-xs text-center w-full">
              <div className="font-medium truncate">{attachment.name}</div>
              <div className="text-muted-foreground">{formatSize(attachment.size)}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setPdfModalOpen(true)}>
              צפייה
            </Button>
          </div>
        )}

        {/* Audio */}
        {isAudio && (
          <div className="space-y-2 min-w-[200px]">
            <div className="flex items-center gap-2">
              {getFileIcon()}
              <div className="text-xs truncate flex-1">{attachment.name}</div>
            </div>
            <audio controls className="w-full h-8">
              <source src={attachment.url} type={attachment.type} />
            </audio>
          </div>
        )}

        {/* Video */}
        {isVideo && (
          <div className="space-y-2 min-w-[200px]">
            <div className="flex items-center gap-2">
              {getFileIcon()}
              <div className="text-xs truncate">{attachment.name}</div>
            </div>
            <video controls className="w-full max-h-32 rounded">
              <source src={attachment.url} type={attachment.type} />
            </video>
          </div>
        )}

        {/* Office Files (Word, PowerPoint, Excel) */}
        {(isWord || isPowerPoint || isExcel) && (
          <div className="flex items-center gap-2 p-2 min-w-[140px]">
            {getFileIcon()}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{attachment.name}</div>
              <div className="text-xs text-muted-foreground">{formatSize(attachment.size)}</div>
            </div>
          </div>
        )}

        {/* Other Files */}
        {!isImage && !isPDF && !isAudio && !isVideo && !isWord && !isPowerPoint && !isExcel && (
          <div className="flex items-center gap-2 p-2 min-w-[120px]">
            {getFileIcon()}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{attachment.name}</div>
              <div className="text-xs text-muted-foreground">{formatSize(attachment.size)}</div>
            </div>
          </div>
        )}

        {/* Download button */}
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

      {/* Image Modal */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{attachment.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <img 
              src={attachment.url} 
              alt={attachment.name}
              className="max-w-full max-h-[70vh] object-contain rounded"
            />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" asChild>
              <a href={attachment.url} download={attachment.name}>
                <Download className="h-4 w-4 mr-2" />
                הורד
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Modal */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{attachment.name}</DialogTitle>
          </DialogHeader>
          <div className="h-[70vh]">
            <iframe 
              src={attachment.url} 
              className="w-full h-full rounded border"
              title={attachment.name}
            />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" asChild>
              <a href={attachment.url} download={attachment.name}>
                <Download className="h-4 w-4 mr-2" />
                הורד
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
