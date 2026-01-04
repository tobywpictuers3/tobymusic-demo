import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/safe-ui/card';
import { Button } from '@/components/safe-ui/button';
import { Input } from '@/components/safe-ui/input';
import { Textarea } from '@/components/safe-ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/safe-ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/safe-ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/safe-ui/dialog';
import { Label } from '@/components/safe-ui/label';
import { CreditCard, ChevronRight, ChevronLeft, Download, Coins, Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { getStudents, getPayments, savePayments, updateStudent, getPerformances, getOneTimePayments, saveOneTimePayments, updateOneTimePayment, deleteOneTimePayment, getTithePaid, saveTithePaid, getCompletedLessonsCount, recordPerLessonPayment, getPerLessonPayments, getStudentPerLessonPayments, updatePerLessonPayment, deletePerLessonPayment } from '@/lib/storage';
import { Payment, Student, OneTimePayment, Performance, PerLessonPayment } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/safe-ui/badge';
import { format } from 'date-fns';

const PaymentManagement = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [currentView, setCurrentView] = useState<'annual' | 'monthly'>('annual');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month.toString().padStart(2, '0');
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    return currentMonth >= 9 ? currentYear : currentYear - 1;
  });
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStudent, setFilterStudent] = useState<string>('all');
  const [editingCell, setEditingCell] = useState<{ studentId: string; month: string } | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [oneTimePayments, setOneTimePayments] = useState<OneTimePayment[]>([]);
  const [showOneTimeDialog, setShowOneTimeDialog] = useState(false);
  const [newOneTimePayment, setNewOneTimePayment] = useState({ description: '', amount: '', month: '' });
  const [history, setHistory] = useState<Array<{ payments: Payment[]; oneTimePayments: OneTimePayment[] }>>([]);
  const [tithePaid, setTithePaid] = useState<Record<string, boolean>>(() => getTithePaid());
  const tableRef = useRef<HTMLDivElement>(null);
  const scrollBarRef = useRef<HTMLDivElement>(null);
  const scrollBarInnerRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const handleTitheToggle = async (monthKey: string, isPaid: boolean) => {
    const updated = { ...tithePaid, [monthKey]: isPaid };
    setTithePaid(updated);
    
    const result = await saveTithePaid(updated);
    
    if (result.synced) {
      toast({ 
        description: isPaid ? '✅ מעשר סומן כהופרש ונשמר בדרופבוקס' : '✅ מעשר סומן כלא הופרש ונשמר בדרופבוקס' 
      });
    } else if (result.success) {
      toast({ 
        description: isPaid ? '💾 מעשר סומן כהופרש (יסונכרן בקרוב)' : '💾 מעשר סומן כלא הופרש (יסונכרן בקרוב)' 
      });
    } else {
      toast({ 
        title: 'שגיאה',
        description: 'לא הצלחנו לשמור את השינוי',
        variant: 'destructive'
      });
    }
  };

  const academicMonths = [
    { key: '09', name: 'ספט', fullName: 'ספטמבר' },
    { key: '10', name: 'אוק', fullName: 'אוקטובר' },
    { key: '11', name: 'נוב', fullName: 'נובמבר' },
    { key: '12', name: 'דצמ', fullName: 'דצמבר' },
    { key: '01', name: 'ינו', fullName: 'ינואר' },
    { key: '02', name: 'פבר', fullName: 'פברואר' },
    { key: '03', name: 'מרץ', fullName: 'מרץ' },
    { key: '04', name: 'אפר', fullName: 'אפריל' },
    { key: '05', name: 'מאי', fullName: 'מאי' },
    { key: '06', name: 'יוני', fullName: 'יוני' },
    { key: '07', name: 'יולי', fullName: 'יולי' },
    { key: '08', name: 'אוג', fullName: 'אוגוסט' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  // סרגל גלילה עליון חדש ופשוט: סנכרון 1:1 בין המסילה העליונה לבין הטבלה
  useEffect(() => {
    const table = tableScrollRef.current;
    const bar = scrollBarRef.current;
    const barInner = scrollBarInnerRef.current;
    if (!table || !bar || !barInner) return;

    // כדי למנוע לולאת אירועים דו-כיוונית
    let syncingFromTable = false;
    let syncingFromBar = false;

    const updateSizes = () => {
      // רוחב המסילה העליונה שווה בדיוק לרוחב האזור הגליל של הטבלה
      bar.style.width = `${table.clientWidth}px`;
      // רוחב התוכן במסילה שווה לרוחב התוכן הגליל של הטבלה
      barInner.style.width = `${table.scrollWidth}px`;
    };

    const onTableScroll = () => {
      if (syncingFromBar) return;
      syncingFromTable = true;
      bar.scrollLeft = table.scrollLeft;
      syncingFromTable = false;
    };

    const onBarScroll = () => {
      if (syncingFromTable) return;
      syncingFromBar = true;
      table.scrollLeft = bar.scrollLeft;
      syncingFromBar = false;
    };

    // האזנות
    table.addEventListener('scroll', onTableScroll);
    bar.addEventListener('scroll', onBarScroll);

    // התאמת גדלים ראשונית + על שינוי גודל/פריסה
    const ro = new ResizeObserver(updateSizes);
    ro.observe(table);
    window.addEventListener('resize', updateSizes);

    // קריאה ראשונה
    updateSizes();

    return () => {
      table.removeEventListener('scroll', onTableScroll);
      bar.removeEventListener('scroll', onBarScroll);
      ro.disconnect();
      window.removeEventListener('resize', updateSizes);
    };
  }, []);

  const loadData = () => {
    setStudents(getStudents());
    setPayments(getPayments());
    setOneTimePayments(getOneTimePayments());
  };

  const handleDownloadJSON = () => {
    const data = {
      students,
      payments,
      oneTimePayments,
      exportDate: new Date().toISOString()
    };
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payments_students_${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
    toast({ description: 'הקובץ הורד בהצלחה' });
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

  const getMonthKey = (monthNum: string, year: number) => {
    return `${year}-${monthNum.padStart(2, '0')}`;
  };

  const getPaymentForMonth = (studentId: string, monthNum: string): Payment | null => {
    const year = parseInt(monthNum) >= 9 ? selectedYear : selectedYear + 1;
    const monthKey = getMonthKey(monthNum, year);
    
    return payments.find(p => p.studentId === studentId && p.month === monthKey) || null;
  };

  const handlePaymentMethodChange = (studentId: string, newMethod: 'bank' | 'check' | 'cash' | 'inactive') => {
    const updatedPayments = [...payments];
    const student = students.find(s => s.id === studentId);
    
    // Update student's payment records with the new payment method
    const studentPayments = updatedPayments.filter(p => p.studentId === studentId);
    studentPayments.forEach(p => p.paymentMethod = newMethod);
    
    // Calculate monthly amount based on calculatedAmount if exists, otherwise annualAmount
    const effectiveAmount = student?.calculatedAmount || student?.annualAmount || 0;
    const monthlyAmount = effectiveAmount / (student?.paymentMonths || 12);
    
    // Apply specific logic based on payment method
    academicMonths.forEach((month, index) => {
      const year = parseInt(month.key) >= 9 ? selectedYear : selectedYear + 1;
      const monthKey = getMonthKey(month.key, year);
      
      const existingPaymentIndex = updatedPayments.findIndex(
        p => p.studentId === studentId && p.month === monthKey
      );
      
      let status: Payment['status'] = 'not_paid';
      let amount = 0;
      
      if (newMethod === 'bank') {
        status = 'pending';
      } else if (newMethod === 'check') {
        status = 'paid';
        amount = monthlyAmount;
      } else if (newMethod === 'cash' && index === 0) {
        status = 'paid';
        amount = monthlyAmount;
      }
      
      if (existingPaymentIndex >= 0) {
        updatedPayments[existingPaymentIndex] = {
          ...updatedPayments[existingPaymentIndex],
          status,
          amount,
          paymentMethod: newMethod
        };
      } else {
        updatedPayments.push({
          id: `${studentId}-${monthKey}`,
          studentId,
          month: monthKey,
          amount,
          status,
          paymentMethod: newMethod
        });
      }
    });
    
    savePayments(updatedPayments);
    loadData();
    toast({ description: 'צורת התשלום עודכנה בהצלחה' });
  };

  const handleCellClick = (studentId: string, monthNum: string, currentStatus: Payment['status'], paymentMethod: 'bank' | 'check' | 'cash' | 'inactive') => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    const year = parseInt(monthNum) >= 9 ? selectedYear : selectedYear + 1;
    const monthKey = getMonthKey(monthNum, year);
    
    // לחיצה על "ממתין" - מזין ישירות את הסכום החודשי
    if (currentStatus === 'pending') {
      const updatedPayments = [...payments];
      const paymentIndex = updatedPayments.findIndex(
        p => p.studentId === studentId && p.month === monthKey
      );
      
      // Use calculatedAmount if exists, otherwise use monthlyAmount
      const amount = student.monthlyAmount || 0;
      
      if (paymentIndex >= 0) {
        updatedPayments[paymentIndex] = {
          ...updatedPayments[paymentIndex],
          amount,
          status: 'paid',
          paidDate: new Date().toISOString().split('T')[0]
        };
      } else {
        updatedPayments.push({
          id: `${studentId}-${monthKey}`,
          studentId,
          month: monthKey,
          amount,
          status: 'paid',
          paymentMethod,
          paidDate: new Date().toISOString().split('T')[0]
        });
      }
      
      savePayments(updatedPayments);
      loadData();
      toast({ description: 'התשלום עודכן' });
    } else {
      // פתיחת עריכה לכל מצב אחר
      setEditingCell({ studentId, month: monthKey });
      const payment = getPaymentForMonth(studentId, monthNum);
      setEditAmount(payment?.amount.toString() || '0');
    }
  };

  const handleSaveEdit = () => {
    if (!editingCell) return;
    
    const student = students.find(s => s.id === editingCell.studentId);
    if (!student) return;
    
    const updatedPayments = [...payments];
    const paymentIndex = updatedPayments.findIndex(
      p => p.studentId === editingCell.studentId && p.month === editingCell.month
    );
    
    const amount = parseFloat(editAmount) || 0;
    let status: Payment['status'] = 'not_paid';
    
    if (editAmount.trim() === '#') {
      status = 'debt';
    } else if (editAmount.trim() === '0.0' || editAmount.trim() === '') {
      status = 'not_paid';
    } else if (amount === 0 && editAmount.trim() === '0') {
      // הזנת 0 - נשאר במצב paid עם סכום 0
      status = 'paid';
    } else if (amount > 0) {
      status = 'paid';
    }
    
    const paymentMethod = payments.find(p => p.studentId === editingCell.studentId)?.paymentMethod || 'cash';
    
    if (paymentIndex >= 0) {
      updatedPayments[paymentIndex] = {
        ...updatedPayments[paymentIndex],
        amount: editAmount.trim() === '#' ? 0 : amount,
        status,
        paidDate: status === 'paid' ? new Date().toISOString().split('T')[0] : undefined
      };
    } else {
      updatedPayments.push({
        id: `${editingCell.studentId}-${editingCell.month}`,
        studentId: editingCell.studentId,
        month: editingCell.month,
        amount: editAmount.trim() === '#' ? 0 : amount,
        status,
        paymentMethod
      });
    }
    
    savePayments(updatedPayments);
    loadData();
    setEditingCell(null);
    toast({ description: 'התשלום עודכן' });
  };

  const getCellDisplay = (student: Student, monthNum: string, paymentMethod: 'bank' | 'check' | 'cash' | 'inactive') => {
    const payment = getPaymentForMonth(student.id, monthNum);
    
    if (paymentMethod === 'inactive') {
      return { text: 'לא פעיל', className: 'text-gray-900 bg-gray-100', clickable: false };
    }
    
    if (!payment || payment.status === 'not_paid') {
      return { text: 'לא שולם', className: 'text-gray-500 bg-gray-50 cursor-pointer hover:bg-gray-100', clickable: true };
    }
    
    if (payment.status === 'debt') {
      return { text: '💥 חוב 💥', className: 'text-red-700 bg-red-200 font-bold text-lg cursor-pointer hover:bg-red-300 border-2 border-red-700', clickable: true };
    }
    
    if (payment.status === 'pending') {
      return { text: 'ממתין', className: 'text-yellow-700 bg-yellow-100 cursor-pointer hover:bg-yellow-200', clickable: true };
    }
    
    if (payment.status === 'paid') {
      // אם הסכום הוא בדיוק 0
      if (payment.amount === 0) {
        return { text: '₪0', className: 'text-yellow-700 bg-yellow-100 font-semibold cursor-pointer hover:bg-yellow-200', clickable: true };
      }
      
      // Round to 1 decimal place and remove trailing zeros
      const roundedAmount = parseFloat(payment.amount.toFixed(1));
      const isPerfectMatch = payment.amount === (student.monthlyAmount || 0);
      if (isPerfectMatch) {
        return { text: `₪${roundedAmount}`, className: 'text-yellow-700 bg-yellow-100 font-semibold cursor-pointer hover:bg-yellow-200', clickable: true };
      } else {
        return { text: `₪${roundedAmount}`, className: 'text-yellow-700 bg-yellow-100 font-semibold border-2 border-[#8B2942] cursor-pointer hover:bg-yellow-200', clickable: true };
      }
    }
    
    return { text: '-', className: 'text-gray-400', clickable: false };
  };

  const calculateTotalPaid = (studentId: string) => {
    let total = 0;
    
    academicMonths.forEach(month => {
      const year = parseInt(month.key) >= 9 ? selectedYear : selectedYear + 1;
      const monthKey = getMonthKey(month.key, year);
      const payment = payments.find(p => p.studentId === studentId && p.month === monthKey);
      
      if (payment && payment.status === 'paid') {
        total += payment.amount;
      }
    });
    
    return total;
  };

  const calculateMonthlyTotal = (monthNum: string) => {
    const year = parseInt(monthNum) >= 9 ? selectedYear : selectedYear + 1;
    const monthKey = getMonthKey(monthNum, year);
    
    let total = 0;
    
    // תשלומי תלמידות רגילות
    payments.forEach(payment => {
      if (payment.month === monthKey && payment.status === 'paid') {
        total += payment.amount;
      }
    });
    
    // תשלומים חד פעמיים
    oneTimePayments
      .filter(otp => otp.month === monthKey)
      .forEach(otp => {
        total += otp.amount;
      });

    // הופעות ששולמו בחודש זה
    const performances = getPerformances();
    performances.forEach(perf => {
      if (perf.paidDate && perf.paidDate.startsWith(monthKey) && perf.amount) {
        total += perf.amount + (perf.travel || 0);
      }
    });
    
    // תשלומים עבור שיעורים חד-פעמיים
    const perLessonPayments = getPerLessonPayments();
    perLessonPayments
      .filter(p => p.month === monthKey)
      .forEach(p => {
        total += p.amount;
      });
    
    return total;
  };

  const calculatePerformancesForMonth = (monthNum: string) => {
    const year = parseInt(monthNum) >= 9 ? selectedYear : selectedYear + 1;
    const monthKey = getMonthKey(monthNum, year);
    
    const performances = getPerformances();
    return performances
      .filter(perf => perf.paidDate && perf.paidDate.startsWith(monthKey))
      .reduce((sum, perf) => sum + (perf.amount || 0) + (perf.travel || 0), 0);
  };

  const calculatePerformancesOnlyForMonth = (monthNum: string) => {
    const year = parseInt(monthNum) >= 9 ? selectedYear : selectedYear + 1;
    const monthKey = getMonthKey(monthNum, year);
    
    const performances = getPerformances();
    return performances
      .filter(perf => perf.paidDate && perf.paidDate.startsWith(monthKey))
      .reduce((sum, perf) => sum + (perf.amount || 0), 0);
  };

  const calculateOneTimePaymentsForMonth = (monthNum: string) => {
    const year = parseInt(monthNum) >= 9 ? selectedYear : selectedYear + 1;
    const monthKey = getMonthKey(monthNum, year);
    
    return oneTimePayments
      .filter(otp => otp.month === monthKey)
      .reduce((sum, otp) => sum + otp.amount, 0);
  };

  const handleAddOneTimePayment = () => {
    if (!newOneTimePayment.description.trim() || !newOneTimePayment.amount || !newOneTimePayment.month) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא את כל השדות',
        variant: 'destructive'
      });
      return;
    }
    const payment: OneTimePayment = {
      id: Date.now().toString(),
      month: newOneTimePayment.month,
      amount: parseFloat(newOneTimePayment.amount),
      description: newOneTimePayment.description,
      paidDate: new Date().toISOString()
    };
    const updatedPayments = [...oneTimePayments, payment];
    saveOneTimePayments(updatedPayments);
    setOneTimePayments(updatedPayments);
    setShowOneTimeDialog(false);
    setNewOneTimePayment({ description: '', amount: '', month: '' });
    toast({
      title: 'הצלחה',
      description: 'תשלום חד פעמי נוסף בהצלחה'
    });
  };

  // Filter annual students (paymentType is 'annual' or undefined)
  const annualStudents = students.filter(s => !s.paymentType || s.paymentType === 'annual');
  
  // Filter per-lesson students
  const perLessonStudents = students.filter(s => s.paymentType === 'per_lesson');

  const filteredStudents = annualStudents.filter(s => {
    // Payment method filtering
    if (filterMethod !== 'all') {
      const studentPaymentMethod = payments.find(p => p.studentId === s.id)?.paymentMethod;
      if (studentPaymentMethod !== filterMethod) return false;
    }
    
    // Payment status filtering
    if (filterStatus !== 'all') {
      const hasStatus = academicMonths.some(month => {
        const payment = getPaymentForMonth(s.id, month.key);
        return payment?.status === filterStatus;
      });
      if (!hasStatus) return false;
    }
    return true;
  });

  // Per-lesson payment dialog state
  const [showPerLessonPaymentDialog, setShowPerLessonPaymentDialog] = useState(false);
  const [selectedPerLessonStudent, setSelectedPerLessonStudent] = useState<Student | null>(null);
  const [perLessonPaymentAmount, setPerLessonPaymentAmount] = useState('');
  const [perLessonPaymentDate, setPerLessonPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [perLessonPaymentNotes, setPerLessonPaymentNotes] = useState('');

  // One-time payment edit state
  const [editingOneTimePayment, setEditingOneTimePayment] = useState<OneTimePayment | null>(null);
  const [showEditOneTimeDialog, setShowEditOneTimeDialog] = useState(false);

  // Per-lesson payment edit/view state
  const [editingPerLessonPayment, setEditingPerLessonPayment] = useState<PerLessonPayment | null>(null);
  const [showEditPerLessonDialog, setShowEditPerLessonDialog] = useState(false);
  const [showPerLessonHistoryDialog, setShowPerLessonHistoryDialog] = useState(false);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);

  const handleRecordPerLessonPayment = () => {
    if (!selectedPerLessonStudent) return;
    
    const amount = parseFloat(perLessonPaymentAmount) || 0;
    if (amount <= 0) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין סכום תשלום',
        variant: 'destructive'
      });
      return;
    }
    
    const result = recordPerLessonPayment(
      selectedPerLessonStudent.id,
      amount,
      perLessonPaymentDate,
      perLessonPaymentNotes || undefined
    );
    
    if (!result) {
      toast({
        title: 'שגיאה',
        description: 'שגיאה ברישום התשלום',
        variant: 'destructive'
      });
      return;
    }
    
    loadData();
    setShowPerLessonPaymentDialog(false);
    setSelectedPerLessonStudent(null);
    setPerLessonPaymentAmount('');
    setPerLessonPaymentDate(new Date().toISOString().split('T')[0]);
    setPerLessonPaymentNotes('');
    
    toast({
      title: 'הצלחה',
      description: `נרשם תשלום ₪${amount} (${result.lessonsCovered} שיעורים, יתרה: ₪${result.newBalance})`
    });
  };

  const handleEditOneTimePayment = () => {
    if (!editingOneTimePayment) return;
    
    updateOneTimePayment(editingOneTimePayment.id, {
      description: editingOneTimePayment.description,
      amount: editingOneTimePayment.amount,
      paidDate: editingOneTimePayment.paidDate,
    });
    
    loadData();
    setShowEditOneTimeDialog(false);
    setEditingOneTimePayment(null);
    toast({ description: 'התשלום עודכן בהצלחה' });
  };

  const handleDeleteOneTimePayment = async (id: string) => {
    await deleteOneTimePayment(id);
    loadData();
    toast({ description: 'התשלום נמחק' });
  };

  const handleEditPerLessonPayment = () => {
    if (!editingPerLessonPayment) return;
    
    updatePerLessonPayment(editingPerLessonPayment.id, {
      amount: editingPerLessonPayment.amount,
      paymentDate: editingPerLessonPayment.paymentDate,
      notes: editingPerLessonPayment.notes,
    });
    
    loadData();
    setShowEditPerLessonDialog(false);
    setEditingPerLessonPayment(null);
    toast({ description: 'התשלום עודכן בהצלחה' });
  };

  const handleDeletePerLessonPayment = async (id: string) => {
    await deletePerLessonPayment(id);
    loadData();
    toast({ description: 'התשלום נמחק' });
  };

  // Calculate per-lesson payments for a month
  const calculatePerLessonPaymentsForMonth = (monthNum: string) => {
    const year = parseInt(monthNum) >= 9 ? selectedYear : selectedYear + 1;
    const monthKey = `${year}-${monthNum.padStart(2, '0')}`;
    
    const perLessonPayments = getPerLessonPayments();
    return perLessonPayments.filter(p => p.month === monthKey);
  };

  const calculatePerLessonTotalForMonth = (monthNum: string) => {
    const payments = calculatePerLessonPaymentsForMonth(monthNum);
    return payments.reduce((sum, p) => sum + p.amount, 0);
  };

  return (
    <div className="space-y-6">
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl flex items-center gap-2">
              <CreditCard className="h-6 w-4" />
              ניהול תשלומים - תלמידות
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={handleDownloadJSON} variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                שמור JSON
              </Button>
              <Select value={currentView} onValueChange={(value: 'annual' | 'monthly') => setCurrentView(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">תצוגה שנתית</SelectItem>
                  <SelectItem value="monthly">תצוגה חודשית</SelectItem>
                </SelectContent>
              </Select>
              {currentView === 'monthly' && (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="בחר חודש" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicMonths.map(month => (
                      <SelectItem key={month.key} value={month.key}>{month.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          
          {/* פילטרים */}
          <div className="flex gap-4 mt-4">
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="צורת תשלום" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="bank">בנק</SelectItem>
                <SelectItem value="check">צ'ק</SelectItem>
                <SelectItem value="cash">מזומן</SelectItem>
                <SelectItem value="inactive">לא פעיל</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="paid">שולם</SelectItem>
                <SelectItem value="pending">ממתין</SelectItem>
                <SelectItem value="not_paid">לא שולם</SelectItem>
                <SelectItem value="debt">חוב</SelectItem>
                <SelectItem value="inactive">לא פעיל</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={() => setShowOneTimeDialog(true)} variant="outline">
              + תשלום חד פעמי
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {currentView === 'annual' ? (
            <div className="space-y-2">
              {/* חיצי גלילה */}
              <div className="flex justify-end gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    if (tableScrollRef.current) {
                      tableScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                    }
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    if (tableScrollRef.current) {
                      tableScrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
                    }
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              
              {/* סמן גלילה עליון */}
              <div className="relative mb-2">
                <div 
                  ref={scrollBarRef}
                  className="overflow-x-auto overflow-y-hidden border border-gray-300 rounded"
                  style={{ height: '20px' }}
                  aria-label="גלילה אופקית לטבלת התשלומים"
                >
                  <div ref={scrollBarInnerRef} style={{ width: '1px', height: '1px' }} aria-hidden="true"></div>
                </div>
              </div>
              
              {/* שורת כותרת קבועה מעל אזור הגלילה */}
              <div className="overflow-hidden border-b-2 border-accent" dir="rtl">
                <div 
                  className="overflow-x-scroll overflow-y-hidden"
                  ref={(el) => {
                    if (el && tableScrollRef.current) {
                      const syncHeaderScroll = () => {
                        if (tableScrollRef.current) {
                          el.scrollLeft = tableScrollRef.current.scrollLeft;
                        }
                      };
                      tableScrollRef.current.addEventListener('scroll', syncHeaderScroll);
                    }
                  }}
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-[hsl(45,95%,55%)] via-[hsl(0,65%,35%)] to-[hsl(45,95%,55%)]">
                      <TableHead className="sticky right-0 bg-gradient-to-r from-[hsl(45,95%,55%)] to-[hsl(0,65%,35%)] z-30 min-w-[85px] w-[85px] max-w-[85px] border-l-2 border-accent shadow-md font-bold text-foreground px-2 text-right">תלמידה</TableHead>
                      <TableHead className="sticky right-[85px] bg-gradient-to-r from-[hsl(0,65%,35%)] to-[hsl(45,95%,55%)] z-20 min-w-[60px] w-[60px] max-w-[60px] font-bold text-foreground px-1 text-right">תשלום</TableHead>
                    {academicMonths.map(month => (
                      <TableHead key={month.key} className="text-center min-w-[45px] w-[45px] max-w-[45px] font-bold text-foreground px-0.5">
                        {month.name}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-[50px] w-[50px] max-w-[50px] font-bold text-foreground px-1 text-right">סה"כ</TableHead>
                    <TableHead className="min-w-[50px] w-[50px] max-w-[50px] font-bold text-foreground px-1 text-right">שנתי</TableHead>
                    <TableHead className="min-w-[70px] w-[70px] max-w-[70px] font-bold text-foreground px-1 text-right">הערות</TableHead>
                      </TableRow>
                    </TableHeader>
                  </Table>
                </div>
              </div>
              
              <div ref={tableScrollRef} id="payment-table-scroll" className="overflow-x-auto max-h-[600px] overflow-y-auto" dir="rtl">
                <Table>
                  <TableHeader className="sticky top-0 z-20">
                    <TableRow className="bg-gradient-to-r from-[hsl(45,95%,55%)] via-[hsl(0,65%,35%)] to-[hsl(45,95%,55%)]">
                    <TableHead className="sticky right-0 bg-gradient-to-r from-[hsl(45,95%,55%)] to-[hsl(0,65%,35%)] z-30 min-w-[85px] w-[85px] max-w-[85px] border-l-2 border-accent shadow-md font-bold text-foreground px-2 text-right">תלמידה</TableHead>
                    <TableHead className="sticky right-[85px] bg-gradient-to-r from-[hsl(0,65%,35%)] to-[hsl(45,95%,55%)] z-20 min-w-[60px] w-[60px] max-w-[60px] font-bold text-foreground px-1 text-right">תשלום</TableHead>
                    {academicMonths.map(month => (
                      <TableHead key={month.key} className="text-center min-w-[45px] w-[45px] max-w-[45px] font-bold text-foreground px-0.5">
                        {month.name}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-[50px] w-[50px] max-w-[50px] font-bold text-foreground px-1 text-right">סה"כ</TableHead>
                    <TableHead className="min-w-[50px] w-[50px] max-w-[50px] font-bold text-foreground px-1 text-right">שנתי</TableHead>
                    <TableHead className="min-w-[70px] w-[70px] max-w-[70px] font-bold text-foreground px-1 text-right">הערות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map(student => {
                    const totalPaid = calculateTotalPaid(student.id);
                    // Use calculatedAmount if exists, otherwise use annualAmount
                    const annualTarget = student.calculatedAmount || student.annualAmount || (student.monthlyAmount * student.paymentMonths);
                    // Round to 1 decimal for comparison to avoid floating point issues
                    const isFullyPaid = Math.abs(parseFloat(totalPaid.toFixed(1)) - parseFloat(annualTarget.toFixed(1))) < 0.01 && totalPaid > 0;
                    const method = payments.find(p => p.studentId === student.id)?.paymentMethod || 'inactive';
                    const isPaidByBank = method === 'bank' && totalPaid > 0;
                    
                    return (
                    <TableRow key={student.id}>
                      <TableCell className={`sticky right-0 bg-foreground z-10 font-bold border-l-2 border-accent shadow-sm text-xs min-w-[85px] w-[85px] max-w-[85px]`}>
                        <span className={isFullyPaid ? 'text-[hsl(0,65%,35%)]' : isPaidByBank ? 'text-[hsl(0,65%,35%)]' : 'text-secondary'}>
                          {student.firstName} {student.lastName}
                          {isFullyPaid && ' ✓'}
                        </span>
                      </TableCell>
                      <TableCell className="sticky right-[85px] bg-background z-10 min-w-[60px] w-[60px] max-w-[60px]">
                        <Select
                          value={payments.find(p => p.studentId === student.id)?.paymentMethod || 'cash'}
                          onValueChange={(value: 'bank' | 'check' | 'cash' | 'inactive') => 
                            handlePaymentMethodChange(student.id, value)
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">מזומן</SelectItem>
                            <SelectItem value="bank">בנק</SelectItem>
                            <SelectItem value="check">צ'ק</SelectItem>
                            <SelectItem value="inactive">לא פעיל</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                       {academicMonths.map(month => {
                         const paymentMethod = payments.find(p => p.studentId === student.id)?.paymentMethod || 'inactive';
                         const display = getCellDisplay(student, month.key, paymentMethod);
                         const year = parseInt(month.key) >= 9 ? selectedYear : selectedYear + 1;
                         const isEditing = editingCell?.studentId === student.id && 
                           editingCell?.month === getMonthKey(month.key, year);
                        
                        return (
                          <TableCell 
                            key={month.key} 
                            className="text-center p-1 min-w-[45px] w-[45px] max-w-[45px]"
                          >
                            {isEditing ? (
                              <div className="flex gap-1">
                                <Input
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                  className="w-14 h-7 text-xs p-1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit();
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                />
                                <Button size="sm" onClick={handleSaveEdit} className="h-7 px-1 text-xs">✓</Button>
                              </div>
                            ) : (
                              <div
                                className={`py-0.5 px-1 rounded text-xs ${display.className}`}
                                onClick={() => {
                                  if (display.clickable) {
                                    const payment = getPaymentForMonth(student.id, month.key);
                                    handleCellClick(student.id, month.key, payment?.status || 'not_paid', paymentMethod);
                                  }
                                }}
                              >
                                {display.text}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="font-semibold text-xs min-w-[50px] w-[50px] max-w-[50px]">
                        ₪{parseFloat(totalPaid.toFixed(1))}
                      </TableCell>
                      <TableCell className="text-xs min-w-[50px] w-[50px] max-w-[50px]">
                        ₪{parseFloat((student.calculatedAmount || student.annualAmount || (student.monthlyAmount * student.paymentMonths)).toFixed(1))}
                      </TableCell>
                      <TableCell className="min-w-[70px] w-[70px] max-w-[70px]">
                        <Textarea
                          value={student.notes || ''}
                          onChange={(e) => updateStudent(student.id, { notes: e.target.value })}
                          className="min-h-[50px] text-xs p-1"
                          placeholder="הערות..."
                        />
                      </TableCell>
                    </TableRow>
                  );
                  })}
                  
                  {/* שורת תשלומים נוספים (אחר) */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="sticky right-0 bg-muted/30 z-10 font-bold border-l-2 border-border text-foreground text-xs min-w-[85px] w-[85px] max-w-[85px]">
                      אחר
                    </TableCell>
                    <TableCell className="sticky right-[85px] bg-muted/30 z-10 min-w-[60px] w-[60px] max-w-[60px]">-</TableCell>
                    {academicMonths.map(month => (
                      <TableCell key={month.key} className="text-center font-semibold text-foreground min-w-[45px] w-[45px] max-w-[45px]">
                        {calculateOneTimePaymentsForMonth(month.key) > 0 
                          ? `₪${parseFloat(calculateOneTimePaymentsForMonth(month.key).toFixed(1))}` 
                          : '-'}
                      </TableCell>
                    ))}
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                  
                  {/* שורת הופעות */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="sticky right-0 bg-muted/30 z-10 font-bold border-l-2 border-border text-foreground text-xs min-w-[85px] w-[85px] max-w-[85px]">
                      הופעות (ללא נסיעות)
                    </TableCell>
                    <TableCell className="sticky right-[85px] bg-muted/30 z-10 min-w-[60px] w-[60px] max-w-[60px]">-</TableCell>
                    {academicMonths.map(month => (
                      <TableCell key={month.key} className="text-center font-semibold text-foreground min-w-[45px] w-[45px] max-w-[45px]">
                        {calculatePerformancesOnlyForMonth(month.key) > 0 
                          ? `₪${parseFloat(calculatePerformancesOnlyForMonth(month.key).toFixed(1))}` 
                          : '-'}
                      </TableCell>
                    ))}
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                  
                  {/* שורת שיעורים חד-פעמיים */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="sticky right-0 bg-muted/30 z-10 font-bold border-l-2 border-border text-foreground text-xs min-w-[85px] w-[85px] max-w-[85px]">
                      שיעורים חד-פעמיים
                    </TableCell>
                    <TableCell className="sticky right-[85px] bg-muted/30 z-10 min-w-[60px] w-[60px] max-w-[60px]">-</TableCell>
                    {academicMonths.map(month => (
                      <TableCell key={month.key} className="text-center font-semibold text-foreground min-w-[45px] w-[45px] max-w-[45px]">
                        {calculatePerLessonTotalForMonth(month.key) > 0 
                          ? `₪${calculatePerLessonTotalForMonth(month.key)}` 
                          : '-'}
                      </TableCell>
                    ))}
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                  
                  {/* שורת סיכום */}
                  <TableRow className="bg-primary/20 font-bold">
                    <TableCell className="sticky right-0 bg-primary/20 z-10 border-l-2 border-accent font-bold text-primary text-xs min-w-[85px] w-[85px] max-w-[85px]">
                      סה"כ חודשי
                    </TableCell>
                    <TableCell className="sticky right-[85px] bg-primary/20 z-10 min-w-[60px] w-[60px] max-w-[60px]">-</TableCell>
                    {academicMonths.map(month => (
                      <TableCell key={month.key} className="text-center text-primary font-bold min-w-[45px] w-[45px] max-w-[45px]">
                        ₪{parseFloat(calculateMonthlyTotal(month.key).toFixed(1))}
                      </TableCell>
                    ))}
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">
                תצוגה חודשית - {academicMonths.find(m => m.key === selectedMonth)?.fullName || 'בחר חודש'}
              </h3>
              {selectedMonth && (
                  <div className="space-y-4">
                    {/* טבלת תלמידות */}
                    <Card>
                      <CardContent className="pt-6 overflow-x-auto" dir="rtl">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right text-foreground">שם תלמידה</TableHead>
                              <TableHead className="text-right text-foreground">אמצעי תשלום</TableHead>
                              <TableHead className="text-right text-foreground">סכום חודשי</TableHead>
                              <TableHead className="text-right text-foreground">סטטוס תשלום</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredStudents.map(student => {
                              const payment = getPaymentForMonth(student.id, selectedMonth);
                              const method = payments.find(p => p.studentId === student.id)?.paymentMethod || 'inactive';
                              const display = getCellDisplay(student, selectedMonth, method);
                              
                              const totalPaid = calculateTotalPaid(student.id);
                              const annualTarget = student.calculatedAmount || student.annualAmount || (student.monthlyAmount * student.paymentMonths);
                              // Round to 1 decimal for comparison to avoid floating point issues
                              const isFullyPaid = Math.abs(parseFloat(totalPaid.toFixed(1)) - parseFloat(annualTarget.toFixed(1))) < 0.01 && totalPaid > 0;
                              const isPaidByBank = method === 'bank' && totalPaid > 0;
                              
                              return (
                                <TableRow key={student.id}>
                                  <TableCell className="font-semibold text-foreground">
                                    <span className={isFullyPaid ? 'text-[hsl(0,65%,35%)] font-bold' : isPaidByBank ? 'text-[hsl(0,65%,35%)] font-bold' : ''}>
                                      {student.firstName} {student.lastName}
                                      {isFullyPaid && ' ✓'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-foreground">
                                    {getPaymentMethodLabel(method)}
                                  </TableCell>
                                  <TableCell className="text-foreground">
                                    ₪{parseFloat((student.monthlyAmount || 0).toFixed(1))}
                                  </TableCell>
                                  <TableCell>
                                    <div className={`inline-block py-1 px-3 rounded ${display.className}`}>
                                      {display.text}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  
                  {/* פירוט תשלומים חד פעמיים - עם אפשרות עריכה */}
                  {calculateOneTimePaymentsForMonth(selectedMonth) > 0 && (
                    <Card className="bg-[hsl(0,65%,35%)] border-[hsl(0,65%,35%)]">
                      <CardContent className="pt-6">
                        <h4 className="font-bold mb-2 text-[hsl(45,95%,55%)]">תשלומים נוספים (אחר)</h4>
                        <div className="space-y-2">
                          {oneTimePayments
                            .filter(otp => {
                              const year = parseInt(selectedMonth) >= 9 ? selectedYear : selectedYear + 1;
                              const monthKey = getMonthKey(selectedMonth, year);
                              return otp.month === monthKey;
                            })
                            .map(otp => (
                              <div key={otp.id} className="flex justify-between items-center text-sm group">
                                <div className="flex items-center gap-2">
                                  <span className="text-[hsl(45,95%,55%)]">{otp.description}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      setEditingOneTimePayment(otp);
                                      setShowEditOneTimeDialog(true);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3 text-[hsl(45,95%,55%)]" />
                                  </Button>
                                </div>
                                <span className="font-semibold text-[hsl(45,95%,55%)]">₪{parseFloat(otp.amount.toFixed(1))}</span>
                              </div>
                            ))
                          }
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[hsl(45,95%,55%)]/50">
                          <span className="font-bold text-[hsl(45,95%,55%)]">סה"כ</span>
                          <span className="font-bold text-[hsl(45,95%,55%)]">
                            ₪{parseFloat(calculateOneTimePaymentsForMonth(selectedMonth).toFixed(1))}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* פירוט הכנסות משיעורים חד-פעמיים */}
                  {calculatePerLessonTotalForMonth(selectedMonth) > 0 && (
                    <Card className="bg-[hsl(0,65%,35%)] border-[hsl(0,65%,35%)]">
                      <CardContent className="pt-6">
                        <h4 className="font-bold mb-2 text-[hsl(45,95%,55%)] flex items-center gap-2">
                          <Coins className="h-4 w-4" />
                          הכנסות משיעורים חד-פעמיים
                        </h4>
                        <div className="space-y-2">
                          {calculatePerLessonPaymentsForMonth(selectedMonth).map(plp => {
                            const student = students.find(s => s.id === plp.studentId);
                            return (
                              <div key={plp.id} className="flex justify-between items-center text-sm group">
                                <div className="flex items-center gap-2">
                                  <span className="text-[hsl(45,95%,55%)]">
                                    {student ? `${student.firstName} ${student.lastName}` : 'תלמידה'}
                                  </span>
                                  <span className="text-[hsl(45,95%,55%)]/70 text-xs">
                                    ({plp.paymentDate?.split('-').reverse().join('/')})
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      setEditingPerLessonPayment(plp);
                                      setShowEditPerLessonDialog(true);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3 text-[hsl(45,95%,55%)]" />
                                  </Button>
                                </div>
                                <span className="font-semibold text-[hsl(45,95%,55%)]">₪{plp.amount}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[hsl(45,95%,55%)]/50">
                          <span className="font-bold text-[hsl(45,95%,55%)]">סה"כ</span>
                          <span className="font-bold text-[hsl(45,95%,55%)]">
                            ₪{calculatePerLessonTotalForMonth(selectedMonth)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* פירוט הופעות */}
                  {calculatePerformancesForMonth(selectedMonth) > 0 && (
                    <Card className="bg-[hsl(0,65%,35%)] border-[hsl(0,65%,35%)]">
                      <CardContent className="pt-6">
                        <h4 className="font-bold mb-2 text-[hsl(45,95%,55%)]">הופעות</h4>
                        <div className="space-y-2">
                          {getPerformances()
                            .filter(perf => {
                              const year = parseInt(selectedMonth) >= 9 ? selectedYear : selectedYear + 1;
                              const monthKey = getMonthKey(selectedMonth, year);
                              return perf.paidDate && perf.paidDate.startsWith(monthKey);
                            })
                            .map(perf => (
                              <div key={perf.id} className="space-y-1">
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-[hsl(45,95%,55%)]">{perf.name}</span>
                                  <span className="font-semibold text-[hsl(45,95%,55%)]">
                                    ₪{parseFloat((perf.amount || 0).toFixed(1))}
                                  </span>
                                </div>
                                {perf.travel && perf.travel > 0 && (
                                  <div className="flex justify-between items-center text-xs text-[hsl(45,95%,55%)]/70 mr-2">
                                    <span>נסיעות</span>
                                    <span>₪{parseFloat(perf.travel.toFixed(1))}</span>
                                  </div>
                                )}
                              </div>
                            ))
                          }
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[hsl(45,95%,55%)]/50">
                          <span className="font-bold text-[hsl(45,95%,55%)]">סה"כ (ללא נסיעות)</span>
                          <span className="font-bold text-[hsl(45,95%,55%)]">
                            ₪{parseFloat(getPerformances()
                              .filter(perf => {
                                const year = parseInt(selectedMonth) >= 9 ? selectedYear : selectedYear + 1;
                                const monthKey = getMonthKey(selectedMonth, year);
                                return perf.paidDate && perf.paidDate.startsWith(monthKey);
                              })
                              .reduce((sum, perf) => sum + (perf.amount || 0), 0).toFixed(1))}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* סה"כ לחודש */}
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-foreground">סה"כ לחודש</h4>
                        <div className="text-2xl font-bold text-green-700">
                          ₪{parseFloat(calculateMonthlyTotal(selectedMonth).toFixed(1))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* מעשר */}
                  {(() => {
                    const year = parseInt(selectedMonth) >= 9 ? selectedYear : selectedYear + 1;
                    const monthKey = getMonthKey(selectedMonth, year);
                    const isPaid = tithePaid[monthKey] || false;
                    
                    return (
                      <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <h4 className="font-bold text-foreground">מעשר (10%)</h4>
                              <div className="text-xl font-bold text-amber-700">
                                ₪{parseFloat((calculateMonthlyTotal(selectedMonth) * 0.1).toFixed(1))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                onClick={() => handleTitheToggle(monthKey, true)}
                                className={`flex-1 ${isPaid ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200 animate-pulse' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                              >
                                ✓ הופרש
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => handleTitheToggle(monthKey, false)}
                                className={`flex-1 ${!isPaid ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                              >
                                ⚠ לא הופרש
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Lesson Students Section */}
      {perLessonStudents.length > 0 && (
        <Card className="card-gradient card-shadow">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Coins className="h-5 w-5" />
              שיעורים חד-פעמיים (מזומן)
              <Badge variant="secondary" className="mr-2">{perLessonStudents.length} תלמידות</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תלמידה</TableHead>
                    <TableHead className="text-right">מחיר/שיעור</TableHead>
                    <TableHead className="text-right">שיעורים שניתנו</TableHead>
                    <TableHead className="text-right">שולם</TableHead>
                    <TableHead className="text-right">יתרה</TableHead>
                    <TableHead className="text-right">סכום לתשלום</TableHead>
                    <TableHead className="text-right">פעולה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perLessonStudents.map(student => {
                    const completedLessons = getCompletedLessonsCount(student.id);
                    const paidLessons = student.paidLessonsCount || 0;
                    const balanceLessons = completedLessons - paidLessons;
                    const balanceAmount = balanceLessons * (student.lessonPrice || 0);
                    
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.firstName} {student.lastName}
                        </TableCell>
                        <TableCell>₪{student.lessonPrice || 0}</TableCell>
                        <TableCell>{completedLessons}</TableCell>
                        <TableCell className="text-green-600 font-medium">{paidLessons}</TableCell>
                        <TableCell className={balanceLessons > 0 ? 'text-destructive font-bold' : 'text-green-600'}>
                          {balanceLessons > 0 ? balanceLessons : '✓'}
                        </TableCell>
                        <TableCell className={balanceAmount > 0 ? 'text-destructive font-bold' : ''}>
                          {balanceAmount > 0 ? `₪${balanceAmount}` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPerLessonStudent(student);
                                // Pre-fill amount based on balance
                                const suggestedAmount = balanceLessons * (student.lessonPrice || 0);
                                setPerLessonPaymentAmount(suggestedAmount > 0 ? suggestedAmount.toString() : '');
                                setPerLessonPaymentDate(new Date().toISOString().split('T')[0]);
                                setPerLessonPaymentNotes('');
                                setShowPerLessonPaymentDialog(true);
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              רשום תשלום
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedStudentForHistory(student);
                                setShowPerLessonHistoryDialog(true);
                              }}
                            >
                              <Calendar className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* דיאלוג תשלום חד פעמי */}
      <Dialog open={showOneTimeDialog} onOpenChange={setShowOneTimeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת תשלום חד פעמי</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-description">תיאור</Label>
              <Input
                id="payment-description"
                value={newOneTimePayment.description}
                onChange={(e) => setNewOneTimePayment({ ...newOneTimePayment, description: e.target.value })}
                placeholder="לדוגמה: השלמה לחודש ינואר"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-amount">סכום</Label>
              <Input
                id="payment-amount"
                type="number"
                value={newOneTimePayment.amount}
                onChange={(e) => setNewOneTimePayment({ ...newOneTimePayment, amount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-month">חודש</Label>
              <Select
                value={newOneTimePayment.month}
                onValueChange={(value) => setNewOneTimePayment({ ...newOneTimePayment, month: value })}
              >
                <SelectTrigger id="payment-month">
                  <SelectValue placeholder="בחר חודש" />
                </SelectTrigger>
                <SelectContent>
                  {academicMonths.map((month) => (
                    <SelectItem key={month.key} value={`${selectedYear}-${month.key}`}>
                      {month.fullName} {selectedYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddOneTimePayment} className="flex-1">הוסף</Button>
              <Button variant="outline" onClick={() => setShowOneTimeDialog(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Per-Lesson Payment Dialog - Amount based with date */}
      <Dialog open={showPerLessonPaymentDialog} onOpenChange={setShowPerLessonPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>רישום תשלום - שיעורים חד-פעמיים</DialogTitle>
          </DialogHeader>
          {selectedPerLessonStudent && (() => {
            const lessonPrice = selectedPerLessonStudent.lessonPrice || 0;
            const currentBalance = selectedPerLessonStudent.perLessonBalance || 0;
            const amount = parseFloat(perLessonPaymentAmount) || 0;
            const totalAvailable = amount + currentBalance;
            const lessonsCovered = lessonPrice > 0 ? Math.floor(totalAvailable / lessonPrice) : 0;
            const newBalance = lessonPrice > 0 ? totalAvailable - (lessonsCovered * lessonPrice) : 0;
            
            return (
              <div className="space-y-4">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <p className="font-bold text-lg">{selectedPerLessonStudent.firstName} {selectedPerLessonStudent.lastName}</p>
                  <p className="text-sm text-muted-foreground">מחיר לשיעור: ₪{lessonPrice}</p>
                  {currentBalance > 0 && (
                    <p className="text-sm text-green-600">יתרה קיימת: ₪{currentBalance}</p>
                  )}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">שיעורים שניתנו:</span>
                      <span className="font-bold mr-1">{getCompletedLessonsCount(selectedPerLessonStudent.id)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">שולם:</span>
                      <span className="font-bold mr-1">{selectedPerLessonStudent.paidLessonsCount || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">חוב:</span>
                      <span className="font-bold text-destructive mr-1">
                        {Math.max(0, getCompletedLessonsCount(selectedPerLessonStudent.id) - (selectedPerLessonStudent.paidLessonsCount || 0))}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="payment-date">תאריך תשלום</Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={perLessonPaymentDate}
                    onChange={(e) => setPerLessonPaymentDate(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="payment-amount">סכום ששולם</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    min={0}
                    value={perLessonPaymentAmount}
                    onChange={(e) => setPerLessonPaymentAmount(e.target.value)}
                    placeholder="הזן סכום"
                  />
                  {amount > 0 && lessonPrice > 0 && (
                    <div className="p-2 bg-muted rounded text-sm">
                      <p>מכסה: <strong>{lessonsCovered} שיעורים</strong></p>
                      {newBalance > 0 && (
                        <p className="text-green-600">יתרה לזכות: ₪{newBalance.toFixed(2)}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-notes">הערות (אופציונלי)</Label>
                  <Input
                    id="payment-notes"
                    value={perLessonPaymentNotes}
                    onChange={(e) => setPerLessonPaymentNotes(e.target.value)}
                    placeholder="הערות..."
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleRecordPerLessonPayment} className="flex-1">
                    רשום תשלום
                  </Button>
                  <Button variant="outline" onClick={() => setShowPerLessonPaymentDialog(false)}>ביטול</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit One-Time Payment Dialog */}
      <Dialog open={showEditOneTimeDialog} onOpenChange={setShowEditOneTimeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת תשלום חד פעמי</DialogTitle>
          </DialogHeader>
          {editingOneTimePayment && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-description">תיאור</Label>
                <Input
                  id="edit-description"
                  value={editingOneTimePayment.description}
                  onChange={(e) => setEditingOneTimePayment({ ...editingOneTimePayment, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-amount">סכום</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  value={editingOneTimePayment.amount}
                  onChange={(e) => setEditingOneTimePayment({ ...editingOneTimePayment, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-date">תאריך</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editingOneTimePayment.paidDate?.split('T')[0] || ''}
                  onChange={(e) => setEditingOneTimePayment({ ...editingOneTimePayment, paidDate: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEditOneTimePayment} className="flex-1">שמור</Button>
                <Button 
                  variant="destructive" 
                  onClick={async () => {
                    await handleDeleteOneTimePayment(editingOneTimePayment.id);
                    setShowEditOneTimeDialog(false);
                    setEditingOneTimePayment(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => setShowEditOneTimeDialog(false)}>ביטול</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Per-Lesson Payment Dialog */}
      <Dialog open={showEditPerLessonDialog} onOpenChange={setShowEditPerLessonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת תשלום - שיעור חד-פעמי</DialogTitle>
          </DialogHeader>
          {editingPerLessonPayment && (() => {
            const student = students.find(s => s.id === editingPerLessonPayment.studentId);
            return (
              <div className="space-y-4">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <p className="font-bold">{student ? `${student.firstName} ${student.lastName}` : 'תלמידה'}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-plp-date">תאריך תשלום</Label>
                  <Input
                    id="edit-plp-date"
                    type="date"
                    value={editingPerLessonPayment.paymentDate || ''}
                    onChange={(e) => setEditingPerLessonPayment({ ...editingPerLessonPayment, paymentDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-plp-amount">סכום</Label>
                  <Input
                    id="edit-plp-amount"
                    type="number"
                    value={editingPerLessonPayment.amount}
                    onChange={(e) => setEditingPerLessonPayment({ ...editingPerLessonPayment, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-plp-notes">הערות</Label>
                  <Input
                    id="edit-plp-notes"
                    value={editingPerLessonPayment.notes || ''}
                    onChange={(e) => setEditingPerLessonPayment({ ...editingPerLessonPayment, notes: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleEditPerLessonPayment} className="flex-1">שמור</Button>
                  <Button 
                    variant="destructive" 
                    onClick={async () => {
                      await handleDeletePerLessonPayment(editingPerLessonPayment.id);
                      setShowEditPerLessonDialog(false);
                      setEditingPerLessonPayment(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => setShowEditPerLessonDialog(false)}>ביטול</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Per-Lesson Payment History Dialog */}
      <Dialog open={showPerLessonHistoryDialog} onOpenChange={setShowPerLessonHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>היסטוריית תשלומים - {selectedStudentForHistory?.firstName} {selectedStudentForHistory?.lastName}</DialogTitle>
          </DialogHeader>
          {selectedStudentForHistory && (() => {
            const studentPayments = getStudentPerLessonPayments(selectedStudentForHistory.id);
            const totalPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
            
            return (
              <div className="space-y-4">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <div className="flex justify-between">
                    <span>מחיר לשיעור:</span>
                    <span className="font-bold">₪{selectedStudentForHistory.lessonPrice || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>סה"כ שולם:</span>
                    <span className="font-bold text-green-600">₪{totalPaid}</span>
                  </div>
                </div>
                
                {studentPayments.length === 0 ? (
                  <p className="text-center text-muted-foreground">אין תשלומים רשומים</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {studentPayments
                      .sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''))
                      .map(plp => (
                        <div key={plp.id} className="flex justify-between items-center p-2 border rounded group">
                          <div>
                            <span className="font-medium">{plp.paymentDate?.split('-').reverse().join('/')}</span>
                            {plp.notes && <span className="text-xs text-muted-foreground mr-2">({plp.notes})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">₪{plp.amount}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setEditingPerLessonPayment(plp);
                                setShowPerLessonHistoryDialog(false);
                                setShowEditPerLessonDialog(true);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowPerLessonHistoryDialog(false)}
                >
                  סגור
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentManagement;
