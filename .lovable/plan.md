

## ניתוח בעיית סנכרון נתונים ותוכנית תיקון

### הבעיה שזוהתה

**שורש הבעיה:** כשקוראים ל-`hybridSync.onDataChange()` בלי `await`, הקריאה מתחילה סנכרון אסינכרוני. אם קריאה שנייה מגיעה בזמן שהראשונה עדיין פעילה, היא נדחית בשקט (שורה 496-498: `if (this.isSyncingInternal) return false`). הנתונים נשארים בזיכרון אבל לא עולים לענן.

**תרחיש לדוגמה:**
1. מעדכנים תשלום → `onDataChange()` מתחיל סנכרון (download + merge + upload = ~2-4 שניות)
2. תוך שנייה מעדכנים חופשה → `onDataChange()` נקרא שוב → `isSyncingInternal=true` → **נדחה בשקט**
3. רענון דף → החופשה לא קיימת כי לא עלתה לענן

**היקף:** ~30 פונקציות כתיבה קוראות `hybridSync.onDataChange()` בלי await, כולל: תשלומים, שיעורים, חופשות, ביצועים, חנות, ועוד.

---

### תוכנית תיקון

#### שלב 1: הוספת מנגנון debounce עם סנכרון מובטח

**קובץ:** `src/lib/hybridSync.ts`

במקום לחסום קריאות נוספות, נוסיף מנגנון debounce שמבטיח שסנכרון אחרון תמיד יתבצע:

- כל קריאה ל-`onDataChange()` תסמן `pendingSync = true`
- אם סנכרון כבר רץ, לא נדחה — רק נסמן שצריך סנכרון נוסף
- בסוף כל סנכרון, נבדוק אם `pendingSync = true` ונריץ סנכרון נוסף
- זה מבטיח שהמצב האחרון בזיכרון תמיד יעלה לענן

```text
onDataChange() called
  ├── sync NOT running → start sync, set pendingSync=false
  │     └── sync done → check pendingSync?
  │           ├── yes → run sync again (with latest data)
  │           └── no  → done
  └── sync IS running → set pendingSync=true (don't drop!)
```

#### שלב 2: הוספת דיליי קצר (debounce 500ms)

למניעת סנכרונים מיותרים כשיש פעולות מהירות ברצף (למשל עדכון כמה שדות), נוסיף debounce של 500ms:

- כל קריאה ל-`onDataChange()` מאפסת טיימר של 500ms
- הסנכרון האמיתי מתבצע אחרי 500ms ללא קריאה נוספת
- זה חוסך קריאות רשת מיותרות בלי לסכן אובדן נתונים

#### שלב 3: עדכון `beforeunload` לבדיקת dirty state

אם המשתמשת סוגרת דפדפן בזמן שיש debounce ממתין — ננסה `sendBeacon` אחרון.

---

### פרטים טכניים

**קובץ שישתנה:** `src/lib/hybridSync.ts` בלבד

שינויים ב-`syncToWorker()`:
- הסרת `return false` כש-`isSyncingInternal=true`
- הוספת `private pendingResync = false`
- בלוק finally: `if (this.pendingResync) { this.pendingResync = false; await this.syncToWorker(); }`

שינויים ב-`onDataChange()`:
- הוספת `private debounceTimer: ReturnType<typeof setTimeout> | null`
- עטיפת הקריאה ל-`syncToWorker()` ב-debounce של 500ms
- Promise חדש שמחזיר תוצאה אחרי שהסנכרון באמת מסתיים

**לא נדרש שינוי** ב-`storage.ts` — כל הפונקציות הקיימות ימשיכו לקרוא `hybridSync.onDataChange()` כרגיל, והמנגנון החדש ידאג שהסנכרון האחרון תמיד יתבצע.

### סיכום

| קובץ | שינוי |
|---|---|
| `src/lib/hybridSync.ts` | debounce 500ms + pending-resync loop שמבטיח סנכרון אחרון |

