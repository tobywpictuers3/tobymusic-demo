import { getDevStore, getOneTimePayments, getStudents, isDevMode, saveOneTimePayments, updateStudent } from './storage';
import { hybridSync } from './hybridSync';
import {
  getStudentSchoolYearRecord,
  upsertStudentSchoolYearTerms,
} from './schoolYear';
import type { Student } from './types';

export type PriorYearSettlementMethod = 'cash' | 'lessons';

export interface PriorYearBalanceRecord {
  id: string;
  studentId: string;
  sourceSchoolYear: number;
  targetSchoolYear: number;
  /** Positive = credit owed to the student; negative = debt owed by the student. */
  signedBalance: number;
  settlementMethod: PriorYearSettlementMethod;
  settled: boolean;
  settlementDate?: string;
  source: 'annual_rollover' | 'manual';
  /** Legacy per-lesson years do not store a historical lesson price snapshot. */
  requiresVerification?: boolean;
  updatedAt: string;
}

const BUCKET = 'priorYearBalances';
const roundMoney = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const mutableStore = (): Record<string, any> => {
  if (isDevMode()) return getDevStore();
  if (typeof window === 'undefined') return {};
  return (window as any).__musicSystemStorage || {};
};

const storeRecords = (records: PriorYearBalanceRecord[]) => {
  const store = mutableStore();
  store[BUCKET] = records;
  if (!isDevMode()) void hybridSync.onDataChange();
};

export const getPriorYearBalanceRecords = (): PriorYearBalanceRecord[] => {
  const store = mutableStore();
  return Array.isArray(store[BUCKET]) ? store[BUCKET].map((row: PriorYearBalanceRecord) => ({ ...row })) : [];
};

const calculatedSourceBalance = (student: Student, targetSchoolYear: number): Pick<PriorYearBalanceRecord, 'signedBalance' | 'source' | 'requiresVerification'> => {
  const sourceSchoolYear = targetSchoolYear - 1;

  // Historical per-lesson records do not persist the lesson price that was in
  // force for each prior-year lesson. Recomputing with today's lessonPrice could
  // silently invent a debt/credit. For legacy years we therefore create the row
  // but require an explicit verified amount instead of guessing.
  if (student.paymentType === 'per_lesson') {
    return { signedBalance: 0, source: 'manual', requiresVerification: true };
  }

  const previous = getStudentSchoolYearRecord(student.id, sourceSchoolYear);
  if (!previous || previous.status !== 'closed') {
    return { signedBalance: 0, source: 'manual', requiresVerification: true };
  }

  return {
    signedBalance: roundMoney(Number(previous.closingFinancialBalance || 0)),
    source: 'annual_rollover',
    requiresVerification: false,
  };
};

export const ensurePriorYearBalanceRows = (targetSchoolYear: number): PriorYearBalanceRecord[] => {
  const current = getPriorYearBalanceRecords();
  const byId = new Map(current.map(row => [row.id, row]));
  let changed = false;

  getStudents().forEach(student => {
    const id = `${student.id}:${targetSchoolYear}`;
    if (byId.has(id)) return;
    const inferred = calculatedSourceBalance(student, targetSchoolYear);
    byId.set(id, {
      id,
      studentId: student.id,
      sourceSchoolYear: targetSchoolYear - 1,
      targetSchoolYear,
      signedBalance: inferred.signedBalance,
      settlementMethod: 'lessons',
      settled: inferred.signedBalance === 0 && !inferred.requiresVerification,
      source: inferred.source,
      requiresVerification: inferred.requiresVerification,
      updatedAt: new Date().toISOString(),
    });
    changed = true;
  });

  const next = Array.from(byId.values());
  if (changed) storeRecords(next);
  return next;
};

const settlementPaymentId = (record: PriorYearBalanceRecord) => `prior-year-balance:${record.targetSchoolYear}:${record.studentId}`;

