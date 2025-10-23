import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Check, X, Clock, Save } from 'lucide-react';
import { getSwapRequests, updateSwapRequest, getStudents } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { syncManager } from '@/lib/syncManager';

const SwapRequests = () => {
  const [requests, setRequests] = useState(getSwapRequests());
  const students = getStudents();

  const getStudentName = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    return student ? `${student.firstName} ${student.lastName}` : 'לא ידוע';
  };

  const handleApprove = (requestId: string) => {
    updateSwapRequest(requestId, { status: 'approved' });
    setRequests(getSwapRequests());
    syncManager.onUserAction('update');
    // Trigger automatic backup when swap request is processed
    syncManager.onSwapRequestReceived();
    toast({
      title: 'הצלחה',
      description: 'הבקשה אושרה בהצלחה',
    });
  };

  const handleReject = (requestId: string) => {
    updateSwapRequest(requestId, { status: 'rejected' });
    setRequests(getSwapRequests());
    syncManager.onUserAction('update');
    // Trigger automatic backup when swap request is processed
    syncManager.onSwapRequestReceived();
    toast({
      title: 'הצלחה',
      description: 'הבקשה נדחתה',
    });
  };

  const handleSave = () => {
    syncManager.onUserAction('update');
    toast({
      title: 'נשמר בהצלחה',
      description: 'כל הנתונים נשמרו למערכת',
    });
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'default',
      approved: 'secondary',
      rejected: 'destructive',
    } as const;

    const labels = {
      pending: 'ממתין',
      approved: 'אושר',
      rejected: 'נדחה',
    };

    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
  };

  return (
    <div className="max-h-screen overflow-y-auto p-4">
      <Card className="royal-card royal-shadow">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl flex items-center gap-2 text-royal-gold">
              <MessageSquare className="h-6 w-6" />
              בקשות החלפת שיעורים
            </CardTitle>
            <Button onClick={handleSave} className="royal-gradient hover:royal-glow">
              <Save className="h-4 w-4 mr-2" />
              שמור נתונים
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-royal-gold">בקשות ממתינות לאישור</h3>
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="p-4 border border-royal-burgundy/30 rounded-lg bg-royal-burgundy/5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-royal-burgundy">
                          {getStudentName(request.requesterId)} מבקשת להחליף עם {getStudentName(request.targetId)}
                        </div>
                        <div className="text-sm text-royal-black/70">
                          תאריך: {new Date(request.date).toLocaleDateString('he-IL')} בשעה {request.time}
                        </div>
                        <div className="text-sm text-royal-black/70">
                          נוצר: {new Date(request.createdAt).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    
                    <div className="mb-3">
                      <strong className="text-royal-burgundy">סיבה:</strong>
                      <p className="text-royal-black/80 mt-1">{request.reason}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(request.id)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        אשר
                      </Button>
                      <Button
                        onClick={() => handleReject(request.id)}
                        variant="destructive"
                      >
                        <X className="h-4 w-4 mr-2" />
                        דחה
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processed Requests */}
          {processedRequests.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-royal-gold">בקשות שטופלו</h3>
              <div className="space-y-3">
                {processedRequests.map((request) => (
                  <div key={request.id} className="p-3 border border-royal-burgundy/20 rounded-lg bg-royal-burgundy/3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-royal-burgundy">
                          {getStudentName(request.requesterId)} ← → {getStudentName(request.targetId)}
                        </div>
                        <div className="text-sm text-royal-black/70">
                          {new Date(request.date).toLocaleDateString('he-IL')} {request.time}
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {requests.length === 0 && (
            <div className="text-center py-8 text-royal-black/60">
              <Clock className="h-12 w-12 mx-auto mb-4 text-royal-gold/50" />
              <p>אין בקשות החלפה כרגע</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SwapRequests;
