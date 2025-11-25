import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Message } from "@/lib/types";
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
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MessageTypeBadge } from "./MessageTypeBadge";

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
  const [composeContent, setComposeContent] = useState('');
  const [composeRecipients, setComposeRecipients] = useState<string[]>(['admin']);
  
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    loadMessages();
    loadStudents();
  }, [studentId]);

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
    if (message.recipientIds.length > 1) {
      const firstStudent = students.find(s => s.id === message.recipientIds[0]);
      const firstName = firstStudent ? `${firstStudent.firstName} ${firstStudent.lastName}` : 'תלמידה';
      return `${firstName} ועוד ${message.recipientIds.length - 1}`;
    }
    if (message.recipientIds[0] === 'admin') return 'המורה';
    const recipient = students.find(s => s.id === message.recipientIds[0]);
    return recipient ? `${recipient.firstName} ${recipient.lastName}` : 'תלמידה';
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

  const handleCompose = () => {
    setIsComposing(true);
    setIsReplying(false);
    setComposeSubject('');
    setComposeContent('');
    setComposeRecipients(['admin']);
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
    setComposeRecipients(['admin']);
    setSelectedMessage(message);
  };

  const handleSend = () => {
    if (!composeSubject.trim()) {
      toast.error('נא למלא נושא');
      return;
    }

    addMessage({
      senderId: studentId,
      senderName: studentName,
      recipientIds: composeRecipients,
      subject: composeSubject,
      content: composeContent,
      inReplyTo: isReplying && selectedMessage ? selectedMessage.id : undefined,
      type: 'general',
    });

    toast.success('ההודעה נשלחה בהצלחה');
    setIsComposing(false);
    setIsReplying(false);
    setComposeSubject('');
    setComposeContent('');
    setComposeRecipients(['admin']);
    setSelectedMessage(null);
    loadMessages();
  };

  const handleSaveDraft = () => {
    if (!composeSubject.trim() && !composeContent.trim()) {
      toast.error('נא למלא נושא או תוכן');
      return;
    }

    saveDraft({
      senderId: studentId,
      senderName: studentName,
      recipientIds: composeRecipients,
      subject: composeSubject,
      content: composeContent,
      type: 'general',
    });

    toast.success('הטיוטה נשמרה');
    setIsComposing(false);
    setComposeSubject('');
    setComposeContent('');
    setComposeRecipients(['admin']);
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

  const filteredMessages = getFilteredMessages().sort((a, b) => 
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
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <p className={cn("text-sm truncate", !isRead && "font-bold")}>
                              {selectedFolder === 'sent' ? `אל: ${getRecipientDisplay(message)}` : `מאת: ${message.senderName}`}
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
                <Label htmlFor="content">תוכן</Label>
                <Textarea
                  id="content"
                  value={composeContent}
                  onChange={(e) => setComposeContent(e.target.value)}
                  placeholder="תוכן ההודעה"
                  rows={10}
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
                    <span>אל: {getRecipientDisplay(selectedMessage)}</span>
                    <span>
                      {format(new Date(selectedMessage.createdAt), 'dd/MM/yyyy HH:mm', { locale: he })}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {canUserRemoveStar(selectedMessage, studentId) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleStar(selectedMessage.id)}
                      title={selectedMessage.starred?.[studentId] ? "הסר כוכב" : "הוסף כוכב"}
                    >
                      <Star 
                        className={cn(
                          "w-4 h-4",
                          selectedMessage.starred?.[studentId] ? "fill-yellow-400 text-yellow-400" : ""
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRestore(selectedMessage.id)}
                      title="שחזר"
                    >
                      <MailOpen className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {selectedMessage.content}
              </div>

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
