import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/safe-ui/card';
import { Input } from '@/components/safe-ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/safe-ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/safe-ui/table';
import { getStudents } from '@/lib/storage';
import {
  ensurePriorYearBalanceRows,
  getPriorYearBalanceRecords,
  updatePriorYearBalanceRecord,
  type PriorYearBalanceRecord,
  type PriorYearSettlementMethod,
} from '@/lib/priorYearBalances';
import { getSchoolYearLabel } from '@/lib/schoolYear';
import { toast } from '@/hooks/use-toast';

interface Props {
  selectedBaseYear: number;
}

const money = (value: number) => `₪${Math.abs(Number(value || 0)).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;

const todayInJerusalem = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export default function PriorYearBalancesCard({ selectedBaseYear }: Props) {
  const targetSchoolYear = selectedBaseYear + 1;
  const sourceSchoolYear = targetSchoolYear - 1;
  const [rows, setRows] = useState<PriorYearBalanceRecord[]>([]);
  const students = getStudents();

  const reload = () => {
    ensurePriorYearBalanceRows(targetSchoolYear);
    setRows(getPriorYearBalanceRecords().filter(row => row.targetSchoolYear === targetSchoolYear));
  };

  useEffect(() => {
    reload();
    const imported = () => reload();
    window.addEventListener('toby:storage-imported', imported);
    return () => window.removeEventListener('toby:storage-imported', imported);
  }, [targetSchoolYear]);

  const update = (row: PriorYearBalanceRecord, updates: Partial<PriorYearBalanceRecord>) => {
    const result = updatePriorYearBalanceRecord(row.id, updates);
    if (!result) {
      toast({ title: 'שגיאה', description: 'לא הצלחנו לעדכן את סגירת השנה', variant: 'destructive' });
      return;
    }
    reload();
  };

  const commitBalance = (row: PriorYearBalanceRecord, rawValue: string) => {
    const amount = Number(rawValue);
    if (!Number.isFinite(amount)) {
      toast({ title: 'סכום לא תקין', description: 'יש להזין מספר חוקי', variant: 'destructive' });
      reload();
      return;
    }
    if (Math.abs(amount - row.signedBalance) < 0.005 && !row.requiresVerification) return;
    update(row, { signedBalance: amount });
  };

  const balanceText = (amount: number) => {
    if (amount > 0) return `+${money(amount)} זכות לתלמידה`;
    if (amount < 0) return `-${money(amount)} חוב של התלמידה`;
    return '₪0 מאוזן';
  };

  return (
    <Card className="mt-5 border-primary/20" data-prior-year-balances>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">סגירת שנת לימודים {getSchoolYearLabel(sourceSchoolYear)}</CardTitle>
        <p className="text-sm text-muted-foreground leading-6">
          הטבלה סוגרת את השנה הקודמת בלי לערבב אותה עם השנה החדשה. ירוק = זכות לתלמידה; אדום = חוב של התלמידה.
          אם בוחרים שיעורים, היתרה עוברת לכרטסת השנה הבאה. אם בוחרים כסף, הפעולה נרשמת בתאריך הביצוע כהכנסה חיובית או שלילית בחודש המתאים.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-auto max-h-[58vh]" dir="rtl">
          <Table className="w-full min-w-[1080px] table-fixed">
            <TableHeader className="sticky top-0 z-20 bg-background/95">
              <TableRow>
                <TableHead className="text-right w-[190px]">תלמידה</TableHead>
                <TableHead className="text-right w-[120px]">מסלול</TableHead>
                <TableHead className="text-right w-[230px]">יתרת סגירה</TableHead>
                <TableHead className="text-right w-[190px]">אופן החזרה / הגבייה</TableHead>
                <TableHead className="text-right w-[130px]">בוצע</TableHead>
                <TableHead className="text-right w-[160px]">תאריך ביצוע</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => {
                const student = students.find(item => item.id === row.studentId);
                const isCash = row.settlementMethod === 'cash';
                const isCredit = row.signedBalance > 0;
                const isDebt = row.signedBalance < 0;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold text-right">{student ? `${student.firstName} ${student.lastName}`.trim() : 'תלמידה לא נמצאה'}</TableCell>
                    <TableCell className="text-right">
                      {row.paymentTrack === 'per_lesson' || student?.paymentType === 'per_lesson' ? 'לפי שיעור' : 'קבועה'}
                    </TableCell>
                    <TableCell className={isCredit
                      ? 'text-right bg-emerald-50 dark:bg-emerald-950/30'
                      : isDebt
                        ? 'text-right bg-rose-50 dark:bg-rose-950/30'
                        : 'text-right'}>
                      <div className="space-y-1">
                        <div className={isCredit
                          ? 'font-bold text-emerald-700 dark:text-emerald-300'
                          : isDebt
                            ? 'font-bold text-rose-700 dark:text-rose-300'
                            : 'text-muted-foreground'}>
                          {balanceText(row.signedBalance)}
                        </div>
                        {row.requiresVerification && (
                          <div className="text-xs text-amber-700 dark:text-amber-300">
                            נדרש אימות — לשנה היסטורית זו אין מחיר שיעור שמור, ולכן לא מחושב סכום משוער.
                          </div>
                        )}
                        {row.lessonPriceSnapshot !== undefined && (
                          <div className="text-xs text-muted-foreground">מחיר שיעור בסגירה: {money(row.lessonPriceSnapshot)}</div>
                        )}
                        <Input
                          key={`${row.id}:${row.updatedAt}`}
                          type="number"
                          step="0.01"
                          defaultValue={row.signedBalance}
                          aria-label="סכום חוב או זכות"
                          onBlur={event => commitBalance(row, event.currentTarget.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') event.currentTarget.blur();
                          }}
                          className="h-8"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={row.settlementMethod}
                        onValueChange={(value: PriorYearSettlementMethod) => update(row, {
                          settlementMethod: value,
                          settled: value === 'lessons',
                          settlementDate: value === 'lessons' ? undefined : row.settlementDate,
                        })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lessons">שיעורים בשנה הבאה</SelectItem>
                          <SelectItem value="cash">כסף</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={row.settled ? 'yes' : 'no'}
                        onValueChange={value => update(row, {
                          settled: value === 'yes',
                          settlementDate: value === 'yes' && isCash ? (row.settlementDate || todayInJerusalem()) : row.settlementDate,
                        })}
                        disabled={row.signedBalance === 0 || row.settlementMethod === 'lessons' || row.requiresVerification}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">לא</SelectItem>
                          <SelectItem value="yes">כן</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="date"
                        value={row.settlementDate || ''}
                        disabled={!isCash || !row.settled || row.signedBalance === 0 || row.requiresVerification}
                        onChange={event => update(row, { settlementDate: event.target.value || undefined })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">אין נתוני סגירה לשנה זו</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
