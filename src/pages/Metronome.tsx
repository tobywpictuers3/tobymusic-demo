import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import {
  MetronomeEngine,
  type SubdivisionMode,
  type MetronomeSound,
} from "@/lib/metronom/MetronomeEngine";

import {
  TunerEngine,
  type TunerState,
  type NoteMeasurement,
} from "@/lib/tuner/TunerEngine";

/**
 * Helper: safe extraction of beat index from unknown metronome tick event shape.
 * We don't assume exact type because MetronomeEngine implementation may vary.
 */
function extractBeatInBar(e: any): number | null {
  const candidates = [
    e?.beatInBar,
    e?.beat,
    e?.beatIndex,
    e?.currentBeat,
    e?.barBeat,
  ];
  for (const v of candidates) {
    if (typeof v === "number" && isFinite(v)) return v;
  }
  return null;
}

function extractIsMainBeat(e: any): boolean {
  if (typeof e?.isMainBeat === "boolean") return e.isMainBeat;
  // fallback: treat any tick as main if unknown
  return true;
}

const SOUND_LABELS: Record<MetronomeSound, string> = {
  classic_click: "Classic Click",
  woodblock: "Woodblock",
  clave: "Clave",
  rimshot: "Rimshot",
  cowbell: "Cowbell",
  hihat: "Hi-Hat",
  beep_sine: "Beep (Sine)",
  beep_square: "Beep (Square)",
  soft_tick: "Soft Tick",
  digital_pop: "Digital Pop",
};

