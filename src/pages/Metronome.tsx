import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MetronomeEngine,
  type MetronomeSettings,
  type MetronomeTickEvent,
  type MetronomeSound,
  type SubdivisionMode,
} from "@/lib/metronom/MetronomeEngine";

const COLORS = {
  gold: "#D6B36A",
  ink: "#1a0f10",
};

const SUBDIVISIONS: { value: SubdivisionMode; label: string }[] = [
  { value: "quarter", label: "רבעים" },
  { value: "eighths", label: "שמיניות" },
  { value: "triplets", label: "טריולות" },
  { value: "sixteenths", label: "שש עשרה" },
  { value: "swing", label: "סווינג (3:1)" },
];

const SOUNDS: { value: MetronomeSound; label: string }[] = [
  { value: "classic_click", label: "Classic Click" },
  { value: "woodblock", label: "Woodblock" },
  { value: "clave", label: "Clave" },
  { value: "rimshot", label: "Rimshot" },
  { value: "cowbell", label: "Cowbell" },
  { value: "hihat", label: "HiHat" },
  { value: "beep_sine", label: "Beep (Sine)" },
  { value: "beep_square", label: "Beep (Square)" },
  { value: "soft_tick", label: "Soft Tick" },
  { value: "digital_pop", label: "Digital Pop" },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** =========================
 *   TUNER UTILS
 *  ========================= */
function noteFromFrequency(frequency: number, a4: number = 440) {
  // MIDI: A4 = 69
  return Math.round(12 * (Math.log(frequency / a4) / Math.log(2)) + 69);
}
function frequencyFromNoteNumber(note: number, a4: number = 440) {
  return a4 * Math.pow(2, (note - 69) / 12);
}
function centsOffFromPitch(frequency: number, note: number, a4: number = 440) {
  const ref = frequencyFromNoteNumber(note, a4);
  return Math.round((1200 * Math.log(frequency / ref)) / Math.log(2));
}
function noteNameFromMidi(note: number) {
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const name = NAMES[((note % 12) + 12) % 12];
  const octave = Math.floor(note / 12) - 1;
  return `${name}${octave}`;
}

/**
 * Auto-correlation pitch detection (good enough for a tuner UI)
 * Returns frequency in Hz or null.
 */
function autoCorrelate(buf: Float32Array, sampleRate: number): number | null {
  // Remove DC offset
  let mean = 0;
  for (let i = 0; i < buf.length; i++) mean += buf[i];
  mean /= buf.length;

  const x = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) x[i] = buf[i] - mean;

  // RMS gate
  let rms = 0;
  for (let i = 0; i < x.length; i++) rms += x[i] * x[i];
  rms = Math.sqrt(rms / x.length);
  if (rms < 0.01) return null;

  // Autocorrelation
  const SIZE = x.length;
  const MAX_LAG = Math.floor(SIZE / 2);

  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = 20; lag < MAX_LAG; lag++) {
    let corr = 0;
    for (let i = 0; i < MAX_LAG; i++) {
      corr += x[i] * x[i + lag];
    }
    corr = corr / MAX_LAG;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag <= 0) return null;
  // A small confidence gate
  if (bestCorr < 0.1) return null;

  return sampleRate / bestLag;
}

/** =========================
 *   PAGE
 *  ========================= */
