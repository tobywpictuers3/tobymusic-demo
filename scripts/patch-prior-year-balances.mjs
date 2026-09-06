import fs from 'node:fs';

const paymentPath = 'src/components/admin/PaymentManagement.tsx';
const durabilityPath = 'src/lib/financialDurability.ts';

let payment = fs.readFileSync(paymentPath, 'utf8');
const importLine = "import PriorYearBalancesCard from '@/components/admin/PriorYearBalancesCard';";
const ledgerImportLine = "import { getPerLessonSchoolYearLedger } from '@/lib/priorYearBalances';";
if (!payment.includes(importLine)) {
  const anchor = "import { format } from 'date-fns';";
  if (!payment.includes(anchor)) throw new Error('prior-year-balances: PaymentManagement import anchor not found');
  payment = payment.replace(anchor, `${anchor}\n${importLine}\n${ledgerImportLine}`);
} else if (!payment.includes(ledgerImportLine)) {
  payment = payment.replace(importLine, `${importLine}\n${ledgerImportLine}`);
}

const jerusalemHelper = `const todayInJerusalem = () => {\n  const parts = new Intl.DateTimeFormat('en-CA', {\n    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit'\n  }).formatToParts(new Date());\n  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));\n  return \`${'${values.year}'}-${'${values.month}'}-${'${values.day}'}\`;\n};\n`;
if (!payment.includes('const todayInJerusalem = () =>')) {
  const componentAnchor = 'const PaymentManagement = () => {';
  if (!payment.includes(componentAnchor)) throw new Error('prior-year-balances: component anchor not found');
  payment = payment.replace(componentAnchor, `${jerusalemHelper}\n${componentAnchor}`);
}

// Never rewrite historical payment methods when the manager changes the method
// for the selected school year.
const allHistoryFilter = "const studentPayments = updatedPayments.filter(p => p.studentId === studentId);";
const currentYearFilter = "const studentPayments = updatedPayments.filter(p => p.studentId === studentId && p.month >= `${selectedYear}-09` && p.month <= `${selectedYear + 1}-08`);";
if (payment.includes(allHistoryFilter)) payment = payment.replace(allHistoryFilter, currentYearFilter);
if (payment.includes(allHistoryFilter)) throw new Error('prior-year-balances: historical payment-method rewrite still present');

// Payment-method display and filters must come from the selected school year,
// not an arbitrary old payment row belonging to the same student.
const oldMethodLookup = "return payments.find(p => p.studentId === studentId)?.paymentMethod || 'inactive';";
const currentMethodLookup = "return payments.find(p => p.studentId === studentId && p.month >= `${selectedYear}-09` && p.month <= `${selectedYear + 1}-08`)?.paymentMethod || 'inactive';";
if (payment.includes(oldMethodLookup)) payment = payment.replace(oldMethodLookup, currentMethodLookup);

const oldFilterMethodLookup = "const studentMethod = payments.find(p => p.studentId === student.id)?.paymentMethod || 'inactive';";
const currentFilterMethodLookup = "const studentMethod = payments.find(p => p.studentId === student.id && p.month >= `${selectedYear}-09` && p.month <= `${selectedYear + 1}-08`)?.paymentMethod || 'inactive';";
if (payment.includes(oldFilterMethodLookup)) payment = payment.replace(oldFilterMethodLookup, currentFilterMethodLookup);

if (payment.includes(oldMethodLookup) || payment.includes(oldFilterMethodLookup)) {
  throw new Error('prior-year-balances: cross-year payment-method lookup still present');
}

// The active per-lesson card is school-year scoped. Historical rows remain
// available in history, but do not contaminate the new year's running balance.
const lifetimeLedger = 'const ledger = getStudentPerLessonLedger(student.id);';
const schoolYearLedger = 'const ledger = getPerLessonSchoolYearLedger(student.id, selectedYear + 1);';
if (payment.includes(lifetimeLedger)) payment = payment.replace(lifetimeLedger, schoolYearLedger);
if (!payment.includes(schoolYearLedger)) throw new Error('prior-year-balances: per-lesson summary did not become school-year scoped');

