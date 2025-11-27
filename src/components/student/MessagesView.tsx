import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/safe-ui/card";
import { Button } from "@/components/safe-ui/button";
import { Badge } from "@/components/safe-ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/safe-ui/tabs";
import { Textarea } from "@/components/safe-ui/textarea";
import { Input } from "@/components/safe-ui/input";
import { Label } from "@/components/safe-ui/label";
import { getMessagesForStudent, markMessageAsRead, addMessage } from "@/lib/messages";
import { Message } from "@/lib/types";
import { toast } from "sonner";
import { Send, Mail, MailOpen } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface MessagesViewProps {
  studentId: string;
  studentName: string;
}

export default function MessagesView({ studentId, studentName }: MessagesViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [replyToId, setReplyToId] = useState<string | undefined>();
  const [replySubject, setReplySubject] = useState('');

  useEffect(() => {
    loadMessages();
  }, [studentId]);

  const loadMessages = () => {
    const studentMessages = getMessagesForStudent(studentId);
    setMessages(studentMessages);
  };

  const handleMarkAsRead = (messageId: string) => {
    markMessageAsRead(messageId, studentId);
    loadMessages();
  };

  const handleReply = (message: Message) => {
    setReplyToId(message.id);
    setReplySubject(`תגובה: ${message.subject}`);
  };

  const handleSendReply = () => {
    if (!replyContent.trim()) {
      toast.error('נא למלא תוכן הודעה');
      return;
    }

    addMessage({
      senderId: studentId,
      senderName: studentName,
      recipientIds: ['admin'],
      subject: replySubject,
      content: replyContent,
      inReplyTo: replyToId,
      type: 'general',
    });

    toast.success('התגובה נשלחה בהצלחה');
    setReplyContent('');
    setReplyToId(undefined);
    setReplySubject('');
    loadMessages();
  };

  const incomingMessages = messages.filter(m => m.senderId !== studentId);
  const sentMessages = messages.filter(m => m.senderId === studentId);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="inbox" dir="rtl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inbox">
            <Mail className="w-4 h-4 ml-2" />
            דואר נכנס
          </TabsTrigger>
          <TabsTrigger value="sent">
            <Send className="w-4 h-4 ml-2" />
            דואר יוצא
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <div className="space-y-3">
            {replyToId && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="text-lg">תגובה להודעה</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reply-subject">נושא</Label>
                    <Input
                      id="reply-subject"
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reply-content">תוכן</Label>
                    <Textarea
                      id="reply-content"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="תוכן התגובה"
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSendReply} className="flex-1">
                      <Send className="w-4 h-4 mr-2" />
                      שלח תגובה
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setReplyToId(undefined);
                        setReplyContent('');
                        setReplySubject('');
                      }}
                    >
                      ביטול
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {incomingMessages.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">אין הודעות חדשות</p>
                </CardContent>
              </Card>
            ) : (
              incomingMessages.map(message => {
                const isRead = message.isRead?.[studentId];
                return (
                  <Card key={message.id} className={!isRead ? 'border-primary' : ''}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-start gap-3 flex-1">
                          {!isRead && <Badge variant="default">חדש</Badge>}
                          <div className="flex-1">
                            <h4 className="font-semibold">{message.subject}</h4>
                            <p className="text-sm text-muted-foreground">
                              מאת: {message.senderName}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {format(new Date(message.createdAt), 'dd/MM/yyyy HH:mm', { locale: he })}
                        </Badge>
                      </div>
                      <p className="text-sm whitespace-pre-wrap mb-3">{message.content}</p>
                      <div className="flex gap-2">
                        {!isRead && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsRead(message.id)}
                          >
                            <MailOpen className="w-4 h-4 mr-2" />
                            סמן כנקרא
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReply(message)}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          תגובה
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="sent">
          <div className="space-y-3">
            {sentMessages.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">לא נשלחו הודעות</p>
                </CardContent>
              </Card>
            ) : (
              sentMessages.map(message => (
                <Card key={message.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold">{message.subject}</h4>
                        <p className="text-sm text-muted-foreground">אל: {message.senderName}</p>
                      </div>
                      <Badge variant="outline">
                        {format(new Date(message.createdAt), 'dd/MM/yyyy HH:mm', { locale: he })}
                      </Badge>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
