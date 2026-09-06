import fs from 'node:fs';

const paymentPath = 'src/components/admin/PaymentManagement.tsx';
const durabilityPath = 'src/lib/financialDurability.ts';

let payment = fs.readFileSync(paymentPath, 'utf8');
const importLine = "import PriorYearBalancesCard from '@/components/admin/PriorYearBalancesCard';";
if (!payment.includes(importLine)) {
  const anchor = "import { format } from 'date-fns';";
  if (!payment.includes(anchor)) throw new Error('prior-year-balances: PaymentManagement import anchor not found');
  payment = payment.replace(anchor, `${anchor}\n${importLine}`);
}

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
