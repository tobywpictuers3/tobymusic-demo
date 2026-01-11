import { useMemo, useState } from "react";
import Homepage from "./Homepage";
import baseContent from "@/content/site.he.json";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const STORAGE_KEY = "toby_site_he_override_v1";

type AnyObj = Record<string, any>;

function deepSet(obj: AnyObj, path: string, value: any) {
  const keys = path.split(".");
  let curr: AnyObj = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof curr[k] !== "object" || curr[k] === null) curr[k] = {};
    curr = curr[k];
  }
  curr[keys[keys.length - 1]] = value;
}

export default function ContentEditor() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const initial = saved ? JSON.parse(saved) : baseContent;

  const [content, setContent] = useState<AnyObj>(initial);

  const t = content.homepage;

  const previewContent = useMemo(() => content, [content]);

  const update = (path: string, value: any) => {
    setContent((prev) => {
      const copy = structuredClone(prev);
      deepSet(copy, path, value);
      return copy;
    });
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
    alert("נשמר מקומית ✅ עכשיו פתחי את דף הבית ותראי את השינוי");
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setContent(baseContent as AnyObj);
    alert("חזר לברירת מחדל ✅");
  };

  const exportJson = async () => {
    const pretty = JSON.stringify(content, null, 2);
    await navigator.clipboard.writeText(pretty);
    alert("ה־JSON הועתק ללוח ✅ אפשר להדביק בקובץ site.he.json בגיטהאב/לוואבל");
  };

  return (
    <div className="h-screen grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
      {/* Preview */}
      <div className="border rounded-xl overflow-auto bg-black/20">
        {/* NOTE: Homepage currently imports baseContent.
            If you want live preview to reflect edits, we’ll do step 4 below (small change). */}
        <Homepage />
      </div>

      {/* Editor */}
      <div className="border rounded-xl p-4 overflow-auto space-y-5 bg-black/30">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">עריכת דף הבית (Preview + עריכה)</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportJson}>העתק JSON</Button>
            <Button variant="outline" onClick={reset}>איפוס</Button>
            <Button onClick={save}>שמור מקומית</Button>
          </div>
        </div>

        {/* Logo */}
        <div className="space-y-2">
          <div className="font-semibold">לוגו</div>
          <Input
            value={t.logo?.src ?? ""}
            onChange={(e) => update("homepage.logo.src", e.target.value)}
            placeholder="נתיב תמונה (src)"
          />
          <Input
            value={t.logo?.alt ?? ""}
            onChange={(e) => update("homepage.logo.alt", e.target.value)}
            placeholder="alt"
          />
        </div>

        {/* Hero */}
        <div className="space-y-2">
          <div className="font-semibold">כותרת ופסקאות</div>
          <Input
            value={t.hero?.title ?? ""}
            onChange={(e) => update("homepage.hero.title", e.target.value)}
            placeholder="כותרת"
          />
          <Textarea
            value={(t.hero?.paragraphs ?? []).join("\n")}
            onChange={(e) =>
              update("homepage.hero.paragraphs", e.target.value.split("\n"))
            }
            placeholder="פסקאות (שורה לכל פסקה)"
            className="min-h-[140px]"
          />
        </div>

        {/* Contact */}
        <div className="space-y-2">
          <div className="font-semibold">פרטי קשר</div>
          <Input
            value={t.contact?.email ?? ""}
            onChange={(e) => update("homepage.contact.email", e.target.value)}
            placeholder="מייל"
          />
          <Input
            value={t.contact?.phone ?? ""}
            onChange={(e) => update("homepage.contact.phone", e.target.value)}
            placeholder="טלפון"
          />
          <Input
            value={t.contact?.whatsapp ?? ""}
            onChange={(e) => update("homepage.contact.whatsapp", e.target.value)}
            placeholder="וואטסאפ טלפוני"
          />
        </div>

        {/* Signature */}
        <div className="space-y-2">
          <div className="font-semibold">חתימה</div>
          <Input
            value={t.signature?.bye ?? ""}
            onChange={(e) => update("homepage.signature.bye", e.target.value)}
            placeholder="שורת פתיחה"
          />
          <Input
            value={t.signature?.name ?? ""}
            onChange={(e) => update("homepage.signature.name", e.target.value)}
            placeholder="שם"
          />
          <Input
            value={t.signature?.slogan ?? ""}
            onChange={(e) => update("homepage.signature.slogan", e.target.value)}
            placeholder="סלוגן"
          />
        </div>
      </div>
    </div>
  );
}
