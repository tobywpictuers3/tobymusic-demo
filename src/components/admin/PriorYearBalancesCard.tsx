import { useEffect, useMemo, useState } from 'react';
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

export default function PriorYearBalancesCard({ selectedBaseYear }: Props) {
  const targetSchoolYear = selectedBaseYear + 1;
  const [rows, setRows] = useState<PriorYearBalanceRecord[]>([]);
  const students = useMemo(() => getStudents(), []);

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

  const labelForBalance = (amount: number) => {
    if (amount > 0) return `זכות לתלמידה +₪${money(amount)}`;
    if (amount < 0) return `חוב לתלמידה -₪${money(Math.abs(amount))}`;
    return 'מאוזן ₪0';
  };

  return (
    <Card className="mt-5 border-primary/20" data-prior-year-balances>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">חובות / זכויות משנה״ל הקודמת</CardTitle>
        <p className="text-xs text-muted-foreground">
          פלוס = זכות לתלמידה. מינוס = חוב של התלמידה. מזומן נרשם בתשלומים אחרים בחודש הפירעון; זכות מזומן נרשמת כהוצאה שלילית וחוב ששולם כהכנסה חיובית.
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
                        <Input
                          type="number"
                          step="1"
                          value={row.signedBalance}
                          aria-label="סכום חוב או זכות"
                          onChange={event => update(row, { signedBalance: Number(event.target.value || 0) })}
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
                          settlementDate: value === 'yes' && isCash ? (row.settlementDate || new Date().toISOString().slice(0, 10)) : row.settlementDate,
                        })}
                        disabled={row.signedBalance === 0 || row.settlementMethod === 'lessons'}
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
                        disabled={!isCash || !row.settled || row.signedBalance === 0}
                        onChange={event => update(row, { settlementDate: event.target.value })}
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
