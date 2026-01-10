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

/** ---------- helpers ---------- */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function pctFromX(x: number) {
  // x in [-1..1] -> pct in [0..100]
  return ((x + 1) / 2) * 100;
}
function extractBeatInBar(e: any): number | null {
  const candidates = [e?.beatInBar, e?.beat, e?.beatIndex, e?.currentBeat, e?.barBeat];
  for (const v of candidates) {
    if (typeof v === "number" && isFinite(v)) return v;
  }
  return null;
}
function extractIsMainBeat(e: any): boolean | null {
  if (typeof e?.isMainBeat === "boolean") return e.isMainBeat;
  return null;
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

function centsColorClass(cents: number, tol = 5) {
  return Math.abs(cents) <= tol ? "text-emerald-400" : "text-red-400";
}

/** ---------- Pendulum Visual (professional) ---------- */
function PendulumVisual(props: {
  running: boolean;
  bpm: number;
  beatsPerBar: number;
  beatInBar: number;
  // tick pulses
  lastHit: { side: -1 | 1; isMain: boolean; id: number };
}) {
  const { running, bpm, beatsPerBar, beatInBar, lastHit } = props;

  // animation model:
  // each beat is a travel from one wall to the other:
  // x(t) = startSide * cos(pi * t/beatMs)
  const beatMs = 60000 / clamp(bpm, 20, 400);

  const startSideRef = useRef<1 | -1>(1); // side at the moment of a beat "hit"
  const t0Ref = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  const [x, setX] = useState<number>(1); // [-1..1]

  // when a hit occurs, we reset the beat segment so the motion starts exactly at the wall
  useEffect(() => {
    startSideRef.current = lastHit.side;
    t0Ref.current = performance.now();
    // snap to wall instantly
    setX(lastHit.side);
  }, [lastHit]);

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const loop = () => {
      const now = performance.now();
      const elapsed = now - t0Ref.current;

      // progress inside current beat travel
      const p = clamp(elapsed / beatMs, 0, 1);
      const side = startSideRef.current;

      // smooth pendulum: cos curve
      const nx = side * Math.cos(Math.PI * p);
      setX(nx);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, beatMs]);

  const posPct = pctFromX(x);

  // trail: from start wall to current position (behind the bob)
  const startSide = startSideRef.current;
  const trailLeft = startSide === 1 ? posPct : 0;
  const trailWidth = startSide === 1 ? 100 - posPct : posPct;

  const burstColor = lastHit.isMain ? "rgba(255,45,75,0.95)" : "rgba(244,189,86,0.92)";
  const burstGlow = lastHit.isMain ? "rgba(255,45,75,0.55)" : "rgba(244,189,86,0.50)";

  const leftWallGlow = lastHit.side === -1 ? burstGlow : "rgba(255,255,255,0.06)";
  const rightWallGlow = lastHit.side === 1 ? burstGlow : "rgba(255,255,255,0.06)";

  return (
    <div className="space-y-4">
      {/* beat dots */}
      <div className="flex items-center justify-between">
        <div className="text-white/70 text-sm">תצוגה</div>
        <div className="flex items-center gap-2">
          {Array.from({ length: beatsPerBar }).map((_, i) => {
            const n = i + 1;
            const active = n === clamp(beatInBar, 1, beatsPerBar);
            return (
              <div
                key={n}
                className={`h-2 w-2 rounded-full ${
                  active ? "bg-amber-300" : "bg-white/20"
                }`}
              />
            );
          })}
          <div className="text-white/60 text-sm ml-3">Beat: {clamp(beatInBar, 1, beatsPerBar)}</div>
        </div>
      </div>

      {/* pendulum stage */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <div className="relative h-[220px] rounded-2xl border border-white/10 bg-black/10 overflow-hidden">
          {/* walls */}
          <div
            className="absolute left-4 top-6 bottom-6 w-[10px] rounded-full"
            style={{
              background:
                `linear-gradient(180deg, rgba(255,255,255,0.06), ${leftWallGlow}, rgba(255,255,255,0.06))`,
              boxShadow: `0 0 18px ${leftWallGlow}`,
            }}
          />
          <div
            className="absolute right-4 top-6 bottom-6 w-[10px] rounded-full"
            style={{
              background:
                `linear-gradient(180deg, rgba(255,255,255,0.06), ${rightWallGlow}, rgba(255,255,255,0.06))`,
              boxShadow: `0 0 18px ${rightWallGlow}`,
            }}
          />

          {/* track */}
          <div className="absolute left-10 right-10 top-[54px] h-[2px] bg-white/10" />

          {/* trail (path) */}
          <div
            className="absolute top-[53px] h-[4px] rounded-full"
            style={{
              left: `calc(10px + ${trailLeft}%)`,
              width: `calc(${trailWidth}% - 0px)`,
              background: "linear-gradient(90deg, rgba(244,189,86,0.0), rgba(244,189,86,0.45))",
              filter: "blur(0.2px)",
            }}
          />

          {/* pivot point */}
          <div className="absolute left-1/2 top-[24px] -translate-x-1/2 h-2 w-2 rounded-full bg-white/30" />

          {/* rod + bob */}
          <div
            className="absolute top-[24px]"
            style={{
              left: `calc(10px + ${posPct}%)`,
              transform: "translateX(-50%)",
              transition: running ? "none" : "left 180ms ease",
            }}
          >
            {/* rod */}
            <div
              className="mx-auto w-[2px] h-[120px]"
              style={{
                background: "linear-gradient(180deg, rgba(244,189,86,0.85), rgba(244,189,86,0.15))",
                boxShadow: "0 0 10px rgba(244,189,86,0.25)",
              }}
            />
            {/* bob */}
            <div
              className="mx-auto mt-[-2px] h-5 w-5 rounded-full"
              style={{
                background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(244,189,86,0.95))",
                boxShadow: "0 0 18px rgba(244,189,86,0.35)",
              }}
            />
          </div>

          {/* burst on hit (wide explosion) */}
          <div
            key={lastHit.id}
            className="absolute top-[35px] h-[80px] w-[80px] rounded-full pointer-events-none"
            style={{
              left: lastHit.side === -1 ? "22px" : "calc(100% - 22px)",
              transform: "translateX(-50%)",
              background: `radial-gradient(circle, ${burstColor} 0%, rgba(255,255,255,0.0) 65%)`,
              animation: "tobyBurst 220ms ease-out",
              filter: "blur(0.2px)",
            }}
          />

          {/* caption */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {running ? "הקשיבי לתנועה — היא חלק מהמקצב" : "לחצי “התחל” כדי לראות תנועה"}
          </div>
        </div>
      </div>

      {/* local keyframes */}
      <style>{`
        @keyframes tobyBurst {
          0% { transform: translateX(-50%) scale(0.4); opacity: 0.0; }
          25% { opacity: 1.0; }
          100% { transform: translateX(-50%) scale(1.25); opacity: 0.0; }
        }
      `}</style>
    </div>
  );
}

export default function Metronome() {
  const [subTab, setSubTab] = useState<"metronome" | "tuner" | "duration">("metronome");

  // ---------------- Metronome engine ----------------
  const m = useMemo(() => MetronomeEngine.getInstance(), []);
  const [mRunning, setMRunning] = useState<boolean>(m.getRunning());
  const [mSettings, setMSettings] = useState(m.getSettings());
  const [beatInBar, setBeatInBar] = useState<number>(1);

  // pendulum hit pulse info
  const hitIdRef = useRef(0);
  const [lastHit, setLastHit] = useState<{ side: -1 | 1; isMain: boolean; id: number }>({
    side: 1,
    isMain: true,
    id: 0,
  });

  // alternate sides each beat hit (right->left->right...)
  const hitSideRef = useRef<1 | -1>(1);

  useEffect(() => {
    m.setOnState((running: boolean) => setMRunning(running));

    m.setOnTick((e: any) => {
      const b = extractBeatInBar(e);
      if (typeof b === "number") {
        // normalize: many engines report 1..N; keep it safe
        setBeatInBar(clamp(Math.round(b), 1, m.getSettings().beatsPerBar));
      }

      const explicitMain = extractIsMainBeat(e);
      // if engine doesn't provide isMainBeat: define main beat as beatInBar==1
      const main = explicitMain ?? (b === 1);

      // "hit" is on the wall at the start of each beat.
      // alternate wall each beat
      const side = hitSideRef.current;
      hitSideRef.current = (hitSideRef.current === 1 ? -1 : 1);

      hitIdRef.current += 1;
      setLastHit({ side, isMain: !!main, id: hitIdRef.current });
    });

    setMSettings(m.getSettings());

    return () => {
      m.setOnState(null as any);
      m.setOnTick(null as any);
    };
  }, [m]);

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

  // ---------------- Tuner engine (shared for tuner + duration) ----------------
  const t = useMemo(() => new TunerEngine(), []);
  const [tState, setTState] = useState<TunerState>({ status: "idle" });
  const [a4, setA4] = useState<number>(440);
  const [durations, setDurations] = useState<Array<NoteMeasurement & { id: string; createdAt: number }>>([]);

  const micShouldRunRef = useRef(false);

  useEffect(() => {
    t.setOnState(setTState);
    t.setOnNoteMeasured((x) => {
      setDurations((prev) => [{ ...x, id: crypto.randomUUID(), createdAt: Date.now() }, ...prev]);
    });
    return () => t.stop();
  }, [t]);

  const startMic = async () => {
    if (tState.status === "starting" || tState.status === "running") return;
    micShouldRunRef.current = true;

    await t.start({
      a4Hz: a4,
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

  useEffect(() => {
    const wantsMic = subTab === "tuner" || subTab === "duration";
    if (wantsMic) {
      startMic().catch(() => {});
    } else {
      stopMic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  useEffect(() => {
    if (tState.status !== "running") return;
    if (!micShouldRunRef.current) return;

    (async () => {
      stopMic();
      await startMic();
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a4]);

  const tunerRunning = tState.status === "running";
  const cents = tunerRunning ? tState.cents : 0;
  const centsClamped = clamp(cents, -50, 50);
  const TOL = 5;
  const inTol = Math.abs(centsClamped) <= TOL;
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
          <Tabs value={subTab} onValueChange={(v) => setSubTab(v as any)} className="space-y-6">
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
                        <Button variant="secondary" onClick={stopMetronome} disabled={!mRunning}>
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
                          onChange={(e) => setSubdivision(e.target.value as SubdivisionMode)}
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
                        <div className="text-white tabular-nums">{Math.round(mSettings.volume * 100)}%</div>
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
                    <CardTitle className="text-right">מראה ויזואלי</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PendulumVisual
                      running={mRunning}
                      bpm={mSettings.bpm}
                      beatsPerBar={mSettings.beatsPerBar}
                      beatInBar={beatInBar}
                      lastHit={lastHit}
                    />
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
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                      <div className="text-sm text-white/70">סטטוס</div>
                      <div className="text-white">{tunerStatusText}</div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={startMic} disabled={tState.status === "starting" || tState.status === "running"}>
                        הפעל מיקרופון
                      </Button>
                      <Button variant="secondary" onClick={stopMic} disabled={tState.status === "idle"}>
                        סגור מיקרופון
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">תו</div>
                      <div className="text-3xl text-white font-semibold">{tunerRunning ? tState.note : "--"}</div>
                    </div>

                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">תדירות</div>
                      <div className="text-3xl text-white font-semibold">
                        {tunerRunning ? `${tState.hz.toFixed(1)} Hz` : "--"}
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">סטייה (cents)</div>
                      <div className={`text-3xl font-semibold ${tunerRunning ? (inTol ? "text-emerald-400" : "text-red-400") : "text-white"}`}>
                        {tunerRunning ? (cents > 0 ? `+${cents}` : `${cents}`) : "--"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2">
                    <div className="flex justify-between text-xs text-white/60">
                      <span>-50</span><span>-25</span><span>0</span><span>+25</span><span>+50</span>
                    </div>

                    <div className="relative h-4 rounded bg-white/10 overflow-hidden">
                      <div
                        className="absolute top-0 h-4 bg-emerald-500/25"
                        style={{ left: `${50 - 5}%`, width: `${10}%` }}
                      />
                      <div className="absolute top-0 h-4 w-[2px] bg-white/70 left-1/2 -translate-x-1/2" />
                      <div
                        className={`absolute top-[-6px] h-7 w-[3px] rounded ${tunerRunning ? (inTol ? "bg-emerald-400" : "bg-red-400") : "bg-white/50"}`}
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
                      {showMicRetry && <Button onClick={startMic}>הפעל מיקרופון</Button>}
                      <Button variant="secondary" onClick={() => setDurations([])} disabled={durations.length === 0}>
                        נקה רשימה
                      </Button>
                    </div>
                  </div>

                  {durations.length === 0 ? (
                    <div className="text-right text-white/60 text-sm">עדיין אין תוצאות.</div>
                  ) : (
                    <div className="space-y-2">
                      {durations.slice(0, 30).map((n, idx) => (
                        <div key={n.id} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
                          <div className="text-white/70 text-sm">#{durations.length - idx}</div>
                          <div className="text-white font-semibold tabular-nums">{n.durationSec.toFixed(2)} שנ׳</div>
                          <div className="text-white/60 text-sm tabular-nums">
                            {typeof n.lastHz === "number" ? `${Math.round(n.lastHz)} Hz` : ""}
                          </div>
                        </div>
                      ))}
                      {durations.length > 30 && (
                        <div className="text-right text-white/50 text-xs">מציג 30 אחרונים מתוך {durations.length}</div>
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
