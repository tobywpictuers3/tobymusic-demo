import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Message, Student } from "@/lib/types";
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
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MessageTypeBadge } from "../student/MessageTypeBadge";

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
  const [composeContent, setComposeContent] = useState('');
  const [composeRecipients, setComposeRecipients] = useState<string[]>(['all']);
  const [expirationDate, setExpirationDate] = useState('');
  
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    loadData();
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

  const handleCompose = () => {
    setIsComposing(true);
    setIsReplying(false);
    setComposeSubject('');
    setComposeContent('');
    setComposeRecipients(['all']);
    setExpirationDate('');
    setSelectedMessage(null);
  };

  const handleReply = (message: Message) => {
    setIsReplying(true);
    setIsComposing(true);
    setComposeSubject(`תגובה: ${message.subject}`);
    setComposeContent('');
    setComposeRecipients([message.senderId]);
    setSelectedMessage(message);
  };

  const handleForward = (message: Message) => {
    setIsReplying(false);
    setIsComposing(true);
    setComposeSubject(`FW: ${message.subject}`);
    setComposeContent(`\n\n--- הודעה מועברת ---\nמאת: ${message.senderName}\nנושא: ${message.subject}\n\n${message.content}`);
    setComposeRecipients(['all']);
    setSelectedMessage(message);
  };

  const handleSend = () => {
    if (!composeSubject.trim()) {
      toast.error('נא למלא נושא');
      return;
    }

    addMessage({
      senderId: 'admin',
      senderName: 'המנהל',
      recipientIds: composeRecipients,
      subject: composeSubject,
      content: composeContent,
      expiresAt: expirationDate || undefined,
      inReplyTo: isReplying && selectedMessage ? selectedMessage.id : undefined,
      type: 'general',
    });

    toast.success('ההודעה נשלחה בהצלחה');
    setIsComposing(false);
    setIsReplying(false);
    setComposeSubject('');
    setComposeContent('');
    setComposeRecipients(['all']);
    setExpirationDate('');
    setSelectedMessage(null);
    loadData();
  };

  const handleSaveDraft = () => {
    if (!composeSubject.trim() && !composeContent.trim()) {
      toast.error('נא למלא נושא או תוכן');
      return;
    }

    saveDraft({
      senderId: 'admin',
      senderName: 'המנהל',
      recipientIds: composeRecipients,
      subject: composeSubject,
      content: composeContent,
      type: 'general',
    });

    toast.success('הטיוטה נשמרה');
    setIsComposing(false);
    setComposeSubject('');
    setComposeContent('');
    setComposeRecipients(['all']);
    setExpirationDate('');
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

  const filteredMessages = getFilteredMessages().sort((a, b) => 
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
    if (recipientIds.length === 1) {
      const student = students.find(s => s.id === recipientIds[0]);
      return student ? `${student.firstName} ${student.lastName}` : 'תלמידה';
    }
    return `${recipientIds.length} תלמידות`;
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
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <p className={cn("text-sm truncate", !isRead && "font-bold")}>
                              {selectedFolder === 'sent' 
                                ? `אל: ${getRecipientName(message.recipientIds)}` 
                                : `מאת: ${message.senderName}`}
                            </p>
                            <MessageTypeBadge message={message} />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatMessageDate(message.createdAt)}
                          </span>
                        </div>
                        <p className={cn("text-sm truncate", !isRead ? "font-bold" : "font-medium")}>{message.subject}</p>
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
                <Label htmlFor="content">תוכן</Label>
                <Textarea
                  id="content"
                  value={composeContent}
                  onChange={(e) => setComposeContent(e.target.value)}
                  placeholder="תוכן ההודעה"
                  rows={10}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration">תאריך תפוגה (אופציונלי)</Label>
                <Input
                  id="expiration"
                  type="datetime-local"
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
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <span>מאת: {selectedMessage.senderName}</span>
                    <span>אל: {getRecipientName(selectedMessage.recipientIds)}</span>
                    <span>
                      {format(new Date(selectedMessage.createdAt), 'dd/MM/yyyy HH:mm', { locale: he })}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {canUserRemoveStar(selectedMessage, 'admin') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleStar(selectedMessage.id)}
                      title={selectedMessage.starred?.['admin'] ? "הסר כוכב" : "הוסף כוכב"}
                    >
                      <Star 
                        className={cn(
                          "w-4 h-4",
                          selectedMessage.starred?.['admin'] ? "fill-yellow-400 text-yellow-400" : ""
                        )} 
                      />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMarkAsUnread(selectedMessage.id)}
                    title="סמן כלא נקרא"
                  >
                    <Mail className="w-4 h-4" />
                  </Button>
                  
                  {selectedFolder !== 'trash' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveToTrash(selectedMessage.id)}
                      title="העבר לאשפה"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRestore(selectedMessage.id)}
                        title="שחזר"
                      >
                        <MailOpen className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePermanentDelete(selectedMessage.id)}
                        title="מחק לצמיתות"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {selectedMessage.content}
              </div>

              {/* Swap Request Action Buttons */}
              {selectedMessage.type === 'swap_request' && 
               selectedMessage.metadata?.action === 'approve_or_reject' && (
                <div className="pt-4 border-t">
                  <div className="flex gap-2">
                    <Button 
                      variant="default" 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApproveSwap(selectedMessage.metadata!.swapRequestId)}
                    >
                      ✓ אשר החלפה
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => handleRejectSwap(selectedMessage.metadata!.swapRequestId)}
                    >
                      ✗ דחה החלפה
                    </Button>
                  </div>
                </div>
              )}

              {selectedMessage.expiresAt && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  תוקף עד: {format(new Date(selectedMessage.expiresAt), 'dd/MM/yyyy HH:mm', { locale: he })}
                </div>
              )}

              {selectedFolder === 'inbox' && (
                <div className="pt-4 border-t">
                  <Button onClick={() => handleReply(selectedMessage)}>
                    <Reply className="w-4 h-4 mr-2" />
                    השב
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <Mail className="w-16 h-16 mx-auto opacity-20" />
                <p>בחר הודעה לצפייה</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
