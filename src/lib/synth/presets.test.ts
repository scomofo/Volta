import assert from "node:assert/strict";
import test from "node:test";
import { copySynthParams, isSynthParams, type PatchStorage, readUserPatches, writeUserPatch } from "./patch-storage.ts";
import type { SynthParams } from "./engine.ts";
import { formatVibratoRate, vibratoGainHz, vibratoRateHz } from "./modulation.ts";

function memoryStorage(): PatchStorage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

function validPatch(): SynthParams {
  return {
    osc1Wave: "sawtooth",
    osc1Footage: "8",
    osc2Wave: "triangle",
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
}

test("saved synth parameters are validated before use", () => {
  assert.equal(isSynthParams(validPatch()), true);
  assert.equal(isSynthParams({ ...validPatch(), cutoff: Number.NaN }), false);
  const decorated = { ...validPatch(), activePatch: "Manual" } as SynthParams;
  assert.deepEqual(copySynthParams(decorated), validPatch());
});

test("vibrato rate and depth map to useful, bounded audio values", () => {
  assert.equal(vibratoRateHz(0), 0.2);
  assert.equal(vibratoRateHz(1), 12);
  assert.ok(vibratoRateHz(0.5) > vibratoRateHz(0));
  assert.equal(formatVibratoRate(0), "0.2Hz");
  assert.equal(vibratoGainHz(440, 0), 0);
  assert.ok(vibratoGainHz(440, 1) > 0);
  assert.equal(vibratoGainHz(-1, 1), 0);
});

test("user patches can be saved, reloaded, and kept in four local slots", () => {
  const storage = memoryStorage();
  const patch = validPatch();

  assert.equal(writeUserPatch(1, patch, storage), true);
  assert.deepEqual(readUserPatches(storage)[1], patch);
  assert.equal(readUserPatches(storage).length, 4);
  assert.equal(writeUserPatch(4, patch, storage), false);
});

test("invalid saved data is ignored without exposing a broken patch", () => {
  const broken: PatchStorage = {
    getItem: () => "{broken",
    setItem: () => undefined,
  };
  assert.deepEqual(readUserPatches(broken), [null, null, null, null]);
});