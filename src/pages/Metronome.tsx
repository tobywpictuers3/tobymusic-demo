import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
    case "quarter":
      return 1;
    case "eighths":
      return 2;
    case "triplets":
      return 3;
    case "sixteenths":
      return 4;
    case "swing":
      return 2;
    default:
      return 1;
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

  // stage
  const W = 520;
  const H = 260;

  const pivotX = W / 2;
  const pivotY = 26;

  // geometry
  const rodLen = 185;
  const maxAngle = 0.95; // radians

  const beatMs = 60000 / clamp(bpm, 20, 400);

  const startSideRef = useRef<1 | -1>(1);
  const t0Ref = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  const [angle, setAngle] = useState<number>(maxAngle);

  // trail canvas (path)
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // burst canvas (separate layer — no leftovers)
  const burstCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const burstRef = useRef<{
    x: number;
    y: number;
    isDownbeat: boolean;
    startedAt: number;
    active: boolean;
  } | null>(null);

  // subdivision blink (force retrigger)
  const [subBlinkId, setSubBlinkId] = useState<number>(0);

  function bobPos(a: number) {
    return {
      x: pivotX + Math.sin(a) * rodLen,
      y: pivotY + Math.cos(a) * rodLen,
    };
  }

  function hardClearCanvas(c: HTMLCanvasElement | null) {
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.clearRect(0, 0, c.width, c.height);
  }

  function hardClearTrail() {
    hardClearCanvas(trailCanvasRef.current);
    lastPointRef.current = null;
  }

  function startBurstAt(x: number, y: number, isDownbeat: boolean) {
    burstRef.current = {
      x,
      y,
      isDownbeat,
      startedAt: performance.now(),
      active: true,
    };
  }

  // respond to tick events (useLayoutEffect = before paint)
  useLayoutEffect(() => {
    if (hit.kind === "main") {
      startSideRef.current = hit.side;
      t0Ref.current = performance.now();

      // snap angle for “impact”
      const snap = hit.side * maxAngle;
      setAngle(snap);

      // reset trail on every main beat
      hardClearTrail();

      // start burst EXACTLY at the snapped bob position
      const p = bobPos(snap);
      startBurstAt(p.x, p.y, hit.isDownbeat);
    } else {
      // subdivision blink: weight only (no burst, no trail reset)
      setSubBlinkId((prev) => prev + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hit]);

  // animation + trail + burst rendering (single timing loop)
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      // cleanup visuals
      hardClearTrail();
      hardClearCanvas(burstCanvasRef.current);
      burstRef.current = null;
      return;
    }

    const loop = () => {
      const now = performance.now();
      const p01 = clamp((now - t0Ref.current) / beatMs, 0, 1);

      // smooth travel extreme->extreme
      const side = startSideRef.current;
      const a = side * Math.cos(Math.PI * p01) * maxAngle;
      setAngle(a);

      // ---- TRAIL (only accumulates within beat; cleared on main beat) ----
      const tc = trailCanvasRef.current;
      if (tc) {
        const tctx = tc.getContext("2d");
        if (tctx) {
          const pt = bobPos(a);
          const prev = lastPointRef.current;

          // neutralize any previous shadow state
          tctx.shadowBlur = 0;
          tctx.shadowColor = "transparent";

          if (prev) {
            tctx.beginPath();
            tctx.moveTo(prev.x, prev.y);
            tctx.lineTo(pt.x, pt.y);
            tctx.lineWidth = 6;
            tctx.lineCap = "round";
            tctx.strokeStyle = "rgba(244,189,86,0.45)";
            tctx.shadowColor = "rgba(244,189,86,0.55)";
            tctx.shadowBlur = 12;
            tctx.stroke();
            tctx.shadowBlur = 0;
          } else {
            // first point of the beat
            tctx.beginPath();
            tctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
            tctx.fillStyle = "rgba(244,189,86,0.55)";
            tctx.fill();
          }

          lastPointRef.current = pt;
        }
      }

      // ---- BURST (drawn in separate canvas, cleared every frame) ----
      const bc = burstCanvasRef.current;
      if (bc) {
        const bctx = bc.getContext("2d");
        if (bctx) {
          // clear burst layer every frame to avoid leftovers
          bctx.setTransform(1, 0, 0, 1, 0, 0);
          bctx.globalCompositeOperation = "source-over";
          bctx.shadowBlur = 0;
          bctx.shadowColor = "transparent";
          bctx.clearRect(0, 0, bc.width, bc.height);

          const br = burstRef.current;
          if (br && br.active) {
            const dur = 220; // ms
            const t = clamp((now - br.startedAt) / dur, 0, 1);

            if (t >= 1) {
              br.active = false;
            } else {
              // ease-out
              const ease = 1 - Math.pow(1 - t, 3);
              const r = 20 + ease * 95;
              const alpha = 1 - ease;

              const core = br.isDownbeat ? "rgba(255,45,75,0.95)" : "rgba(244,189,86,0.95)";
              const glow = br.isDownbeat ? "rgba(255,45,75,0.55)" : "rgba(244,189,86,0.55)";

              // gradient “explosion”
              const g = bctx.createRadialGradient(br.x, br.y, 0, br.x, br.y, r);
              g.addColorStop(0, core);
              g.addColorStop(0.55, br.isDownbeat ? "rgba(255,45,75,0.25)" : "rgba(244,189,86,0.25)");
              g.addColorStop(1, "rgba(0,0,0,0)");

              bctx.globalAlpha = alpha;
              bctx.fillStyle = g;
              bctx.beginPath();
              bctx.arc(br.x, br.y, r, 0, Math.PI * 2);
              bctx.fill();

              // ring + glow
              bctx.globalAlpha = alpha * 0.75;
              bctx.strokeStyle = core;
              bctx.lineWidth = 2;
              bctx.shadowColor = glow;
              bctx.shadowBlur = 24;
              bctx.beginPath();
              bctx.arc(br.x, br.y, r * 0.52, 0, Math.PI * 2);
              bctx.stroke();

              // reset
              bctx.shadowBlur = 0;
              bctx.globalAlpha = 1;
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, beatMs]);

  // when stopping: clear layers so nothing “sticks”
  useEffect(() => {
    if (!running) {
      hardClearTrail();
      hardClearCanvas(burstCanvasRef.current);
      burstRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const p = bobPos(angle);
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
          <div className="text-white/60 text-sm ml-3">Beat: {clamp(beatInBar, 1, beatsPerBar)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <div className="relative h-[260px] rounded-2xl border border-white/10 bg-black/10 overflow-hidden">
          {/* Trail */}
          <canvas ref={trailCanvasRef} width={W} height={H} className="absolute inset-0 w-full h-full" />
          {/* Burst (separate canvas => no leftovers, no React lag) */}
          <canvas ref={burstCanvasRef} width={W} height={H} className="absolute inset-0 w-full h-full" />

          {/* SVG overlay (rod + weight only) */}
          <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <radialGradient id="weightGrad" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                <stop offset="55%" stopColor="rgba(244,189,86,0.98)" />
                <stop offset="100%" stopColor="rgba(244,189,86,0.65)" />
              </radialGradient>
            </defs>

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

            {/* weight group (KEYED) so blink retriggers */}
            <g key={`${showSub ? subBlinkId : "no-sub"}`}>
              <circle cx={p.x} cy={p.y} r={13} fill="url(#weightGrad)" className={showSub ? "tobyWeightBlink" : ""} />
              <circle cx={p.x - 4} cy={p.y - 5} r={4} fill="rgba(255,255,255,0.18)" className={showSub ? "tobyWeightBlink" : ""} />
            </g>
          </svg>

          <style>{`
            .tobyWeightBlink {
              animation: tobyBlink 120ms ease-out;
              filter: drop-shadow(0 0 18px rgba(244,189,86,0.65));
            }
            @keyframes tobyBlink {
              0% { transform: scale(0.96); opacity: 0.75; }
              40% { transform: scale(1.08); opacity: 1; }
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

  // ---------------- Tuner engine (shared) ----------------
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

      durationTarget: "A4_A5",
      durationTargetCents: 150,
    });
  };

  const stopMic = () => {
    micShouldRunRef.current = false;
    t.stop();
  };

  useEffect(() => {
    // Auto stop mic when leaving the duration tab
    if (subTab !== "duration") return;
    // start mic automatically when entering duration tab
    if (tState.status === "idle" || tState.status === "no_signal" || tState.status === "error") {
      void startMic();
    }
    return () => {
      // stop when leaving tab
      if (subTab !== "duration") return;
      stopMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  return (
    <Card className="border-white/10 bg-black/20">
      <CardHeader>
        <CardTitle className="text-white">העזרים של טובי</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs value={subTab} onValueChange={(v) => setSubTab(v as any)} dir="rtl">
          <TabsList className="bg-black/20 border border-white/10">
            <TabsTrigger value="metronome">מטרונום</TabsTrigger>
            <TabsTrigger value="tuner">טיונר</TabsTrigger>
            <TabsTrigger value="duration">מדידת אורך צליל</TabsTrigger>
          </TabsList>

          {/* ---------- METRONOME ---------- */}
          <TabsContent value="metronome" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white text-xl font-semibold">שליטה</div>
                    <div className="text-white/60 text-sm">סטטוס: {mRunning ? "פועל" : "מוכן"}</div>
                  </div>

                  <div className="flex gap-2">
                    {!mRunning ? (
                      <Button onClick={startMetronome} className="bg-red-700 hover:bg-red-600">
                        התחל
                      </Button>
                    ) : (
                      <Button onClick={stopMetronome} variant="secondary">
                        עצור
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-5">
                  {/* BPM */}
                  <div>
                    <div className="flex items-center justify-between text-white/80 text-sm mb-2">
                      <span>BPM</span>
                      <span>{mSettings.bpm}</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={240}
                      value={mSettings.bpm}
                      onChange={(e) => setBpm(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  {/* beats per bar */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-white/80 text-sm mb-2">מספר פעימות בתיבה</div>
                      <select
                        value={mSettings.beatsPerBar}
                        onChange={(e) => setBeatsPerBar(Number(e.target.value))}
                        className="w-full rounded-md bg-black/30 border border-white/10 text-white px-3 py-2"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* accent toggle (ear only) */}
                    <div>
                      <div className="text-white/80 text-sm mb-2">הדגשת פעימה כבדה (לאוזן)</div>
                      <Button
                        onClick={toggleAccentDownbeat}
                        className={`w-full ${accentDownbeat ? "bg-red-700 hover:bg-red-600" : "bg-white/10 hover:bg-white/20"}`}
                      >
                        {accentDownbeat ? "מופעל" : "כבוי"}
                      </Button>
                      <div className="text-white/50 text-xs mt-1">
                        הויזואליה תמיד תדגיש פעימה כבדה לפי משקל (פעימה 1 בכל תיבה).
                      </div>
                    </div>
                  </div>

                  {/* subdivision + sound */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-white/80 text-sm mb-2">חלוקה פנימית</div>
                      <select
                        value={mSettings.subdivision}
                        onChange={(e) => setSubdivision(e.target.value as SubdivisionMode)}
                        className="w-full rounded-md bg-black/30 border border-white/10 text-white px-3 py-2"
                      >
                        {Object.entries(SUB_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="text-white/80 text-sm mb-2">סאונד</div>
                      <select
                        value={mSettings.sound}
                        onChange={(e) => setSound(e.target.value as MetronomeSound)}
                        className="w-full rounded-md bg-black/30 border border-white/10 text-white px-3 py-2"
                      >
                        {Object.entries(SOUND_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* volume */}
                  <div>
                    <div className="flex items-center justify-between text-white/80 text-sm mb-2">
                      <span>עוצמה</span>
                      <span>{Math.round(mSettings.volume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={mSettings.volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* VISUAL */}
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-white text-xl font-semibold">מראה ויזואלי</div>
                    <div className="text-white/60 text-sm">הפעמה קבועה; חלוקה פנימית רק הבהוב משקולת.</div>
                  </div>
                </div>

                <PendulumVisual
                  running={mRunning}
                  bpm={mSettings.bpm}
                  beatsPerBar={mSettings.beatsPerBar}
                  beatInBar={beatInBar}
                  subdivision={mSettings.subdivision}
                  hit={hit}
                />
              </div>
            </div>
          </TabsContent>

          {/* ---------- TUNER (kept as-is in this file) ---------- */}
          <TabsContent value="tuner" className="mt-6">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-white/80">
              <div className="text-white text-xl font-semibold mb-2">טיונר</div>
              <div className="text-white/60 text-sm">
                (הטיונר מנוהל ב־TunerCard/TunerEngine בקבצים אחרים – לא שינינו כאן)
              </div>
            </div>
          </TabsContent>

          {/* ---------- NOTE DURATION ---------- */}
          <TabsContent value="duration" className="mt-6">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-white/80 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white text-xl font-semibold">מדידת אורך צליל</div>
                  <div className="text-white/60 text-sm">המיקרופון מופעל אוטומטית בטאב זה ונסגר ביציאה.</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={startMic} className="bg-red-700 hover:bg-red-600">
                    הפעל מיקרופון
                  </Button>
                  <Button onClick={stopMic} variant="secondary">
                    סגור מיקרופון
                  </Button>
                </div>
              </div>

              <div className="text-white/70 text-sm">
                סטטוס: <span className="text-white">{tState.status}</span> · A4:{" "}
                <input
                  className="ml-2 w-20 rounded bg-black/30 border border-white/10 px-2 py-1 text-white"
                  type="number"
                  value={a4}
                  onChange={(e) => setA4(Number(e.target.value))}
                />
                Hz
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-white font-semibold mb-2">תוצאות</div>
                {durations.length === 0 ? (
                  <div className="text-white/50 text-sm">עדיין אין תוצאות.</div>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-auto">
                    {durations.map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-sm border-b border-white/10 pb-2">
                        <div className="text-white/80">
                          {d.note} · {d.hz.toFixed(1)}Hz · {d.cents >= 0 ? "+" : ""}
                          {d.cents.toFixed(0)}c
                        </div>
                        <div className="text-white">
                          {d.durationMs != null ? `${(d.durationMs / 1000).toFixed(2)}s` : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
