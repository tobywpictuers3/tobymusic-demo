import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  getMessagesForStudent, 
  markMessageAsRead, 
  markMessageAsUnread,
  addMessage,
  toggleMessageStar,
  markMessageAsDeleted,
  getDrafts,
  getStarredMessages,
  getDeletedMessages,
  getMessageType,
  canUserRemoveStar,
  saveDraft
} from "@/lib/messages";
import { Message, Attachment } from "@/lib/types";
import { toast } from "sonner";
import { 
  Send, 
  Mail, 
  Inbox,
  Star,
  Trash2,
  FileText,
  Plus,
  Reply,
  MailOpen,
  X,
  Save,
  Forward,
  RotateCcw,
  Paperclip
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageTypeBadge } from "./MessageTypeBadge";
import { workerApi } from "@/lib/workerApi";
import AttachmentPreview from "@/components/messages/AttachmentPreview";

// Format message date: HH:MM for today, dd/MM for older
const formatMessageDate = (createdAt: string): string => {
  const msgDate = new Date(createdAt);
  const now = new Date();
  const isToday = msgDate.toDateString() === now.toDateString();
  
  return isToday
    ? msgDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : msgDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
};

interface GmailStyleMessagesProps {
  studentId: string;
  studentName: string;
}

type FolderType = 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash';

