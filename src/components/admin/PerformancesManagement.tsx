import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Music, Download, Plus, Edit, Trash2, Check } from 'lucide-react';
import { getPerformances, addPerformance, updatePerformance, deletePerformance } from '@/lib/storage';
import { Performance } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { syncManager } from '@/lib/syncManager';

const PerformancesManagement = () => {
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showSelectionDialog, setShowSelectionDialog] = useState(false);
  const [editingPerformance, setEditingPerformance] = useState<Performance | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<Performance[]>([]);

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
    paymentStatus: 'not_paid' as Performance['paymentStatus'],
    paidDate: '',
    notes: '',
    status: 'open' as Performance['status']
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setPerformances(getPerformances());
  };

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
      paymentStatus: 'not_paid',
      paidDate: '',
      notes: '',
      status: 'open'
    });
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
      paymentStatus: performance.paymentStatus,
      paidDate: performance.paidDate || '',
      notes: performance.notes || '',
      status: performance.status
    });
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
      paymentStatus: formData.paymentStatus,
      paidDate: formData.paidDate || undefined,
      notes: formData.notes || undefined,
      status: formData.status
    };

    const isUpdate = !!editingPerformance;

    if (isUpdate) {
      updatePerformance(editingPerformance.id, performanceData);
      toast({ description: 'ההופעה עודכנה בהצלחה' });
    } else {
      addPerformance(performanceData);
      toast({ description: 'ההופעה נוספה בהצלחה' });
    }

    // Send to Google Calendar
    const description = [
      formData.client && `לקוח: ${formData.client}`,
      formData.clientPhone && `טלפון: ${formData.clientPhone}`,
      formData.orderContent && `תוכן: ${formData.orderContent}`,
      formData.amount && `סכום: ₪${formData.amount}`,
      formData.notes && `הערות: ${formData.notes}`
    ].filter(Boolean).join('\n');

    await syncManager.sendCalendarEvent({
      type: 'calendar_event',
      category: 'עבודה',
      sub_category: 'הופעות',
      title: formData.name,
      date: formData.date,
      time: formData.timeEstimate || '00:00',
      description,
      action: isUpdate ? 'update' : 'create',
      eventId: editingPerformance?.id
    });

    loadData();
    setShowEventDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('האם למחוק הופעה זו?')) {
      const performance = performances.find(p => p.id === id);
      
      deletePerformance(id);
      loadData();
      toast({ description: 'ההופעה נמחקה' });

      // Send to Google Calendar
      if (performance) {
        await syncManager.sendCalendarEvent({
          type: 'calendar_event',
          category: 'עבודה',
          sub_category: 'הופעות',
          title: performance.name,
          date: performance.date,
          time: performance.timeEstimate || '00:00',
          action: 'delete',
          eventId: id
        });
      }
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
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getPerformancesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return performances.filter(p => p.date === dateStr);
  };

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
            <h3 className="text-lg font-semibold mb-4">הופעות סגורות</h3>
            <div className="overflow-x-auto" dir="rtl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-[150px]">שם ההופעה</TableHead>
                    <TableHead className="text-right w-[120px]">מזמינה</TableHead>
                    <TableHead className="text-right w-[100px]">תאריך</TableHead>
                    <TableHead className="text-right w-[80px]">סכום</TableHead>
                    <TableHead className="text-right w-[110px]">סכום + נסיעות</TableHead>
                    <TableHead className="text-right w-[100px]">תאריך תשלום</TableHead>
                    <TableHead className="text-right w-auto">הערות</TableHead>
                    <TableHead className="text-right w-[100px]">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedPerformances.map(perf => (
                    <TableRow key={perf.id}>
                      <TableCell className="text-right">{perf.name}</TableCell>
                      <TableCell className="text-right">{perf.client || '-'}</TableCell>
                      <TableCell className="text-right">{format(new Date(perf.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-right">{perf.amount ? `₪${perf.amount}` : '-'}</TableCell>
                      <TableCell className="text-right">
                        {perf.amount && perf.travel ? `₪${perf.amount + perf.travel}` : perf.amount ? `₪${perf.amount}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {perf.paidDate ? format(new Date(perf.paidDate), 'dd/MM/yyyy') : '-'}
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
                  ))}
                  {closedPerformances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        אין הופעות סגורות
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
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
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
              <Label htmlFor="travel">נסיעות</Label>
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
              <Label htmlFor="paymentStatus">צורת תשלום</Label>
              <Select
                value={formData.paymentStatus}
                onValueChange={(val: Performance['paymentStatus']) => setFormData({ ...formData, paymentStatus: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_paid">לא שולם</SelectItem>
                  <SelectItem value="bank">בנק</SelectItem>
                  <SelectItem value="check">צ'ק</SelectItem>
                  <SelectItem value="cash">מזומן</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="paidDate">תאריך תשלום</Label>
              <Input
                id="paidDate"
                type="date"
                value={formData.paidDate}
                onChange={(e) => setFormData({ ...formData, paidDate: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="status">סטטוס</Label>
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
