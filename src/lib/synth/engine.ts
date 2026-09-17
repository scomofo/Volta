import { expMap, midiToFreq, type Waveform } from "./notes";

export type SynthParams = {
  waveform: Waveform;
  cutoff: number;
  resonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  volume: number;
};

const WAVE_GAIN: Record<Waveform, number> = {
  sine: 1,
  triangle: 0.9,
  sawtooth: 0.52,
  square: 0.38,
};

const MAX_VOICES = 8;

type Voice = {
  midi: number;
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  env: GainNode;
  startedAt: number;
  releasing: boolean;
};

export function cutoffHz(t: number): number {
  return expMap(t, 80, 12000);
}

export function attackSec(t: number): number {
  return expMap(t, 0.002, 2);
}

export function decaySec(t: number): number {
  return expMap(t, 0.02, 2);
}

export function releaseSec(t: number): number {
  return expMap(t, 0.02, 3);
}

export function resonanceQ(t: number): number {
  return 0.5 + t * 17.5;
}

function createAudioContext(): AudioContext {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) {
    throw new Error("Web Audio is not available");
  }
  return new Ctor({ latencyHint: "interactive" });
}

export class SynthEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  compressor: DynamicsCompressorNode | null = null;
  analyser: AnalyserNode | null = null;
  params: SynthParams = {
    waveform: "sawtooth",
    cutoff: 0.72,
    resonance: 0.18,
    attack: 0.1,
    decay: 0.28,
    sustain: 0.68,
    release: 0.32,
    volume: 0.72,
  };

  private voices = new Map<number, Voice>();
  private holds = new Map<number, number>();
  private timeDomain: Uint8Array<ArrayBuffer> | null = null;

  get armed(): boolean {
    return this.ctx !== null && this.ctx.state !== "closed";
  }

  /** Must run inside a user-gesture call stack. */
  arm(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.ctx) {
      this.ctx = createAudioContext();
      this.buildGraph();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return true;
  }

  resume(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  panic(): void {
    const now = this.ctx?.currentTime ?? 0;
    for (const midi of [...this.voices.keys()]) {
      this.releaseVoice(midi, now, 0.03);
    }
    this.holds.clear();
  }

  setParams(partial: Partial<SynthParams>): void {
    this.params = { ...this.params, ...partial };
    this.applyLiveParams();
  }

  noteOn(midi: number): void {
    this.arm();
    const ctx = this.ctx;
    if (!ctx) return;
    const holds = (this.holds.get(midi) ?? 0) + 1;
    this.holds.set(midi, holds);
    if (holds > 1) {
      const existing = this.voices.get(midi);
      if (existing && !existing.releasing) return;
    }
    this.startVoice(midi);
  }

  noteOff(midi: number): void {
    const holds = (this.holds.get(midi) ?? 0) - 1;
    if (holds > 0) {
      this.holds.set(midi, holds);
      return;
    }
    this.holds.delete(midi);
    const ctx = this.ctx;
    if (!ctx) return;
    this.releaseVoice(midi, ctx.currentTime, releaseSec(this.params.release));
  }

  getByteTimeDomain(): Uint8Array<ArrayBuffer> | null {
    if (!this.analyser || !this.timeDomain) return null;
    this.analyser.getByteTimeDomainData(this.timeDomain);
    return this.timeDomain;
  }

  rms(): number {
    const data = this.getByteTimeDomain();
    if (!data) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i]! - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }

  private buildGraph(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 3.2;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.12;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.35;
    this.timeDomain = new Uint8Array(this.analyser.fftSize);

    this.master.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(ctx.destination);
    this.applyMaster();
  }

  private applyMaster(): void {
    if (!this.master || !this.ctx) return;
    const g = this.params.volume ** 2 * 0.42;
    this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.03);
  }

  private applyLiveParams(): void {
    this.applyMaster();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const voice of this.voices.values()) {
      voice.osc.type = this.params.waveform;
      const tracked = cutoffHz(this.params.cutoff) * 2 ** (((voice.midi - 60) / 12) * 0.35);
      voice.filter.frequency.setTargetAtTime(Math.min(tracked, 18000), now, 0.02);
      voice.filter.Q.setTargetAtTime(resonanceQ(this.params.resonance), now, 0.02);
    }
  }

  private stealOldest(): void {
    if (this.voices.size < MAX_VOICES) return;
    let oldest: Voice | null = null;
    for (const v of this.voices.values()) {
      if (!oldest || v.startedAt < oldest.startedAt) oldest = v;
    }
    if (oldest) this.disposeVoice(oldest, true);
  }

  private startVoice(midi: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const existing = this.voices.get(midi);
    if (existing) this.disposeVoice(existing, true);

    this.stealOldest();

    const osc = ctx.createOscillator();
    osc.type = this.params.waveform;
    osc.frequency.value = midiToFreq(midi);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    const tracked = cutoffHz(this.params.cutoff) * 2 ** (((midi - 60) / 12) * 0.35);
    filter.frequency.value = Math.min(tracked, 18000);
    filter.Q.value = resonanceQ(this.params.resonance);

    const env = ctx.createGain();
    env.gain.value = 0;

    osc.connect(filter);
    filter.connect(env);
    env.connect(master);

    const now = ctx.currentTime;
    const a = attackSec(this.params.attack);
    const d = decaySec(this.params.decay);
    const s = this.params.sustain;
    const peak = WAVE_GAIN[this.params.waveform];

    env.gain.cancelScheduledValues(now);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(peak, now + a);
    env.gain.linearRampToValueAtTime(peak * s, now + a + d);

    osc.start(now);

    const voice: Voice = { midi, osc, filter, env, startedAt: now, releasing: false };
    this.voices.set(midi, voice);
    osc.onended = () => {
      if (this.voices.get(midi) === voice) this.voices.delete(midi);
      this.disposeVoice(voice, false);
    };
  }

  private releaseVoice(midi: number, now: number, release: number): void {
    const voice = this.voices.get(midi);
    if (!voice || !this.ctx) return;
    voice.releasing = true;
    const g = voice.env.gain;
    const current = Math.max(g.value, 0.0001);
    g.cancelScheduledValues(now);
    g.setValueAtTime(current, now);
    g.exponentialRampToValueAtTime(0.0001, now + Math.max(0.01, release));
    try {
      voice.osc.stop(now + Math.max(0.01, release) + 0.03);
    } catch {
      /* already stopped */
    }
  }

  private disposeVoice(voice: Voice, stop: boolean): void {
    try {
      if (stop) voice.osc.stop();
    } catch {
      /* already stopped */
    }
    try {
      voice.osc.disconnect();
      voice.filter.disconnect();
      voice.env.disconnect();
    } catch {
      /* already disconnected */
    }
    if (this.voices.get(voice.midi) === voice) this.voices.delete(voice.midi);
  }
}

let singleton: SynthEngine | null = null;

export function getEngine(): SynthEngine {
  if (!singleton) singleton = new SynthEngine();
  return singleton;
}
