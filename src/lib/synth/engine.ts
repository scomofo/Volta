import {
  expMap,
  footageRatio,
  midiToFreq,
  velocityAmpPeak,
  velocityCutoffHz,
  velocityNorm,
  type Footage,
  type OscWave,
} from "./notes.ts";
import { SWARM_WORKLET, couplingRate } from "./swarm.ts";
import { LADDER_WORKLET } from "./ladder-worklet.ts";
import { TAP_WORKLET } from "./tap-worklet.ts";
import { TakeRecorder } from "./recorder.ts";
import { encodeWav } from "./wav.ts";
import { vibratoGainHz, vibratoRateHz } from "./modulation.ts";
import { bendRatio } from "./performance.ts";




export type SynthParams = {
  osc1Wave: OscWave;
  osc1Footage: Footage;
  osc2Wave: OscWave;
  osc2Footage: Footage;
  osc2Tune: number;
  osc3Wave: OscWave;
  osc3Footage: Footage;
  osc3Tune: number;
  osc3Follow: boolean;
  mix1: number;
  mix2: number;
  mix3: number;
  mixNoise: number;
  swarm: number;
  swarmLock: number;
  cutoff: number;
  emphasis: number;
  contour: number;
  filterAttack: number;
  filterDecay: number;
  filterSustain: number;
  filterTrack: number;
  ampAttack: number;
  ampDecay: number;
  ampSustain: number;
  glide: number;
  vibratoRate: number;
  vibratoDepth: number;
  pitchMod: number;
  filterMod: number;
  /** Velocity amount 0..1. 0 = off: notes behave exactly as before (legacy). */
  velocity: number;
  volume: number;
  tune: number;
  a440: boolean;
};

export const DEFAULT_PARAMS: SynthParams = {
  osc1Wave: "sawtooth",
  osc1Footage: "8",
  osc2Wave: "sawtooth",
  osc2Footage: "8",
  osc2Tune: 0.52,
  osc3Wave: "sawtooth",
  osc3Footage: "16",
  osc3Tune: 0.48,
  osc3Follow: true,
  mix1: 0.74,
  mix2: 0.62,
  mix3: 0.42,
  mixNoise: 0,
  swarm: 0,
  swarmLock: 0.5,
  cutoff: 0.58,
  emphasis: 0.32,
  contour: 0.55,
  filterAttack: 0.08,
  filterDecay: 0.42,
  filterSustain: 0.28,
  filterTrack: 0.66,
  ampAttack: 0.06,
  ampDecay: 0.48,
  ampSustain: 0.82,
  glide: 0,
  vibratoRate: 0.42,
  vibratoDepth: 0,
  pitchMod: 0,
  filterMod: 0,
  velocity: 0,
  volume: 0.72,
  tune: 0.5,
  a440: false,
};

export function cutoffHz(t: number): number {
  return expMap(t, 40, 14000);
}

export function attackSec(t: number): number {
  return expMap(t, 0.001, 3);
}

export function decaySec(t: number): number {
  return expMap(t, 0.04, 12);
}

export function glideSec(t: number): number {
  if (t < 0.02) return 0;
  return expMap(t, 0.012, 1.4);
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

function makeShaper(ctx: AudioContext): WaveShaperNode {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.55);
  }
  const shaper = ctx.createWaveShaper();
  shaper.curve = curve;
  shaper.oversample = "2x";
  return shaper;
}

function makePulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const n = 64;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  }
  return ctx.createPeriodicWave(real, imag);
}

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function tuneSemis(t: number): number {
  return (t - 0.5) * 14;
}

// Processor names live for the AudioContext's lifetime, even after a tap stops.
// Share in-flight loads as well as successful ones; only failed loads may retry.
const tapModules = new WeakMap<AudioContext, Promise<void>>();

