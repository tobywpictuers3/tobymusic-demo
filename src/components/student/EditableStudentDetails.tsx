import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { User, Phone, Mail, Calendar, CreditCard, Edit, Plus, Trash2 } from 'lucide-react';
import { Student } from '@/lib/types';
import { getPayments, updateStudent } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { clearAppCache } from '@/lib/clearAppCache';

interface EditableStudentDetailsProps {
  student: Student;
  onUpdate: () => void;
}

const EditableStudentDetails = ({ student, onUpdate }: EditableStudentDetailsProps) => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSwapCodeDialog, setShowSwapCodeDialog] = useState(false);
  const [editedEmail, setEditedEmail] = useState(student.email);
  const [editedPhone, setEditedPhone] = useState(student.phone);
  const [editedSwapCode, setEditedSwapCode] = useState(student.swapCode || '');
  const [additionalEmails, setAdditionalEmails] = useState<string[]>(student.additionalEmails || []);
  const [additionalPhones, setAdditionalPhones] = useState<string[]>(student.additionalPhones || []);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

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

  const handleSaveChanges = async () => {
    await clearAppCache();
    updateStudent(student.id, {
      email: editedEmail,
      phone: editedPhone,
      additionalEmails,
      additionalPhones
    });
    
    setShowEditDialog(false);
    onUpdate();
    toast({
      title: 'הפרטים עודכנו',
      description: 'השינויים נשמרו בהצלחה'
    });
  };

  const handleSaveSwapCode = () => {
    if (editedSwapCode.length !== 4 || !/^\d{4}$/.test(editedSwapCode)) {
      toast({
        title: 'שגיאה',
        description: 'קוד החלפה חייב להיות 4 ספרות',
        variant: 'destructive'
      });
      return;
    }

    updateStudent(student.id, {
      swapCode: editedSwapCode
    });
    
    setShowSwapCodeDialog(false);
    onUpdate();
    toast({
      title: 'קוד ההחלפה עודכן',
      description: 'הקוד החדש נשמר בהצלחה'
    });
  };

  const generateRandomSwapCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setEditedSwapCode(code);
  };

  const handleAddEmail = () => {
    if (newEmail.trim() && !additionalEmails.includes(newEmail.trim())) {
      setAdditionalEmails([...additionalEmails, newEmail.trim()]);
      setNewEmail('');
    }
  };

  const handleAddPhone = () => {
    if (newPhone.trim() && !additionalPhones.includes(newPhone.trim())) {
      setAdditionalPhones([...additionalPhones, newPhone.trim()]);
      setNewPhone('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setAdditionalEmails(additionalEmails.filter(e => e !== email));
  };

  const handleRemovePhone = (phone: string) => {
    setAdditionalPhones(additionalPhones.filter(p => p !== phone));
  };

  const paymentStatus = getDetailedPaymentStatus();
  const paymentMethod = payments[0]?.paymentMethod || 'inactive';

  return (
    <>
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl flex items-center gap-2">
              <User className="h-6 w-6" />
              הפרטים שלי
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowEditDialog(true)}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              ערוך פרטים
            </Button>
          </div>
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
                <div className="flex-1">
                  <div className="font-medium">טלפון</div>
                  <div className="text-muted-foreground">{student.phone}</div>
                  {additionalPhones.length > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {additionalPhones.map((phone, idx) => (
                        <div key={idx}>• {phone}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <Mail className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">אימייל</div>
                  <div className="text-muted-foreground break-all">{student.email}</div>
                  {additionalEmails.length > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {additionalEmails.map((email, idx) => (
                        <div key={idx} className="break-all">• {email}</div>
                      ))}
                    </div>
                  )}
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
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">קוד החלפה אישי</h4>
              <Button variant="outline" size="sm" onClick={() => setShowSwapCodeDialog(true)}>
                ערוך קוד
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• קוד נוכחי: <span className="font-mono font-bold">{student.swapCode || 'לא הוגדר'}</span></p>
              <p>• שתפי קוד זה עם חברה כדי לאשר החלפה אוטומטית</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Swap Code Dialog */}
      <Dialog open={showSwapCodeDialog} onOpenChange={setShowSwapCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת קוד החלפה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>קוד החלפה (4 ספרות)</Label>
              <div className="flex gap-2">
                <Input
                  value={editedSwapCode}
                  onChange={(e) => setEditedSwapCode(e.target.value)}
                  maxLength={4}
                  placeholder="0000"
                  className="font-mono text-lg"
                />
                <Button variant="outline" onClick={generateRandomSwapCode}>
                  קוד אקראי
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSwapCodeDialog(false)}>ביטול</Button>
            <Button onClick={handleSaveSwapCode}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>עריכת פרטים אישיים</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Main Email */}
            <div className="space-y-2">
              <Label htmlFor="email">כתובת מייל ראשית</Label>
              <Input
                id="email"
                type="email"
                value={editedEmail}
                onChange={(e) => setEditedEmail(e.target.value)}
              />
            </div>

            {/* Additional Emails */}
            <div className="space-y-2">
              <Label>כתובות מייל נוספות</Label>
              <div className="space-y-2">
                {additionalEmails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={email} disabled className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEmail(email)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="הוסף מייל נוסף"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                  />
                  <Button onClick={handleAddEmail} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Main Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">מספר טלפון ראשי</Label>
              <Input
                id="phone"
                type="tel"
                value={editedPhone}
                onChange={(e) => setEditedPhone(e.target.value)}
              />
            </div>

            {/* Additional Phones */}
            <div className="space-y-2">
              <Label>מספרי טלפון נוספים</Label>
              <div className="space-y-2">
                {additionalPhones.map((phone, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={phone} disabled className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePhone(phone)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="הוסף טלפון נוסף"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPhone()}
                  />
                  <Button onClick={handleAddPhone} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleSaveChanges}>
              שמור שינויים
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditableStudentDetails;
