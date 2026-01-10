/* eslint-disable no-console */

export type TunerState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "running"; hz: number; note: string; cents: number; clarity: number }
  | { status: "no_signal" }
  | { status: "permission_denied" }
  | { status: "error"; message: string };

export interface TunerOptions {
  a4Hz?: number;
  smoothingTimeConstant?: number;
  fftSize?: number;
  minHz?: number;
  maxHz?: number;

  fluteMinHz?: number;
  fluteMaxHz?: number;
  minClarity?: number;
  absoluteMinRms?: number;
  rmsFactor?: number;
  attackMs?: number;
  releaseMs?: number;
  minNoteMs?: number;
  maxGapMs?: number;

  /** NEW: duration measurement target */
  durationTarget?: "ANY_FLUTE" | "A4_A5";
  durationTargetCents?: number; // +/- cents around A4/A5 (default 150)
}

export type NoteMeasurement = {
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  durationSec: number;
  lastHz?: number;
};

export class TunerEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  private rafId: number | null = null;
  private buf: Float32Array<ArrayBufferLike> = new Float32Array(2048);

  private a4Hz = 440;
  private minHz = 50;
  private maxHz = 2000;

  private onState?: (s: TunerState) => void;
  private onNoteMeasured?: (m: NoteMeasurement) => void;

  private gate = {
    active: false,
    startedAtMs: 0,
    silentMs: 0,
    lastHz: undefined as number | undefined,
    noiseRms: 0.008,
  };

  private measureCfg = {
    fluteMinHz: 180,
    fluteMaxHz: 2600,
    minClarity: 0.58,
    absoluteMinRms: 0.004,
    rmsFactor: 2.0,
    attackMs: 40,
    releaseMs: 150,
    minNoteMs: 90,

    // NEW:
    durationTarget: "A4_A5" as "ANY_FLUTE" | "A4_A5",
    durationTargetCents: 150,
  };

  constructor(opts?: TunerOptions) {
    if (opts?.a4Hz) this.a4Hz = opts.a4Hz;
    if (opts?.minHz) this.minHz = opts.minHz;
    if (opts?.maxHz) this.maxHz = opts.maxHz;
    this.applyMeasureOptions(opts);
  }

  setOnState(cb?: (s: TunerState) => void) {
    this.onState = cb;
  }

  setOnNoteMeasured(cb?: (m: NoteMeasurement) => void) {
    this.onNoteMeasured = cb;
  }

  private emit(s: TunerState) {
    this.onState?.(s);
  }

  private emitNote(m: NoteMeasurement) {
    this.onNoteMeasured?.(m);
  }

  private applyMeasureOptions(opts?: TunerOptions) {
    if (!opts) return;

    if (typeof opts.fluteMinHz === "number") this.measureCfg.fluteMinHz = opts.fluteMinHz;
    if (typeof opts.fluteMaxHz === "number") this.measureCfg.fluteMaxHz = opts.fluteMaxHz;
    if (typeof opts.minClarity === "number") this.measureCfg.minClarity = opts.minClarity;
    if (typeof opts.absoluteMinRms === "number") this.measureCfg.absoluteMinRms = opts.absoluteMinRms;
    if (typeof opts.rmsFactor === "number") this.measureCfg.rmsFactor = opts.rmsFactor;
    if (typeof opts.attackMs === "number") this.measureCfg.attackMs = opts.attackMs;
    if (typeof opts.releaseMs === "number") this.measureCfg.releaseMs = opts.releaseMs;
    if (typeof opts.maxGapMs === "number") this.measureCfg.releaseMs = opts.maxGapMs;
    if (typeof opts.minNoteMs === "number") this.measureCfg.minNoteMs = opts.minNoteMs;

    if (opts.durationTarget) this.measureCfg.durationTarget = opts.durationTarget;
    if (typeof opts.durationTargetCents === "number") this.measureCfg.durationTargetCents = opts.durationTargetCents;
  }

  async start(opts?: TunerOptions) {
    try {
      this.emit({ status: "starting" });
      this.applyMeasureOptions(opts);

      if (!this.audioCtx) {
        // @ts-ignore
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new Ctx();
      }

      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = opts?.fftSize ?? 2048;
      this.analyser.smoothingTimeConstant = opts?.smoothingTimeConstant ?? 0.2;

      this.buf = new Float32Array(this.analyser.fftSize);
      this.source = this.audioCtx.createMediaStreamSource(this.stream);

      // gentle highpass for rumble
      const hp = this.audioCtx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 120;

      this.source.connect(hp);
      hp.connect(this.analyser);

      this.minHz = opts?.minHz ?? this.minHz;
      this.maxHz = opts?.maxHz ?? this.maxHz;
      this.a4Hz = opts?.a4Hz ?? this.a4Hz;

      this.gate = {
        active: false,
        startedAtMs: 0,
        silentMs: 0,
        lastHz: undefined,
        noiseRms: 0.008,
      };

      this.loop();
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
        this.emit({ status: "permission_denied" });
      } else {
        this.emit({ status: "error", message: e?.message ?? String(e) });
      }
      this.stop();
    }
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;

    try { this.source?.disconnect(); } catch {}
    this.source = null;
    this.analyser = null;

    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    this.stream = null;

    this.emit({ status: "idle" });
  }

  private loop = () => {
    if (!this.analyser) {
      this.emit({ status: "idle" });
      return;
    }

    this.analyser.getFloatTimeDomainData(this.buf as Float32Array<ArrayBuffer>);

    const { hz, clarity, rms } = estimatePitchAutoCorr(this.buf, this.audioCtx!.sampleRate, this.minHz, this.maxHz);

    // tuner state
    if (!hz || clarity < 0.55) {
      this.emit({ status: "no_signal" });
    } else {
      const { note, cents } = hzToNote(hz, this.a4Hz);
      this.emit({ status: "running", hz, note, cents, clarity });
    }

    // duration measurement
    this.updateNoteDuration({ timeMs: performance.now(), hz, clarity, rms });

    this.rafId = requestAnimationFrame(this.loop);
  };

  private isAllowedDurationPitch(hz: number) {
    const cfg = this.measureCfg;
    if (cfg.durationTarget === "ANY_FLUTE") return true;

    // A4 & A5 relative to current a4
    const A4 = this.a4Hz;
    const A5 = this.a4Hz * 2;
    const tol = cfg.durationTargetCents;

    const d4 = centsDiff(hz, A4);
    const d5 = centsDiff(hz, A5);

    return Math.abs(d4) <= tol || Math.abs(d5) <= tol;
  }

  private updateNoteDuration(input: { timeMs: number; hz: number | null; clarity: number; rms: number }) {
    const cfg = this.measureCfg;
    const g = this.gate;

    const inFluteBand =
      typeof input.hz === "number" && input.hz >= cfg.fluteMinHz && input.hz <= cfg.fluteMaxHz;

    const pitchReliable =
      typeof input.hz === "number" &&
      input.clarity >= cfg.minClarity &&
      inFluteBand &&
      this.isAllowedDurationPitch(input.hz);

    // update noise floor only when idle and NOT reliable
    if (!g.active && !pitchReliable) {
      const alpha = 0.03;
      g.noiseRms = g.noiseRms * (1 - alpha) + input.rms * alpha;
      g.noiseRms = clamp(g.noiseRms, 0.0015, 0.08);
    }

    const dynamicThreshold = Math.max(cfg.absoluteMinRms, g.noiseRms * cfg.rmsFactor);
    const looksLikeNote = pitchReliable && input.rms >= dynamicThreshold;

    const dtMs = 16;

    if (!g.active) {
      if (looksLikeNote) {
        g.silentMs += dtMs; // attack accumulator
        if (g.silentMs >= cfg.attackMs) {
          g.active = true;
          g.startedAtMs = input.timeMs;
          g.lastHz = input.hz ?? undefined;
          g.silentMs = 0;
        }
      } else {
        g.silentMs = 0;
      }
      return;
    }

    // active note
    if (looksLikeNote) {
      g.silentMs = 0;
      g.lastHz = input.hz ?? g.lastHz;
      return;
    }

    // release/gap
    g.silentMs += dtMs;
    if (g.silentMs < cfg.releaseMs) return;

    // end note
    const endedAtMs = input.timeMs;
    const durationMs = endedAtMs - g.startedAtMs;

    if (durationMs >= cfg.minNoteMs) {
      const durationSec = Math.round((durationMs / 1000) * 100) / 100;
      this.emitNote({
        startedAtMs: g.startedAtMs,
        endedAtMs,
        durationMs,
        durationSec,
        lastHz: g.lastHz,
      });
    }

    g.active = false;
    g.silentMs = 0;
    g.lastHz = undefined;
  }
}