function loadTapModule(ctx: AudioContext): Promise<void> {
  const existing = tapModules.get(ctx);
  if (existing) return existing;
  const url = URL.createObjectURL(new Blob([TAP_WORKLET], { type: "application/javascript" }));
  const loading = Promise.resolve()
    .then(() => ctx.audioWorklet.addModule(url))
    .catch((error: unknown) => {
      tapModules.delete(ctx);
      throw error;
    })
    .finally(() => URL.revokeObjectURL(url));
  tapModules.set(ctx, loading);
  return loading;
}

export class SynthEngine {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  params: SynthParams = { ...DEFAULT_PARAMS };

  private oscs: OscillatorNode[] = [];
  private oscGains: GainNode[] = [];
  private noise: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private mixer: GainNode | null = null;
  private vca: GainNode | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private ladderWorklet: AudioWorkletNode | null = null;
  private swarmWorklet: AudioWorkletNode | null = null;
  private swarmGain: GainNode | null = null;
  private vibratoOscillator: OscillatorNode | null = null;
  private vibratoGains: GainNode[] = [];
  private biquads: BiquadFilterNode[] = [];
  private shaper: WaveShaperNode | null = null;
  private cutoffTargets: AudioParam[] = [];
  private filterEnv: GainNode | null = null;
  private contourAmt: GainNode | null = null;
  private ampEnv: GainNode | null = null;
  private pitchModGain: GainNode | null = null;
  private filterModGain: GainNode | null = null;
  private a440Osc: OscillatorNode | null = null;
  private a440Gain: GainNode | null = null;
  private pulseWave: PeriodicWave | null = null;
  private dc: ConstantSourceNode | null = null;
  private timeDomain: Uint8Array<ArrayBuffer> | null = null;
  private stack: number[] = [];
  private envOpen = false;
  private lastMidi = 60;
  private lastVelocity = 1;
  private velCutoffHz = 0;
  /** Pitch-wheel offset in semitones; applied to every oscillator in setPitch. */
  private bendSemitones = 0;
  private workletReady = false;
  private swarmReady = false;
  private tapNode: AudioWorkletNode | null = null;
  private tapSource: AnalyserNode | null = null;
  private tapGeneration = 0;
  private take: TakeRecorder | null = null;
  private takePatchName = "";

  get armed(): boolean {
    return this.ctx !== null && this.ctx.state !== "closed";
  }

  /** Must run inside a user-gesture call stack. */
  arm(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.ctx) {
      this.ctx = createAudioContext();
      this.buildGraph();
      void this.upgradeLadder();
      void this.upgradeSwarm();
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
    this.stack = [];
    this.envOpen = false;
    this.releaseEnvelopes(0.03);
  }

  setParams(partial: Partial<SynthParams>): void {
    this.params = { ...this.params, ...partial };
    this.applyLiveParams();
  }

  noteOn(midi: number, velocity = 100): void {
    this.arm();
    if (!this.ctx) return;
    this.stack = this.stack.filter((m) => m !== midi);
    const legato = this.stack.length > 0 && this.envOpen;
    this.stack.push(midi);
    this.lastVelocity = velocityNorm(velocity);
    this.velCutoffHz = velocityCutoffHz(this.lastVelocity, this.params.velocity);
    this.setPitch(midi, legato);
    if (!legato) this.triggerEnvelopes();
    this.envOpen = true;
  }

