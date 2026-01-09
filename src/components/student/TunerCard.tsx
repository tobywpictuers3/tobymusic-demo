import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TunerEngine, type TunerState, type NoteMeasurement } from "@/lib/tuner/TunerEngine";

function centsColor(cents: number) {
  const abs = Math.abs(cents);
  if (abs <= 5) return "text-emerald-400";
  if (abs <= 15) return "text-yellow-300";
  return "text-red-400";
}

export default function TunerCard() {
  const engine = useMemo(() => new TunerEngine(), []);
  const [state, setState] = useState<TunerState>({ status: "idle" });

  const [notes, setNotes] = useState<
    Array<NoteMeasurement & { id: string; createdAt: number }>
  >([]);

  useEffect(() => {
    engine.setOnState(setState);

    engine.setOnNoteMeasured((m) => {
      setNotes((prev) => [
        { ...m, id: crypto.randomUUID(), createdAt: Date.now() },
        ...prev,
      ]);
    });

    return () => engine.stop();
  }, [engine]);

  const start = async () => {
    // optional: you can tune these if needed (flute sensitivity)
    await engine.start({
      fluteMinHz: 180,
      fluteMaxHz: 2600,
      minClarity: 0.58,
      absoluteMinRms: 0.004,
      rmsFactor: 2.0,
      attackMs: 40,
      releaseMs: 150,
      minNoteMs: 90,
    });
  };

  const stop = () => engine.stop();

  const running = state.status === "running";
  const noSignal = state.status === "no_signal";
  const denied = state.status === "permission_denied";
  const err = state.status === "error";

  return (
    <Card className="border-white/10 bg-black/20">
      <CardHeader>
        <CardTitle className="text-right">טיונר (מיקרופון)</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-right">
            <div className="text-sm text-white/70">סטטוס</div>
            <div className="text-white">
              {state.status === "idle" && "מוכן"}
              {state.status === "starting" && "מבקש הרשאת מיקרופון..."}
              {running && "מזהה תו"}
              {noSignal && "אין אות מספיק חזק"}
              {denied && "אין הרשאה למיקרופון"}
              {err && `שגיאה: ${state.message}`}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={start} disabled={state.status === "starting" || running}>
              התחל
            </Button>
            <Button variant="secondary" onClick={stop} disabled={state.status === "idle"}>
              עצור
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
            <div className="text-sm text-white/70">תו</div>
            <div className="text-3xl text-white font-semibold">
              {running ? state.note : "--"}
            </div>
          </div>

          <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
            <div className="text-sm text-white/70">תדירות</div>
            <div className="text-3xl text-white font-semibold">
              {running ? `${state.hz.toFixed(1)} Hz` : "--"}
            </div>
          </div>

          <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
            <div className="text-sm text-white/70">סטייה (סנטים)</div>
            <div
              className={`text-3xl font-semibold ${
                running ? centsColor(state.cents) : "text-white"
              }`}
            >
              {running ? (state.cents > 0 ? `+${state.cents}` : `${state.cents}`) : "--"}
            </div>
          </div>
        </div>

        {/* Visual needle */}
        <div className="rounded-lg bg-black/25 border border-white/10 p-4">
          <div className="flex justify-between text-xs text-white/60 mb-2">
            <span>-50</span>
            <span>-25</span>
            <span>0</span>
            <span>+25</span>
            <span>+50</span>
          </div>

          <div className="relative h-3 bg-white/10 rounded">
            <div
              className="absolute top-0 h-3 w-[2px] bg-white/70 left-1/2 -translate-x-1/2"
              title="0"
            />
            <div
              className="absolute top-[-10px] h-8 w-[3px] bg-amber-300 rounded"
              style={{
                left: running
                  ? `${50 + Math.max(-50, Math.min(50, state.cents))}%`
                  : "50%",
                transform: "translateX(-50%)",
                transition: "left 80ms linear",
              }}
              title="needle"
            />
          </div>

          <div className="text-right text-xs text-white/60 mt-2">
            טיפ: כדי לקבל זיהוי יציב, נגני תו יחיד חזק ונקי, וקרבי את המיקרופון לכלי.
          </div>
        </div>

        {/* Note length list */}
        <div className="rounded-lg bg-black/25 border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-right">
              <div className="text-sm text-white/70">מדידת אורך צליל</div>
              <div className="text-white">נרשם אוטומטית כשהצליל מתחיל ונגמר</div>
            </div>

            <Button
              variant="secondary"
              onClick={() => setNotes([])}
              disabled={notes.length === 0}
            >
              נקה רשימה
            </Button>
          </div>

          {notes.length === 0 ? (
            <div className="text-right text-white/60 text-sm">עדיין אין תוצאות.</div>
          ) : (
            <div className="space-y-2">
              {notes.slice(0, 20).map((n, idx) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div className="text-white/70 text-sm">#{notes.length - idx}</div>

                  <div className="text-white font-semibold tabular-nums">
                    {n.durationSec.toFixed(2)} שנ׳
                  </div>

                  <div className="text-white/60 text-sm tabular-nums">
                    {typeof n.lastHz === "number" ? `${Math.round(n.lastHz)} Hz` : ""}
                  </div>
                </div>
              ))}
              {notes.length > 20 && (
                <div className="text-right text-white/50 text-xs">
                  מציג 20 אחרונים מתוך {notes.length}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
