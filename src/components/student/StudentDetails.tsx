import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Mail, Calendar, CreditCard, Coins } from 'lucide-react';
import { Student } from '@/lib/types';
import { calculateLessonNumber, getPayments, getCompletedLessonsCount } from '@/lib/storage';

interface StudentDetailsProps {
  student: Student;
}

const StudentDetails = ({ student }: StudentDetailsProps) => {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentLessonNumber = calculateLessonNumber(student.id, currentDate);
  
  const isPerLesson = student.paymentType === 'per_lesson';
  
  // For per-lesson students
  const completedLessons = isPerLesson ? getCompletedLessonsCount(student.id) : 0;
  const paidLessons = student.paidLessonsCount || 0;
  const balanceLessons = completedLessons - paidLessons;
  
  // For annual students - Calculate payment status based on payments
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
          {isPerLesson && (
            <Badge variant="secondary" className="text-xs">
              <Coins className="h-3 w-3 mr-1" />
              שיעורים חד-פעמיים
            </Badge>
          )}
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
            
            {isPerLesson ? (
              // Per-lesson payment display - simplified without debt display
              <>
                <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                  <Coins className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="font-medium">מעקב שיעורים</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center p-2 bg-background rounded">
                        <div className="text-2xl font-bold">{completedLessons}</div>
                        <div className="text-xs text-muted-foreground">שיעורים שניתנו</div>
                      </div>
                      <div className="text-center p-2 bg-background rounded">
                        <div className="text-2xl font-bold text-green-600">{paidLessons}</div>
                        <div className="text-xs text-muted-foreground">שולם</div>
                      </div>
                      <div className="text-center p-2 bg-background rounded">
                        <div className={`text-2xl font-bold ${balanceLessons > 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {balanceLessons > 0 ? balanceLessons : '✓'}
                        </div>
                        <div className="text-xs text-muted-foreground">יתרה</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium">מחיר לשיעור</div>
                    <div className="text-muted-foreground">₪{student.lessonPrice || 0}</div>
                  </div>
                </div>
              </>
            ) : (
              // Annual payment display
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
            )}

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
            {isPerLesson && (
              <p>• התשלום מתבצע לפי שיעורים שניתנו (במזומן)</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentDetails;