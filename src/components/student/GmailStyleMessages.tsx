import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  getMessagesForStudent, 
  markMessageAsRead, 
  addMessage,
  toggleMessageStar,
  markMessageAsDeleted,
  getDrafts,
  getStarredMessages,
  getDeletedMessages
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
  X
} from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

  const getFilteredMessages = (): Message[] => {
    switch (selectedFolder) {
      case 'inbox':
        return allMessages.filter(m => 
          (m.senderId !== studentId || m.recipientIds.includes(studentId)) && 
          !m.deletedBy?.[studentId]
        );
      case 'sent':
        return allMessages.filter(m => 
          m.senderId === studentId &&
          !m.deletedBy?.[studentId]
        );
      case 'drafts':
        return getDrafts(studentId).filter(m => !m.deletedBy?.[studentId]);
      case 'starred':
        return getStarredMessages(studentId).filter(m => !m.deletedBy?.[studentId]);
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

  const handleSend = () => {
    if (!composeContent.trim() || !composeSubject.trim()) {
      toast.error('נא למלא נושא ותוכן');
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
    
    // Auto-unstar when opening a starred message
    if (message.starred?.[studentId]) {
      toggleMessageStar(message.id, studentId);
      loadMessages();
    }
    
    setSelectedMessage(message);
  };

  const filteredMessages = getFilteredMessages();
  const unreadCount = allMessages.filter(m => 
    m.senderId !== studentId && 
    !m.isRead?.[studentId] &&
    !m.deletedBy?.[studentId]
  ).length;

  const folders = [
    { type: 'inbox' as FolderType, label: 'דואר נכנס', icon: Inbox, count: unreadCount },
    { type: 'sent' as FolderType, label: 'דואר יוצא', icon: Send, count: 0 },
    { type: 'drafts' as FolderType, label: 'טיוטות', icon: FileText, count: 0 },
    { type: 'starred' as FolderType, label: 'מסומנות בכוכב', icon: Star, count: 0 },
    { type: 'trash' as FolderType, label: 'אשפה', icon: Trash2, count: 0 },
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
                      !isRead && "bg-primary/5 font-semibold",
                      isSelected && "bg-muted"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStar(message.id);
                        }}
                        className="mt-1"
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
                          <p className="text-sm truncate">
                            {selectedFolder === 'sent' ? `אל: ${message.senderName}` : `מאת: ${message.senderName}`}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(message.createdAt), 'dd/MM', { locale: he })}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate">{message.subject}</p>
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
                      const allStudentIds = students.map(s => s.id);
                      setComposeRecipients(['all', ...allStudentIds]);
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
                  <h3 className="text-xl font-semibold mb-2">{selectedMessage.subject}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{selectedMessage.senderName}</span>
                    <span>
                      {format(new Date(selectedMessage.createdAt), 'dd/MM/yyyy HH:mm', { locale: he })}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleStar(selectedMessage.id)}
                  >
                    <Star 
                      className={cn(
                        "w-4 h-4",
                        selectedMessage.starred?.[studentId] ? "fill-yellow-400 text-yellow-400" : ""
                      )} 
                    />
                  </Button>
                  
                  {selectedFolder !== 'trash' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMoveToTrash(selectedMessage.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRestore(selectedMessage.id)}
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