  noteOff(midi: number): void {
    this.stack = this.stack.filter((m) => m !== midi);
    if (this.stack.length) {
      this.setPitch(this.stack[this.stack.length - 1]!, true);
      return;
    }
    this.releaseEnvelopes();
    this.envOpen = false;
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

  /**
   * True while the tap is capturing. Note: after the length cap trips the
   * tap disconnects but the finished take is still held for stopRecording().
   */
  get recording(): boolean {
    return this.tapNode !== null;
  }

  recordedSeconds(): number {
    return this.take?.recordedSeconds ?? 0;
  }

  /**
   * Capture the master output as 16-bit PCM. Tap point is after the
   * analyser (post master-volume, post compressor): what you hear is what
   * gets recorded. Recording survives patch changes; the filename uses the
   * patch name from when recording started. Takes auto-stop at 5:00.
   * Must run inside a user-gesture call stack.
   */
  async startRecording(patchName: string): Promise<boolean> {
    this.arm();
    const ctx = this.ctx;
    const source = this.analyser;
    if (!ctx || !source || this.tapNode || this.take) return false;
    const generation = this.tapGeneration;
    let node: AudioWorkletNode;
    try {
      await loadTapModule(ctx);
      if (
        this.ctx !== ctx || this.analyser !== source || this.tapNode || this.take ||
        this.tapGeneration !== generation
      ) return false;
      node = new AudioWorkletNode(ctx, "volta-tap", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
      });
    } catch {
      return false;
    }
    const take = new TakeRecorder(ctx.sampleRate);
    node.port.onmessage = (event: MessageEvent) => {
      const active = this.take;
      if (!active || active !== take) return;
      const chans = (event.data?.channels ?? []) as Float32Array[];
      active.push(chans);
      if (active.capped) this.disconnectTap();
    };
    source.connect(node);
    this.tapNode = node;
    this.tapSource = source;
    this.take = take;
    this.takePatchName = patchName;
    return true;
  }

  /**
   * Stop the tap and encode the take as a 16-bit WAV. Returns null when
   * nothing was recording or the take was too short to keep.
   */
  stopRecording(): {
    wav: ArrayBuffer;
    patchName: string;
    seconds: number;
    capped: boolean;
  } | null {
    this.tapGeneration++;
    const take = this.take;
    this.disconnectTap();
    this.take = null;
    if (!take) return null;
    const pcm = take.finish();
    if (!pcm) return null;
    return {
      wav: encodeWav(pcm),
      patchName: this.takePatchName,
      seconds: take.recordedSeconds,
      capped: take.capped,
    };
  }

  /** Stop the tap and throw the take away. */
  cancelRecording(): void {
    this.tapGeneration++;
    this.disconnectTap();
    this.take = null;
  }

  private disconnectTap(): void {
    if (this.tapNode) {
      // This sink has no outputs: disconnect its incoming edge explicitly.
      try {
        this.tapSource?.disconnect(this.tapNode);
      } catch {
        /* already disconnected */
      }
      this.tapNode.port.onmessage = null;
      this.tapNode.port.close();
      try {
        this.tapNode.disconnect();
      } catch {
        /* already disconnected */
      }
      this.tapNode = null;
      this.tapSource = null;
    }
  }

  private buildGraph(): void {
    const ctx = this.ctx!;
    this.pulseWave = makePulseWave(ctx, 0.18);

    this.mixer = ctx.createGain();
    this.mixer.gain.value = 1;
    this.shaper = makeShaper(ctx);

    this.biquads = [0, 1, 2, 3].map(() => {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = cutoffHz(this.params.cutoff);
      f.Q.value = 0.5;
      return f;
    });
    this.biquads[0]!.connect(this.biquads[1]!);
    this.biquads[1]!.connect(this.biquads[2]!);
    this.biquads[2]!.connect(this.biquads[3]!);
    this.cutoffTargets = this.biquads.map((b) => b.frequency);

    this.vca = ctx.createGain();
    this.vca.gain.value = 1;
    this.ampEnv = ctx.createGain();
    this.ampEnv.gain.value = 0;

    this.master = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 2.8;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.18;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.32;
    this.timeDomain = new Uint8Array(this.analyser.fftSize);

    this.mixer.connect(this.shaper);
    this.shaper.connect(this.biquads[0]!);
    this.biquads[3]!.connect(this.ampEnv);
    this.ampEnv.connect(this.vca);
    this.vca.connect(this.master);
    this.master.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.oscs = [];
    this.oscGains = [];
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = midiToFreq(60);
      osc.connect(gain);
      gain.connect(this.mixer);
      osc.start();
      this.oscs.push(osc);
      this.oscGains.push(gain);
    }