/** Autocorrelation pitch estimator */
function estimatePitchAutoCorr(
  input: Float32Array<ArrayBufferLike>,
  sampleRate: number,
  minHz: number,
  maxHz: number
): { hz: number | null; clarity: number; rms: number } {
  let mean = 0;
  for (let i = 0; i < input.length; i++) mean += input[i];
  mean /= input.length;

  let rms = 0;
  for (let i = 0; i < input.length; i++) {
    const v = input[i] - mean;
    rms += v * v;
  }
  rms = Math.sqrt(rms / input.length);

  if (rms < 0.003) return { hz: null, clarity: 0, rms };

  const size = input.length;
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.floor(sampleRate / minHz);

  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag <= Math.min(maxLag, size - 2); lag++) {
    let corr = 0;
    for (let i = 0; i < size - lag; i++) {
      const a = input[i] - mean;
      const b = input[i + lag] - mean;
      corr += a * b;
    }
    corr = corr / (size - lag);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag <= 0) return { hz: null, clarity: 0, rms };

  const lag = bestLag;
  const y0 = autoCorrAtLag(input, mean, lag - 1);
  const y1 = autoCorrAtLag(input, mean, lag);
  const y2 = autoCorrAtLag(input, mean, lag + 1);

  const denom = y0 - 2 * y1 + y2;
  let shift = 0;
  if (Math.abs(denom) > 1e-12) shift = 0.5 * (y0 - y2) / denom;

  const betterLag = lag + shift;
  const hz = sampleRate / betterLag;

  const clarity = clamp(bestCorr / (rms * rms + 1e-9), 0, 1);
  if (!isFinite(hz) || hz < minHz || hz > maxHz) return { hz: null, clarity: 0, rms };

  return { hz, clarity, rms };
}

function autoCorrAtLag(input: Float32Array<ArrayBufferLike>, mean: number, lag: number) {
  if (lag < 1) return 0;
  const size = input.length;
  let corr = 0;
  const n = size - lag;
  for (let i = 0; i < n; i++) {
    const a = input[i] - mean;
    const b = input[i + lag] - mean;
    corr += a * b;
  }
  return corr / n;
}

function hzToNote(hz: number, a4: number) {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const n = 69 + 12 * Math.log2(hz / a4);
  const midi = Math.round(n);
  const noteIndex = (midi + 1200) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const note = `${noteNames[noteIndex]}${octave}`;
  const nearestHz = a4 * Math.pow(2, (midi - 69) / 12);
  const cents = Math.round(1200 * Math.log2(hz / nearestHz));
  return { note, cents };
}

function centsDiff(hz: number, centerHz: number) {
  return 1200 * Math.log2(hz / centerHz);
}

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}
