import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MetronomeEngine,
  type MetronomeSettings,
  type MetronomeTickEvent,
  type MetronomeSound,
  type SubdivisionMode,
} from "@/lib/metronom/MetronomeEngine";

const SUBDIVISIONS: { value: SubdivisionMode; label: string }[] = [
  { value: "quarter", label: "רבעים" },
  { value: "eighths", label: "שמיניות" },
  { value: "triplets", label: "שלישונים" },
  { value: "sixteenths", label: "שש־עשריות" },
  { value: "swing", label: "סווינג (מנוקד 3:1)" },
];

const SOUNDS: { value: MetronomeSound; label: string }[] = [
  { value: "classic_click", label: "Classic Click" },
  { value: "woodblock", label: "Woodblock" },
  { value: "clave", label: "Clave" },
  { value: "rimshot", label: "Rimshot" },
  { value: "cowbell", label: "Cowbell" },
  { value: "hihat", label: "Hi-Hat" },
  { value: "beep_sine", label: "Beep (Sine)" },
  { value: "beep_square", label: "Beep (Square)" },
  { value: "soft_tick", label: "Soft Tick" },
  { value: "digital_pop", label: "Digital Pop" },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPct(v01: number) {
  return `${Math.round(v01 * 100)}%`;
}

/** ---------- TUNER HELPERS ---------- */
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteFromFrequency(freq: number) {
  const noteNumber = 69 + 12 * Math.log2(freq / 440);
  return Math.round(noteNumber);
}

function frequencyFromNoteNumber(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function noteName(noteNumber: number) {
  const name = NOTE_NAMES[(noteNumber + 1200) % 12];
  const octave = Math.floor(noteNumber / 12) - 1;
  return `${name}${octave}`;
}

function centsOffFromPitch(freq: number, noteNumber: number) {
  const ref = frequencyFromNoteNumber(noteNumber);
  return Math.floor((1200 * Math.log2(freq / ref)) * 10) / 10; // 0.1 cents
}

/**
 * Autocorrelation pitch detection.
 * Returns frequency in Hz, or -1 if no reliable pitch.
 */
function autoCorrelateFloat32(buf: Float32Array, sampleRate: number) {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return -1;

  let r1 = 0;
  let r2 = buf.length - 1;
  const threshold = 0.2;

  for (let i = 0; i < buf.length / 2; i++) {
    if (Math.abs(buf[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < buf.length / 2; i++) {
    if (Math.abs(buf[buf.length - i]) < threshold) {
      r2 = buf.length - i;
      break;
    }
  }

  const trimmed = buf.slice(r1, r2);
  const size = trimmed.length;
  if (size < 128) return -1;

  const c = new Array<number>(size).fill(0);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] = c[i] + trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (d < size - 1 && c[d] > c[d + 1]) d++;

  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  if (maxpos <= 0) return -1;

  const x1 = c[maxpos - 1] ?? 0;
  const x2 = c[maxpos];
  const x3 = c[maxpos + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  let t0 = maxpos;
  if (a) t0 = t0 - b / (2 * a);

  const freq = sampleRate / t0;
  if (freq < 40 || freq > 2000) return -1;
  return freq;
}

function TunerPanel({ COLORS }: { COLORS: { wine: string; gold: string; gold2: string; ink: string } }) {
  const [micOn, setMicOn] = useState(false);
  const [status, setStatus] = useState<string>("כבוי");
  const [freq, setFreq] = useState<number | null>(null);
  const [note, setNote] = useState<string>("—");
  const [cents, setCents] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<"low" | "ok">("low");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufRef = useRef<Float32Array | null>(null);

  const stopMic = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }

    analyserRef.current = null;
    bufRef.current = null;

    setMicOn(false);
    setStatus("כבוי");
    setFreq(null);
    setNote("—");
    setCents(null);
    setConfidence("low");
  };

  const startMic = async () => {
    try {
      setStatus("מבקש הרשאה למיקרופון...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
        video: false,
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.4;

      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      mediaStreamRef.current = stream;

      bufRef.current = new Float32Array(analyser.fftSize);
      setMicOn(true);
      setStatus("דולק (מקשיב...)");

      const tick = () => {
        const a = analyserRef.current;
        const ctx = audioCtxRef.current;
        const buf = bufRef.current;
        if (!a || !ctx || !buf) return;

        a.getFloatTimeDomainData(buf);
        const f = autoCorrelateFloat32(buf, ctx.sampleRate);

        if (f > 0) {
          const nn = noteFromFrequency(f);
          const nname = noteName(nn);
          const c = centsOffFromPitch(f, nn);

          setFreq(f);
          setNote(nname);
          setCents(c);

          setConfidence(Math.abs(c) <= 35 ? "ok" : "low");
        } else {
          setFreq(null);
          setNote("—");
          setCents(null);
          setConfidence("low");
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setStatus("נחסם / אין הרשאה למיקרופון");
      setMicOn(false);
    }
  };

  useEffect(() => {
    return () => stopMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inTune = cents != null && Math.abs(cents) <= 5;

  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "rgba(215,180,106,0.25)", background: "rgba(0,0,0,0.25)" }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-medium" style={{ color: "rgba(255,255,255,0.90)" }}>
            טיונר
          </div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.60)" }}>
            {status}
          </div>
        </div>

        <button
          onClick={micOn ? stopMic : startMic}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={{
            background: micOn ? "rgba(255,255,255,0.12)" : COLORS.gold,
            color: micOn ? "rgba(255,255,255,0.9)" : COLORS.ink,
            border: `1px solid ${micOn ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.2)"}`,
          }}
        >
          {micOn ? "כבה מיקרופון" : "הפעל מיקרופון"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)" }}>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
            תו
          </div>
          <div className="mt-1 text-3xl font-semibold" style={{ color: inTune ? COLORS.gold2 : COLORS.gold }}>
            {note}
          </div>
          <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            {confidence === "ok" ? "קליטה טובה" : "קליטה חלשה / לא יציב"}
          </div>
        </div>

        <div className="rounded-lg border p-4" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)" }}>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
            תדר (Hz)
          </div>
          <div className="mt-1 text-2xl font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
            {freq ? freq.toFixed(1) : "—"}
          </div>
          <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            טווח מומלץ: 40–2000Hz
          </div>
        </div>

        <div className="rounded-lg border p-4" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)" }}>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
            סטייה (cents)
          </div>
          <div className="mt-1 text-2xl font-semibold" style={{ color: inTune ? COLORS.gold2 : "rgba(255,255,255,0.9)" }}>
            {cents == null ? "—" : `${cents > 0 ? "+" : ""}${cents.toFixed(1)}`}
          </div>

          <div className="mt-3 h-3 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.10)" }}>
            <div
              className="h-full"
              style={{
                width: "100%",
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(215,180,106,0.35) 35%, rgba(241,209,138,0.65) 50%, rgba(215,180,106,0.35) 65%, rgba(255,255,255,0.05) 100%)",
              }}
            />
          </div>

          <div className="relative mt-1 h-4">
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 2,
                width: 2,
                height: 12,
                background: "rgba(255,255,255,0.25)",
                transform: "translateX(-50%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 1,
                height: 14,
                width: 10,
                borderRadius: 8,
                background: inTune ? COLORS.gold2 : COLORS.gold,
                boxShadow: inTune ? "0 0 14px rgba(241,209,138,0.45)" : "0 0 12px rgba(215,180,106,0.35)",
                left:
                  cents == null ? "50%" : `calc(50% + ${Math.max(-50, Math.min(50, cents))} * 0.7%)`,
                transform: "translateX(-50%)",
                transition: "left 80ms linear",
              }}
              title="סטייה"
            />
          </div>

          <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            יעד: ±5 סנט (כמעט מדויק)
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs leading-5" style={{ color: "rgba(255,255,255,0.60)" }}>
        טיפ: אם הטיונר “קופץ” — התקרבי למקור הצליל, כבי רעשי רקע, ותני תו יציב (ללא ויברטו חזק).
      </div>
    </div>
  );
}

