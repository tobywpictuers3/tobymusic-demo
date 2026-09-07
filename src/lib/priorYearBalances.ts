import { getDevStore, getLessons, getOneTimePayments, getPerLessonPayments, getStudents, isDevMode, saveOneTimePayments, updateStudent } from './storage';
import { hybridSync } from './hybridSync';
import {
  getSchoolYearBounds,
  getStudentSchoolYearRecord,
  isPriorYearDebtMakeupLesson,
  upsertStudentSchoolYearTerms,
} from './schoolYear';
import type { PerLessonLedger, Student } from './types';

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
  source: 'annual_rollover' | 'per_lesson_rollover' | 'manual';
  /** Legacy per-lesson years do not store a historical lesson price snapshot. */
  requiresVerification?: boolean;
  paymentTrack?: 'annual' | 'per_lesson';
  lessonPriceSnapshot?: number;
  totalDueSnapshot?: number;
  totalPaidSnapshot?: number;
  updatedAt: string;
}

const BUCKET = 'priorYearBalances';
/**
 * School year 2026 predates the clean per-lesson year-close model, so its
 * historical lesson price cannot be reconstructed safely. From school year
 * 2027 onward the row is captured when the new-year Payments area first opens,
 * before that closing balance can participate in the new-year ledger.
 */
export const FIRST_AUTOMATED_PER_LESSON_CLOSE_YEAR = 2027;
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

const calculatePerLessonSourceBalance = (
  student: Student,
  targetSchoolYear: number,
): Pick<
  PriorYearBalanceRecord,
  'signedBalance' | 'source' | 'requiresVerification' | 'paymentTrack' | 'lessonPriceSnapshot' | 'totalDueSnapshot' | 'totalPaidSnapshot'
> => {
  const sourceSchoolYear = targetSchoolYear - 1;

  if (sourceSchoolYear < FIRST_AUTOMATED_PER_LESSON_CLOSE_YEAR) {
    return {
      signedBalance: 0,
      source: 'manual',
      requiresVerification: true,
      paymentTrack: 'per_lesson',
    };
  }

  const openingRow = getPriorYearBalanceRecords().find(row =>
    row.studentId === student.id && row.targetSchoolYear === sourceSchoolYear,
  );

  if (openingRow?.requiresVerification) {
    return {
      signedBalance: 0,
      source: 'manual',
      requiresVerification: true,
      paymentTrack: 'per_lesson',
    };
  }

  const { start, end } = getSchoolYearBounds(sourceSchoolYear);
  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);
  const lessonPrice = roundMoney(Number(student.lessonPrice || 0));
  const completedLessonsCount = getLessons().filter(lesson =>
    lesson.studentId === student.id &&
    lesson.status === 'completed' &&
    lesson.date >= start &&
    lesson.date <= end &&
    !isPriorYearDebtMakeupLesson(lesson),
  ).length;
  const totalDue = roundMoney(completedLessonsCount * lessonPrice);
  const totalPaid = roundMoney(getPerLessonPayments()
    .filter(payment => payment.studentId === student.id && payment.month >= startMonth && payment.month <= endMonth)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const openingBalance = openingRow && openingRow.settlementMethod === 'lessons'
    ? Number(openingRow.signedBalance || 0)
    : 0;

  return {
    signedBalance: roundMoney(openingBalance + totalPaid - totalDue),
    source: 'per_lesson_rollover',
    requiresVerification: false,
    paymentTrack: 'per_lesson',
    lessonPriceSnapshot: lessonPrice,
    totalDueSnapshot: totalDue,
    totalPaidSnapshot: totalPaid,
  };
};

const calculatedSourceBalance = (
  student: Student,
  targetSchoolYear: number,
): Pick<
  PriorYearBalanceRecord,
  'signedBalance' | 'source' | 'requiresVerification' | 'paymentTrack' | 'lessonPriceSnapshot' | 'totalDueSnapshot' | 'totalPaidSnapshot'
