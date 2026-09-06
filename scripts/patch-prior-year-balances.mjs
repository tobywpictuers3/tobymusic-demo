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

// Negative one-time cash settlements are real refunds and must remain visible in
// yearly breakdowns rather than disappearing behind a positive-only renderer.
payment = payment.replace(
  "{value > 0 ? `₪${formatCurrencyAmount(value)}` : '-'}",
  "{value !== 0 ? `${value < 0 ? '-' : ''}₪${formatCurrencyAmount(Math.abs(value))}` : '-'}",
);

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