/** ---------- PAGE (METRONOME + TUNER) ---------- */
export default function Metronome() {
  const engine = useMemo(() => MetronomeEngine.getInstance(), []);
  const [settings, setSettings] = useState<MetronomeSettings>(() => engine.getSettings());
  const [running, setRunning] = useState<boolean>(() => engine.getRunning());

  const [tab, setTab] = useState<"metronome" | "tuner">("metronome");

  const [beatInBar, setBeatInBar] = useState<number>(1);
  const [subIndex, setSubIndex] = useState<number>(0);
  const [flash, setFlash] = useState<{ on: boolean; strong: boolean }>({ on: false, strong: false });

  const lastMainTickAtRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);
  const [pendulumAngle, setPendulumAngle] = useState<number>(0);

  const COLORS = {
    wine: "#5b1f24",
    gold: "#d7b46a",
    gold2: "#f1d18a",
    ink: "#1a1a1a",
  };

  useEffect(() => {
    engine.setOnState((r) => setRunning(r));

    engine.setOnTick((e: MetronomeTickEvent) => {
      setBeatInBar(e.beatInBar);
      setSubIndex(e.subIndex);

      if (e.isMainBeat) {
        lastMainTickAtRef.current = performance.now();
        setFlash({ on: true, strong: e.isDownbeat || e.isAccent });
        window.setTimeout(() => setFlash({ on: false, strong: false }), 90);
      }
    });

    return () => {
      engine.setOnTick(null);
      engine.setOnState(null);
      engine.stop();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [engine]);

  useEffect(() => {
    const loop = () => {
      const bpm = settings.bpm;
      const msPerBeat = (60_000 / bpm) || 500;

      if (!running) {
        setPendulumAngle((prev) => prev * 0.85);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const t = performance.now();
      const dt = t - lastMainTickAtRef.current;
      const phase = (dt / msPerBeat) * Math.PI;
      const angle = Math.sin(phase) * 28;
      setPendulumAngle(angle);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, settings.bpm]);

  const applySettings = (next: Partial<MetronomeSettings>) => {
    const merged: MetronomeSettings = { ...settings, ...next };
    setSettings(merged);

    engine.setBpm(merged.bpm);
    engine.setBeatsPerBar(merged.beatsPerBar);
    engine.setAccentEvery(merged.accentEvery);
    engine.setSubdivision(merged.subdivision);
    engine.setSound(merged.sound);
    engine.setVolume(merged.volume);
  };

  const startStop = async () => {
    if (running) {
      engine.stop();
      return;
    }
    await engine.start();
  };

  const beatDots = useMemo(() => {
    return Array.from({ length: settings.beatsPerBar }, (_, i) => {
      const n = i + 1;
      const isCurrent = n === beatInBar && subIndex === 0;
      const isDownbeat = n === 1;
      return (
        <div
          key={n}
          className="h-3 w-3 rounded-full"
          style={{
            background: isCurrent ? (isDownbeat ? COLORS.gold2 : COLORS.gold) : "rgba(255,255,255,0.25)",
            boxShadow: isCurrent ? `0 0 0 3px rgba(215,180,106,0.25)` : "none",
          }}
          title={`Beat ${n}`}
        />
      );
    });
  }, [settings.beatsPerBar, beatInBar, subIndex]);

  return (
    <div
      className="min-h-screen w-full p-6"
      style={{ background: "linear-gradient(135deg, #1a0c0e 0%, #2a0f12 55%, #140607 100%)" }}
    >
 <div className="mx-auto w-full max-w-5xl">
  {/* Header */}
  <div className="mb-6 flex flex-col gap-1">
    <h1
      className="text-2xl font-semibold"
      style={{ color: COLORS.gold }}
    >
      מטרונום טיונר
    </h1>
  </div>

  {/* Sub Tabs */}
  <div className="mb-6 flex gap-2">
    <button
      onClick={() => setTab("metronome")}
      className="rounded-lg px-4 py-2 text-sm font-semibold transition"
      style={{
        background:
          tab === "metronome"
            ? COLORS.gold
            : "rgba(255,255,255,0.10)",
        color:
          tab === "metronome"
            ? COLORS.ink
            : "rgba(255,255,255,0.85)",
        border: `1px solid ${
          tab === "metronome"
            ? "rgba(0,0,0,0.25)"
            : "rgba(255,255,255,0.18)"
        }`,
      }}
    >
      מטרונום
    </button>

    <button
      onClick={() => setTab("tuner")}
      className="rounded-lg px-4 py-2 text-sm font-semibold transition"
      style={{
        background:
          tab === "tuner"
            ? COLORS.gold
            : "rgba(255,255,255,0.10)",
        color:
          tab === "tuner"
            ? COLORS.ink
            : "rgba(255,255,255,0.85)",
        border: `1px solid ${
          tab === "tuner"
            ? "rgba(0,0,0,0.25)"
            : "rgba(255,255,255,0.18)"
        }`,
      }}
    >
      טיונר
    </button>
  </div>
</div>


        {tab === "tuner" ? (
          <TunerPanel COLORS={COLORS} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Controls */}
            <div
              className="rounded-xl border p-5"
              style={{ borderColor: "rgba(215,180,106,0.25)", background: "rgba(0,0,0,0.25)" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="text-lg font-medium" style={{ color: "rgba(255,255,255,0.90)" }}>
                  שליטה
                </div>
                <button
                  onClick={startStop}
                  className="rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{
                    background: running ? "rgba(255,255,255,0.12)" : COLORS.gold,
                    color: running ? "rgba(255,255,255,0.9)" : COLORS.ink,
                    border: `1px solid ${running ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.2)"}`,
                  }}
                >
                  {running ? "עצור" : "התחל"}
                </button>
              </div>

              {/* BPM */}
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                    BPM
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={300}
                    value={settings.bpm}
                    onChange={(e) => applySettings({ bpm: clamp(Number(e.target.value || 120), 20, 300) })}
                    className="w-24 rounded-md border px-2 py-1 text-sm"
                    style={{
                      background: "rgba(0,0,0,0.35)",
                      borderColor: "rgba(255,255,255,0.15)",
                      color: "rgba(255,255,255,0.9)",
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={20}
                  max={300}
                  value={settings.bpm}
                  onChange={(e) => applySettings({ bpm: clamp(Number(e.target.value), 20, 300) })}
                  className="w-full"
                />
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                    מספר פעימות בתיבה (1–7)
                  </label>
                  <select
                    value={settings.beatsPerBar}
                    onChange={(e) => applySettings({ beatsPerBar: clamp(Number(e.target.value), 1, 7) })}
                    className="w-full rounded-md border px-2 py-2 text-sm"
                    style={{
                      background: "rgba(0,0,0,0.35)",
                      borderColor: "rgba(255,255,255,0.15)",
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                    תדירות פעמה כבדה AccentEvery (0–7)
                  </label>
                  <select
                    value={settings.accentEvery}
                    onChange={(e) => applySettings({ accentEvery: clamp(Number(e.target.value), 0, 7) })}
                    className="w-full rounded-md border px-2 py-2 text-sm"
                    style={{
                      background: "rgba(0,0,0,0.35)",
                      borderColor: "rgba(255,255,255,0.15)",
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    {Array.from({ length: 8 }, (_, i) => i).map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "0 — ללא" : n === 1 ? "1 — כל פעימה" : `${n} — כל ${n} פעימות`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                  חלוקה פנימית (מקצבים)
                </label>
                <select
                  value={settings.subdivision}
                  onChange={(e) => applySettings({ subdivision: e.target.value as SubdivisionMode })}
                  className="w-full rounded-md border px-2 py-2 text-sm"
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    borderColor: "rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  {SUBDIVISIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                  * הנקודה המהבהבת מסונכרנת לפעימה הראשית (main beat).
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                  סאונד
                </label>
                <select
                  value={settings.sound}
                  onChange={(e) => applySettings({ sound: e.target.value as MetronomeSound })}
                  className="w-full rounded-md border px-2 py-2 text-sm"
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    borderColor: "rgba(255,255,255,0.15)",
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  {SOUNDS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                    עוצמה
                  </label>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                    {formatPct(settings.volume)}
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.volume}
                  onChange={(e) => applySettings({ volume: clamp(Number(e.target.value), 0, 1) })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Visual */}
            <div
              className="rounded-xl border p-5"
              style={{ borderColor: "rgba(215,180,106,0.25)", background: "rgba(0,0,0,0.25)" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="text-lg font-medium" style={{ color: "rgba(255,255,255,0.90)" }}>
                  תצוגה
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                    פעמה
                  </div>
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{
                      background: flash.on ? (flash.strong ? COLORS.gold2 : COLORS.gold) : "rgba(255,255,255,0.18)",
                      boxShadow: flash.on
                        ? `0 0 12px ${flash.strong ? "rgba(241,209,138,0.55)" : "rgba(215,180,106,0.45)"}`
                        : "none",
                      transition: "transform 80ms ease, box-shadow 80ms ease",
                      transform: flash.on ? "scale(1.15)" : "scale(1)",
                    }}
                    title="Blink"
                  />
                </div>
              </div>

              <div className="mb-4 flex items-center gap-2">
                {beatDots}
                <div className="ml-2 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Beat: <span style={{ color: COLORS.gold }}>{beatInBar}</span>
                  {settings.subdivision !== "quarter" && (
                    <>
                      {" "}
                      | Sub: <span style={{ color: COLORS.gold }}>{subIndex}</span>
                    </>
                  )}
                </div>
              </div>

              <div
                className="relative mx-auto mt-2 flex h-64 w-full max-w-sm items-end justify-center overflow-hidden rounded-xl"
                style={{
                  background:
                    "radial-gradient(120% 140% at 50% 0%, rgba(215,180,106,0.14) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.35) 100%)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div
                  className="absolute bottom-0 h-56 w-56 rounded-2xl"
                  style={{
                    background: `linear-gradient(180deg, rgba(91,31,36,0.92) 0%, rgba(38,10,12,0.95) 100%)`,
                    border: "1px solid rgba(215,180,106,0.25)",
                    boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
                  }}
                />
                <div
                  className="absolute bottom-6 h-12 w-40 rounded-lg"
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(215,180,106,0.25)",
                  }}
                />
                {/* תיקון טקסט לפי הסימון שלך */}
                <div className="absolute bottom-8 text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>
                  מטרונום טיונר
                </div>

                <div
                  className="absolute"
                  style={{
                    bottom: 170,
                    left: "50%",
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    transform: "translateX(-50%)",
                    background: COLORS.gold,
                    boxShadow: "0 0 12px rgba(215,180,106,0.35)",
                  }}
                />

                <div
                  className="absolute origin-top"
                  style={{
                    bottom: 170,
                    left: "50%",
                    width: 6,
                    height: 140,
                    transform: `translateX(-50%) rotate(${pendulumAngle}deg)`,
                    transition: running ? "transform 16ms linear" : "transform 120ms ease",
                    background: `linear-gradient(180deg, ${COLORS.gold2} 0%, ${COLORS.gold} 100%)`,
                    borderRadius: 999,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 40,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 26,
                      height: 18,
                      borderRadius: 8,
                      background: "rgba(0,0,0,0.35)",
                      border: "1px solid rgba(215,180,106,0.35)",
                      boxShadow: "0 10px 22px rgba(0,0,0,0.45)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: -10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      background: flash.on ? COLORS.gold2 : COLORS.gold,
                      boxShadow: flash.on ? "0 0 16px rgba(241,209,138,0.55)" : "0 0 10px rgba(215,180,106,0.35)",
                      transition: "background 80ms ease, box-shadow 80ms ease",
                    }}
                    title="Pendulum tip"
                  />
                </div>

                <div
                  className="absolute bottom-[170px] left-0 right-0 flex items-center justify-between px-10 text-[10px]"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  <span>◀︎</span>
                  <span>▶︎</span>
                </div>
              </div>

              <div className="mt-4 text-xs leading-5" style={{ color: "rgba(255,255,255,0.6)" }}>
                טיפ: במובייל חובה ללחוץ “התחל” כדי שה־AudioContext יופעל.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
