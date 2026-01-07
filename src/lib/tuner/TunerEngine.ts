/* eslint-disable no-console */

/**
 * Simple Tuner Engine (Web Audio + getUserMedia)
 * - Starts/stops microphone capture
 * - Estimates pitch (Hz) via autocorrelation
 * - Converts to note + cents
 *
 * Notes:
 * - Works best on HTTPS (Lovable preview is HTTPS)
 * - Needs user gesture to start audio (button click)
 * - On iOS/Safari: must be initiated from a direct user action
 */

export type TunerState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "running"; hz: number; note: string; cents: number; clarity: number }
  | { status: "no_signal" }
  | { status: "permission_denied" }
  | { status: "error"; message: string };

export interface TunerOptions {
  a4Hz?: number; // default 440
  smoothingTimeConstant?: number; // analyser smoothing
  fftSize?: number; // default 2048
  minHz?: number; // default 50
  maxHz?: number; // default 2000
}

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

  constructor(opts?: TunerOptions) {
    if (opts?.a4Hz) this.a4Hz = opts.a4Hz;
    if (opts?.minHz) this.minHz = opts.minHz;
    if (opts?.maxHz) this.maxHz = opts.maxHz;

    // analyser params will be set in start()
  }

  setOnState(cb?: (s: TunerState) => void) {
    this.onState = cb;
  }

  private emit(s: TunerState) {
    this.onState?.(s);
  }

  async start(opts?: TunerOptions) {
    try {
      this.emit({ status: "starting" });

      if (!this.audioCtx) {
        // @ts-ignore
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new Ctx();
      }

      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = opts?.fftSize ?? 2048;
      this.analyser.smoothingTimeConstant = opts?.smoothingTimeConstant ?? 0.2;

      this.buf = new Float32Array(this.analyser.fftSize);

      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      this.minHz = opts?.minHz ?? this.minHz;
      this.maxHz = opts?.maxHz ?? this.maxHz;
      this.a4Hz = opts?.a4Hz ?? this.a4Hz;

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

    try {
      this.source?.disconnect();
    } catch {}

    this.source = null;
    this.analyser = null;

    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
    }
    this.stream = null;

    // keep audioCtx for fast restart (optional)
    this.emit({ status: "idle" });
  }

  private loop = () => {
    if (!this.analyser) {
      this.emit({ status: "idle" });
      return;
    }

    this.analyser.getFloatTimeDomainData(this.buf as Float32Array<ArrayBuffer>);

    const { hz, clarity } = estimatePitchAutoCorr(this.buf, this.audioCtx!.sampleRate, this.minHz, this.maxHz);

    if (!hz || clarity < 0.55) {
      this.emit({ status: "no_signal" });
    } else {
      const { note, cents } = hzToNote(hz, this.a4Hz);
      this.emit({ status: "running", hz, note, cents, clarity });
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}

/**
 * Autocorrelation pitch estimator
 * returns hz + clarity (0..1)
 */
function estimatePitchAutoCorr(
  input: Float32Array<ArrayBufferLike>,
  sampleRate: number,
  minHz: number,
  maxHz: number
): { hz: number | null; clarity: number } {
  // 1) remove DC + compute RMS (signal)
  let mean = 0;
  for (let i = 0; i < input.length; i++) mean += input[i];
  mean /= input.length;

  let rms = 0;
  for (let i = 0; i < input.length; i++) {
    const v = input[i] - mean;
    rms += v * v;
  }
  rms = Math.sqrt(rms / input.length);

  if (rms < 0.01) return { hz: null, clarity: 0 }; // very low signal

  // 2) autocorrelation
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

  if (bestLag <= 0) return { hz: null, clarity: 0 };

  // 3) parabolic interpolation around bestLag for better precision
  const lag = bestLag;
  const y0 = autoCorrAtLag(input, mean, lag - 1);
  const y1 = autoCorrAtLag(input, mean, lag);
  const y2 = autoCorrAtLag(input, mean, lag + 1);

  const denom = (y0 - 2 * y1 + y2);
  let shift = 0;
  if (Math.abs(denom) > 1e-12) {
    shift = 0.5 * (y0 - y2) / denom; // -0.5..0.5 typically
  }

  const betterLag = lag + shift;
  const hz = sampleRate / betterLag;

  // clarity: normalize corr by energy (roughly)
  const clarity = clamp(bestCorr / (rms * rms + 1e-9), 0, 1);

  if (!isFinite(hz) || hz < minHz || hz > maxHz) return { hz: null, clarity: 0 };

  return { hz, clarity };
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

  // midi note
  const n = 69 + 12 * Math.log2(hz / a4);
  const midi = Math.round(n);

  const noteIndex = (midi + 1200) % 12;
  const octave = Math.floor(midi / 12) - 1;

  const note = `${noteNames[noteIndex]}${octave}`;

  // cents difference from nearest semitone
  const nearestHz = a4 * Math.pow(2, (midi - 69) / 12);
  const cents = Math.round(1200 * Math.log2(hz / nearestHz));

  return { note, cents };
}

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}
