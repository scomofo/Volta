/**
 * Kuramoto-style coupled oscillator swarm ("swarm detune" prototype).
 *
 * Kurare (Våld Labs) voices each note from coupled oscillator swarms that
 * slide between chaos and lockstep. This module ports that idea to Volta as
 * an additive voice layer: N oscillators with slightly detuned natural
 * frequencies, pulled toward their mean field by a coupling strength K.
 *
 *   dθᵢ/dt = ωᵢ + (K/N)·Σⱼ sin(θⱼ − θᵢ)
 *
 * K = 0   → free drift: classic detuned-oscillator chorus.
 * K large → the swarm phase-locks to its mean frequency.
 *
 * The O(N²) all-pairs term is evaluated in O(N) via the order parameter:
 *   (K/N)·Σⱼ sin(θⱼ−θᵢ) = (K/N)·(S·cosθᵢ − C·sinθᵢ),
 * where S = Σⱼ sinθⱼ and C = Σⱼ cosθⱼ.
 *
 * swarmStep and swarmDetune are intentionally self-contained (no imports,
 * no closures) so their source can be embedded verbatim in the
 * AudioWorklet via Function.prototype.toString — one source of truth for
 * both the DSP and the unit tests.
 */

export const SWARM_OSC_COUNT = 8;
/** Coupling K in rad/s when the Lock knob is at maximum. */
export const SWARM_MAX_COUPLING = 120;
/** Natural-frequency spread of the swarm, in cents, at init. */
export const SWARM_SPREAD_CENTS = 14;

/**
 * Deterministic per-oscillator detune offset in [-1, 1], golden-ratio
 * distributed so the swarm never clusters. Multiplied by
 * SWARM_SPREAD_CENTS to get each oscillator's offset in cents.
 */
export function swarmDetune(index: number, count: number): number {
  void count;
  const golden = 0.618033988749895;
  return ((index * golden) % 1) * 2 - 1;
}

/** Map the 0..1 Lock knob to coupling K in rad/s (quadratic feel). */
export function couplingRate(lock: number): number {
  const t = Math.min(1, Math.max(0, lock));
  return t * t * SWARM_MAX_COUPLING;
}

/**
 * Advance every oscillator phase by one Kuramoto step.
 *
 * @param phases   oscillator phases θᵢ in radians (mutated in place)
 * @param freqs    natural angular frequencies ωᵢ in rad/s
 * @param coupling coupling strength K in rad/s
 * @param dt       timestep in seconds
 */
export function swarmStep(
  phases: Float64Array,
  freqs: Float64Array,
  coupling: number,
  dt: number,
): void {
  const n = phases.length;
  let s = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    s += Math.sin(phases[i]!);
    c += Math.cos(phases[i]!);
  }
  const k = coupling / n;
  for (let i = 0; i < n; i++) {
    const th = phases[i]!;
    const pull = k * (s * Math.cos(th) - c * Math.sin(th));
    phases[i] = th + (freqs[i]! + pull) * dt;
  }
}

/** Order parameter R in [0, 1]: 0 = fully desynced, 1 = phase-locked. */
export function swarmCoherence(phases: Float64Array): number {
  const n = phases.length;
  let s = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    s += Math.sin(phases[i]!);
    c += Math.cos(phases[i]!);
  }
  return Math.hypot(s, c) / n;
}

export const SWARM_WORKLET = `
const SWARM_OSC_COUNT = ${SWARM_OSC_COUNT};
const swarmDetune = ${swarmDetune.toString()};
const swarmStep = ${swarmStep.toString()};

class SwarmOscProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "freq", defaultValue: 440, minValue: 20, maxValue: 4000, automationRate: "a-rate" },
      { name: "lock", defaultValue: ${couplingRate(0.5)}, minValue: 0, maxValue: ${SWARM_MAX_COUPLING}, automationRate: "k-rate" },
      { name: "spread", defaultValue: ${SWARM_SPREAD_CENTS}, minValue: 0, maxValue: 50, automationRate: "k-rate" }
    ];
  }
  constructor() {
    super();
    this.phases = new Float64Array(SWARM_OSC_COUNT);
    this.freqs = new Float64Array(SWARM_OSC_COUNT);
    for (let i = 0; i < SWARM_OSC_COUNT; i++) {
      this.phases[i] = (i / SWARM_OSC_COUNT) * 2 * Math.PI;
    }
  }
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const out = output[0];
    const n = out.length;
    const freq = parameters.freq;
    const lock = parameters.lock.length === 1 ? parameters.lock[0] : parameters.lock[0];
    const spread = parameters.spread.length === 1 ? parameters.spread[0] : parameters.spread[0];
    const dt = 1 / sampleRate;
    const inv = 1 / SWARM_OSC_COUNT;
    for (let i = 0; i < n; i++) {
      const hz = freq.length === 1 ? freq[0] : freq[i];
      for (let o = 0; o < SWARM_OSC_COUNT; o++) {
        const cents = spread * swarmDetune(o, SWARM_OSC_COUNT);
        this.freqs[o] = 2 * Math.PI * hz * Math.pow(2, cents / 1200);
      }
      swarmStep(this.phases, this.freqs, lock, dt);
      let sum = 0;
      for (let o = 0; o < SWARM_OSC_COUNT; o++) sum += Math.sin(this.phases[o]);
      out[i] = sum * inv;
    }
    for (let ch = 1; ch < output.length; ch++) output[ch].set(out);
    return true;
  }
}
registerProcessor("swarm-osc", SwarmOscProcessor);
`;