    this.vibratoOscillator = ctx.createOscillator();
    this.vibratoOscillator.type = "sine";
    this.vibratoOscillator.frequency.value = vibratoRateHz(this.params.vibratoRate);
    for (const osc of this.oscs) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      this.vibratoOscillator.connect(gain);
      gain.connect(osc.frequency);
      this.vibratoGains.push(gain);
    }
    this.vibratoOscillator.start();

    this.noise = ctx.createBufferSource();
    this.noise.buffer = makeNoiseBuffer(ctx);
    this.noise.loop = true;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    this.noise.connect(this.noiseGain);
    this.noiseGain.connect(this.mixer);
    this.noise.start();

    this.swarmGain = ctx.createGain();
    this.swarmGain.gain.value = 0;
    this.swarmGain.connect(this.mixer);

    this.dc = ctx.createConstantSource();
    this.dc.offset.value = 1;
    this.filterEnv = ctx.createGain();
    this.filterEnv.gain.value = 0;
    this.contourAmt = ctx.createGain();
    this.contourAmt.gain.value = 0;
    this.dc.connect(this.filterEnv);
    this.filterEnv.connect(this.contourAmt);
    this.dc.start();
    this.connectToCutoff(this.contourAmt);

    this.pitchModGain = ctx.createGain();
    this.pitchModGain.gain.value = 0;
    this.filterModGain = ctx.createGain();
    this.filterModGain.gain.value = 0;
    this.oscs[2]!.connect(this.pitchModGain);
    this.oscs[2]!.connect(this.filterModGain);
    this.pitchModGain.connect(this.oscs[0]!.frequency);
    this.pitchModGain.connect(this.oscs[1]!.frequency);
    this.connectToCutoff(this.filterModGain);

    this.a440Gain = ctx.createGain();
    this.a440Gain.gain.value = 0;
    this.a440Osc = ctx.createOscillator();
    this.a440Osc.type = "sine";
    this.a440Osc.frequency.value = 440;
    this.a440Osc.connect(this.a440Gain);
    this.a440Gain.connect(this.master);
    this.a440Osc.start();

    this.applyLiveParams();
    this.setCutoff(cutoffHz(this.params.cutoff), ctx.currentTime, 0.01);
  }

  private async upgradeLadder(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || this.workletReady) return;
    try {
      const url = URL.createObjectURL(new Blob([LADDER_WORKLET], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      if (this.ctx !== ctx || !this.shaper || !this.ampEnv || !this.biquads[0]) return;

      const node = new AudioWorkletNode(ctx, "moog-ladder", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      const cutoff = node.parameters.get("cutoff");
      const res = node.parameters.get("resonance");
      if (cutoff) cutoff.value = cutoffHz(this.params.cutoff);
      if (res) res.value = this.params.emphasis;

      this.shaper.disconnect();
      this.biquads[3]?.disconnect();
      this.shaper.connect(node);
      node.connect(this.ampEnv);

      this.disconnectCutoff(this.contourAmt);
      this.disconnectCutoff(this.filterModGain);
      this.biquads = [];
      this.ladderWorklet = node;
      this.cutoffTargets = cutoff ? [cutoff] : [];
      this.connectToCutoff(this.contourAmt);
      this.connectToCutoff(this.filterModGain);
      this.workletReady = true;
      this.applyLiveParams();
    } catch {
      this.workletReady = false;
    }
  }

  private async upgradeSwarm(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || this.swarmReady) return;
    try {
      const url = URL.createObjectURL(new Blob([SWARM_WORKLET], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      if (this.ctx !== ctx || !this.swarmGain || !this.mixer) return;

      const node = new AudioWorkletNode(ctx, "swarm-osc", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      node.connect(this.swarmGain);
      this.swarmWorklet = node;
      this.swarmReady = true;
      this.applyLiveParams();
      this.setPitch(this.lastMidi, false);
    } catch {
      this.swarmReady = false;
    }
  }

  private connectToCutoff(source: GainNode | null): void {
    if (!source) return;
    for (const param of this.cutoffTargets) {
      try {
        source.connect(param);
      } catch {
        /* already connected */
      }
    }
  }

  private disconnectCutoff(source: GainNode | null): void {
    if (!source) return;
    try {
      source.disconnect();
    } catch {
      /* already disconnected */
    }
  }

  private applyLiveParams(): void {
    if (!this.ctx) return;
    const p = this.params;
    const now = this.ctx.currentTime;

    this.vibratoOscillator?.frequency.setTargetAtTime(vibratoRateHz(p.vibratoRate), now, 0.02);
    this.applyWave(this.oscs[0], p.osc1Wave);
    this.applyWave(this.oscs[1], p.osc2Wave);
    this.applyWave(this.oscs[2], p.osc3Wave);

    this.setMix(this.oscGains[0], p.mix1 ** 2 * 0.42);
    this.setMix(this.oscGains[1], p.mix2 ** 2 * 0.42);
    this.setMix(this.oscGains[2], p.mix3 ** 2 * 0.38);
    this.setMix(this.noiseGain, p.mixNoise ** 2 * 0.28);
    this.setMix(this.swarmGain, p.swarm ** 2 * 0.5);

    if (this.swarmWorklet) {
      const lock = this.swarmWorklet.parameters.get("lock");
      lock?.setTargetAtTime(couplingRate(p.swarmLock), now, 0.02);
    }

    if (this.master) {
      this.master.gain.setTargetAtTime(p.volume ** 2 * 0.5, now, 0.03);
    }
    if (this.a440Gain) {
      this.a440Gain.gain.setTargetAtTime(p.a440 ? 0.12 : 0, now, 0.02);
    }
    if (this.contourAmt) {
      this.contourAmt.gain.setTargetAtTime(p.contour * 7200, now, 0.02);
    }
    if (this.pitchModGain) {
      this.pitchModGain.gain.setTargetAtTime(p.pitchMod * 48, now, 0.02);
    }
    if (this.filterModGain) {
      this.filterModGain.gain.setTargetAtTime(p.filterMod * 1800, now, 0.02);
    }
    if (this.ladderWorklet) {
      const res = this.ladderWorklet.parameters.get("resonance");
      res?.setTargetAtTime(p.emphasis, now, 0.02);
    } else {
      const q = 0.5 + p.emphasis * 14;
      this.biquads[3]?.Q.setTargetAtTime(q, now, 0.02);
    }

    this.setCutoff(this.trackedCutoff(), now, 0.03);
    this.setPitch(this.lastMidi, false);
  }

  private setMix(node: GainNode | null | undefined, value: number): void {
    if (!node || !this.ctx) return;
    node.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
  }

  private applyWave(osc: OscillatorNode | undefined, wave: OscWave): void {
    if (!osc) return;
    if (wave === "pulse") {
      if (this.pulseWave) osc.setPeriodicWave(this.pulseWave);
      return;
    }
    osc.type = wave;
  }

  private oscFreq(index: number, midi: number): number {
    const p = this.params;
    const master = tuneSemis(p.tune);
    if (index === 0) {
      return midiToFreq(midi) * footageRatio(p.osc1Footage) * 2 ** (master / 12);
    }
    if (index === 1) {
      const det = master + tuneSemis(p.osc2Tune);
      return midiToFreq(midi) * footageRatio(p.osc2Footage) * 2 ** (det / 12);
    }
    const follow = p.osc3Follow ? midi : this.lastMidi;
    if (p.osc3Footage === "LO") {
      const rate = expMap(p.osc3Tune, 0.12, 22);
      if (!p.osc3Follow) return rate;
      return midiToFreq(follow) * 0.015625 * 2 ** (tuneSemis(p.osc3Tune) / 12);
    }
    const det = master + tuneSemis(p.osc3Tune);
    const key = p.osc3Follow ? midi : 60;
    return midiToFreq(key) * footageRatio(p.osc3Footage) * 2 ** (det / 12);
  }

  /**
   * Pitch-wheel bend in semitones (typically ±2). Re-applies the current
   * pitch immediately when a note is sounding; otherwise takes effect on
   * the next noteOn. Safe to call before the audio graph exists.
   */
  setPitchBend(semitones: number): void {
    this.bendSemitones = Number.isFinite(semitones) ? semitones : 0;
    if (!this.ctx || !this.envOpen) return;
    this.setPitch(this.lastMidi, false);
  }

  private setPitch(midi: number, glide: boolean): void {
    if (!this.ctx) return;
    this.lastMidi = midi;
    const now = this.ctx.currentTime;
    const time = glideSec(this.params.glide);
    const tau = glide && time > 0 ? Math.max(0.008, time * 0.35) : 0;
    const bend = bendRatio(this.bendSemitones);
    for (let i = 0; i < 3; i++) {
      const osc = this.oscs[i];
      if (!osc) continue;
      const freq = this.oscFreq(i, midi) * bend;
      if (tau > 0) osc.frequency.setTargetAtTime(freq, now, tau);
      else osc.frequency.setValueAtTime(freq, now);
    }
    for (let i = 0; i < this.vibratoGains.length; i++) {
      const frequency = this.oscFreq(i, midi);
      this.vibratoGains[i]!.gain.setTargetAtTime(
        vibratoGainHz(frequency, this.params.vibratoDepth),
        now,
        0.02,
      );
    }
    if (this.swarmWorklet) {
      const swarmFreq = this.swarmWorklet.parameters.get("freq");
      const hz = this.oscFreq(0, midi) * bend;
      if (swarmFreq) {
        if (tau > 0) swarmFreq.setTargetAtTime(hz, now, tau);
        else swarmFreq.setValueAtTime(hz, now);
      }
    }
    this.setCutoff(this.trackedCutoff(), now, 0.02);
  }

  private trackedCutoff(): number {
    const base = cutoffHz(this.params.cutoff);
    const track = 2 ** (((this.lastMidi - 60) / 12) * this.params.filterTrack * 0.7);
    return Math.min(16000, base * track + this.velCutoffHz);
  }

  private setCutoff(hz: number, now: number, tau: number): void {
    for (const param of this.cutoffTargets) {
      param.setTargetAtTime(Math.max(20, hz), now, tau);
    }
  }

  private triggerEnvelopes(): void {
    if (!this.ctx || !this.ampEnv || !this.filterEnv) return;
    const now = this.ctx.currentTime;
    const p = this.params;
    const aA = attackSec(p.ampAttack);
    const aD = decaySec(p.ampDecay);
    const fA = attackSec(p.filterAttack);
    const fD = decaySec(p.filterDecay);

    const amp = this.ampEnv.gain;
    amp.cancelScheduledValues(now);
    amp.setValueAtTime(0.0001, now);
    amp.linearRampToValueAtTime(velocityAmpPeak(this.lastVelocity, p.velocity), now + aA);
    amp.linearRampToValueAtTime(Math.max(0.0001, p.ampSustain), now + aA + aD);

    const filt = this.filterEnv.gain;
    filt.cancelScheduledValues(now);
    filt.setValueAtTime(0.0001, now);
    filt.linearRampToValueAtTime(1, now + fA);
    filt.linearRampToValueAtTime(Math.max(0.0001, p.filterSustain), now + fA + fD);
  }

  private releaseEnvelopes(force?: number): void {
    if (!this.ctx || !this.ampEnv || !this.filterEnv) return;
    const now = this.ctx.currentTime;
    const ampRel = force ?? decaySec(this.params.ampDecay);
    const filtRel = force ?? decaySec(this.params.filterDecay);

    const amp = this.ampEnv.gain;
    const ampNow = Math.max(amp.value, 0.0001);
    amp.cancelScheduledValues(now);
    amp.setValueAtTime(ampNow, now);
    amp.exponentialRampToValueAtTime(0.0001, now + Math.max(0.02, ampRel));

    const filt = this.filterEnv.gain;
    const filtNow = Math.max(filt.value, 0.0001);
    filt.cancelScheduledValues(now);
    filt.setValueAtTime(filtNow, now);
    filt.exponentialRampToValueAtTime(0.0001, now + Math.max(0.02, filtRel));
  }
}

let singleton: SynthEngine | null = null;

export function getEngine(): SynthEngine {
  if (!singleton) singleton = new SynthEngine();
  return singleton;
}