const SUB_LABELS: Record<SubdivisionMode, string> = {
  quarter: "רבעים",
  eighths: "שמיניות",
  triplets: "שלישיות",
  sixteenths: "שש עשרה",
  swing: "סווינג",
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function Metronome() {
  const [subTab, setSubTab] = useState<"metronome" | "tuner" | "duration">(
    "metronome"
  );

  // ---------------- Metronome engine ----------------
  const m = useMemo(() => MetronomeEngine.getInstance(), []);
  const [mRunning, setMRunning] = useState<boolean>(m.getRunning());
  const [mSettings, setMSettings] = useState(m.getSettings());

  // visual: beat dots & beat number & pendulum swing
  const [beatInBar, setBeatInBar] = useState<number>(1);
  const [blink, setBlink] = useState(false);
  const [swingDir, setSwingDir] = useState<1 | -1>(1);

  // ---------------- Tuner engine (shared for tuner + duration) ----------------
  const t = useMemo(() => new TunerEngine(), []);
  const [tState, setTState] = useState<TunerState>({ status: "idle" });

  const [a4, setA4] = useState<number>(440);

  const [durations, setDurations] = useState<
    Array<NoteMeasurement & { id: string; createdAt: number }>
  >([]);

  // track whether mic is requested to be on (for auto start/stop)
  const micShouldRunRef = useRef(false);

  useEffect(() => {
    // metronome running state
    m.setOnState((running: boolean) => setMRunning(running));

    // metronome tick visual
    m.setOnTick((e: any) => {
      const isMain = extractIsMainBeat(e);
      const b = extractBeatInBar(e);

      if (typeof b === "number") {
        // Some engines provide 0-based, some 1-based; normalize to 1..beatsPerBar
        const normalized =
          b <= 0 ? 1 : b > 64 ? 1 : b; // avoid weird values
        setBeatInBar(normalized);
      }

      if (isMain) {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 90);
        setSwingDir((d) => (d === 1 ? -1 : 1));
      }
    });

    // tuner callbacks
    t.setOnState(setTState);
    t.setOnNoteMeasured((x) => {
      setDurations((prev) => [
        { ...x, id: crypto.randomUUID(), createdAt: Date.now() },
        ...prev,
      ]);
    });

    // ensure local settings sync
    setMSettings(m.getSettings());

    return () => {
      m.setOnState(null as any);
      m.setOnTick(null as any);
      t.stop();
    };
  }, [m, t]);

  // ---------------- Metronome controls ----------------
  const startMetronome = async () => {
    await m.start();
    setMSettings(m.getSettings());
  };

  const stopMetronome = () => {
    m.stop();
    setMSettings(m.getSettings());
  };

  const setBpm = (v: number) => {
    m.setBpm(v, true);
    setMSettings(m.getSettings());
  };

  const setBeatsPerBar = (v: number) => {
    m.setBeatsPerBar(v, true);
    setMSettings(m.getSettings());
    // keep beat index in range
    setBeatInBar((cur) => clamp(cur, 1, v));
  };

  const setAccentEvery = (v: number) => {
    m.setAccentEvery(v, true);
    setMSettings(m.getSettings());
  };

  const setSubdivision = (v: SubdivisionMode) => {
    m.setSubdivision(v, true);
    setMSettings(m.getSettings());
  };

  const setSound = (v: MetronomeSound) => {
    m.setSound(v, true);
    setMSettings(m.getSettings());
  };

  const setVolume = (v: number) => {
    m.setVolume(v, true);
    setMSettings(m.getSettings());
  };

  // ---------------- Mic auto start/stop by sub-tab ----------------
  const startMic = async () => {
    // prevent repeated start calls
    if (tState.status === "starting" || tState.status === "running") return;

    micShouldRunRef.current = true;

    await t.start({
      a4Hz: a4,
      // flute + gating configuration
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

  const stopMic = () => {
    micShouldRunRef.current = false;
    t.stop();
  };

  // when switching tabs:
  // - tuner or duration => mic should run
  // - metronome => mic should stop
  useEffect(() => {
    const wantsMic = subTab === "tuner" || subTab === "duration";

    if (wantsMic) {
      // Tab click is user gesture -> safe to auto-start here
      startMic().catch(() => {});
    } else {
      // leaving mic-related tabs: close mic automatically
      stopMic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  // if A4 changes while mic is running: restart (slider interaction = user gesture)
  useEffect(() => {
    if (tState.status !== "running") return;
    if (!micShouldRunRef.current) return;

    // restart to apply new A4
    (async () => {
      stopMic();
      await startMic();
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a4]);

  // ---------------- Tuner UI helpers ----------------
  const tunerRunning = tState.status === "running";
  const cents = tunerRunning ? tState.cents : 0;
  const centsClamped = clamp(cents, -50, 50);

  const TOL = 5; // allowed cents range
  const inTol = Math.abs(centsClamped) <= TOL;

  // marker position: 0..100
  const markerLeft = 50 + centsClamped;

  const tunerStatusText = (() => {
    if (tState.status === "idle") return "מוכן";
    if (tState.status === "starting") return "מבקש הרשאת מיקרופון…";
    if (tState.status === "running") return "מזהה תו";
    if (tState.status === "no_signal") return "אין אות מספיק חזק/יציב";
    if (tState.status === "permission_denied") return "אין הרשאה למיקרופון";
    if (tState.status === "error") return `שגיאה: ${tState.message}`;
    return "";
  })();

  // ---------------- Duration tab UX tweaks ----------------
  const showMicRetry =
    tState.status === "permission_denied" ||
    tState.status === "error" ||
    tState.status === "idle";

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle className="text-right">העזרים של טובי</CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs
            value={subTab}
            onValueChange={(v) => setSubTab(v as any)}
            className="space-y-6"
          >
            <TabsList className="gap-2">
              <TabsTrigger value="metronome">מטרונום</TabsTrigger>
              <TabsTrigger value="tuner">טיונר</TabsTrigger>
              <TabsTrigger value="duration">מדידת אורך צליל</TabsTrigger>
            </TabsList>

            {/* ===================== METRONOME ===================== */}
            <TabsContent value="metronome" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Controls */}
                <Card className="border-white/10 bg-black/20">
                  <CardHeader>
                    <CardTitle className="text-right">שליטה</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-right">
                        <div className="text-sm text-white/70">סטטוס</div>
                        <div className="text-white">{mRunning ? "פועל" : "מוכן"}</div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={startMetronome} disabled={mRunning}>
                          התחל
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={stopMetronome}
                          disabled={!mRunning}
                        >
                          עצור
                        </Button>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/70">BPM</div>
                        <div className="text-white tabular-nums">{mSettings.bpm}</div>
                      </div>
                      <input
                        type="range"
                        min={40}
                        max={220}
                        value={mSettings.bpm}
                        onChange={(e) => setBpm(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="text-right">
                        <div className="text-sm text-white/70">מספר פעימות בתיבה</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.beatsPerBar}
                          onChange={(e) => setBeatsPerBar(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/70">AccentEvery</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.accentEvery}
                          onChange={(e) => setAccentEvery(Number(e.target.value))}
                        >
                          <option value={0}>ללא</option>
                          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                            <option key={n} value={n}>
                              כל {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/70">חלוקה פנימית</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.subdivision}
                          onChange={(e) =>
                            setSubdivision(e.target.value as SubdivisionMode)
                          }
                        >
                          {Object.keys(SUB_LABELS).map((k) => (
                            <option key={k} value={k}>
                              {SUB_LABELS[k as SubdivisionMode]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/70">סאונד</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.sound}
                          onChange={(e) => setSound(e.target.value as MetronomeSound)}
                        >
                          {Object.keys(SOUND_LABELS).map((k) => (
                            <option key={k} value={k}>
                              {SOUND_LABELS[k as MetronomeSound]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/70">עוצמה</div>
                        <div className="text-white tabular-nums">
                          {Math.round(mSettings.volume * 100)}%
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(mSettings.volume * 100)}
                        onChange={(e) => setVolume(Number(e.target.value) / 100)}
                        className="w-full"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Visual */}
                <Card className="border-white/10 bg-black/20">
                  <CardHeader>
                    <CardTitle className="text-right">תצוגה</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Dots */}
                    <div className="flex items-center justify-between">
                      <div className="text-white/70 text-sm">נקודה</div>
                      <div className="flex items-center gap-2">
                        {Array.from({ length: mSettings.beatsPerBar }).map((_, i) => {
                          const n = i + 1;
                          const active = n === clamp(beatInBar, 1, mSettings.beatsPerBar);
                          return (
                            <div
                              key={n}
                              className={`h-2 w-2 rounded-full ${
                                active ? "bg-amber-300" : "bg-white/20"
                              }`}
                            />
                          );
                        })}
                        <div className="text-white/60 text-sm ml-3">Beat: {clamp(beatInBar, 1, mSettings.beatsPerBar)}</div>
                      </div>
                    </div>

                    {/* Pendulum-style visual */}
                    <div className="rounded-xl border border-white/10 bg-black/20 p-6 flex items-center justify-center">
                      <div className="relative w-[220px] h-[220px] rounded-2xl border border-white/10 bg-black/10 flex items-center justify-center overflow-hidden">
                        <div
                          className="absolute top-6 w-[2px] h-[140px] bg-amber-200/80 origin-top"
                          style={{
                            transform: `rotate(${(blink ? 1 : 0) * 0 + swingDir * 12}deg)`,
                            transition: "transform 90ms ease-out",
                          }}
                        />
                        <div
                          className="absolute top-[150px] w-4 h-4 rounded-full bg-amber-200/90"
                          style={{
                            left: "50%",
                            transform: `translateX(-50%) translateX(${swingDir * 20}px)`,
                            transition: "transform 90ms ease-out",
                          }}
                        />
                        <div className="absolute bottom-6 text-white/70 text-sm">
                          {mRunning ? "מטרונום פועל" : "לחצי התחל"}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs text-white/50">
                      טיפ: הפעלה/עצירה חייבת להיות בלחיצה כדי שה-AudioContext יעבוד יציב.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ===================== TUNER ===================== */}
            <TabsContent value="tuner" className="space-y-6">
              <Card className="border-white/10 bg-black/20">
                <CardHeader>
                  <CardTitle className="text-right">טיונר</CardTitle>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Master tuning (A4) */}
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-white/70 text-sm text-right">כיוון מאסטר (A4)</div>
                      <div className="text-white tabular-nums">{a4}Hz</div>
                    </div>
                    <input
                      type="range"
                      min={430}
                      max={450}
                      value={a4}
                      onChange={(e) => setA4(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="text-right text-xs text-white/50">
                      טווח מקובל: 440Hz (אפשר לשנות לפי כלי/הרכב).
                    </div>
                  </div>

                  {/* Status + mic */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                      <div className="text-sm text-white/70">סטטוס</div>
                      <div className="text-white">{tunerStatusText}</div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={startMic}
                        disabled={tState.status === "starting" || tState.status === "running"}
                      >
                        הפעל מיקרופון
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={stopMic}
                        disabled={tState.status === "idle"}
                      >
                        סגור מיקרופון
                      </Button>
                    </div>
                  </div>

                  {/* Readouts */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">תו</div>
                      <div className="text-3xl text-white font-semibold">
                        {tunerRunning ? tState.note : "--"}
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">תדירות</div>
                      <div className="text-3xl text-white font-semibold">
                        {tunerRunning ? `${tState.hz.toFixed(1)} Hz` : "--"}
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">סטייה (cents)</div>
                      <div
                        className={`text-3xl font-semibold ${
                          tunerRunning
                            ? inTol
                              ? "text-emerald-400"
                              : "text-red-400"
                            : "text-white"
                        }`}
                      >
                        {tunerRunning ? (cents > 0 ? `+${cents}` : `${cents}`) : "--"}
                      </div>
                    </div>
                  </div>

                  {/* Digital tuner meter: green allowed range, red forbidden */}
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2">
                    <div className="flex justify-between text-xs text-white/60">
                      <span>-50</span>
                      <span>-25</span>
                      <span>0</span>
                      <span>+25</span>
                      <span>+50</span>
                    </div>

                    <div className="relative h-4 rounded bg-white/10 overflow-hidden">
                      {/* allowed (green) center zone */}
                      <div
                        className="absolute top-0 h-4 bg-emerald-500/25"
                        style={{
                          left: `${50 - TOL}%`,
                          width: `${TOL * 2}%`,
                        }}
                      />
                      {/* center line */}
                      <div className="absolute top-0 h-4 w-[2px] bg-white/70 left-1/2 -translate-x-1/2" />

                      {/* marker */}
                      <div
                        className={`absolute top-[-6px] h-7 w-[3px] rounded ${
                          tunerRunning
                            ? inTol
                              ? "bg-emerald-400"
                              : "bg-red-400"
                            : "bg-white/50"
                        }`}
                        style={{
                          left: `${markerLeft}%`,
                          transform: "translateX(-50%)",
                          transition: "left 80ms linear",
                        }}
                      />
                    </div>

                    <div className="text-right text-xs text-white/50">
                      ירוק = בתחום המותר (±{TOL} סנט). אדום = מחוץ לתחום.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===================== DURATION ===================== */}
            <TabsContent value="duration" className="space-y-6">
              <Card className="border-white/10 bg-black/20">
                <CardHeader>
                  <CardTitle className="text-right">מדידת אורך צליל</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* No long mic instructions. Auto-start on entering tab. No stop button. */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                      <div className="text-sm text-white/70">מצב</div>
                      <div className="text-white">
                        {tState.status === "starting" && "מבקש הרשאת מיקרופון…"}
                        {tState.status === "running" && "מקשיב ומודד אוטומטית"}
                        {tState.status === "no_signal" && "ממתין לצליל יציב"}
                        {tState.status === "idle" && "מוכן למדידה"}
                        {tState.status === "permission_denied" && "אין הרשאה למיקרופון"}
                        {tState.status === "error" && `שגיאה: ${tState.message}`}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {/* Only show retry button if needed */}
                      {showMicRetry && (
                        <Button onClick={startMic}>הפעל מיקרופון</Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => setDurations([])}
                        disabled={durations.length === 0}
                      >
                        נקה רשימה
                      </Button>
                    </div>
                  </div>

                  {durations.length === 0 ? (
                    <div className="text-right text-white/60 text-sm">
                      עדיין אין תוצאות.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {durations.slice(0, 30).map((n, idx) => (
                        <div
                          key={n.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2"
                        >
                          <div className="text-white/70 text-sm">#{durations.length - idx}</div>
                          <div className="text-white font-semibold tabular-nums">
                            {n.durationSec.toFixed(2)} שנ׳
                          </div>
                          <div className="text-white/60 text-sm tabular-nums">
                            {typeof n.lastHz === "number" ? `${Math.round(n.lastHz)} Hz` : ""}
                          </div>
                        </div>
                      ))}
                      {durations.length > 30 && (
                        <div className="text-right text-white/50 text-xs">
                          מציג 30 אחרונים מתוך {durations.length}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-right text-xs text-white/50">
                    המיקרופון נסגר אוטומטית כשעוברים ללשונית אחרת.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
