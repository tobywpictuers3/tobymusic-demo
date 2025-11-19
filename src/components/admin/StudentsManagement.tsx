import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Grid, List, UserPlus, Edit, Trash2, Users, History } from 'lucide-react';
import { getStudents, addStudent, updateStudent, deleteStudent } from '@/lib/storage';
import { Student } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import StudentLessonHistory from './StudentLessonHistory';
import PracticeStats from './PracticeStats';

const StudentsManagement = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDialog, setShowDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Form states
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    personalCode: '',
    startDate: '2025-09-01',
    startingLessonNumber: 1,
    annualAmount: 4800,
    paymentMonths: 12,
    calculatedAmount: undefined as number | undefined,
    calculatedFormula: '',
    notes: '',
    additionalPhones: [] as string[],
    additionalEmails: [] as string[]
  });

  useEffect(() => {
    refreshStudents();
  }, []);

  const refreshStudents = () => {
    setStudents(getStudents());
  };

  const resetForm = () => {
    setStudentForm({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      personalCode: '',
      startDate: '2025-09-01',
      startingLessonNumber: 1,
      annualAmount: 4800,
      paymentMonths: 12,
      calculatedAmount: undefined,
      calculatedFormula: '',
      notes: '',
      additionalPhones: [],
      additionalEmails: []
    });
  };

  const handleOpenDialog = () => {
    setEditingStudent(null);
    resetForm();
    setShowDialog(true);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone,
      email: student.email,
      personalCode: student.personalCode,
      startDate: student.startDate,
      startingLessonNumber: student.startingLessonNumber,
      annualAmount: student.annualAmount,
      paymentMonths: student.paymentMonths,
      calculatedAmount: student.calculatedAmount,
      calculatedFormula: '',
      notes: student.notes || '',
      additionalPhones: student.additionalPhones || [],
      additionalEmails: student.additionalEmails || []
    });
    setShowDialog(true);
  };

  const handleSaveStudent = () => {
    if (!studentForm.firstName || !studentForm.lastName || !studentForm.phone || !studentForm.personalCode) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל השדות הנדרשים (שם, משפחה, טלפון, קוד אישי)',
        variant: 'destructive'
      });
      return;
    }

    if (studentForm.personalCode.length !== 4 || !/^\d{4}$/.test(studentForm.personalCode)) {
      toast({
        title: 'שגיאה',
        description: 'קוד אישי חייב להכיל בדיוק 4 ספרות',
        variant: 'destructive'
      });
      return;
    }

    const effectiveAmount = studentForm.calculatedAmount || studentForm.annualAmount;
    const monthlyAmount = effectiveAmount / studentForm.paymentMonths;
    
    if (editingStudent) {
      updateStudent(editingStudent.id, {
        firstName: studentForm.firstName,
        lastName: studentForm.lastName,
        phone: studentForm.phone,
        email: studentForm.email,
        personalCode: studentForm.personalCode,
        startDate: studentForm.startDate,
        startingLessonNumber: studentForm.startingLessonNumber,
        annualAmount: studentForm.annualAmount,
        paymentMonths: studentForm.paymentMonths,
        calculatedAmount: studentForm.calculatedAmount,
        monthlyAmount,
        notes: studentForm.notes,
        additionalPhones: studentForm.additionalPhones,
        additionalEmails: studentForm.additionalEmails
      });
      toast({
        title: 'הצלחה',
        description: 'פרטי התלמידה עודכנו בהצלחה'
      });
    } else {
      addStudent({
        firstName: studentForm.firstName,
        lastName: studentForm.lastName,
        phone: studentForm.phone,
        email: studentForm.email,
        personalCode: studentForm.personalCode,
        swapCode: Math.floor(1000 + Math.random() * 9000).toString(), // Generate random 4-digit swap code
        startDate: studentForm.startDate,
        startingLessonNumber: studentForm.startingLessonNumber,
        annualAmount: studentForm.annualAmount,
        paymentMonths: studentForm.paymentMonths,
        calculatedAmount: studentForm.calculatedAmount,
        monthlyAmount,
        notes: studentForm.notes,
        additionalPhones: studentForm.additionalPhones,
        additionalEmails: studentForm.additionalEmails
      });
      toast({
        title: 'הצלחה',
        description: 'התלמידה נוספה בהצלחה'
      });
    }

    refreshStudents();
    setShowDialog(false);
    resetForm();
  };

  const handleDeleteStudent = (studentId: string) => {
    if (window.confirm('האם את בטוחה שברצונך למחוק את התלמידה?')) {
      deleteStudent(studentId);
      refreshStudents();
      toast({
        title: 'הצלחה',
        description: 'התלמידה נמחקה בהצלחה'
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="h-6 w-6" />
              ניהול תלמידות ({students.length})
            </CardTitle>
            <div className="flex gap-2">
              <div className="flex border rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handleOpenDialog} className="hero-gradient">
                <UserPlus className="h-4 w-4 mr-2" />
                הוספת תלמידה
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((student) => (
                <Card key={student.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h3 className="font-bold text-lg">
                        {student.firstName} {student.lastName}
                      </h3>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p>🔑 קוד: {student.personalCode}</p>
                        <p>📞 {student.phone}</p>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setHistoryStudent(student);
                            setShowHistoryDialog(true);
                          }}
                        >
                          <History className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditStudent(student)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteStudent(student.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead>משפחה</TableHead>
                    <TableHead>פרטי התקשרות</TableHead>
                    <TableHead>תחילת שנה</TableHead>
                    <TableHead>תשלום חודשי</TableHead>
                    <TableHead>תשלום שנתי</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.firstName}</TableCell>
                      <TableCell>{student.lastName}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>📞 {student.phone}</div>
                          {student.additionalPhones && student.additionalPhones.length > 0 && 
                            student.additionalPhones.map((phone, idx) => (
                              <div key={idx} className="text-xs text-muted-foreground">📞 {phone}</div>
                            ))
                          }
                          {student.email && <div>📧 {student.email}</div>}
                          {student.additionalEmails && student.additionalEmails.length > 0 && 
                            student.additionalEmails.map((email, idx) => (
                              <div key={idx} className="text-xs text-muted-foreground">📧 {email}</div>
                            ))
                          }
                        </div>
                      </TableCell>
                      <TableCell>{new Date(student.startDate).toLocaleDateString('he-IL')}</TableCell>
                      <TableCell>₪{student.monthlyAmount}</TableCell>
                      <TableCell>₪{student.annualAmount}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setHistoryStudent(student);
                              setShowHistoryDialog(true);
                            }}
                          >
                            <History className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditStudent(student)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteStudent(student.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for Add/Edit Student */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'עריכת תלמידה' : 'הוספת תלמידה חדשה'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="firstName">שם פרטי *</Label>
                <Input
                  id="firstName"
                  value={studentForm.firstName}
                  onChange={(e) => setStudentForm({...studentForm, firstName: e.target.value})}
                  placeholder="שם פרטי"
                />
              </div>
              <div>
                <Label htmlFor="lastName">שם משפחה *</Label>
                <Input
                  id="lastName"
                  value={studentForm.lastName}
                  onChange={(e) => setStudentForm({...studentForm, lastName: e.target.value})}
                  placeholder="שם משפחה"
                />
              </div>
              <div>
                <Label htmlFor="personalCode">קוד אישי (4 ספרות) *</Label>
                <Input
                  id="personalCode"
                  value={studentForm.personalCode}
                  onChange={(e) => setStudentForm({...studentForm, personalCode: e.target.value})}
                  placeholder="0000"
                  maxLength={4}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">טלפון *</Label>
                <Input
                  id="phone"
                  value={studentForm.phone}
                  onChange={(e) => setStudentForm({...studentForm, phone: e.target.value})}
                  placeholder="מספר טלפון"
                />
              </div>
              <div>
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({...studentForm, email: e.target.value})}
                  placeholder="כתובת אימייל"
                />
              </div>
            </div>

            {/* Additional Phones */}
            <div className="space-y-2">
              <Label>טלפונים נוספים</Label>
              {studentForm.additionalPhones.map((phone, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => {
                      const updated = [...studentForm.additionalPhones];
                      updated[index] = e.target.value;
                      setStudentForm({...studentForm, additionalPhones: updated});
                    }}
                    placeholder="מספר טלפון נוסף"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const updated = studentForm.additionalPhones.filter((_, i) => i !== index);
                      setStudentForm({...studentForm, additionalPhones: updated});
                    }}
                  >
                    הסר
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStudentForm({
                    ...studentForm,
                    additionalPhones: [...studentForm.additionalPhones, '']
                  });
                }}
              >
                הוסף טלפון נוסף
              </Button>
            </div>

            {/* Additional Emails */}
            <div className="space-y-2">
              <Label>כתובות מייל נוספות</Label>
              {studentForm.additionalEmails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const updated = [...studentForm.additionalEmails];
                      updated[index] = e.target.value;
                      setStudentForm({...studentForm, additionalEmails: updated});
                    }}
                    placeholder="כתובת מייל נוספת"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const updated = studentForm.additionalEmails.filter((_, i) => i !== index);
                      setStudentForm({...studentForm, additionalEmails: updated});
                    }}
                  >
                    הסר
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStudentForm({
                    ...studentForm,
                    additionalEmails: [...studentForm.additionalEmails, '']
                  });
                }}
              >
                הוסף מייל נוסף
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">תאריך התחלה</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={studentForm.startDate}
                  onChange={(e) => setStudentForm({...studentForm, startDate: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="startingLessonNumber">מספר שיעור התחלתי</Label>
                <Input
                  id="startingLessonNumber"
                  type="number"
                  value={studentForm.startingLessonNumber}
                  onChange={(e) => setStudentForm({...studentForm, startingLessonNumber: parseInt(e.target.value) || 1})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="annualAmount">תשלום שנתי</Label>
                <Input
                  id="annualAmount"
                  type="number"
                  value={studentForm.annualAmount}
                  onChange={(e) => setStudentForm({...studentForm, annualAmount: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label htmlFor="paymentMonths">מס' חודשי תשלום</Label>
                <Input
                  id="paymentMonths"
                  type="number"
                  value={studentForm.paymentMonths}
                  onChange={(e) => setStudentForm({...studentForm, paymentMonths: parseInt(e.target.value) || 12})}
                />
              </div>
            </div>

            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <Label htmlFor="calculatedFormula">מחשבון סכום יחסי (הקלד נוסחה המתחילה ב-=)</Label>
              <Input
                id="calculatedFormula"
                value={studentForm.calculatedFormula}
                onChange={(e) => {
                  const formula = e.target.value;
                  setStudentForm({...studentForm, calculatedFormula: formula});
                  
                  if (formula.startsWith('=')) {
                    try {
                      // Remove = and evaluate the expression
                      const expression = formula.slice(1);
                      // Safe evaluation - only allow numbers and basic operators
                      const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
                      const result = eval(sanitized);
                      if (!isNaN(result) && isFinite(result)) {
                        setStudentForm(prev => ({...prev, calculatedFormula: formula, calculatedAmount: Math.round(result)}));
                      }
                    } catch (e) {
                      // Invalid formula, ignore
                    }
                  }
                }}
                placeholder="=4800/40*28"
              />
              <div>
                <Label htmlFor="calculatedAmount">מחיר מחושב (קובע לתשלום)</Label>
                <Input
                  id="calculatedAmount"
                  type="number"
                  value={studentForm.calculatedAmount || ''}
                  onChange={(e) => setStudentForm({...studentForm, calculatedAmount: parseInt(e.target.value) || undefined})}
                  placeholder="הזן סכום או השתמש במחשבון למעלה"
                />
              </div>
            </div>

            <div>
              <Label>תשלום חודשי (מחושב)</Label>
              <div className="p-3 bg-muted rounded-lg font-bold">
                ₪{((studentForm.calculatedAmount || studentForm.annualAmount) / studentForm.paymentMonths).toFixed(1)}
              </div>
            </div>
            
            <div>
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                value={studentForm.notes}
                onChange={(e) => setStudentForm({...studentForm, notes: e.target.value})}
                placeholder="הערות נוספות"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                ביטול
              </Button>
              <Button onClick={handleSaveStudent} className="hero-gradient">
                {editingStudent ? 'עדכן' : 'הוסף'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lesson History Dialog */}
      {historyStudent && (
        <StudentLessonHistory
          student={historyStudent}
          open={showHistoryDialog}
          onOpenChange={setShowHistoryDialog}
        />
      )}
    </div>
  );
};

export default StudentsManagement;