const syncCashSettlementPayment = (record: PriorYearBalanceRecord, student: Student) => {
  const id = settlementPaymentId(record);
  const existing = getOneTimePayments();
  const without = existing.filter(payment => payment.id !== id);

  if (
    record.settlementMethod === 'cash' &&
    record.settled &&
    !record.requiresVerification &&
    record.settlementDate &&
    record.signedBalance !== 0
  ) {
    // Balance sign is from the student's perspective; cash flow is the reverse:
    // debt -100 => teacher receives +100; credit +100 => teacher refunds -100.
    const signedCashFlow = roundMoney(-record.signedBalance);
    without.push({
      id,
      month: record.settlementDate.slice(0, 7),
      amount: signedCashFlow,
      description: `סגירת יתרה משנה״ל ${record.sourceSchoolYear - 1}-${String(record.sourceSchoolYear).slice(-2)} — ${student.firstName} ${student.lastName}`.trim(),
      paidDate: record.settlementDate,
    });
  }

  saveOneTimePayments(without);
};

const applyToCurrentStudentCard = (record: PriorYearBalanceRecord, student: Student) => {
  if (record.requiresVerification) return;
  const carryForward = record.settlementMethod === 'lessons' ? record.signedBalance : 0;

  if (student.paymentType === 'per_lesson') {
    updateStudent(student.id, { perLessonBalance: roundMoney(carryForward) });
    return;
  }

  const current = getStudentSchoolYearRecord(student.id, record.targetSchoolYear);
  if (!current || current.status !== 'open') return;

  upsertStudentSchoolYearTerms(student.id, record.targetSchoolYear, {
    startReason: current.startReason,
    startingLessonNumber: current.startingLessonNumber,
    annualAmountFull: current.annualAmountFull,
    openingFinancialBalance: roundMoney(carryForward),
    openingCarryoverLessons: current.openingCarryoverLessons,
    openingCarryoverBankMinutes: current.openingCarryoverBankMinutes,
    source: current.source,
  });

  const netTarget = roundMoney(Math.max(0, current.baseTarget - carryForward));
  updateStudent(student.id, {
    calculatedAmount: Math.abs(netTarget - current.annualAmountFull) > 0.009 ? netTarget : undefined,
    monthlyAmount: student.paymentMonths > 0 ? roundMoney(netTarget / student.paymentMonths) : netTarget,
  });
};

export const updatePriorYearBalanceRecord = (
  id: string,
  updates: Partial<Pick<PriorYearBalanceRecord, 'signedBalance' | 'settlementMethod' | 'settled' | 'settlementDate'>>,
): PriorYearBalanceRecord | undefined => {
  const records = getPriorYearBalanceRecords();
  const index = records.findIndex(row => row.id === id);
  if (index < 0) return undefined;

  const previous = records[index];
  const hasSettlementDate = Object.prototype.hasOwnProperty.call(updates, 'settlementDate');
  const amountWasExplicitlyEdited = Object.prototype.hasOwnProperty.call(updates, 'signedBalance');
  const next: PriorYearBalanceRecord = {
    ...previous,
    ...updates,
    signedBalance: roundMoney(updates.signedBalance ?? previous.signedBalance),
    settlementDate: hasSettlementDate ? updates.settlementDate : previous.settlementDate,
    // An explicit human-entered amount resolves a legacy "requires verification" row.
    requiresVerification: amountWasExplicitlyEdited ? false : previous.requiresVerification,
    source: amountWasExplicitlyEdited ? 'manual' : previous.source,
    updatedAt: new Date().toISOString(),
  };

  if (next.settlementMethod === 'lessons') {
    next.settled = !next.requiresVerification;
    next.settlementDate = undefined;
  } else if (!next.settlementDate || next.requiresVerification) {
    next.settled = false;
  }
  if (next.signedBalance === 0 && !next.requiresVerification) next.settled = true;

  records[index] = next;
  storeRecords(records);

  const student = getStudents().find(item => item.id === next.studentId);
  if (student) {
    syncCashSettlementPayment(next, student);
    applyToCurrentStudentCard(next, student);
  }
  return next;
};
