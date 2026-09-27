import assert from "node:assert/strict";
import test from "node:test";
import { velocityAmpPeak, velocityCutoffHz, velocityNorm } from "./notes.ts";
import {
  copySynthParams,
  isSynthParams,
  readUserPatches,
  writeUserPatch,
  type PatchStorage,
} from "./patch-storage.ts";
import type { SynthParams } from "./engine.ts";

function memoryStorage(): PatchStorage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

test("velocity normalizes the MIDI 1..127 range to 0..1", () => {
  assert.equal(velocityNorm(127), 1);
  assert.equal(velocityNorm(1), 0.008); // floored so the softest note stays audible
  assert.equal(velocityNorm(200), 1);
  assert.equal(velocityNorm(0), 0.008);
  assert.ok(velocityNorm(64) > velocityNorm(1));
  assert.ok(velocityNorm(64) < velocityNorm(127));
});

test("velocity amount 0 reproduces legacy behavior exactly", () => {
  for (const vel of [0.01, 0.25, 0.5, 0.9, 1]) {
    assert.equal(velocityAmpPeak(vel, 0), 1);
    assert.equal(velocityCutoffHz(vel, 0), 0);
  }
});

test("velocity scales amplitude from near-silent to full", () => {
  assert.equal(velocityAmpPeak(1, 1), 1);
  const soft = velocityAmpPeak(velocityNorm(1), 1);
  assert.ok(soft < 0.01, `softest note should be near silent, got ${soft}`);
  const mid = velocityAmpPeak(velocityNorm(64), 1);
  assert.ok(mid > soft && mid < 1, `mid velocity should sit between, got ${mid}`);
  // Half amount halves the effect, never the peak.
  assert.equal(velocityAmpPeak(1, 0.5), 1);
  assert.ok(velocityAmpPeak(velocityNorm(64), 0.5) > mid);
});

test("velocity opens the filter up to +4.2kHz at full amount", () => {
  assert.equal(velocityCutoffHz(1, 1), 4200);
  const soft = velocityCutoffHz(velocityNorm(1), 1);
  assert.ok(soft >= 0 && soft < 100, `softest note opens almost nothing, got ${soft}`);
  const mid = velocityCutoffHz(velocityNorm(64), 1);
  assert.ok(mid > soft && mid < 4200);
  assert.equal(velocityCutoffHz(1, 0.5), 2100);
});

test("patches saved before velocity existed still validate and load as legacy", () => {
  // A v1 user patch without the velocity key (as saved by earlier builds).
  const oldPatch = {
    osc1Wave: "sawtooth",
    osc1Footage: "8",
    osc2Wave: "sawtooth",
    osc2Footage: "8",
    osc2Tune: 0.5,
    osc3Wave: "square",
    osc3Footage: "16",
    osc3Tune: 0.5,
    osc3Follow: true,
    mix1: 0.7,
    mix2: 0.4,
    mix3: 0.2,
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
    vibratoDepth: 0.2,
    pitchMod: 0,
    filterMod: 0,
    volume: 0.72,
    tune: 0.5,
    a440: false,
  };
  assert.equal(isSynthParams(oldPatch), true);
  const loaded = copySynthParams(oldPatch as unknown as SynthParams);
  assert.equal(loaded.velocity, 0);
  // …while a present-but-invalid velocity is still rejected.
  assert.equal(isSynthParams({ ...oldPatch, velocity: 2 }), false);
  assert.equal(isSynthParams({ ...oldPatch, velocity: Number.NaN }), false);
});

test("velocity amount survives a user-patch save round-trip", () => {
  const storage = memoryStorage();
  const patch: SynthParams = {
    osc1Wave: "sawtooth",
    osc1Footage: "8",
    osc2Wave: "sawtooth",
    osc2Footage: "8",
    osc2Tune: 0.5,
    osc3Wave: "square",
    osc3Footage: "16",
    osc3Tune: 0.5,
    osc3Follow: true,
    mix1: 0.7,
    mix2: 0.4,
    mix3: 0.2,
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
    vibratoDepth: 0.2,
    pitchMod: 0,
    filterMod: 0,
    velocity: 0.65,
    volume: 0.72,
    tune: 0.5,
    a440: false,
  };
  assert.equal(writeUserPatch(0, patch, storage), true);
  assert.equal(readUserPatches(storage)[0]?.velocity, 0.65);
});
