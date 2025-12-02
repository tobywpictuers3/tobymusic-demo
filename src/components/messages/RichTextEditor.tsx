import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/safe-ui/button";
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  List,
  ListOrdered,
  Link,
  Type,
  Palette,
  Highlighter,
  RemoveFormatting,
  Paperclip
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/safe-ui/popover";
import EmojiPicker from "./EmojiPicker";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  onContentChange?: (html: string, plainText: string) => void;
  onPasteImage?: (file: File) => Promise<string | null>;
  onFileUpload?: () => void;
  isUploading?: boolean;
  placeholder?: string;
  initialContent?: string;
  className?: string;
  dir?: "rtl" | "ltr";
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export interface RichTextEditorHandle {
  getHtml: () => string;
  getText: () => string;
  setContent: (html: string) => void;
  clear: () => void;
  focus: () => void;
  insertEmoji: (emoji: string) => void;
}

const TEXT_COLORS = [
  { name: 'שחור', value: '#000000' },
  { name: 'אדום', value: '#dc2626' },
  { name: 'כתום', value: '#ea580c' },
  { name: 'צהוב', value: '#ca8a04' },
  { name: 'ירוק', value: '#16a34a' },
  { name: 'כחול', value: '#2563eb' },
  { name: 'סגול', value: '#9333ea' },
  { name: 'ורוד', value: '#db2777' },
];

const HIGHLIGHT_COLORS = [
  { name: 'צהוב', value: '#fef08a' },
  { name: 'ירוק', value: '#bbf7d0' },
  { name: 'כחול', value: '#bfdbfe' },
  { name: 'ורוד', value: '#fbcfe8' },
  { name: 'סגול', value: '#ddd6fe' },
  { name: 'אפור', value: '#e5e7eb' },
  { name: 'לבן', value: '#ffffff' },
  { name: 'ללא', value: 'transparent' },
];

const FONT_SIZES = [
  { name: 'קטן', value: '1' },
  { name: 'רגיל', value: '3' },
  { name: 'גדול', value: '5' },
  { name: 'ענק', value: '7' },
];

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(({
  onContentChange,
  onPasteImage,
  onFileUpload,
  isUploading,
  placeholder = "כתוב את ההודעה...",
  initialContent = "",
  className,
  dir = "rtl",
  onDragOver,
  onDrop,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getHtml: () => editorRef.current?.innerHTML || '',
    getText: () => editorRef.current?.innerText || '',
    setContent: (html: string) => {
      if (editorRef.current) {
        editorRef.current.innerHTML = html;
      }
    },
    clear: () => {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    },
    focus: () => {
      editorRef.current?.focus();
    },
    insertEmoji: (emoji: string) => {
      insertAtCursor(emoji);
    },
  }));

  useEffect(() => {
    if (initialContent && editorRef.current) {
      editorRef.current.innerHTML = initialContent;
    }
  }, [initialContent]);

  // Handle paste for images
  useEffect(() => {
    const el = editorRef.current;
    if (!el || !onPasteImage) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          
          const url = await onPasteImage(file);
          if (url) {
            const img = document.createElement('img');
            img.src = url;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '8px';
            img.style.marginTop = '8px';
            img.style.marginBottom = '8px';
            
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.deleteContents();
              range.insertNode(img);
              range.collapse(false);
            } else {
              el.appendChild(img);
            }
          }
        }
      }
    };

    el.addEventListener('paste', handlePaste as any);
    return () => el.removeEventListener('paste', handlePaste as any);
  }, [onPasteImage]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    notifyChange();
  };

  const insertAtCursor = (text: string) => {
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;
    
    editorRef.current.focus();
    
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    }
    notifyChange();
  };

  const insertLink = () => {
    const url = prompt('הכנס כתובת URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const notifyChange = () => {
    if (onContentChange && editorRef.current) {
      onContentChange(
        editorRef.current.innerHTML,
        editorRef.current.innerText
      );
    }
  };

  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted flex-wrap">
        {/* Text Formatting */}
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={() => execCommand('bold')}
          title="מודגש"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={() => execCommand('italic')}
          title="נטוי"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={() => execCommand('underline')}
          title="קו תחתון"
        >
          <Underline className="h-4 w-4" />
        </Button>

        <div className="border-r h-6 mx-1" />

        {/* Text Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              type="button"
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              title="צבע טקסט"
            >
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-4 gap-1">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className="h-6 w-6 rounded border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color.value }}
                  onClick={() => execCommand('foreColor', color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              type="button"
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              title="הדגשת רקע"
            >
              <Highlighter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-4 gap-1">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className="h-6 w-6 rounded border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color.value }}
                  onClick={() => execCommand('hiliteColor', color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Font Size */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              type="button"
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              title="גודל גופן"
            >
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="flex flex-col gap-1">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  className="px-3 py-1 text-right hover:bg-muted rounded"
                  onClick={() => execCommand('fontSize', size.value)}
                >
                  {size.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="border-r h-6 mx-1" />

        {/* Alignment */}
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={() => execCommand('justifyRight')}
          title="יישור לימין"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={() => execCommand('justifyCenter')}
          title="יישור למרכז"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={() => execCommand('justifyLeft')}
          title="יישור לשמאל"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>

        <div className="border-r h-6 mx-1" />

        {/* Lists */}
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={() => execCommand('insertUnorderedList')}
          title="רשימה"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={() => execCommand('insertOrderedList')}
          title="רשימה ממוספרת"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="border-r h-6 mx-1" />

        {/* Link */}
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={insertLink}
          title="הוסף קישור"
        >
          <Link className="h-4 w-4" />
        </Button>

        {/* Clear Formatting */}
        <Button 
          type="button"
          variant="ghost" 
          size="icon"
          className="h-8 w-8"
          onClick={() => execCommand('removeFormat')}
          title="נקה עיצוב"
        >
          <RemoveFormatting className="h-4 w-4" />
        </Button>

        <div className="border-r h-6 mx-1" />

        {/* File Upload */}
        {onFileUpload && (
          <Button 
            type="button"
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={onFileUpload}
            disabled={isUploading}
            title="צרף קובץ"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        )}

        {/* Emoji Picker */}
        <EmojiPicker onSelect={insertAtCursor} className="h-8 w-8" />
      </div>

      {/* Editable Area */}
      <div
        ref={editorRef}
        className="min-h-[150px] px-3 py-2 outline-none focus:ring-1 focus:ring-ring bg-background"
        contentEditable
        suppressContentEditableWarning
        dir={dir}
        onInput={notifyChange}
        onDragOver={onDragOver}
        onDrop={onDrop}
        data-placeholder={placeholder}
        style={{
          minHeight: '150px',
        }}
      />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
