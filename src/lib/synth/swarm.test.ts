import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SWARM_MAX_COUPLING,
  SWARM_OSC_COUNT,
  SWARM_SPREAD_CENTS,
  SWARM_WORKLET,
  couplingRate,
  swarmCoherence,
  swarmDetune,
  swarmStep,
} from "./swarm.ts";

function makeSwarm(baseHz: number): { phases: Float64Array; freqs: Float64Array } {
  const phases = new Float64Array(SWARM_OSC_COUNT);
  const freqs = new Float64Array(SWARM_OSC_COUNT);
  for (let i = 0; i < SWARM_OSC_COUNT; i++) {
    phases[i] = (i / SWARM_OSC_COUNT) * 2 * Math.PI;
    const cents = SWARM_SPREAD_CENTS * swarmDetune(i, SWARM_OSC_COUNT);
    freqs[i] = 2 * Math.PI * baseHz * 2 ** (cents / 1200);
  }
  return { phases, freqs };
}

describe("swarmDetune", () => {
  it("stays in [-1, 1] and is deterministic", () => {
    for (let i = 0; i < SWARM_OSC_COUNT; i++) {
      const d = swarmDetune(i, SWARM_OSC_COUNT);
      assert.ok(d >= -1 && d <= 1, `detune[${i}] = ${d} out of range`);
      assert.equal(d, swarmDetune(i, SWARM_OSC_COUNT));
    }
  });

  it("gives every oscillator a distinct offset", () => {
    const seen = new Set<number>();
    for (let i = 0; i < SWARM_OSC_COUNT; i++) seen.add(swarmDetune(i, SWARM_OSC_COUNT));
    assert.equal(seen.size, SWARM_OSC_COUNT);
  });
});

describe("couplingRate", () => {
  it("maps 0 to 0 and 1 to the maximum coupling", () => {
    assert.equal(couplingRate(0), 0);
    assert.equal(couplingRate(1), SWARM_MAX_COUPLING);
  });

  it("is monotonic and clamps out-of-range input", () => {
    assert.ok(couplingRate(0.75) > couplingRate(0.5));
    assert.ok(couplingRate(0.5) > couplingRate(0.25));
    assert.equal(couplingRate(-2), 0);
    assert.equal(couplingRate(2), SWARM_MAX_COUPLING);
  });
});

describe("swarmStep", () => {
  it("advances phases by exactly omega*dt when coupling is zero", () => {
    const { phases, freqs } = makeSwarm(440);
    const before = Float64Array.from(phases);
    const dt = 1 / 48000;
    swarmStep(phases, freqs, 0, dt);
    for (let i = 0; i < SWARM_OSC_COUNT; i++) {
      assert.ok(Math.abs(phases[i]! - (before[i]! + freqs[i]! * dt)) < 1e-12);
    }
  });

  it("phase-locks the swarm at maximum coupling", () => {
    const { phases, freqs } = makeSwarm(440);
    const dt = 1 / 48000;
    for (let s = 0; s < 96000; s++) {
      swarmStep(phases, freqs, SWARM_MAX_COUPLING, dt);
    }
    assert.ok(swarmCoherence(phases) > 0.99, `coherence = ${swarmCoherence(phases)}`);
  });

  it("lets the swarm drift apart with no coupling", () => {
    const { phases, freqs } = makeSwarm(440);
    const dt = 1 / 48000;
    for (let s = 0; s < 96000; s++) {
      swarmStep(phases, freqs, 0, dt);
    }
    assert.ok(swarmCoherence(phases) < 0.95, `coherence = ${swarmCoherence(phases)}`);
  });
});

describe("SWARM_WORKLET", () => {
  it("embeds the swarmStep source and registers the processor", () => {
    assert.ok(SWARM_WORKLET.includes('registerProcessor("swarm-osc"'));
    assert.ok(SWARM_WORKLET.includes("swarmStep"));
    assert.ok(SWARM_WORKLET.includes("swarmDetune"));
    // The embedded functions must be self-contained: no imports or closures.
    assert.ok(!SWARM_WORKLET.includes("import "));
  });
});
