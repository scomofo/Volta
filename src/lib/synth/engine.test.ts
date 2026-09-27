import test from "node:test";
import assert from "node:assert/strict";
import { LADDER_WORKLET } from "./ladder-worklet.ts";

// --- Minimal AudioWorklet shims so the worklet source runs under Node ---
const registered = new Map<string, any>();
(globalThis as any).sampleRate = 48000;
(globalThis as any).AudioWorkletProcessor = class {
  port = { postMessage() {}, onmessage: null };
};
(globalThis as any).registerProcessor = (name: string, ctor: any) => {
  registered.set(name, ctor);
};

// Indirect eval: runs the worklet source in global scope, like the browser.
(0, eval)(LADDER_WORKLET);

const MoogLadder = registered.get("moog-ladder");
assert.ok(MoogLadder, "expected the moog-ladder processor to be registered");

const SR = 48000;
const N = 256;

function runProcessor(resonance: number, cutoff = 1000): Float32Array {
  const proc = new MoogLadder();
  const input = new Float32Array(N);
  input[0] = 1; // impulse
  const output = new Float32Array(N);
  // Web Audio shape: outputs[outputIndex][channelIndex]
  proc.process(
    [[input]],
    [[output]],
    {
      cutoff: new Float32Array([cutoff]),
      resonance: new Float32Array([resonance]),
    },
  );
  return output;
}

// Independent reference: 4 cascaded one-pole stages with k = 0 (no feedback),
// mirroring the worklet's difference equations.
function referenceNoResonance(cutoff = 1000): Float32Array {
  let f = (2 * cutoff) / SR;
  f = Math.min(0.86, Math.max(0.0002, f));
  const fc = f * 1.16;
  let y1 = 0,
    y2 = 0,
    y3 = 0,
    y4 = 0,
    t1 = 0,
    t2 = 0,
    t3 = 0,
    t4 = 0,
    dc = 0;
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = Math.tanh(i === 0 ? 1 : 0); // k = 0: no feedback term
    y1 += fc * (x - t1);
    t1 = Math.tanh(y1);
    y2 += fc * (t1 - t2);
    t2 = Math.tanh(y2);
    y3 += fc * (t2 - t3);
    t3 = Math.tanh(y3);
    y4 += fc * (t3 - t4);
    t4 = Math.tanh(y4);
    dc = dc * 0.995 + y4 * 0.005;
    out[i] = y4 - dc;
  }
  return out;
}

test("resonance=0 reaches true zero (no feedback in the ladder)", () => {
  const out = runProcessor(0);
  const ref = referenceNoResonance();
  for (let i = 0; i < N; i++) {
    assert.ok(
      Math.abs(out[i] - ref[i]) < 1e-6,
      `sample ${i}: got ${out[i]}, expected ${ref[i]}`,
    );
  }
});

test("resonance=0 response differs from resonance=0.3", () => {
  // Regression test: `|| 0.3` coerced a zero resonance to 0.3, so the two
  // responses were identical and the knob minimum never reached true zero.
  const zero = runProcessor(0);
  const mid = runProcessor(0.3);
  let maxDiff = 0;
  for (let i = 0; i < N; i++) {
    maxDiff = Math.max(maxDiff, Math.abs(zero[i] - mid[i]));
  }
  assert.ok(maxDiff > 1e-3, `expected different responses, max diff ${maxDiff}`);
});
