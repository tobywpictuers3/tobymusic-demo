import { downloadCanonicalDropboxLatest } from './canonicalDropboxRead';
import { hybridSync } from './hybridSync';
import {
  getPriorYearBalanceRecords,
  replacePriorYearBalanceRecords,
  type PriorYearBalanceRecord,
} from './priorYearBalances';
import { isPriorYearDebtMakeupLesson } from './schoolYear';
import { workerApi } from './workerApi';

export const APPROVED_2026_SNAPSHOT_PATH = '/Apps/lovale db/backups/2026/08/30.json';
export const APPROVED_2026_SOURCE_YEAR = 2026;
export const APPROVED_2026_TARGET_YEAR = 2027;
export const APPROVED_2026_CUTOFF = '2026-08-31T23:59:59+03:00';

const START = '2025-09-01';
const END = '2026-08-31';
const START_MONTH = '2025-09';
const END_MONTH = '2026-08';

const roundMoney = (value: number) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const asArray = <T = any>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const paymentBelongsTo2026 = (payment: any): boolean => {
  const paymentDate = typeof payment?.paymentDate === 'string' ? payment.paymentDate.slice(0, 10) : '';
  if (paymentDate) return paymentDate >= START && paymentDate <= END;
  const month = typeof payment?.month === 'string' ? payment.month.slice(0, 7) : '';
  return month >= START_MONTH && month <= END_MONTH;
};

const isAlreadyHandled = (row: PriorYearBalanceRecord | undefined): boolean => {
  if (!row) return false;
  if (row.settlementMethod === 'cash' && row.settled && Boolean(row.settlementDate)) return true;
  if (!row.requiresVerification && row.source === 'manual') return true;
  if (!row.requiresVerification && row.sourceSnapshotPath === APPROVED_2026_SNAPSHOT_PATH) return true;
  return false;
};

export type Approved2026MigrationReport = {
  changed: boolean;
  migrated: number;
  skippedHandled: number;
  requiresVerification: number;
  verified: number;
  backupCreated: boolean;
  readBackVerified: boolean;
};

