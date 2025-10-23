import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getSwapRequests, getStudents } from '@/lib/storage';
import { SwapRequest } from '@/lib/types';

interface SwapRequestsStatusProps {
  studentId: string;
}

const SwapRequestsStatus = ({ studentId }: SwapRequestsStatusProps) => {
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const students = getStudents();

  useEffect(() => {
    const allRequests = getSwapRequests();
    // Filter requests where this student is either the requester or target
    const myRequests = allRequests.filter(r => 
      r.requesterId === studentId || r.targetId === studentId
    );
    setRequests(myRequests);
  }, [studentId]);

  const getStudentName = (id: string) => {
    const student = students.find(s => s.id === id);
    return student ? `${student.firstName} ${student.lastName}` : 'לא ידוע';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'approved') {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          אושרה
        </Badge>
      );
    }
    if (status === 'rejected') {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          נדחתה
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        ממתינה לאישור
      </Badge>
    );
  };

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            בקשות החלפה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">
            אין בקשות החלפה
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          בקשות החלפה שלי
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {requests.map((request) => {
          const isRequester = request.requesterId === studentId;
          const otherStudentId = isRequester ? request.targetId : request.requesterId;
          const otherStudentName = getStudentName(otherStudentId);

          return (
            <div
              key={request.id}
              className={`p-4 border rounded-lg ${
                request.status === 'approved'
                  ? 'bg-green-50 border-green-200'
                  : request.status === 'rejected'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-muted/50 border-muted'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium">
                    {isRequester ? (
                      <>בקשת החלפה עם {otherStudentName}</>
                    ) : (
                      <>{otherStudentName} מבקשת להחליף איתך</>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    השיעור המקורי: {new Date(request.date).toLocaleDateString('he-IL')} בשעה {request.time}
                  </p>
                  {request.targetDate && request.targetTime && (
                    <p className="text-sm text-muted-foreground">
                      שיעור להחלפה: {new Date(request.targetDate).toLocaleDateString('he-IL')} בשעה {request.targetTime}
                    </p>
                  )}
                </div>
                {getStatusBadge(request.status)}
              </div>

              {request.reason && (
                <div className="mt-2 p-2 bg-background/50 rounded text-sm">
                  <strong>סיבה:</strong> {request.reason}
                </div>
              )}

              {request.status === 'approved' && (
                <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded text-sm text-green-800">
                  ✓ ההחלפה בוצעה בהצלחה - השיעורים עודכנו במערכת
                </div>
              )}

              {request.status === 'rejected' && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-800">
                  ✗ הבקשה נדחתה על ידי המנהלת
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-2">
                נשלחה: {new Date(request.createdAt).toLocaleDateString('he-IL')}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default SwapRequestsStatus;
