import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  getMessagesForAdmin, 
  markMessageAsRead, 
  markMessageAsUnread,
  addMessage,
  toggleMessageStar,
  markMessageAsDeleted,
  getDrafts,
  getStarredMessages,
  getDeletedMessages,
  deleteMessage,
  getMessageType,
  canUserRemoveStar,
  saveDraft
} from "@/lib/messages";
import { getStudents, updateSwapRequestStatus } from "@/lib/storage";
import { Message, Student, Attachment } from "@/lib/types";
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
  ArrowLeftRight,
  Save,
  Forward,
  RotateCcw,
  Paperclip
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageTypeBadge } from "../student/MessageTypeBadge";
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

type FolderType = 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash' | 'swap_requests';

export default function MessagingTab() {
  const [selectedFolder, setSelectedFolder] = useState<FolderType>('inbox');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  
  const [composeSubject, setComposeSubject] = useState('');
  const [composeRecipients, setComposeRecipients] = useState<string[]>(['all']);
  const [expirationDate, setExpirationDate] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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

  const loadData = () => {
    setStudents(getStudents());
    const messages = getMessagesForAdmin(true); // include deleted
    setAllMessages(messages);
  };

  const handleApproveSwap = (swapRequestId: string) => {
    try {
      updateSwapRequestStatus(swapRequestId, 'approved');
      loadData(); // Refresh messages
      setSelectedMessage(null); // Close message view
      toast.success('בקשת ההחלפה אושרה והשיעורים הוחלפו');
    } catch (error) {
      toast.error('לא ניתן לאשר את ההחלפה');
    }
  };

  const handleRejectSwap = (swapRequestId: string) => {
    try {
      updateSwapRequestStatus(swapRequestId, 'rejected');
      loadData(); // Refresh messages
      setSelectedMessage(null); // Close message view
      toast.success('בקשת ההחלפה נדחתה');
    } catch (error) {
      toast.error('לא ניתן לדחות את ההחלפה');
    }
  };

  const getFilteredMessages = (): Message[] => {
    switch (selectedFolder) {
      case 'inbox':
        return allMessages.filter(m => 
          m.senderId !== 'admin' && 
          !m.isDeleted?.['admin']
        );
      case 'sent':
        return allMessages.filter(m => 
          m.senderId === 'admin' &&
          !m.isDeleted?.['admin']
        );
      case 'drafts':
        return getDrafts('admin').filter(m => !m.isDeleted?.['admin']);
      case 'starred':
        return getStarredMessages('admin').filter(m => !m.isDeleted?.['admin']);
      case 'trash':
        return getDeletedMessages('admin');
      case 'swap_requests':
        return allMessages.filter(m => 
          (m.type === 'swap_request' || m.metadata?.action === 'approve_or_reject') &&
          !m.isDeleted?.['admin']
        );
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
    setComposeRecipients(['all']);
    setExpirationDate('');
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
    setComposeRecipients(['all']);
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
      senderId: 'admin',
      senderName: 'המנהל',
      recipientIds: composeRecipients,
      subject: composeSubject,
      content: plain,
      contentHtml: html,
      attachments: attachments.length > 0 ? attachments : undefined,
      expiresAt: expirationDate || undefined,
      inReplyTo: isReplying && selectedMessage ? selectedMessage.id : undefined,
      type: 'general',
    });

    toast.success('ההודעה נשלחה בהצלחה');
    setIsComposing(false);
    setIsReplying(false);
    setComposeSubject('');
    if (editorRef.current) editorRef.current.innerHTML = '';
    setComposeRecipients(['all']);
    setExpirationDate('');
    setSelectedMessage(null);
    setAttachments([]);
    loadData();
  };

  const handleSaveDraft = () => {
    if (!composeSubject.trim() && !editorRef.current?.innerText?.trim()) {
      toast.error('נא למלא נושא או תוכן');
      return;
    }

    const html = editorRef.current?.innerHTML || '';
    const plain = editorRef.current?.innerText || '';

    saveDraft({
      senderId: 'admin',
      senderName: 'המנהל',
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
    setComposeRecipients(['all']);
    setExpirationDate('');
    setAttachments([]);
    loadData();
  };

  const handleToggleStar = (messageId: string) => {
    toggleMessageStar(messageId, 'admin');
    loadData();
  };

  const handleMoveToTrash = (messageId: string) => {
    markMessageAsDeleted(messageId, 'admin', true);
    loadData();
    setSelectedMessage(null);
    toast.success('ההודעה הועברה לאשפה');
  };

  const handleRestore = (messageId: string) => {
    markMessageAsDeleted(messageId, 'admin', false);
    loadData();
    setSelectedMessage(null);
    toast.success('ההודעה שוחזרה');
  };

  const handlePermanentDelete = (messageId: string) => {
    deleteMessage(messageId);
    loadData();
    setSelectedMessage(null);
    toast.success('ההודעה נמחקה לצמיתות');
  };

  const handleMarkAsRead = (message: Message) => {
    if (!message.isRead?.['admin']) {
      markMessageAsRead(message.id, 'admin', true);
      loadData();
    }
    
    setSelectedMessage(message);
  };

  const handleMarkAsUnread = (messageId: string) => {
    markMessageAsUnread(messageId, 'admin');
    loadData();
    toast.success('ההודעה סומנה כלא נקראה');
  };

  // Filter out messages shown in starred banner
  const bannerStarredIds = new Set(
    getStarredMessages('admin').slice(0, 3).map(m => m.id)
  );

  const filteredMessages = getFilteredMessages()
    .filter(m => !bannerStarredIds.has(m.id))
    .sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  
  const unreadCount = allMessages.filter(m => 
    m.senderId !== 'admin' && 
    !m.isRead?.['admin'] &&
    !m.isDeleted?.['admin']
  ).length;

  const sentCount = allMessages.filter(m => 
    m.senderId === 'admin' &&
    !m.isDeleted?.['admin']
  ).length;

  const draftsCount = getDrafts('admin').filter(m => !m.isDeleted?.['admin']).length;
  const starredCount = getStarredMessages('admin').filter(m => !m.isDeleted?.['admin']).length;
  const swapRequestsCount = allMessages.filter(m => 
    (m.type === 'swap_request' || m.metadata?.action === 'approve_or_reject') &&
    !m.isDeleted?.['admin']
  ).length;
  const trashCount = getDeletedMessages('admin').length;

  const folders = [
    { type: 'inbox' as FolderType, label: 'דואר נכנס', icon: Inbox, count: unreadCount },
    { type: 'sent' as FolderType, label: 'דואר יוצא', icon: Send, count: sentCount },
    { type: 'drafts' as FolderType, label: 'טיוטות', icon: FileText, count: draftsCount },
    { type: 'starred' as FolderType, label: 'מסומנות בכוכב', icon: Star, count: starredCount },
    { type: 'swap_requests' as FolderType, label: 'בקשות החלפה', icon: ArrowLeftRight, count: swapRequestsCount },
    { type: 'trash' as FolderType, label: 'אשפה', icon: Trash2, count: trashCount },
  ];

  const getRecipientName = (recipientIds: string[]) => {
    if (recipientIds.includes('all')) return 'כל התלמידות';

    const names = recipientIds
      .map(id => students.find(s => s.id === id))
      .filter(Boolean)
      .map(s => `${s!.firstName} ${s!.lastName}`);

    if (names.length <= 1) return names[0] || 'תלמידה';
    if (names.length === 2) return `${names[0]}, ${names[1]}`;

    const extra = names.length - 2;
    return `${names[0]}, ${names[1]} ועוד ${extra} תלמידות`;
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-250px)]" dir="rtl">
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
          <ScrollArea className="h-[calc(100vh-250px)]">
              {filteredMessages.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {selectedFolder === 'inbox' && 'אין הודעות חדשות'}
                  {selectedFolder === 'sent' && 'לא נשלחו הודעות'}
                  {selectedFolder === 'drafts' && 'אין טיוטות'}
                  {selectedFolder === 'starred' && 'אין הודעות מסומנות'}
                  {selectedFolder === 'swap_requests' && 'אין בקשות החלפה'}
                  {selectedFolder === 'trash' && 'האשפה ריקה'}
                </div>
            ) : (
              filteredMessages.map(message => {
                const isRead = message.isRead?.['admin'];
                const isStarred = message.starred?.['admin'];
                const isSelected = selectedMessage?.id === message.id;
                
                return (
                  <div
                    key={message.id}
                    onClick={() => handleMarkAsRead(message)}
                    className={cn(
                      "p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                      !isRead && selectedFolder === 'inbox' && "bg-amber-50 font-bold",
                      isSelected && "bg-muted"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {/* Envelope Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {!isRead && selectedFolder === 'inbox' ? (
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
                        disabled={isStarred && !canUserRemoveStar(message, 'admin')}
                        className={`mt-1 ${isStarred && !canUserRemoveStar(message, 'admin') ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                            {selectedFolder === 'sent' 
                              ? `אל: ${getRecipientName(message.recipientIds)}` 
                              : `מאת: ${message.senderName}`}
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
          </ScrollArea>
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
                    <SelectItem value="all">כל התלמידות</SelectItem>
                    {students.map(student => (
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

              <div className="space-y-2">
                <Label htmlFor="expiration">תאריך תפוגה (אופציונלי)</Label>
                <Input
                  id="expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>

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
                    <div>אל: {getRecipientName(selectedMessage.recipientIds)}</div>
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

              {/* Swap request actions */}
              {selectedMessage.metadata?.action === 'approve_or_reject' && selectedMessage.metadata.swapRequestId && (
                <div className="flex gap-2 p-4 bg-muted rounded-lg">
                  <Button
                    onClick={() => handleApproveSwap(selectedMessage.metadata!.swapRequestId!)}
                    variant="default"
                  >
                    אשר החלפה
                  </Button>
                  <Button
                    onClick={() => handleRejectSwap(selectedMessage.metadata!.swapRequestId!)}
                    variant="destructive"
                  >
                    דחה החלפה
                  </Button>
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
                {!selectedMessage.isRead?.['admin'] && (
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
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(selectedMessage.id)}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      שחזר
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handlePermanentDelete(selectedMessage.id)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      מחק לצמיתות
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleStar(selectedMessage.id)}
                  disabled={selectedMessage.starred?.['admin'] && !canUserRemoveStar(selectedMessage, 'admin')}
                >
                  <Star 
                    className={cn(
                      "w-4 h-4 mr-2",
                      selectedMessage.starred?.['admin'] && "fill-yellow-400"
                    )} 
                  />
                  {selectedMessage.starred?.['admin'] ? 'הסר כוכב' : 'סמן בכוכב'}
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