import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CreditCard, X } from 'lucide-react';
import { getPayments } from '@/lib/storage';
import { Payment } from '@/lib/types';

interface PaymentAlertProps {
  studentId: string;
}

const PaymentAlert = ({ studentId }: PaymentAlertProps) => {
  const [overduePayments, setOverduePayments] = useState<Payment[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const payments = getPayments();
    
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const relevantPayments = payments.filter(payment => {
      if (payment.studentId !== studentId) return false;
      if (payment.status === 'paid') return false;
      
      // Show unpaid or debt payments for current month and previous months
      return payment.month <= currentMonth && (payment.status === 'not_paid' || payment.status === 'debt');
    });
    
    setOverduePayments(relevantPayments);
  }, [studentId]);

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const monthNames = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
  };

  if (!isVisible || overduePayments.length === 0) {
    return null;
  }

  return (
    <Card className="border-destructive bg-destructive/5 mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            התראת תשלום
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            יש לך תשלומים שטרם שולמו:
          </p>
          {overduePayments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-destructive" />
                <div>
                  <div className="font-medium">{formatMonth(payment.month)}</div>
                  <div className="text-sm text-muted-foreground">
                    ₪{payment.amount}
                    {payment.status === 'debt' && <span className="text-destructive font-bold mr-2">(חוב)</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-3">
            אנא פנה למנהלת לקבלת פרטי התשלום
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentAlert;
