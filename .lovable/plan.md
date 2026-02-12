

## תוכנית: עדכון עיצוב כולל -- כרטיסים, כפתורים, טבלאות, אפקטים

### שלב 0: תיקון שגיאת בנייה (קריטי)

**קובץ:** `src/pages/Homepage.tsx` שורה 86

`ASSETS.backgrounds.pianoflute` לא קיים. הנכס הנכון הוא `ASSETS.hero.pianoFlute`. מחליפים את הרקע בדף הבית בהתאם.

---

### שלב 1: כרטיסים -- בורדו-זהב 80% אטימות

**קובץ:** `src/index.css`

עדכון `.card-wine-gold-70` (או יצירת מחלקה חדשה `.card-brand`) עם gradient בורדו-זהב ב-80% אטימות:

```css
.card-brand {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--wine-main) 80%, transparent) 0%,
    color-mix(in srgb, var(--gold-main) 80%, transparent) 100%
  );
  border: 1px solid color-mix(in srgb, var(--gold-main) 50%, transparent);
}
```

החלה על כל Card ברחבי האפליקציה (Homepage, Dashboards).

---

### שלב 2: קומפוננטות ראשיות -- לבן/שחור עם fade לשקיפות

**קובץ:** `src/index.css`

מחלקה חדשה `.section-fade`:

```css
.section-fade {
  background: linear-gradient(
    to bottom,
    hsl(var(--background)) 0%,
    hsl(var(--background) / 0.8) 60%,
    transparent 100%
  );
}
```

כך שהחלק העליון (עם טקסט) אטום, ובסוף הקומפוננטה -- שקיפות מלאה שמגלה את הרקע מאחור.

---

### שלב 3: כפתורים -- צבעי מותג

**קובץ:** `src/index.css`

מחלקות כפתורים חדשות:

```css
.btn-gold {
  background: var(--gold-main);
  color: var(--wine-main);
}
.btn-confirm {
  background: var(--brand-red, #b71c1c);
  color: white;
}
.btn-delete {
  background: var(--wine-main);
  color: white;
}
.btn-edit-theme {
  /* light: black, dark: gold */
  background: black;
  color: white;
}
.dark .btn-edit-theme {
  background: var(--gold-main);
  color: var(--wine-main);
}
```

עדכון כפתורים ב-Homepage (כניסה = gold, כניסה כמנהל = red), AdminDashboard (מחיקה = burgundy, עריכה = theme-aware), StudentDashboard (בהתאם).

---

### שלב 4: ביטול fade בתמונת pianoflute

**קובץ:** `src/components/ui/PageBackground.tsx`

הסרת `maskImage` ו-`WebkitMaskImage` מהרכיב התחתון. התמונה תוצג ללא כל fade -- חתך ישיר.

---

### שלב 5: טבלאות -- gold בבהיר, red בכהה

**קובץ:** `src/index.css`

```css
table, .table-brand {
  background-image: url(...gold...);
}
.dark table, .dark .table-brand {
  background-image: url(...red...);
}
```

מכיוון שה-URL מגיע מ-ASSETS (runtime), נשתמש ב-CSS custom properties שנקבעים ב-JS:

**קובץ:** `src/components/ui/PageBackground.tsx` (או BrandProvider)

הגדרת `--table-bg-light` ו-`--table-bg-dark` כ-CSS variables, ואז בטבלאות:

```css
table {
  background-image: var(--table-bg);
  background-size: cover;
}
```

---

### שלב 6: אפקטים -- גלילה, מעברי עמודים, נצנוץ בריחוף

**קובץ:** `src/index.css`

**נצנוץ בריחוף:**
```css
.hover-sparkle {
  transition: box-shadow 0.3s, transform 0.2s;
}
.hover-sparkle:hover {
  box-shadow: 0 0 20px rgba(230, 182, 92, 0.5),
              0 0 40px rgba(230, 182, 92, 0.3);
  transform: translateY(-2px);
}
```

**אפקט גלילה (scroll reveal):**

מחלקת `.scroll-reveal` עם `opacity: 0; transform: translateY(20px)` שמופעלת עם IntersectionObserver ב-JS. קומפוננטה קטנה `ScrollReveal` שעוטפת תוכן.

**מעברי עמודים:**

עדכון `.fade-slide-in` הקיימת להיות חלקה יותר (0.4s) והחלה על כל `TabsContent` ו-route transitions.

---

### סיכום קבצים

| פעולה | קובץ |
|-------|------|
| עריכה | `src/index.css` -- מחלקות חדשות: card-brand, section-fade, btn-*, hover-sparkle, scroll-reveal, טבלאות |
| עריכה | `src/pages/Homepage.tsx` -- תיקון build error (pianoflute), החלת card-brand, btn-gold/btn-confirm |
| עריכה | `src/components/ui/PageBackground.tsx` -- הסרת mask/fade מ-pianoflute, הוספת CSS vars לטבלאות |
| עריכה | `src/pages/AdminDashboard.tsx` -- החלת card-brand, section-fade, btn-delete/btn-edit-theme, hover-sparkle |
| עריכה | `src/pages/StudentDashboard.tsx` -- החלת card-brand, section-fade, hover-sparkle על כרטיסים |
| יצירה | `src/components/ui/ScrollReveal.tsx` -- wrapper קומפוננטה עם IntersectionObserver לאפקט גלילה |

