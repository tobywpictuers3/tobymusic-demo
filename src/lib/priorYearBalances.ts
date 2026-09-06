import { getLessons, getOneTimePayments, getPerLessonPayments, getStudents, isDevMode, saveOneTimePayments, updateStudent } from './storage';
import { hybridSync } from './hybridSync';
import {
  getSchoolYearBounds,
  getStudentSchoolYearRecord,
  isPriorYearDebtMakeupLesson,
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
  source: 'annual_rollover' | 'per_lesson_calculation' | 'manual';
  updatedAt: string;
}

const BUCKET = 'priorYearBalances';
const roundMoney = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const mutableStore = (): Record<string, any> => {
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

const perLessonPriorYearBalance = (student: Student, sourceSchoolYear: number): number => {
  const { start, end } = getSchoolYearBounds(sourceSchoolYear);
  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);
  const completedLessons = getLessons().filter(lesson =>
    lesson.studentId === student.id &&
    lesson.status === 'completed' &&
    lesson.date >= start &&
    lesson.date <= end &&
    !isPriorYearDebtMakeupLesson(lesson),
  ).length;
  const paid = getPerLessonPayments()
    .filter(payment => payment.studentId === student.id && payment.month >= startMonth && payment.month <= endMonth)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const due = completedLessons * Number(student.lessonPrice || 0);
  return roundMoney(paid - due);
};

const calculatedSourceBalance = (student: Student, targetSchoolYear: number): { amount: number; source: PriorYearBalanceRecord['source'] } => {
  const sourceSchoolYear = targetSchoolYear - 1;
  if (student.paymentType === 'per_lesson') {
    return { amount: perLessonPriorYearBalance(student, sourceSchoolYear), source: 'per_lesson_calculation' };
  }
  const previous = getStudentSchoolYearRecord(student.id, sourceSchoolYear);
  return {
    amount: roundMoney(Number(previous?.closingFinancialBalance || 0)),
    source: 'annual_rollover',
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
      signedBalance: inferred.amount,
      settlementMethod: 'lessons',
      settled: inferred.amount === 0,
      source: inferred.source,
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
  if (record.settlementMethod === 'cash' && record.settled && record.settlementDate && record.signedBalance !== 0) {
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
  const next: PriorYearBalanceRecord = {
    ...previous,
    ...updates,
    signedBalance: roundMoney(updates.signedBalance ?? previous.signedBalance),
    settlementDate: updates.settlementDate ?? previous.settlementDate,
    updatedAt: new Date().toISOString(),
  };

  // A lesson/annual carry-forward is effective immediately; cash affects current-year
  // accounting only after an actual settlement date is recorded and marked paid.
  if (next.settlementMethod === 'cash' && (!next.settled || !next.settlementDate)) {
    next.settled = false;
  }
  if (next.signedBalance === 0) next.settled = true;

  records[index] = next;
  storeRecords(records);

  const student = getStudents().find(item => item.id === next.studentId);
  if (student) {
    syncCashSettlementPayment(next, student);
    applyToCurrentStudentCard(next, student);
  }
  return next;
};

export const getPriorYearBalanceCashFlowForMonth = (monthKey: string): number =>
  getOneTimePayments()
    .filter(payment => payment.id.startsWith('prior-year-balance:') && payment.month === monthKey)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
