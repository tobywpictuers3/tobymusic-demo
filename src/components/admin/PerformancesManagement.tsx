import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/safe-ui/card';
import { Button } from '@/components/safe-ui/button';
import { Input } from '@/components/safe-ui/input';
import { Label } from '@/components/safe-ui/label';
import { Textarea } from '@/components/safe-ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/safe-ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/safe-ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/safe-ui/table';
import { Calendar } from '@/components/safe-ui/calendar';
import { Music, Download, Plus, Edit, Trash2, Check } from 'lucide-react';
import {
  getPerformances,
  addPerformance,
  updatePerformance,
  deletePerformance,
  addPerformancePayment,
  deletePerformancePayment,
  getPerformancePaidTotal,
  getPerformancePaymentStatus,
} from '@/lib/storage';
import { Performance } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const PerformancesManagement = () => {
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showSelectionDialog, setShowSelectionDialog] = useState(false);
  const [editingPerformance, setEditingPerformance] = useState<Performance | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<Performance[]>([]);

  // Collection / payment status filter for the closed performances table
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'not_paid' | 'partial' | 'paid'>('all');

  const [formData, setFormData] = useState({
    name: '',
    client: '',
    clientEmail: '',
    clientPhone: '',
    date: '',
    timeEstimate: '',
    orderContent: '',
    amount: '',
    travel: '',
    invoiceNumber: '',
    receiptNumber: '',
    notes: '',
    status: 'open' as Performance['status']
  });

  // Inline new-payment editor (used inside Edit dialog)
  const [newPpDate, setNewPpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newPpAmount, setNewPpAmount] = useState('');
  const [newPpMethod, setNewPpMethod] = useState<'bank' | 'check' | 'cash'>('bank');
  const [newPpNotes, setNewPpNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setPerformances(getPerformances());
  };

  const formatCurrencyAmount = (n: number) => Number.isInteger(n) ? n.toString() : n.toFixed(2);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const eventsOnDate = performances.filter(p => p.date === dateStr);
    
    if (eventsOnDate.length > 0) {
      setSelectedDateEvents(eventsOnDate);
      setShowSelectionDialog(true);
    } else {
      handleAddNew(dateStr);
    }
  };

  const handleAddNew = (dateStr?: string) => {
    setEditingPerformance(null);
    setFormData({
      name: '',
      client: '',
      clientEmail: '',
      clientPhone: '',
      date: dateStr || (selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''),
      timeEstimate: '',
      orderContent: '',
      amount: '',
      travel: '',
      invoiceNumber: '',
      receiptNumber: '',
      notes: '',
      status: 'open'
    });
    setNewPpAmount('');
    setNewPpNotes('');
    setNewPpDate(new Date().toISOString().split('T')[0]);
    setShowEventDialog(true);
    setShowSelectionDialog(false);
  };

  const handleEdit = (performance: Performance) => {
    setEditingPerformance(performance);
    setFormData({
      name: performance.name,
      client: performance.client || '',
      clientEmail: performance.clientEmail || '',
      clientPhone: performance.clientPhone || '',
      date: performance.date,
      timeEstimate: performance.timeEstimate || '',
      orderContent: performance.orderContent || '',
      amount: performance.amount?.toString() || '',
      travel: performance.travel?.toString() || '',
      invoiceNumber: performance.invoiceNumber || '',
      receiptNumber: performance.receiptNumber || '',
      notes: performance.notes || '',
      status: performance.status
    });
    setNewPpAmount('');
    setNewPpNotes('');
    setNewPpDate(new Date().toISOString().split('T')[0]);
    setShowEventDialog(true);
    setShowSelectionDialog(false);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.date) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא לפחות שם הופעה ותאריך',
        variant: 'destructive'
      });
      return;
    }

    const performanceData = {
      name: formData.name,
      client: formData.client || undefined,
      clientEmail: formData.clientEmail || undefined,
      clientPhone: formData.clientPhone || undefined,
      date: formData.date,
      timeEstimate: formData.timeEstimate || undefined,
      orderContent: formData.orderContent || undefined,
      amount: formData.amount ? parseFloat(formData.amount) : undefined,
      travel: formData.travel ? parseFloat(formData.travel) : undefined,
      invoiceNumber: formData.invoiceNumber || undefined,
      receiptNumber: formData.receiptNumber || undefined,
      // Legacy fields kept for back-compat; not used as source of truth
      paymentStatus: 'not_paid' as Performance['paymentStatus'],
      notes: formData.notes || undefined,
      status: formData.status
    };

    if (editingPerformance) {
      updatePerformance(editingPerformance.id, performanceData);
      toast({ description: 'ההופעה עודכנה בהצלחה' });
    } else {
      addPerformance(performanceData);
      toast({ description: 'ההופעה נוספה בהצלחה' });
    }

    loadData();
    setShowEventDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('האם למחוק הופעה זו?')) {
      deletePerformance(id);
      loadData();
      toast({ description: 'ההופעה נמחקה' });
    }
  };

  const handleAddPaymentInline = () => {
    if (!editingPerformance) return;
    const amt = parseFloat(newPpAmount);
    if (!amt || amt <= 0) {
      toast({ title: 'שגיאה', description: 'יש להזין סכום תשלום חיובי', variant: 'destructive' });
      return;
    }
    const updated = addPerformancePayment(editingPerformance.id, {
      date: newPpDate,
      amount: amt,
      method: newPpMethod,
      notes: newPpNotes || undefined,
    });
    if (updated) {
      setEditingPerformance(updated);
      loadData();
      setNewPpAmount('');
      setNewPpNotes('');
      toast({ description: 'תשלום נוסף' });
    }
  };

  const handleDeletePaymentInline = (paymentId: string) => {
    if (!editingPerformance) return;
    const updated = deletePerformancePayment(editingPerformance.id, paymentId);
    if (updated) {
      setEditingPerformance(updated);
      loadData();
      toast({ description: 'תשלום נמחק' });
    }
  };

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(performances, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performances_${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
    toast({ description: 'הקובץ הורד בהצלחה' });
  };

  const closedPerformances = performances
    .filter(p => p.status === 'closed')
    .filter(p => paymentStatusFilter === 'all' ? true : getPerformancePaymentStatus(p) === paymentStatusFilter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const modifiers = {
    hasEvent: (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return performances.some(p => p.date === dateStr);
    },
    openEvent: (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return performances.some(p => p.date === dateStr && p.status === 'open');
    }
  };

  const modifiersClassNames = {
    hasEvent: 'bg-primary/20 font-bold',
    openEvent: 'bg-amber-200 text-amber-900'
  };

  const timeOptions = [
    { value: 'morning', label: 'בוקר' },
    { value: 'noon', label: 'צהריים' },
    { value: 'afternoon', label: 'אחרי הצהריים' },
    { value: 'evening', label: 'ערב' },
    { value: 'night', label: 'לילה' }
  ];

  const renderStatusBadge = (perf: Performance) => {
    const status = getPerformancePaymentStatus(perf);
    const paid = getPerformancePaidTotal(perf);
    const due = perf.amount || 0;
    const cls = status === 'paid'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : status === 'partial'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
    const label = status === 'paid'
      ? 'שולם'
      : status === 'partial'
        ? `חלקי ₪${formatCurrencyAmount(paid)}/₪${formatCurrencyAmount(due)}`
        : 'לא שולם';
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
  };

  return (
    <div className="space-y-6">
      <Card className="card-gradient card-shadow">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Music className="h-6 w-6" />
              ניהול הופעות
            </CardTitle>
            <Button onClick={handleDownloadJSON} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              שמור JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Two Calendars Side by Side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-center">יומן הופעות</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                locale={he}
                modifiers={modifiers}
                modifiersClassNames={modifiersClassNames}
                className="rounded-md border mx-auto"
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-center">אירועים ופגישות</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                locale={he}
                className="rounded-md border mx-auto"
              />
              <p className="text-xs text-muted-foreground text-center mt-2">
                בהמשך יסונכרן עם יומן Google
              </p>
            </div>
          </div>

          {/* Closed Performances Table */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-lg font-semibold">הופעות סגורות</h3>
              <div className="flex items-center gap-2">
                <Label className="text-sm">סינון לגביה:</Label>
                <Select value={paymentStatusFilter} onValueChange={(v: 'all' | 'not_paid' | 'partial' | 'paid') => setPaymentStatusFilter(v)}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="not_paid">לא שולם</SelectItem>
                    <SelectItem value="partial">שולם חלקית</SelectItem>
                    <SelectItem value="paid">שולם</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto" dir="rtl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-[160px]">שם ההופעה</TableHead>
                    <TableHead className="text-right w-[120px]">מזמינה</TableHead>
                    <TableHead className="text-right w-[100px]">תאריך</TableHead>
                    <TableHead className="text-right w-[90px]">סכום</TableHead>
                    <TableHead className="text-right w-[90px]">נסיעות</TableHead>
                    <TableHead className="text-right w-[170px]">סטטוס תשלום</TableHead>
                    <TableHead className="text-right w-[110px]">יתרה</TableHead>
                    <TableHead className="text-right w-auto">הערות</TableHead>
                    <TableHead className="text-right w-[100px]">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedPerformances.map(perf => {
                    const due = perf.amount || 0;
                    const paid = getPerformancePaidTotal(perf);
                    const balance = due - paid;
                    return (
                      <TableRow key={perf.id}>
                        <TableCell className="text-right">{perf.name}</TableCell>
                        <TableCell className="text-right">{perf.client || '-'}</TableCell>
                        <TableCell className="text-right">{format(new Date(perf.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="text-right">{perf.amount ? `₪${perf.amount}` : '-'}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{perf.travel ? `₪${perf.travel}` : '-'}</TableCell>
                        <TableCell className="text-right">{renderStatusBadge(perf)}</TableCell>
                        <TableCell className={`text-right font-semibold ${balance > 0 ? 'text-amber-700 dark:text-amber-300' : balance < 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                          {balance > 0 ? `₪${formatCurrencyAmount(balance)}` : balance < 0 ? `+₪${formatCurrencyAmount(Math.abs(balance))}` : '-'}
                        </TableCell>
                        <TableCell className="text-right max-w-[200px] truncate">{perf.notes || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(perf)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(perf.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {closedPerformances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        אין הופעות להצגה
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection Dialog - Choose between Edit or Add New */}
      <Dialog open={showSelectionDialog} onOpenChange={setShowSelectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>בחר פעולה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              קיימות {selectedDateEvents.length} הופעות בתאריך זה
            </p>
            <div className="space-y-2">
              {selectedDateEvents.map(event => (
                <Button
                  key={event.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleEdit(event)}
                >
                  <Edit className="h-4 w-4 ml-2" />
                  {event.name} - {event.status === 'open' ? 'פתוחה' : 'סגורה'}
                </Button>
              ))}
            </div>
            <Button
              className="w-full"
              onClick={() => handleAddNew(selectedDateEvents[0]?.date)}
            >
              <Plus className="h-4 w-4 ml-2" />
              הוסף הופעה חדשה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={(o) => { setShowEventDialog(o); if (!o) setEditingPerformance(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPerformance ? 'עריכת הופעה' : 'הופעה חדשה'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">שם ההופעה *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="client">מזמינה</Label>
              <Input
                id="client"
                value={formData.client}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="clientEmail">מייל מזמינה</Label>
              <Input
                id="clientEmail"
                type="email"
                value={formData.clientEmail}
                onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="clientPhone">טלפון מזמינה</Label>
              <Input
                id="clientPhone"
                value={formData.clientPhone}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="date">תאריך *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="timeEstimate">שעה משוערת</Label>
              <div className="flex gap-2">
                <Select
                  value={timeOptions.find(t => t.value === formData.timeEstimate) ? formData.timeEstimate : 'custom'}
                  onValueChange={(val) => {
                    if (val !== 'custom') {
                      setFormData({ ...formData, timeEstimate: val });
                    }
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                    <SelectItem value="custom">שעה ספציפית</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  value={!timeOptions.find(t => t.value === formData.timeEstimate) ? formData.timeEstimate : ''}
                  onChange={(e) => setFormData({ ...formData, timeEstimate: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="col-span-2">
              <Label htmlFor="orderContent">תוכן ההזמנה</Label>
              <Textarea
                id="orderContent"
                value={formData.orderContent}
                onChange={(e) => setFormData({ ...formData, orderContent: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="amount">סכום ההזמנה</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="travel">נסיעות (לא נכלל בהכנסה)</Label>
              <Input
                id="travel"
                type="number"
                value={formData.travel}
                onChange={(e) => setFormData({ ...formData, travel: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="invoiceNumber">מספר דרישת תשלום</Label>
              <Input
                id="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="receiptNumber">מספר קבלה</Label>
              <Input
                id="receiptNumber"
                value={formData.receiptNumber}
                onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="status">סטטוס הופעה</Label>
              <Select
                value={formData.status}
                onValueChange={(val: Performance['status']) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">פתוח</SelectItem>
                  <SelectItem value="closed">סגור</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            {/* Partial payments editor — only for existing performances */}
            {editingPerformance && (() => {
              const totalDue = editingPerformance.amount || 0;
              const totalPaid = getPerformancePaidTotal(editingPerformance);
              const status = getPerformancePaymentStatus(editingPerformance);
              const balance = totalDue - totalPaid;
              return (
                <div className="col-span-2 rounded-md border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">תשלומים שהתקבלו</div>
                    {renderStatusBadge(editingPerformance)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    שולם ₪{formatCurrencyAmount(totalPaid)} מתוך ₪{formatCurrencyAmount(totalDue)}
                    {balance > 0 && <span className="text-amber-700 dark:text-amber-300 mr-2">• יתרה ₪{formatCurrencyAmount(balance)}</span>}
                    {balance < 0 && <span className="text-emerald-700 dark:text-emerald-300 mr-2">• עודף ₪{formatCurrencyAmount(Math.abs(balance))}</span>}
                  </div>

                  {(editingPerformance.performancePayments || []).length > 0 && (
                    <div className="space-y-1">
                      {(editingPerformance.performancePayments || []).slice().sort((a, b) => b.date.localeCompare(a.date)).map(pp => (
                        <div key={pp.id} className="flex items-center gap-2 text-sm bg-background rounded px-2 py-1.5 border">
                          <span className="font-mono">{format(new Date(pp.date), 'dd/MM/yyyy')}</span>
                          <span className="font-semibold">₪{formatCurrencyAmount(pp.amount)}</span>
                          {pp.method && <span className="text-xs text-muted-foreground">({pp.method === 'bank' ? 'בנק' : pp.method === 'check' ? 'צ׳ק' : 'מזומן'})</span>}
                          {pp.notes && <span className="text-xs text-muted-foreground truncate flex-1">{pp.notes}</span>}
                          <Button size="sm" variant="ghost" className="h-7 px-2 mr-auto" onClick={() => handleDeletePaymentInline(pp.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t">
                    <div>
                      <Label className="text-xs">תאריך</Label>
                      <Input type="date" value={newPpDate} onChange={(e) => setNewPpDate(e.target.value)} className="h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">סכום</Label>
                      <Input type="number" value={newPpAmount} onChange={(e) => setNewPpAmount(e.target.value)} className="h-9" placeholder="₪" />
                    </div>
                    <div>
                      <Label className="text-xs">אמצעי</Label>
                      <Select value={newPpMethod} onValueChange={(v: 'bank' | 'check' | 'cash') => setNewPpMethod(v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank">בנק</SelectItem>
                          <SelectItem value="check">צ׳ק</SelectItem>
                          <SelectItem value="cash">מזומן</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleAddPaymentInline} className="w-full h-9">
                        <Plus className="h-4 w-4 ml-1" /> הוסף תשלום
                      </Button>
                    </div>
                    <div className="col-span-2 md:col-span-4">
                      <Input value={newPpNotes} onChange={(e) => setNewPpNotes(e.target.value)} placeholder="הערות לתשלום (אופציונלי)" className="h-9" />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex gap-2 justify-end mt-4">
            {editingPerformance && (
              <Button variant="destructive" onClick={() => handleDelete(editingPerformance.id)}>
                <Trash2 className="h-4 w-4 ml-2" />
                מחק
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowEventDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleSave}>
              <Check className="h-4 w-4 ml-2" />
              שמור
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PerformancesManagement;
