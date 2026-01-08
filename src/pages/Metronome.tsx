import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MetronomeEngine,
  type MetronomeSettings,
  type MetronomeTickEvent,
  type MetronomeSound,
  type SubdivisionMode,
} from "@/lib/metronom/MetronomeEngine";

const COLORS = {
  gold: "#d8b15a",
  ink: "#1b1412",
};

const SUBDIVISIONS: { value: SubdivisionMode; label: string }[] = [
  { value: "quarter", label: "רבעים" },
  { value: "eighths", label: "שמיניות" },
  { value: "triplets", label: "טריולות" },
  { value: "sixteenths", label: "שש־עשריות" },
  { value: "swing", label: "סווינג (3:1)" },
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

/* ======== TUNER MATH (supports variable A4) ======== */
function noteFromFrequency(freq: number, a4: number = 440) {
  const noteNumber = 69 + 12 * Math.log2(freq / a4);
  return Math.round(noteNumber);
}

function frequencyFromNoteNumber(note: number, a4: number = 440) {
  return a4 * Math.pow(2, (note - 69) / 12);
}

function noteNameFromNumber(noteNumber: number) {
  const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteIndex = (noteNumber + 1200) % 12;
  const octave = Math.floor(noteNumber / 12) - 1;
  return `${noteStrings[noteIndex]}${octave}`;
}

function centsOffFromPitch(freq: number, noteNumber: number, a4: number = 440) {
  const ref = frequencyFromNoteNumber(noteNumber, a4);
  return Math.floor((1200 * Math.log2(freq / ref)) * 10) / 10; // 0.1 cents
}

/* ======== AUTOCORRELATION PITCH DETECTION ======== */
function autoCorrelate(buf: Float32Array, sampleRate: number) {
  // Based on Chris Wilson PitchDetect (with tweaks)
  const SIZE = buf.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    const val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return { freq: -1, confidence: 0 };

  // Trim edges (silence)
  let r1 = 0;
  let r2 = SIZE - 1;
  const THRESHOLD = 0.2;

  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < THRESHOLD) continue;
    r1 = i;
    break;
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < THRESHOLD) continue;
    r2 = SIZE - i;
    break;
  }

  const trimmed = buf.slice(r1, r2);
  const len = trimmed.length;
  const c = new Array<number>(len).fill(0);

  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len - i; j++) {
      c[i] = c[i] + trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (d < len && c[d] > c[d + 1]) d++;

  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < len; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;
  if (T0 <= 0) return { freq: -1, confidence: 0 };

  // Parabolic interpolation
  const x1 = c[T0 - 1] ?? 0;
  const x2 = c[T0] ?? 0;
  const x3 = c[T0 + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  const freq = sampleRate / T0;
  const confidence = clamp(maxval / (c[0] || 1), 0, 1);
  return { freq, confidence };
}

/* ===================== PAGE ===================== */

export default function Metronome() {
  const [tab, setTab] = useState<"metronome" | "tuner">("metronome");

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Header (נקי – בלי שורת הסבר) */}
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
            border: `1px solid ${
              tab === "tuner" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.18)"
            }`,
          }}
        >
          טיונר
        </button>
      </div>

      {tab === "metronome" ? <MetronomePanel /> : <TunerPanel />}
    </div>
  );
}

/* ===================== METRONOME ===================== */