export async function migrateApproved2026PerLessonClose(): Promise<Approved2026MigrationReport> {
  const snapshotResult = await workerApi.downloadByPath(APPROVED_2026_SNAPSHOT_PATH);
  if (!snapshotResult.success || !snapshotResult.data || typeof snapshotResult.data !== 'object') {
    throw new Error('APPROVED_2026_SNAPSHOT_UNAVAILABLE');
  }

  const snapshot = snapshotResult.data as Record<string, any>;
  const academic = snapshot.musicSystem_academicYearSettings || {};
  if (academic.startDate !== START || academic.endDate !== END) {
    throw new Error('APPROVED_2026_SNAPSHOT_YEAR_MISMATCH');
  }

  const students = asArray<any>(snapshot.musicSystem_students)
    .filter(student => student?.paymentType === 'per_lesson' && student?.id);
  const lessons = asArray<any>(snapshot.musicSystem_lessons);
  const payments = asArray<any>(snapshot.musicSystem_perLessonPayments);
  const snapshotPriorBalances = asArray<PriorYearBalanceRecord>(snapshot.musicSystem_priorYearBalances);

  if (students.length === 0) throw new Error('APPROVED_2026_SNAPSHOT_HAS_NO_PER_LESSON_STUDENTS');

  const existing = getPriorYearBalanceRecords();
  const byId = new Map(existing.map(row => [row.id, row]));
  let migrated = 0;
  let skippedHandled = 0;
  let requiresVerification = 0;
  const intendedIds: string[] = [];

  for (const student of students) {
    const id = `${student.id}:${APPROVED_2026_TARGET_YEAR}`;
    const current = byId.get(id);
    if (isAlreadyHandled(current)) {
      skippedHandled += 1;
      continue;
    }

    const sourceLessonPrice = roundMoney(Number(student.lessonPrice || 0));
    const completedLessons = lessons.filter(lesson =>
      lesson?.studentId === student.id &&
      lesson?.status === 'completed' &&
      typeof lesson?.date === 'string' &&
      lesson.date >= START &&
      lesson.date <= END &&
      !isPriorYearDebtMakeupLesson(lesson),
    );
    const sourceCompletedLessons = completedLessons.length;
    const sourceTotalDue = roundMoney(sourceCompletedLessons * sourceLessonPrice);
    const sourceTotalPaid = roundMoney(payments
      .filter(payment => payment?.studentId === student.id && paymentBelongsTo2026(payment))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0));

    const openingRow = snapshotPriorBalances.find(row =>
      row.studentId === student.id && row.targetSchoolYear === APPROVED_2026_SOURCE_YEAR,
    );
    const openingIsUnverified = Boolean(openingRow?.requiresVerification);
    const sourceOpeningBalance = !openingIsUnverified && openingRow?.settlementMethod === 'lessons'
      ? roundMoney(Number(openingRow.signedBalance || 0))
      : 0;
    const reliable = sourceLessonPrice > 0 && !openingIsUnverified;
    const signedBalance = reliable
      ? roundMoney(sourceOpeningBalance + sourceTotalPaid - sourceTotalDue)
      : Number(current?.signedBalance || 0);
    const settlementMethod = current?.settlementMethod || 'lessons';

    const next: PriorYearBalanceRecord = {
      ...current,
      id,
      studentId: student.id,
      sourceSchoolYear: APPROVED_2026_SOURCE_YEAR,
      targetSchoolYear: APPROVED_2026_TARGET_YEAR,
      signedBalance,
      settlementMethod,
      settled: reliable && settlementMethod === 'lessons'
        ? true
        : Boolean(current?.settled && current?.settlementDate),
      settlementDate: settlementMethod === 'lessons' ? undefined : current?.settlementDate,
      source: reliable ? 'per_lesson_rollover' : 'manual',
      requiresVerification: !reliable,
      paymentTrack: 'per_lesson',
      sourceLessonPrice,
      sourceCompletedLessons,
      sourceOpeningBalance,
      sourceTotalDue,
      sourceTotalPaid,
      lessonPriceSnapshot: sourceLessonPrice,
      totalDueSnapshot: sourceTotalDue,
      totalPaidSnapshot: sourceTotalPaid,
      sourceProvenance: 'approved_2026_snapshot',
      sourceSnapshotPath: APPROVED_2026_SNAPSHOT_PATH,
      sourceSnapshotTimestamp: String(snapshot.timestamp || ''),
      sourceCutoff: APPROVED_2026_CUTOFF,
      updatedAt: new Date().toISOString(),
    };

    byId.set(id, next);
    intendedIds.push(id);
    migrated += 1;
    if (!reliable) requiresVerification += 1;
  }

  if (migrated === 0) {
    return {
      changed: false,
      migrated: 0,
      skippedHandled,
      requiresVerification: 0,
      verified: students.length - skippedHandled,
      backupCreated: false,
      readBackVerified: true,
    };
  }

  // Safety rule: create a full, identical versioned copy of canonical latest
  // before mutating any production bucket. The approved 30.json is input only;
  // current 2027 data always comes from canonical latest.
  const canonicalBefore = await downloadCanonicalDropboxLatest();
  if (!canonicalBefore.success || !canonicalBefore.data) {
    throw new Error('CANONICAL_BACKUP_SOURCE_UNAVAILABLE');
  }
  const backup = await workerApi.uploadVersioned(canonicalBefore.data);
  if (!backup.success) throw new Error('CANONICAL_BACKUP_CREATE_FAILED');

  replacePriorYearBalanceRecords(Array.from(byId.values()), { sync: false });
  await hybridSync.onDataChange();
  const synced = await hybridSync.manualSync();
  if (!synced) throw new Error('APPROVED_2026_MIGRATION_SYNC_FAILED');

  const readBack = await downloadCanonicalDropboxLatest();
  if (!readBack.success || !readBack.data) throw new Error('APPROVED_2026_READBACK_FAILED');
  const remoteRows = asArray<PriorYearBalanceRecord>(readBack.data.musicSystem_priorYearBalances);
  const remoteById = new Map(remoteRows.map(row => [row.id, row]));
  const readBackVerified = intendedIds.every(id => {
    const expected = byId.get(id);
    const actual = remoteById.get(id);
    return Boolean(
      expected && actual &&
      actual.sourceSnapshotPath === APPROVED_2026_SNAPSHOT_PATH &&
      actual.requiresVerification === expected.requiresVerification &&
      roundMoney(actual.signedBalance) === roundMoney(expected.signedBalance) &&
      roundMoney(Number(actual.sourceTotalDue || 0)) === roundMoney(Number(expected.sourceTotalDue || 0)) &&
      roundMoney(Number(actual.sourceTotalPaid || 0)) === roundMoney(Number(expected.sourceTotalPaid || 0))
    );
  });
  if (!readBackVerified) throw new Error('APPROVED_2026_READBACK_MISMATCH');

  return {
    changed: true,
    migrated,
    skippedHandled,
    requiresVerification,
    verified: migrated - requiresVerification,
    backupCreated: true,
    readBackVerified,
  };
}