export default function GmailStyleMessages({ studentId, studentName }: GmailStyleMessagesProps) {
  const [selectedFolder, setSelectedFolder] = useState<FolderType>('inbox');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  
  const [composeSubject, setComposeSubject] = useState('');
  const [composeRecipients, setComposeRecipients] = useState<string[]>(['admin']);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadMessages();
    loadStudents();
  }, [studentId]);

  // Handle paste for inline images - upload to Worker
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          
          // Upload to Worker
          setIsUploading(true);
          const result = await workerApi.uploadAttachment(file);
          setIsUploading(false);

          if (result.success && result.data) {
            // Insert img tag with URL from server
            const img = document.createElement('img');
            img.src = result.data.url;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '8px';
            img.style.marginTop = '8px';
            img.style.marginBottom = '8px';
            el.appendChild(img);
          } else {
            toast.error('שגיאה בהעלאת התמונה');
          }
        }
      }
    };

    el.addEventListener('paste', handlePaste as any);
    return () => el.removeEventListener('paste', handlePaste as any);
  }, []);

  const loadMessages = () => {
    const messages = getMessagesForStudent(studentId, true); // include deleted
    setAllMessages(messages);
  };

  const loadStudents = async () => {
    try {
      const { getStudents } = await import('@/lib/storage');
      const allStudents = getStudents();
      // Filter out current student
      setStudents(allStudents.filter(s => s.id !== studentId));
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const getRecipientDisplay = (message: Message): string => {
    if (message.recipientIds.includes('all')) return 'כל התלמידות';

    const names = message.recipientIds
      .map(id => students.find(s => s.id === id))
      .filter(Boolean)
      .map(s => `${s!.firstName} ${s!.lastName}`);

    if (names.length <= 1) return names[0] || 'תלמידה';
    if (names.length === 2) return `${names[0]}, ${names[1]}`;

    const extra = names.length - 2;
    return `${names[0]}, ${names[1]} ועוד ${extra} תלמידות`;
  };

  const getFilteredMessages = (): Message[] => {
    switch (selectedFolder) {
      case 'inbox':
        return allMessages.filter(m => 
          (m.senderId !== studentId || m.recipientIds.includes(studentId)) && 
          !m.isDeleted?.[studentId]
        );
      case 'sent':
        return allMessages.filter(m => 
          m.senderId === studentId &&
          !m.isDeleted?.[studentId]
        );
      case 'drafts':
        return getDrafts(studentId).filter(m => !m.isDeleted?.[studentId]);
      case 'starred':
        return getStarredMessages(studentId).filter(m => !m.isDeleted?.[studentId]);
      case 'trash':
        return getDeletedMessages(studentId);
      default:
        return [];
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await workerApi.uploadAttachment(file);
      
      if (result.success && result.data) {
        setAttachments(prev => [...prev, result.data]);
      } else {
        toast.error(`שגיאה בהעלאת ${file.name}`);
      }
    }
    setIsUploading(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await handleFileUpload(files);
    }
  };

  const handleDeleteAttachment = async (index: number) => {
    const attachment = attachments[index];
    const result = await workerApi.deleteAttachment(attachment.path);
    
    if (result.success) {
      setAttachments(prev => prev.filter((_, i) => i !== index));
      toast.success('הקובץ נמחק');
    } else {
      toast.error('שגיאה במחיקת הקובץ');
    }
  };

  const handleCompose = () => {
    setIsComposing(true);
    setIsReplying(false);
    setComposeSubject('');
    if (editorRef.current) editorRef.current.innerHTML = '';
    setComposeRecipients(['admin']);
    setSelectedMessage(null);
    setAttachments([]);
  };

  const handleReply = (message: Message) => {
    setIsReplying(true);
    setIsComposing(true);
    setComposeSubject(`תגובה: ${message.subject}`);
    if (editorRef.current) editorRef.current.innerHTML = '';
    setComposeRecipients([message.senderId]);
    setSelectedMessage(message);
  };

  const handleForward = (message: Message) => {
    setIsReplying(false);
    setIsComposing(true);
    setComposeSubject(`FW: ${message.subject}`);
    if (editorRef.current) {
      editorRef.current.innerHTML = `<p><br></p><p>--- הודעה מועברת ---</p><p>מאת: ${message.senderName}</p><p>נושא: ${message.subject}</p><p><br></p>${message.contentHtml || message.content}`;
    }
    setComposeRecipients(['admin']);
    setSelectedMessage(message);
  };

  const insertEmoji = (emoji: string) => {
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(emoji));
    range.collapse(false);
  };

  const handleSend = () => {
    if (!composeSubject.trim()) {
      toast.error('נא למלא נושא');
      return;
    }

    const html = editorRef.current?.innerHTML || '';
    const plain = editorRef.current?.innerText || '';

    addMessage({
      senderId: studentId,
      senderName: studentName,
      recipientIds: composeRecipients,
      subject: composeSubject,
      content: plain,
      contentHtml: html,
      attachments: attachments.length > 0 ? attachments : undefined,
      inReplyTo: isReplying && selectedMessage ? selectedMessage.id : undefined,
      type: 'general',
    });

    toast.success('ההודעה נשלחה בהצלחה');
    setIsComposing(false);
    setIsReplying(false);
    setComposeSubject('');
    if (editorRef.current) editorRef.current.innerHTML = '';
    setComposeRecipients(['admin']);
    setSelectedMessage(null);
    setAttachments([]);
    loadMessages();
  };

  const handleSaveDraft = () => {
    if (!composeSubject.trim() && !editorRef.current?.innerText?.trim()) {
      toast.error('נא למלא נושא או תוכן');
      return;
    }

    const html = editorRef.current?.innerHTML || '';
    const plain = editorRef.current?.innerText || '';

    saveDraft({
      senderId: studentId,
      senderName: studentName,
      recipientIds: composeRecipients,
      subject: composeSubject,
      content: plain,
      contentHtml: html,
      attachments: attachments.length > 0 ? attachments : undefined,
      type: 'general',
    });

    toast.success('הטיוטה נשמרה');
    setIsComposing(false);
    setComposeSubject('');
    if (editorRef.current) editorRef.current.innerHTML = '';
    setComposeRecipients(['admin']);
    setAttachments([]);
    loadMessages();
  };

  const handleToggleStar = (messageId: string) => {
    toggleMessageStar(messageId, studentId);
    loadMessages();
  };

  const handleMoveToTrash = (messageId: string) => {
    markMessageAsDeleted(messageId, studentId, true);
    loadMessages();
    setSelectedMessage(null);
    toast.success('ההודעה הועברה לאשפה');
  };

  const handleRestore = (messageId: string) => {
    markMessageAsDeleted(messageId, studentId, false);
    loadMessages();
    setSelectedMessage(null);
    toast.success('ההודעה שוחזרה');
  };

  const handleMarkAsRead = (message: Message) => {
    if (!message.isRead?.[studentId]) {
      markMessageAsRead(message.id, studentId, true);
      loadMessages();
    }
    
    setSelectedMessage(message);
  };

  const handleMarkAsUnread = (messageId: string) => {
    markMessageAsUnread(messageId, studentId);
    loadMessages();
    toast.success('ההודעה סומנה כלא נקראה');
  };

  // Filter out messages shown in starred banner
  const bannerStarredIds = new Set(
    getStarredMessages(studentId).slice(0, 3).map(m => m.id)
  );

  const filteredMessages = getFilteredMessages()
    .filter(m => !bannerStarredIds.has(m.id))
    .sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  
  const unreadCount = allMessages.filter(m => 
    m.senderId !== studentId && 
    !m.isRead?.[studentId] &&
    !m.isDeleted?.[studentId]
  ).length;

  const sentCount = allMessages.filter(m => 
    m.senderId === studentId &&
    !m.isDeleted?.[studentId]
  ).length;

  const draftsCount = getDrafts(studentId).filter(m => !m.isDeleted?.[studentId]).length;
  const starredCount = getStarredMessages(studentId).filter(m => !m.isDeleted?.[studentId]).length;
  const trashCount = getDeletedMessages(studentId).length;

  const folders = [
    { type: 'inbox' as FolderType, label: 'דואר נכנס', icon: Inbox, count: unreadCount },
    { type: 'sent' as FolderType, label: 'דואר יוצא', icon: Send, count: sentCount },
    { type: 'drafts' as FolderType, label: 'טיוטות', icon: FileText, count: draftsCount },
    { type: 'starred' as FolderType, label: 'מסומנות בכוכב', icon: Star, count: starredCount },
    { type: 'trash' as FolderType, label: 'אשפה', icon: Trash2, count: trashCount },
  ];

  return (
    <div className="flex gap-4 h-[calc(100vh-300px)]" dir="rtl">
      {/* Right Sidebar - Folders */}
      <Card className="w-64 flex-shrink-0">
        <CardContent className="p-4 space-y-2">
          <Button 
            onClick={handleCompose}
            className="w-full justify-start gap-2 mb-4"
          >
            <Plus className="w-4 h-4" />
            הודעה חדשה
          </Button>

          {folders.map(folder => (
            <Button
              key={folder.type}
              variant={selectedFolder === folder.type ? 'default' : 'ghost'}
              className="w-full justify-between"
              onClick={() => {
                setSelectedFolder(folder.type);
                setSelectedMessage(null);
                setIsComposing(false);
              }}
            >
              <div className="flex items-center gap-2">
                <folder.icon className="w-4 h-4" />
                {folder.label}
              </div>
              {folder.count > 0 && (
                <Badge variant="secondary">{folder.count}</Badge>
              )}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Message List */}
      <Card className="w-96 flex-shrink-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-y-auto h-full">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {selectedFolder === 'inbox' && 'אין הודעות חדשות'}
                {selectedFolder === 'sent' && 'לא נשלחו הודעות'}
                {selectedFolder === 'drafts' && 'אין טיוטות'}
                {selectedFolder === 'starred' && 'אין הודעות מסומנות'}
                {selectedFolder === 'trash' && 'האשפה ריקה'}
              </div>
            ) : (
              filteredMessages.map(message => {
                const isRead = message.isRead?.[studentId];
                const isStarred = message.starred?.[studentId];
                const isSelected = selectedMessage?.id === message.id;
                
                return (
                  <div
                    key={message.id}
                    onClick={() => handleMarkAsRead(message)}
                    className={cn(
                      "p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                      !isRead && "bg-amber-50 font-bold",
                      isSelected && "bg-muted"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {/* Envelope Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {!isRead ? (
                          <Mail className="w-4 h-4 text-primary" />
                        ) : (
                          <MailOpen className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStar(message.id);
                        }}
                        disabled={isStarred && !canUserRemoveStar(message, studentId)}
                        className={`mt-1 ${isStarred && !canUserRemoveStar(message, studentId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Star 
                          className={cn(
                            "w-4 h-4",
                            isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                          )} 
                        />
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("font-semibold truncate", !isRead && "font-bold")}>
                            {message.subject || '(ללא נושא)'}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatMessageDate(message.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate mt-1">
                          <span>
                            {selectedFolder === 'sent' ? `אל: ${getRecipientDisplay(message)}` : `מאת: ${message.senderName}`}
                          </span>
                          <MessageTypeBadge message={message} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Message View / Compose */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-6 h-full overflow-y-auto">
          {isComposing ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {isReplying ? 'תגובה להודעה' : 'הודעה חדשה'}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsComposing(false);
                    setIsReplying(false);
                    setSelectedMessage(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>נמענים</Label>
                <Select
                  value={composeRecipients[0]}
                  onValueChange={(value) => {
                    if (value === 'all') {
                      setComposeRecipients(['all']);
                    } else {
                      setComposeRecipients([value]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר נמענים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">למנהל</SelectItem>
                    <SelectItem value="all">לכל התלמידות</SelectItem>
                    {students.map((student: any) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.firstName} {student.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">נושא</Label>
                <Input
                  id="subject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="נושא ההודעה"
                />
              </div>

              <div className="space-y-2">
                <Label>תוכן</Label>
                <div className="border rounded-md overflow-hidden">
                  {/* Toolbar */}
                  <div className="flex items-center gap-2 px-2 py-1 border-b bg-muted">
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      onClick={() => document.execCommand('bold')}
                    >
                      <span className="font-bold">B</span>
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      onClick={() => document.execCommand('underline')}
                    >
                      <span style={{ textDecoration: 'underline' }}>U</span>
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      onClick={() => document.execCommand('foreColor', false, '#c53030')}
                    >
                      <span className="text-red-600">A</span>
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      onClick={() => document.execCommand('fontSize', false, '4')}
                    >
                      A+
                    </Button>
                    <div className="border-r h-6 mx-2" />
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    <div className="ml-auto flex gap-1">
                      {['🎵','⭐','😊','🔥','👏'].map(e => (
                        <button 
                          key={e} 
                          type="button" 
                          className="text-lg hover:bg-muted rounded p-1"
                          onClick={() => insertEmoji(e)}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Editable area */}
                  <div
                    ref={editorRef}
                    className="min-h-[120px] px-3 py-2 outline-none focus:ring-1 focus:ring-ring"
                    contentEditable
                    suppressContentEditableWarning
                    dir="rtl"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                </div>
              </div>

              {/* Attachments display */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <Label>קבצים מצורפים ({attachments.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att, idx) => (
                      <AttachmentPreview 
                        key={idx} 
                        attachment={att} 
                        onDelete={() => handleDeleteAttachment(idx)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {isUploading && (
                <div className="text-sm text-muted-foreground">
                  מעלה קבצים...
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSend}>
                  <Send className="w-4 h-4 mr-2" />
                  שלח
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                >
                  <Save className="w-4 h-4 mr-2" />
                  שמור כטיוטה
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsComposing(false);
                    setIsReplying(false);
                  }}
                >
                  ביטול
                </Button>
              </div>
            </div>
          ) : selectedMessage ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 pb-4 border-b">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-semibold">{selectedMessage.subject}</h3>
                    <MessageTypeBadge message={selectedMessage} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>מאת: {selectedMessage.senderName}</div>
                    <div>אל: {getRecipientDisplay(selectedMessage)}</div>
                    <div>{new Date(selectedMessage.createdAt).toLocaleString('he-IL')}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedMessage(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="text-sm leading-relaxed">
                {selectedMessage.contentHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: selectedMessage.contentHtml }} />
                ) : (
                  <div className="whitespace-pre-wrap">{selectedMessage.content}</div>
                )}
              </div>

              {/* Attachments display in message view */}
              {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                <div className="pt-4 border-t space-y-2">
                  <Label>קבצים מצורפים ({selectedMessage.attachments.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMessage.attachments.map((att, idx) => (
                      <AttachmentPreview 
                        key={idx} 
                        attachment={att} 
                        readOnly
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReply(selectedMessage)}
                >
                  <Reply className="w-4 h-4 mr-2" />
                  השב
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleForward(selectedMessage)}
                >
                  <Forward className="w-4 h-4 mr-2" />
                  העבר
                </Button>
                {!selectedMessage.isRead?.[studentId] && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkAsUnread(selectedMessage.id)}
                  >
                    <MailOpen className="w-4 h-4 mr-2" />
                    סמן כלא נקרא
                  </Button>
                )}
                {selectedFolder !== 'trash' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMoveToTrash(selectedMessage.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    העבר לאשפה
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(selectedMessage.id)}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    שחזר
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleStar(selectedMessage.id)}
                  disabled={selectedMessage.starred?.[studentId] && !canUserRemoveStar(selectedMessage, studentId)}
                >
                  <Star 
                    className={cn(
                      "w-4 h-4 mr-2",
                      selectedMessage.starred?.[studentId] && "fill-yellow-400"
                    )} 
                  />
                  {selectedMessage.starred?.[studentId] ? 'הסר כוכב' : 'סמן בכוכב'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              בחר הודעה לצפייה
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}