function MetronomePanel() {
  const engineRef = useRef<MetronomeEngine | null>(null);

  const [bpm, setBpm] = useState<number>(120);
  const [beatsPerBar, setBeatsPerBar] = useState<number>(4);
  const [accentEvery, setAccentEvery] = useState<number>(2);
  const [subdivision, setSubdivision] = useState<SubdivisionMode>("quarter");
  const [sound, setSound] = useState<MetronomeSound>("classic_click");
  const [volume, setVolume] = useState<number>(0.9);

  const [running, setRunning] = useState(false);

  // UI callbacks
  const [beat, setBeat] = useState<number>(1);
  const [dotOn, setDotOn] = useState(false);

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new MetronomeEngine();
      engineRef.current.setUICallbacks({
        onTick: (e: MetronomeTickEvent) => {
          setBeat(e.beatInBar);
          setDotOn(true);
          window.setTimeout(() => setDotOn(false), 60);
        },
      });
    }

    return () => {
      try {
        engineRef.current?.stop();
      } catch {}
    };
  }, []);

  const settings: MetronomeSettings = useMemo(
    () => ({
      bpm,
      beatsPerBar,
      accentEvery,
      subdivision,
      sound,
      volume,
    }),
    [bpm, beatsPerBar, accentEvery, subdivision, sound, volume]
  );

  useEffect(() => {
    engineRef.current?.setSettings(settings);
  }, [settings]);

  const toggle = async () => {
    const engine = engineRef.current;
    if (!engine) return;

    if (!running) {
      await engine.start();
      setRunning(true);
    } else {
      engine.stop();
      setRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
          שליטה
        </div>

        <button
          onClick={toggle}
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{
            background: COLORS.gold,
            color: COLORS.ink,
            border: "1px solid rgba(0,0,0,0.25)",
          }}
        >
          {running ? "עצור" : "התחל"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="mb-2 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            BPM
          </div>

          <input
            type="range"
            min={20}
            max={300}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
            {bpm}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="mb-2 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            תצוגה
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
              Beat: {beat}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                נקודה
              </div>
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  background: dotOn ? COLORS.gold : "rgba(255,255,255,0.18)",
                  boxShadow: dotOn ? "0 0 12px rgba(216,177,90,0.65)" : "none",
                }}
              />
            </div>
          </div>

          {/* Placeholder area for your existing pendulum UI if you already have it elsewhere */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
              (התצוגה הוויזואלית שלך נמצאת כאן)
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="mb-2 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            מספר פעימות בתיבה (1–7)
          </div>

          <select
            value={beatsPerBar}
            onChange={(e) => setBeatsPerBar(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="mb-2 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            AccentEvery (0–7)
          </div>

          <select
            value={accentEvery}
            onChange={(e) => setAccentEvery(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "ללא" : `כל ${n} פעימות`}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="mb-2 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            חלוקה
          </div>

          <select
            value={subdivision}
            onChange={(e) => setSubdivision(e.target.value as SubdivisionMode)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          >
            {SUBDIVISIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="mb-2 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            צליל
          </div>

          <select
            value={sound}
            onChange={(e) => setSound(e.target.value as MetronomeSound)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          >
            {SOUNDS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4 md:col-span-2">
          <div className="mb-2 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            ווליום (0–1)
          </div>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
            {volume.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== TUNER ===================== */

function TunerPanel() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [micOn, setMicOn] = useState(false);
  const [freq, setFreq] = useState<number | null>(null);
  const [note, setNote] = useState<string>("—");
  const [cents, setCents] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);

  // MASTER TUNING (A4) 435–445
  const [a4, setA4] = useState<number>(440);

  const startMic = async () => {
    if (micOn) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    mediaStreamRef.current = stream;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    source.connect(analyser);

    const buf = new Float32Array(analyser.fftSize);

    const tick = () => {
      const an = analyserRef.current;
      const ctx = audioCtxRef.current;
      if (!an || !ctx) return;

      an.getFloatTimeDomainData(buf);
      const { freq: f, confidence: conf } = autoCorrelate(buf, ctx.sampleRate);

      if (f > 0 && conf > 0.1) {
        const nn = noteFromFrequency(f, a4);
        const c = centsOffFromPitch(f, nn, a4);
        setFreq(f);
        setNote(noteNameFromNumber(nn));
        setCents(c);
        setConfidence(conf);
      } else {
        setFreq(null);
        setNote("—");
        setCents(0);
        setConfidence(conf);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    setMicOn(true);
  };

  const stopMic = async () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    analyserRef.current = null;

    if (audioCtxRef.current) {
      try {
        await audioCtxRef.current.close();
      } catch {}
    }
    audioCtxRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    mediaStreamRef.current = null;

    setMicOn(false);
  };

  useEffect(() => {
    return () => {
      stopMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needleX = useMemo(() => {
    // cents typically -50..+50
    const v = clamp(cents, -50, 50);
    const pct = (v + 50) / 100;
    return pct * 100;
  }, [cents]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
          טיונר (מיקרופון)
        </div>

        <button
          onClick={micOn ? stopMic : startMic}
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{
            background: micOn ? "rgba(255,255,255,0.12)" : COLORS.gold,
            color: micOn ? "rgba(255,255,255,0.9)" : COLORS.ink,
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          {micOn ? "כבה מיקרופון" : "הפעל מיקרופון"}
        </button>
      </div>

      {/* A4 Master Tuning */}
      <div className="mt-4 flex flex-col gap-2">
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
          className="w-full"
        />

        <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
          טווח כיוון: 435–445Hz (ברירת מחדל 440Hz)
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="mb-2 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            תו
          </div>
          <div className="text-3xl font-bold" style={{ color: COLORS.gold }}>
            {note}
          </div>
          <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
            {micOn ? (confidence > 0.1 ? "קולט" : "שקט/לא יציב") : "מיקרופון כבוי"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="mb-2 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            תדר (Hz)
          </div>
          <div className="text-2xl font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
            {freq ? freq.toFixed(2) : "—"}
          </div>
          <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
            מומלץ טווח עבודה: ~40Hz–2000Hz
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="mb-2 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
            סטייה (cents)
          </div>

          <div className="mb-2 text-2xl font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
            {freq ? `${cents > 0 ? "+" : ""}${cents.toFixed(1)}` : "—"}
          </div>

          <div className="relative mt-3 h-2 w-full rounded-full bg-white/10">
            <div className="absolute left-1/2 top-[-6px] h-6 w-[2px] bg-white/30" />
            <div
              className="absolute top-[-7px] h-6 w-3 rounded-full"
              style={{
                left: `calc(${needleX}% - 6px)`,
                background: COLORS.gold,
                boxShadow: "0 0 12px rgba(216,177,90,0.55)",
              }}
            />
          </div>

          <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
            יעד: ±5 סנט (כמעט מדויק)
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
        טיפ: אם הטיונר “קופץ” — התקרבי למקור הצליל, כבי רעשי רקע, ונגני תו יציב (ללא ויברטו חזק).
      </div>
    </div>
  );
}
