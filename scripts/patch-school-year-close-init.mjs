import fs from 'node:fs';

const path = 'src/pages/AdminDashboard.tsx';
let source = fs.readFileSync(path, 'utf8');

const oldSchoolYearImport = "import { ensureSchoolYearRollover } from '@/lib/schoolYear';";
const newSchoolYearImport = "import { ensureSchoolYearRollover, getSchoolYearForDate } from '@/lib/schoolYear';\nimport { ensurePriorYearBalanceRows } from '@/lib/priorYearBalances';\nimport { migrateApproved2026PerLessonClose } from '@/lib/approved2026PerLessonClose';";
if (source.includes(oldSchoolYearImport)) source = source.replace(oldSchoolYearImport, newSchoolYearImport);
if (!source.includes("migrateApproved2026PerLessonClose")) {
  throw new Error('school-year-close-init: imports were not installed');
}

const stateAnchor = "  const [activeTab, setActiveTab] = useState('journal');";
const stateBlock = `${stateAnchor}\n  const [financialInitState, setFinancialInitState] = useState<'pending' | 'ready' | 'error'>(isStorybook ? 'ready' : 'pending');\n  const [financialInitError, setFinancialInitError] = useState('');\n  const [financialInitRetry, setFinancialInitRetry] = useState(0);`;
if (!source.includes('const [financialInitState,')) {
  if (!source.includes(stateAnchor)) throw new Error('school-year-close-init: state anchor not found');
  source = source.replace(stateAnchor, stateBlock);
}

const oldEffect = `  useEffect(() => {\n    if (user?.type !== 'admin') return;\n    // Idempotent and date-gated. Before Sep 1 this is read-only; after Sep 1\n    // it closes the prior year once and opens the new annual cards.\n    void ensureSchoolYearRollover().then(result => {\n      if (result.changed) {\n        toast({\n          title: \`✅ שנת \${result.closedYear} נסגרה\`,\n          description: \`נפתחו כרטסות שנת \${result.openedYear}; יתרות שיעורים, בנק זמן ותשלום הועברו אוטומטית.\`\n        });\n      }\n    }).catch(() => {\n      // The normal sync status UI will surface persistence errors; do not block the dashboard.\n    });\n  }, [user]);`;

const newEffect = `  useEffect(() => {\n    if (user?.type !== 'admin') return;\n    if (isStorybook) {\n      setFinancialInitState('ready');\n      return;\n    }\n\n    let cancelled = false;\n    setFinancialInitState('pending');\n    setFinancialInitError('');\n\n    void (async () => {\n      try {\n        const currentSchoolYear = getSchoolYearForDate();\n        const migration = currentSchoolYear >= 2027\n          ? await migrateApproved2026PerLessonClose()\n          : null;\n        const rollover = await ensureSchoolYearRollover();\n\n        // Freeze the just-closed year's financial inputs before any admin\n        // screen can edit the new year's student price/terms. PaymentManagement\n        // keeps its own call only as an idempotent fallback.\n        ensurePriorYearBalanceRows(currentSchoolYear);\n\n        if (cancelled) return;\n        setFinancialInitState('ready');\n\n        if (migration?.changed) {\n          toast({\n            title: '✅ סגירת 2026 חושבה ואומתה',\n            description: \`נוצרו \${migration.verified} רשומות מאומתות; \${migration.requiresVerification} נדרשות אימות.\`,\n          });\n        }\n        if (rollover.changed) {\n          toast({\n            title: \`✅ שנת \${rollover.closedYear} נסגרה\`,\n            description: \`נפתחו כרטסות שנת \${rollover.openedYear}; יתרות שיעורים, בנק זמן ותשלום הועברו אוטומטית.\`,\n          });\n        }\n      } catch (error) {\n        if (cancelled) return;\n        const code = error instanceof Error ? error.message : 'SCHOOL_YEAR_CLOSE_FAILED';\n        setFinancialInitError(code);\n        setFinancialInitState('error');\n      }\n    })();\n\n    return () => { cancelled = true; };\n  }, [user, isStorybook, financialInitRetry]);`;

if (source.includes(oldEffect)) source = source.replace(oldEffect, newEffect);
if (!source.includes('setFinancialInitState(\'ready\')') || source.includes(oldEffect)) {
  throw new Error('school-year-close-init: rollover effect was not replaced');
}

const guardAnchor = "  if (!user || user.type !== 'admin') return null;";
const guardBlock = `${guardAnchor}\n\n  if (financialInitState === 'pending') {\n    return (\n      <div className=\"min-h-screen flex items-center justify-center p-6\" dir=\"rtl\">\n        <div className=\"rounded-xl border bg-background p-6 text-center shadow-sm\">\n          <div className=\"font-semibold\">מכינה את שנת הלימודים הכספית…</div>\n          <div className=\"mt-2 text-sm text-muted-foreground\">הניהול ייפתח מיד לאחר הקפאת נתוני השנה הקודמת.</div>\n        </div>\n      </div>\n    );\n  }\n\n  if (financialInitState === 'error') {\n    return (\n      <div className=\"min-h-screen flex items-center justify-center p-6\" dir=\"rtl\">\n        <div className=\"max-w-lg rounded-xl border bg-background p-6 text-center shadow-sm\">\n          <div className=\"font-semibold text-destructive\">סגירת שנת הלימודים לא הושלמה</div>\n          <div className=\"mt-2 text-sm text-muted-foreground\">הניהול נחסם כדי שמחיר או נתוני שנה חדשה לא ישנו את סגירת השנה הקודמת.</div>\n          <div className=\"mt-2 text-xs font-mono\">\${financialInitError}</div>\n          <Button className=\"mt-4\" onClick={() => setFinancialInitRetry(value => value + 1)}>נסי שוב</Button>\n        </div>\n      </div>\n    );\n  }`;
if (!source.includes("financialInitState === 'pending'")) {
  if (!source.includes(guardAnchor)) throw new Error('school-year-close-init: guard anchor not found');
  source = source.replace(guardAnchor, guardBlock);
}

fs.writeFileSync(path, source);
console.log('school-year-close-init patch applied');