// Business dates are Jerusalem dates. UTC ISO dates can be one calendar day off
// around local midnight.
payment = payment.replaceAll("new Date().toISOString().split('T')[0]", 'todayInJerusalem()');

const oldOther = "{activePaymentsTab === 'other' && (otherView === 'annual' ? renderOtherAnnualTab() : renderOtherMonthlyTab())}";
const newOther = "{activePaymentsTab === 'other' && (<>\n            {otherView === 'annual' ? renderOtherAnnualTab() : renderOtherMonthlyTab()}\n            <PriorYearBalancesCard selectedBaseYear={selectedYear} />\n          </>)}";
if (payment.includes(oldOther)) payment = payment.replace(oldOther, newOther);
if (!payment.includes('<PriorYearBalancesCard selectedBaseYear={selectedYear} />')) {
  throw new Error('prior-year-balances: failed to mount table inside Other payments tab');
}

// Refunds are signed negative cash flow. They must remain visible in every
// summary and must reduce the monthly/yearly total rather than disappear.
const annualPositiveOnly = "{value > 0 ? `₪${formatCurrencyAmount(value)}` : '-'}";
const annualSigned = "{value !== 0 ? `${value < 0 ? '-' : ''}₪${formatCurrencyAmount(Math.abs(value))}` : '-'}";
if (payment.includes(annualPositiveOnly)) payment = payment.replace(annualPositiveOnly, annualSigned);

const dailyOtherPositiveOnly = "{row.other > 0 ? `₪${formatCurrencyAmount(row.other)}` : '-'}";
const dailyOtherSigned = "{row.other !== 0 ? `${row.other < 0 ? '-' : ''}₪${formatCurrencyAmount(Math.abs(row.other))}` : '-'}";
if (payment.includes(dailyOtherPositiveOnly)) payment = payment.replace(dailyOtherPositiveOnly, dailyOtherSigned);

const monthlyOtherPlain = '<div className="rounded-lg border p-3 bg-background"><div className="text-xs text-muted-foreground">אחר</div><div className="font-bold">₪{formatCurrencyAmount(breakdown.other)}</div></div>';
const monthlyOtherSigned = '<div className="rounded-lg border p-3 bg-background"><div className="text-xs text-muted-foreground">אחר</div><div className="font-bold">{breakdown.other < 0 ? `-₪${formatCurrencyAmount(Math.abs(breakdown.other))}` : `₪${formatCurrencyAmount(breakdown.other)}`}</div></div>';
if (payment.includes(monthlyOtherPlain)) payment = payment.replace(monthlyOtherPlain, monthlyOtherSigned);

if (payment.includes(dailyOtherPositiveOnly)) throw new Error('prior-year-balances: daily refund renderer still hides negatives');
if (payment.includes(monthlyOtherPlain)) throw new Error('prior-year-balances: monthly refund renderer not patched');
if (payment.includes("new Date().toISOString().split('T')[0]")) throw new Error('prior-year-balances: UTC business date remains in PaymentManagement');

fs.writeFileSync(paymentPath, payment);

let durability = fs.readFileSync(durabilityPath, 'utf8');
const projectionAnchor = "  schoolYearRecords: data?.musicSystem_schoolYearRecords || [],";
const projectionLine = "  priorYearBalances: data?.musicSystem_priorYearBalances || [],";
if (!durability.includes(projectionLine)) {
  if (!durability.includes(projectionAnchor)) throw new Error('prior-year-balances: financial projection anchor not found');
  durability = durability.replace(projectionAnchor, `${projectionAnchor}\n${projectionLine}`);
}
if (!durability.includes(projectionLine)) throw new Error('prior-year-balances: durability projection missing');
fs.writeFileSync(durabilityPath, durability);

console.log('prior-year-balances patch applied');