> => {
  const sourceSchoolYear = targetSchoolYear - 1;

  if (student.paymentType === 'per_lesson') {
    return calculatePerLessonSourceBalance(student, targetSchoolYear);
  }

  const previous = getStudentSchoolYearRecord(student.id, sourceSchoolYear);
  if (!previous || previous.status !== 'closed') {
    return {
      signedBalance: 0,
      source: 'manual',
      requiresVerification: true,
      paymentTrack: 'annual',
    };
  }

  return {
    signedBalance: roundMoney(Number(previous.closingFinancialBalance || 0)),
    source: 'annual_rollover',
    requiresVerification: false,
    paymentTrack: 'annual',
    totalDueSnapshot: roundMoney(Number(previous.finalTarget || previous.baseTarget || 0)),
    totalPaidSnapshot: roundMoney(Number(previous.paidTotal || 0)),
  };
};

export const ensurePriorYearBalanceRows = (targetSchoolYear: number): PriorYearBalanceRecord[] => {
  const current = getPriorYearBalanceRecords();
  let changed = false;
  const normalized = current.map(row => {
    if (row.settlementMethod === 'lessons' && !row.requiresVerification && (!row.settled || row.settlementDate)) {
      changed = true;
      return { ...row, settled: true, settlementDate: undefined, updatedAt: new Date().toISOString() };
    }
    return row;
  });
  const byId = new Map(normalized.map(row => [row.id, row]));

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
      settled: !inferred.requiresVerification,
      source: inferred.source,
      requiresVerification: inferred.requiresVerification,
      paymentTrack: inferred.paymentTrack,
      lessonPriceSnapshot: inferred.lessonPriceSnapshot,
      totalDueSnapshot: inferred.totalDueSnapshot,
      totalPaidSnapshot: inferred.totalPaidSnapshot,
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
    const signedCashFlow = roundMoney(-record.signedBalance);
    without.push({
      id,
      month: record.settlementDate.slice(0, 7),
      amount: signedCashFlow,
      description: `סגירת יתרה משנה״ל ${record.sourceSchoolYear - 1}-${String(record.sourceSchoolYear).slice(-2)} — ${student.firstName} ${student.lastName}`.trim(),
      paidDate: record.settlementDate,
    });
  }

  if (JSON.stringify(existing) !== JSON.stringify(without)) saveOneTimePayments(without);
};

const applyToCurrentStudentCard = (record: PriorYearBalanceRecord, student: Student) => {
  if (record.requiresVerification || student.paymentType === 'per_lesson') return;
  const carryForward = record.settlementMethod === 'lessons' ? record.signedBalance : 0;

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

export const getPerLessonSchoolYearLedger = (studentId: string, schoolYear: number): PerLessonLedger => {
  const student = getStudents().find(item => item.id === studentId);
  const lessonPrice = Number(student?.lessonPrice || 0);
  const { start, end } = getSchoolYearBounds(schoolYear);
  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);

  const completedLessonsCount = getLessons().filter(lesson =>
    lesson.studentId === studentId &&
    lesson.status === 'completed' &&
    lesson.date >= start &&
    lesson.date <= end &&
    !isPriorYearDebtMakeupLesson(lesson),
  ).length;

  const totalPaid = roundMoney(getPerLessonPayments()
    .filter(payment => payment.studentId === studentId && payment.month >= startMonth && payment.month <= endMonth)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0));

  const openingRow = getPriorYearBalanceRecords().find(row =>
    row.studentId === studentId && row.targetSchoolYear === schoolYear,
  );
  const openingBalance = openingRow && !openingRow.requiresVerification && openingRow.settlementMethod === 'lessons'
    ? Number(openingRow.signedBalance || 0)
    : 0;
  const totalDue = roundMoney(completedLessonsCount * lessonPrice);
  const totalBalance = roundMoney(openingBalance + totalPaid - totalDue);

  return {
    lessonPrice,
    completedLessonsCount,
    totalDue,
    totalPaid,
    totalBalance,
    rows: [],
  };
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