export default function Metronome() {
  const engine = useMemo(() => MetronomeEngine.getInstance(), []);
  const [settings, setSettings] = useState<MetronomeSettings>(() => engine.getSettings());
  const [running, setRunning] = useState<boolean>(() => engine.getRunning());

  const [tab, setTab] = useState<"metronome" | "tuner">("metronome");

  // Metronome UI tick visualization
  const [beatInBar, setBeatInBar] = useState<number>(1);
  const [subIndex, setSubIndex] = useState<number>(0);
  const [flash, setFlash] = useState<{ on: boolean; strong: boolean }>({ on: false, strong: false });

  // Pendulum animation
  const lastMainTickAtRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);
  const [pendulumAngle, setPendulumAngle] = useState<number>(0);

  // TUNER state
  const [a4, setA4] = useState<number>(440);
  const [micOn, setMicOn] = useState(false);
  const [tunerNote, setTunerNote] = useState<string>("—");
  const [tunerHz, setTunerHz] = useState<string>("—");
  const [tunerCents, setTunerCents] = useState<string>("—");
  const [tunerStatus, setTunerStatus] = useState<string>("");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const tunerRafRef = useRef<number | null>(null);
  const timeDataRef = useRef<Float32Array | null>(null);

  /** ---------- Wire engine callbacks ---------- */
  useEffect(() => {
    engine.setOnState((isRunning: boolean) => setRunning(isRunning));
    engine.setOnTick((e: MetronomeTickEvent) => {
      // e: { beatInBar, subIndex, isMain, isAccent, ... } (engine side)
      if (typeof e.beatInBar === "number") setBeatInBar(e.beatInBar);
      if (typeof e.subIndex === "number") setSubIndex(e.subIndex);

      const isMain = Boolean((e as any).isMain ?? (e as any).main);
      const isAccent = Boolean((e as any).isAccent ?? (e as any).accent);

      if (isMain) {
        lastMainTickAtRef.current = performance.now();
        setFlash({ on: true, strong: isAccent });
        window.setTimeout(() => setFlash({ on: false, strong: false }), 90);
      }
    });

    return () => {
      engine.setOnState(undefined as any);
      engine.setOnTick(undefined as any);
    };
  }, [engine]);

  /** ---------- Pendulum raf loop ---------- */
  useEffect(() => {
    const loop = () => {
      if (!running) {
        setPendulumAngle(0);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const msPerBeat = 60000 / clamp(settings.bpm ?? 120, 20, 300);
      const t = performance.now();
      const dt = t - lastMainTickAtRef.current;
      const phase = (dt / msPerBeat) * Math.PI; // 0..π..2π
      const angle = Math.sin(phase) * 28; // deg
      setPendulumAngle(angle);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, settings.bpm]);

  /** ---------- Update engine when settings change ---------- */
  const updateSettings = (patch: Partial<MetronomeSettings>) => {
    const next = { ...settings, ...patch } as MetronomeSettings;
    setSettings(next);
    // engine supports setSettings OR updateSettings in many builds; try setSettings first
    if ((engine as any).setSettings) (engine as any).setSettings(next);
    else if ((engine as any).updateSettings) (engine as any).updateSettings(next);
  };

  const toggleMetronome = async () => {
    try {
      if (running) {
        await engine.stop();
      } else {
        // engine may have start(settings) or start()
        if ((engine as any).start.length >= 1) await (engine as any).start(settings);
        else await (engine as any).start();
      }
    } catch (e) {
      // no toast dependency here; keep silent
      console.error(e);
    }
  };

  /** ---------- Tuner start/stop ---------- */
  const stopTuner = async () => {
    setMicOn(false);
    setTunerStatus("");

    if (tunerRafRef.current) cancelAnimationFrame(tunerRafRef.current);
    tunerRafRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      try {
        await audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    timeDataRef.current = null;
  };

  const startTuner = async () => {
    try {
      setTunerStatus("מבקש הרשאת מיקרופון…");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      src.connect(analyser);

      analyserRef.current = analyser;
      timeDataRef.current = new Float32Array(analyser.fftSize);

      setMicOn(true);
      setTunerStatus("");

      const tick = () => {
        if (!analyserRef.current || !audioCtxRef.current || !timeDataRef.current) {
          tunerRafRef.current = requestAnimationFrame(tick);
          return;
        }

        const an = analyserRef.current;
        const buf = timeDataRef.current;

        an.getFloatTimeDomainData(buf);

        const hz = autoCorrelate(buf, audioCtxRef.current.sampleRate);
        if (!hz) {
          setTunerNote("—");
          setTunerHz("—");
          setTunerCents("—");
          tunerRafRef.current = requestAnimationFrame(tick);
          return;
        }

        const midi = noteFromFrequency(hz, a4);
        const cents = centsOffFromPitch(hz, midi, a4);

        setTunerNote(noteNameFromMidi(midi));
        setTunerHz(hz.toFixed(1));
        setTunerCents(String(cents));

        tunerRafRef.current = requestAnimationFrame(tick);
      };

      tunerRafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error(e);
      setTunerStatus("אין גישה למיקרופון. בדקי הרשאות בדפדפן.");
      await stopTuner();
    }
  };

  useEffect(() => {
    return () => {
      // cleanup on unmount
      stopTuner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** =========================
   *   RENDER
   *  ========================= */
  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Header (בלי כיתוב כחול) */}
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold" style={{ color: COLORS.gold }}>
          מטרונום טיונר
        </h1>
      </div>

      {/* Sub Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab("metronome")}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition"
          style={{
            background: tab === "metronome" ? COLORS.gold : "rgba(255,255,255,0.10)",
            color: tab === "metronome" ? COLORS.ink : "rgba(255,255,255,0.85)",
            border: `1px solid ${
              tab === "metronome" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.18)"
            }`,
          }}
        >
          מטרונום
        </button>

        <button
          onClick={() => setTab("tuner")}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition"
          style={{
            background: tab === "tuner" ? COLORS.gold : "rgba(255,255,255,0.10)",
            color: tab === "tuner" ? COLORS.ink : "rgba(255,255,255,0.85)",
            border: `1px solid ${tab === "tuner" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.18)"}`,
          }}
        >
          טיונר
        </button>
      </div>

      {/* CONTENT */}
      {tab === "metronome" ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
              מטרונום
            </div>

            <button
              onClick={toggleMetronome}
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{
                background: running ? "rgba(255,255,255,0.10)" : COLORS.gold,
                color: running ? "rgba(255,255,255,0.90)" : COLORS.ink,
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {running ? "עצור" : "התחל"}
            </button>
          </div>

          {/* Controls grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Left: controls */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                שליטה
              </div>

              <div className="mb-2 flex items-center justify-between text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                <span>BPM</span>
                <span className="font-semibold">{settings.bpm}</span>
              </div>
              <input
                type="range"
                min={20}
                max={300}
                step={1}
                value={settings.bpm}
                onChange={(e) => updateSettings({ bpm: Number(e.target.value) })}
                className="w-full"
              />

              <div className="mt-4 grid grid-cols-1 gap-3">
                <label className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                  מספר פעימות בתיבה (1–7)
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-2"
                    value={settings.beatsPerBar}
                    onChange={(e) => updateSettings({ beatsPerBar: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                  הדגשה כל N פעימות (0–7)
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-2"
                    value={settings.accentEvery}
                    onChange={(e) => updateSettings({ accentEvery: Number(e.target.value) })}
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "ללא" : n}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                  חלוקה
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-2"
                    value={settings.subdivision}
                    onChange={(e) => updateSettings({ subdivision: e.target.value as SubdivisionMode })}
                  >
                    {SUBDIVISIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                  סאונד
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-2"
                    value={settings.sound}
                    onChange={(e) => updateSettings({ sound: e.target.value as MetronomeSound })}
                  >
                    {SOUNDS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-2">
                  <div className="mb-2 flex items-center justify-between text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                    <span>ווליום</span>
                    <span className="font-semibold">{settings.masterVolume}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={settings.masterVolume}
                    onChange={(e) => updateSettings({ masterVolume: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Right: visual */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                  תצוגה
                </div>

                <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>
                  <span className="inline-flex items-center gap-2">
                    נקודה
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: flash.on ? (flash.strong ? COLORS.gold : "rgba(255,255,255,0.85)") : "rgba(255,255,255,0.20)",
                        boxShadow: flash.on ? `0 0 18px ${flash.strong ? COLORS.gold : "rgba(255,255,255,0.7)"}` : "none",
                      }}
                    />
                  </span>
                </div>
              </div>

              <div className="mb-3 text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>
                Beat: {beatInBar} · Sub: {subIndex + 1}
              </div>

              {/* Pendulum */}
              <div className="relative mx-auto mt-4 h-56 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                <div
                  className="absolute left-1/2 top-6 h-44 w-0"
                  style={{
                    transform: `translateX(-50%) rotate(${pendulumAngle}deg)`,
                    transformOrigin: "50% 0%",
                  }}
                >
                  <div className="h-36 w-[3px] rounded bg-white/70" />
                  <div className="mx-auto mt-2 h-5 w-5 rounded-full" style={{ background: COLORS.gold }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
              טיונר (מיקרופון)
            </div>

            <button
              onClick={() => (micOn ? stopTuner() : startTuner())}
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{
                background: micOn ? "rgba(255,255,255,0.10)" : COLORS.gold,
                color: micOn ? "rgba(255,255,255,0.90)" : COLORS.ink,
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {micOn ? "כבה מיקרופון" : "הפעל מיקרופון"}
            </button>
          </div>

          {tunerStatus ? (
            <div className="mb-4 rounded-xl border border-white/10 bg-black/25 p-3 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
              {tunerStatus}
            </div>
          ) : null}

          {/* A4 master tuning */}
          <div className="mb-5 rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
              <span>כיוון מאסטר (A4)</span>
              <span className="font-semibold">{a4}Hz</span>
            </div>
            <input
              type="range"
              min={435}
              max={445}
              step={1}
              value={a4}
              onChange={(e) => setA4(Number(e.target.value))}
              className="mt-3 w-full"
            />
            <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
              טווח כיוון: 435–445Hz (ברירת מחדל 440Hz)
            </div>
          </div>

          {/* Readout */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                תו
              </div>
              <div className="mt-2 text-3xl font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
                {tunerNote}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                תדר (Hz)
              </div>
              <div className="mt-2 text-3xl font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
                {tunerHz}
              </div>
              <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                מומלץ לעבוד מול צליל נקי (ללא עיוות)
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                סטייה (cents)
              </div>
              <div className="mt-2 text-3xl font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
                {tunerCents === "—" ? "—" : `${tunerCents}`}
              </div>

              {/* Simple cents bar */}
              <div className="mt-4 h-2 w-full rounded-full bg-white/10">
                {tunerCents !== "—" ? (
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${clamp((Number(tunerCents) + 50) / 100, 0, 1) * 100}%`,
                      background: COLORS.gold,
                    }}
                  />
                ) : null}
              </div>
              <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                יעד: 0 · טווח תצוגה: ±50
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
            טיפ: אם זה “קופץ” — התקרבי למקור הצליל, ונסי צליל נקי (בלי רוורב/דיליי).
          </div>
        </div>
      )}
    </div>
  );
}
