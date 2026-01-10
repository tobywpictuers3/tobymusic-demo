import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MetronomeEngine, type SubdivisionMode, type MetronomeSound } from "@/lib/metronom/MetronomeEngine";
import { TunerEngine, type TunerState, type NoteMeasurement } from "@/lib/tuner/TunerEngine";

/** ---------- helpers ---------- */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function extractBeatInBar(e: any): number | null {
  const candidates = [e?.beatInBar, e?.beat, e?.beatIndex, e?.currentBeat, e?.barBeat];
  for (const v of candidates) if (typeof v === "number" && isFinite(v)) return v;
  return null;
}
function subdivCount(mode: SubdivisionMode): number {
  switch (mode) {
    case "quarter": return 1;
    case "eighths": return 2;
    case "triplets": return 3;
    case "sixteenths": return 4;
    case "swing": return 2;
    default: return 1;
  }
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

type HitEvent =
  | { kind: "main"; side: -1 | 1; isDownbeat: boolean; id: number }
  | { kind: "sub"; id: number };

function PendulumVisual(props: {
  running: boolean;
  bpm: number;
  beatsPerBar: number;
  beatInBar: number;
  subdivision: SubdivisionMode;
  hit: HitEvent;
}) {
  const { running, bpm, beatsPerBar, beatInBar, subdivision, hit } = props;

  // virtual stage
  const W = 520;
  const H = 260;

  const pivotX = W / 2;
  const pivotY = 26;

  const wallPad = 26;
  const wallThickness = 10;

  // IMPORTANT: wall face X is where collision happens
  const leftWallFaceX = wallPad + wallThickness;                 // inner face
  const rightWallFaceX = W - (wallPad + wallThickness);          // inner face

  const rodLen = 185;
  const dx = pivotX - leftWallFaceX; // equals rightWallFaceX - pivotX

  const ratio = clamp(dx / rodLen, 0, 0.999);
  const maxAngle = Math.asin(ratio); // ensures bob touches wall face exactly

  const beatMs = 60000 / clamp(bpm, 20, 400);

  const startSideRef = useRef<1 | -1>(1);
  const t0Ref = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  const angleRef = useRef<number>(maxAngle);
  const [angle, setAngle] = useState<number>(maxAngle);

  // canvas trail (only this beat)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [burst, setBurst] = useState<{
    x: number;
    y: number;
    isDownbeat: boolean;
    id: number;
  } | null>(null);

  const [subPulse, setSubPulse] = useState<{ id: number } | null>(null);

  function bobPos(a: number) {
    return {
      x: pivotX + Math.sin(a) * rodLen,
      y: pivotY + Math.cos(a) * rodLen,
    };
  }

  function clearTrail() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    lastPointRef.current = null;
  }

  // tick events
  useEffect(() => {
    if (hit.kind === "main") {
      startSideRef.current = hit.side;
      t0Ref.current = performance.now();

      const snap = hit.side * maxAngle;
      angleRef.current = snap;
      setAngle(snap);

      // reset trail exactly on each beat
      clearTrail();

      // burst must be ON THE WALL FACE at the bob Y
      const p = bobPos(snap);
      const wallX = hit.side === 1 ? rightWallFaceX : leftWallFaceX;

      setBurst({
        x: wallX,
        y: p.y,
        isDownbeat: hit.isDownbeat,
        id: hit.id,
      });
    } else {
      // subdivision: pulse the weight only (no burst)
      setSubPulse({ id: hit.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hit]);

  // animation + trail drawing
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const loop = () => {
      const now = performance.now();
      const p = clamp((now - t0Ref.current) / beatMs, 0, 1);

      // smooth travel wall->wall
      const side = startSideRef.current;
      const a = side * Math.cos(Math.PI * p) * maxAngle;

      angleRef.current = a;
      setAngle(a);

      // draw trail segment (only this beat)
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx) {
          const pt = bobPos(a);
          const prev = lastPointRef.current;

          if (prev) {
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(pt.x, pt.y);
            ctx.lineWidth = 6;
            ctx.lineCap = "round";
            ctx.strokeStyle = "rgba(244,189,86,0.45)";
            ctx.shadowColor = "rgba(244,189,86,0.55)";
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.shadowBlur = 0;
          } else {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(244,189,86,0.55)";
            ctx.fill();
          }

          lastPointRef.current = pt;
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, beatMs, maxAngle]);

  useEffect(() => {
    if (!running) clearTrail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const p = bobPos(angle);

  const burstCore = burst?.isDownbeat ? "rgba(255,45,75,0.95)" : "rgba(244,189,86,0.95)";
  const burstGlow = burst?.isDownbeat ? "rgba(255,45,75,0.55)" : "rgba(244,189,86,0.55)";

  const showSub = subdivCount(subdivision) > 1;

  return (
    <div className="space-y-4">
      {/* beat dots */}
      <div className="flex items-center justify-between">
        <div className="text-white/70 text-sm">תצוגה</div>
        <div className="flex items-center gap-2">
          {Array.from({ length: beatsPerBar }).map((_, i) => {
            const n = i + 1;
            const active = n === clamp(beatInBar, 1, beatsPerBar);
            const down = n === 1;
            return (
              <div
                key={n}
                className={`h-2 w-2 rounded-full ${
                  active ? (down ? "bg-red-400" : "bg-amber-300") : "bg-white/20"
                }`}
              />
            );
          })}
          <div className="text-white/60 text-sm ml-3">
            Beat: {clamp(beatInBar, 1, beatsPerBar)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <div className="relative h-[260px] rounded-2xl border border-white/10 bg-black/10 overflow-hidden">
          {/* Trail */}
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="absolute inset-0 w-full h-full"
          />

          {/* SVG overlay (rod + weight + walls + burst) */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
          >
            <defs>
              <radialGradient id="weightGrad" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                <stop offset="55%" stopColor="rgba(244,189,86,0.98)" />
                <stop offset="100%" stopColor="rgba(244,189,86,0.65)" />
              </radialGradient>
              <radialGradient id="burstGradRed" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,45,75,0.95)" />
                <stop offset="60%" stopColor="rgba(255,45,75,0.20)" />
                <stop offset="100%" stopColor="rgba(255,45,75,0.0)" />
              </radialGradient>
              <radialGradient id="burstGradGold" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(244,189,86,0.95)" />
                <stop offset="60%" stopColor="rgba(244,189,86,0.20)" />
                <stop offset="100%" stopColor="rgba(244,189,86,0.0)" />
              </radialGradient>
            </defs>

            {/* walls (NO constant glow) */}
            <rect
              x={wallPad}
              y={22}
              width={wallThickness}
              height={H - 44}
              rx={5}
              fill="rgba(255,255,255,0.10)"
            />
            <rect
              x={W - wallPad - wallThickness}
              y={22}
              width={wallThickness}
              height={H - 44}
              rx={5}
              fill="rgba(255,255,255,0.10)"
            />

            {/* pivot */}
            <circle cx={pivotX} cy={pivotY} r={5} fill="rgba(255,255,255,0.22)" />

            {/* rod */}
            <line
              x1={pivotX}
              y1={pivotY}
              x2={p.x}
              y2={p.y}
              stroke="rgba(244,189,86,0.85)"
              strokeWidth={2.2}
              strokeLinecap="round"
            />

            {/* weight (main object) */}
            <g>
              {/* weight body */}
              <circle
                cx={p.x}
                cy={p.y}
                r={13}
                fill="url(#weightGrad)"
                className={showSub && subPulse ? "tobyWeightPulse" : ""}
              />
              {/* small cap highlight */}
              <circle
                cx={p.x - 4}
                cy={p.y - 5}
                r={4}
                fill="rgba(255,255,255,0.18)"
                className={showSub && subPulse ? "tobyWeightPulse" : ""}
              />
            </g>

            {/* burst at wall contact ONLY on main beat */}
            {burst && (
              <g key={burst.id}>
                <circle
                  cx={burst.x}
                  cy={burst.y}
                  r={70}
                  fill={burst.isDownbeat ? "url(#burstGradRed)" : "url(#burstGradGold)"}
                  style={{ animation: "tobyBurst 220ms ease-out" }}
                />
                {/* extra glow */}
                <circle
                  cx={burst.x}
                  cy={burst.y}
                  r={34}
                  fill="transparent"
                  stroke={burstCore}
                  strokeOpacity={0.55}
                  strokeWidth={2}
                  style={{ filter: `drop-shadow(0 0 18px ${burstGlow})`, animation: "tobyBurst 220ms ease-out" }}
                />
              </g>
            )}
          </svg>

          <style>{`
            @keyframes tobyBurst {
              0% { transform: scale(0.55); opacity: 0; }
              20% { opacity: 1; }
              100% { transform: scale(1.25); opacity: 0; }
            }
            .tobyWeightPulse {
              animation: tobyPulse 140ms ease-out;
              filter: drop-shadow(0 0 14px rgba(244,189,86,0.60));
            }
            @keyframes tobyPulse {
              0% { transform: scale(0.96); opacity: 0.75; }
              40% { transform: scale(1.06); opacity: 1; }
              100% { transform: scale(1.00); opacity: 1; }
            }
          `}</style>
        </div>
      </div>
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

  // Accent toggle (ear only)
  const [accentDownbeat, setAccentDownbeat] = useState<boolean>(() => (m.getSettings().accentEvery ?? 0) > 0);

  // events for visuals
  const eventIdRef = useRef(0);
  const hitSideRef = useRef<1 | -1>(1);
  const lastBeatRef = useRef<number>(1);
  const subTickRef = useRef<number>(0);
  const [hit, setHit] = useState<HitEvent>({ kind: "main", side: 1, isDownbeat: true, id: 0 });

  useEffect(() => {
    m.setOnState((running: boolean) => setMRunning(running));

    m.setOnTick((e: any) => {
      const beatsPerBar = m.getSettings().beatsPerBar;
      const bRaw = extractBeatInBar(e);
      const b = typeof bRaw === "number" ? clamp(Math.round(bRaw), 1, beatsPerBar) : lastBeatRef.current;

      const beatChanged = b !== lastBeatRef.current;

      if (beatChanged) {
        lastBeatRef.current = b;
        setBeatInBar(b);
        subTickRef.current = 0;

        const isDownbeat = b === 1; // heavy beat follows meter
        const side = hitSideRef.current;
        hitSideRef.current = hitSideRef.current === 1 ? -1 : 1;

        eventIdRef.current += 1;
        setHit({ kind: "main", side, isDownbeat, id: eventIdRef.current });
      } else {
        const subN = subdivCount(m.getSettings().subdivision);
        if (subN > 1) {
          subTickRef.current += 1;
          if (subTickRef.current < subN) {
            eventIdRef.current += 1;
            setHit({ kind: "sub", id: eventIdRef.current });
          }
        }
      }
    });

    setMSettings(m.getSettings());
    return () => {
      m.setOnState(null as any);
      m.setOnTick(null as any);
    };
  }, [m]);

  useEffect(() => {
    if (!accentDownbeat) return;
    m.setAccentEvery(m.getSettings().beatsPerBar, true);
    setMSettings(m.getSettings());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentDownbeat, mSettings.beatsPerBar]);

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
    if (accentDownbeat) m.setAccentEvery(v, true);
    setMSettings(m.getSettings());
    setBeatInBar((cur) => clamp(cur, 1, v));
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
  const toggleAccentDownbeat = () => {
    const next = !accentDownbeat;
    setAccentDownbeat(next);
    if (next) m.setAccentEvery(m.getSettings().beatsPerBar, true);
    else m.setAccentEvery(0, true);
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

      // IMPORTANT: duration measurement target
      durationTarget: "A4_A5",
      durationTargetCents: 150,
    });
  };

  const stopMic = () => {
    micShouldRunRef.current = false;
    t.stop();
  };

  useEffect(() => {
    const wantsMic = subTab === "tuner" || subTab === "duration";
    if (wantsMic) startMic().catch(() => {});
    else stopMic();
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
                        <Button onClick={startMetronome} disabled={mRunning}>התחל</Button>
                        <Button variant="secondary" onClick={stopMetronome} disabled={!mRunning}>עצור</Button>
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
                          {[1,2,3,4,5,6,7].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/70">הדגשת פעימה כבדה (לאוזן)</div>
                        <Button
                          type="button"
                          variant={accentDownbeat ? "default" : "secondary"}
                          className="w-full justify-center"
                          onClick={toggleAccentDownbeat}
                        >
                          {accentDownbeat ? "מופעל" : "כבוי"}
                        </Button>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/70">חלוקה פנימית</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.subdivision}
                          onChange={(e) => setSubdivision(e.target.value as SubdivisionMode)}
                        >
                          {Object.keys(SUB_LABELS).map((k) => (
                            <option key={k} value={k}>{SUB_LABELS[k as SubdivisionMode]}</option>
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
                            <option key={k} value={k}>{SOUND_LABELS[k as MetronomeSound]}</option>
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
                      subdivision={mSettings.subdivision}
                      hit={hit}
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
                      <div
                        className={`text-3xl font-semibold ${
                          tunerRunning ? (inTol ? "text-emerald-400" : "text-red-400") : "text-white"
                        }`}
                      >
                        {tunerRunning ? (tState.cents > 0 ? `+${tState.cents}` : `${tState.cents}`) : "--"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2">
                    <div className="flex justify-between text-xs text-white/60">
                      <span>-50</span><span>-25</span><span>0</span><span>+25</span><span>+50</span>
                    </div>

                    <div className="relative h-4 rounded bg-white/10 overflow-hidden">
                      {/* green tolerance band that GLOWS when inTol */}
                      <div
                        className="absolute top-0 h-4"
                        style={{
                          left: `${50 - 5}%`,
                          width: `${10}%`,
                          background: inTol && tunerRunning ? "rgba(16,185,129,0.42)" : "rgba(16,185,129,0.20)",
                          boxShadow: inTol && tunerRunning ? "0 0 22px rgba(16,185,129,0.55)" : "none",
                          transition: "background 120ms ease, box-shadow 120ms ease",
                        }}
                      />
                      <div className="absolute top-0 h-4 w-[2px] bg-white/70 left-1/2 -translate-x-1/2" />
                      <div
                        className={`absolute top-[-6px] h-7 w-[3px] rounded ${
                          tunerRunning ? (inTol ? "bg-emerald-400" : "bg-red-400") : "bg-white/50"
                        }`}
                        style={{
                          left: `${markerLeft}%`,
                          transform: "translateX(-50%)",
                          transition: "left 80ms linear",
                        }}
                      />
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
                        {tState.status === "running" && "מקשיב ומודד אוטומטית (A4/A5 בלבד)"}
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
