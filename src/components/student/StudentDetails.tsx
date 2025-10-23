import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Mail, Calendar, CreditCard } from 'lucide-react';
import { Student } from '@/lib/types';
import { calculateLessonNumber, getPayments } from '@/lib/storage';

interface StudentDetailsProps {
  student: Student;
}

const StudentDetails = ({ student }: StudentDetailsProps) => {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentLessonNumber = calculateLessonNumber(student.id, currentDate);
  
  // Calculate payment status based on payments
  const payments = getPayments().filter(p => p.studentId === student.id);
  const currentYear = new Date().getFullYear();
  const academicYearPayments = payments.filter(p => {
    if (!p.month) return false;
    const paymentYear = parseInt(p.month.split('-')[0]);
    const paymentMonth = parseInt(p.month.split('-')[1]);
    return (paymentYear === currentYear && paymentMonth >= 9) || 
           (paymentYear === currentYear + 1 && paymentMonth <= 8);
  });
  
  const paidMonths = academicYearPayments.filter(p => p.status === 'paid').length;
  const totalMonths = student.paymentMonths;
  
  const getDetailedPaymentStatus = () => {
    if (paidMonths === totalMonths) {
      return { status: 'שולם', variant: 'default' as const, description: `${paidMonths}/${totalMonths} חודשים` };
    }
    
    const paymentMethod = payments[0]?.paymentMethod || 'inactive';
    
    switch (paymentMethod) {
      case 'bank':
        return { 
          status: 'מטופל', 
          variant: 'secondary' as const, 
          description: `${paidMonths}/${totalMonths} חודשים - הוראת קבע` 
        };
      case 'cash':
        const halfYearComplete = paidMonths >= 6;
        return { 
          status: halfYearComplete ? 'מזומן חצי שנתי הושלם' : 'מזומן חצי שנתי', 
          variant: halfYearComplete ? 'default' as const : 'secondary' as const,
          description: `${paidMonths}/${totalMonths} חודשים` 
        };
      case 'check':
        return { 
          status: paidMonths === 0 ? 'לא הושלם' : 'מטופל', 
          variant: paidMonths === 0 ? 'destructive' as const : 'secondary' as const,
          description: `${paidMonths}/${totalMonths} חודשים - צ'קים` 
        };
      default:
        return { 
          status: 'לא הושלם', 
          variant: 'destructive' as const, 
          description: `${paidMonths}/${totalMonths} חודשים` 
        };
    }
  };

  const getPaymentMethodLabel = (method: 'bank' | 'check' | 'cash' | 'inactive') => {
    const labels = {
      bank: 'בנק',
      check: 'צ\'ק',
      cash: 'מזומן',
      inactive: 'לא פעיל'
    };
    return labels[method];
  };

  const paymentStatus = getDetailedPaymentStatus();
  const paymentMethod = payments[0]?.paymentMethod || 'inactive';

  return (
    <Card className="card-gradient card-shadow">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <User className="h-6 w-6" />
          הפרטים שלי
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">פרטים אישיים</h3>
            
            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
              <User className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">שם מלא</div>
                <div className="text-muted-foreground">{student.firstName} {student.lastName}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">טלפון</div>
                <div className="text-muted-foreground">{student.phone}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">אימייל</div>
                <div className="text-muted-foreground">{student.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">תאריך התחלה</div>
                <div className="text-muted-foreground">
                  {new Date(student.startDate).toLocaleDateString('he-IL')}
                </div>
              </div>
            </div>
          </div>

          {/* Learning Progress */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">התקדמות בלימודים</h3>
            
            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="font-medium">סטטוס תשלום</div>
                <div className="mt-1 space-y-1">
                  <Badge variant={paymentStatus.variant}>{paymentStatus.status}</Badge>
                  <div className="text-sm text-muted-foreground">
                    {paymentStatus.description}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    אופן תשלום: {getPaymentMethodLabel(paymentMethod)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">מספר שיעור נוכחי</div>
                <div className="text-muted-foreground">שיעור #{currentLessonNumber}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold mb-2">מידע נוסף</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• כל שיעור נספר החל מתאריך ההתחלה שלך</p>
            <p>• ניתן לבקש החלפות שיעור דרך המערכת</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentDetails;
