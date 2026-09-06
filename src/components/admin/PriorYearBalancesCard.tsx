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
import { toast } from '@/hooks/use-toast';

interface Props {
  selectedBaseYear: number;
}

const money = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2);

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
      toast({ title: 'שגיאה', description: 'לא הצלחנו לעדכן את יתרת השנה הקודמת', variant: 'destructive' });
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

  const labelForBalance = (amount: number) => {
    if (amount > 0) return `זכות לתלמידה +₪${money(amount)}`;
    if (amount < 0) return `חוב של התלמידה -₪${money(Math.abs(amount))}`;
    return 'מאוזן ₪0';
  };

  return (
    <Card className="mt-5 border-primary/20" data-prior-year-balances>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">חובות / זכויות משנה״ל הקודמת</CardTitle>
        <p className="text-xs text-muted-foreground">
          פלוס = זכות לתלמידה. מינוס = חוב של התלמידה. מזומן נרשם בתשלומים אחרים בחודש הפירעון; החזר לתלמידה נרשם במינוס ומקטין את סך ההכנסות של אותו חודש.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-auto max-h-[52vh]" dir="rtl">
          <Table className="w-full min-w-[880px] table-fixed">
            <TableHeader className="sticky top-0 z-20 bg-background/95">
              <TableRow>
                <TableHead className="text-right w-[220px]">שם</TableHead>
                <TableHead className="text-right w-[210px]">חוב / זכות</TableHead>
                <TableHead className="text-right w-[160px]">אופן סגירה</TableHead>
                <TableHead className="text-right w-[140px]">שולם / נסגר</TableHead>
                <TableHead className="text-right w-[150px]">תאריך תשלום</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => {
                const student = students.find(item => item.id === row.studentId);
                const isCash = row.settlementMethod === 'cash';
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold text-right">{student ? `${student.firstName} ${student.lastName}`.trim() : 'תלמידה לא נמצאה'}</TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-1">
                        <div className={row.signedBalance > 0 ? 'text-emerald-700 dark:text-emerald-300' : row.signedBalance < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'}>
                          {labelForBalance(row.signedBalance)}
                        </div>
                        {row.requiresVerification && (
                          <div className="text-xs text-amber-700 dark:text-amber-300">נדרש אימות — הזיני את היתרה ההיסטורית</div>
                        )}
                        <Input
                          key={`${row.id}:${row.updatedAt}`}
                          type="number"
                          step="1"
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
                          settled: value === 'lessons' ? true : false,
                          settlementDate: value === 'lessons' ? undefined : row.settlementDate,
                        })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">מזומן</SelectItem>
                          <SelectItem value="lessons">שיעורים / קיזוז בכרטסת</SelectItem>
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
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">אין נתונים לשנה זו</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
