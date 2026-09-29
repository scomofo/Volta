import assert from "node:assert/strict";
import test from "node:test";
import { ARP_RATE_MAX, ARP_RATE_MIN, rateToBpm } from "./arp.ts";
import {
  loadMidiBindings,
  saveMidiBindings,
  type BindingStorage,
  type MidiBindings,
} from "./midi.ts";
import { copySynthParams, isSynthParams } from "./patch-storage.ts";
import { DEFAULT_PARAMS, type SynthParams } from "./engine.ts";
import { FACTORY_PRESETS } from "./presets.ts";

function memoryStorage(): BindingStorage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

/** Install a fake window.localStorage so the store persists like in a browser. */
function installWindowStorage(): BindingStorage {
  const storage = memoryStorage();
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  return storage;
}

type StoreApi = (typeof import("./store.ts"))["useSynthStore"];

let generation = 0;
/** Import a fresh copy of the store module (simulates a separate page load). */
async function freshStore(): Promise<StoreApi> {
  generation += 1;
  const mod = (await import(`./store.ts?arp-midi-learn=${generation}`)) as {
    useSynthStore: StoreApi;
  };
  return mod.useSynthStore;
}

/** Run the standard learn gesture: MIDI button, click target, move a CC. */
function learnCc(
  api: () => ReturnType<StoreApi["getState"]>,
  paramKey: string,
  cc: number,
  value: number,
): void {
  api().toggleMidiLearn();
  api().setLearnTarget(paramKey);
  api().applyCc(cc, value);
}

test("arp rate knob learns a MIDI CC with the same gesture as patch knobs", async () => {
  installWindowStorage();
  const useSynthStore = await freshStore();
  const api = () => useSynthStore.getState();

  api().toggleMidiLearn();
  assert.equal(api().midiLearn, true);
  api().setLearnTarget("arpRate");
  assert.equal(api().learnTarget, "arpRate");

  api().applyCc(74, 64);
  const s = api();
  assert.equal(s.bindings["arpRate"], 74);
  assert.equal(s.midiLearn, false);
  assert.equal(s.learnTarget, null);
  // The learning move only binds — it does not turn the knob.
  assert.equal(s.arpRate, 120);
});

test("arp pattern control learns a MIDI CC with the same gesture as patch knobs", async () => {
  installWindowStorage();
  const useSynthStore = await freshStore();
  const api = () => useSynthStore.getState();

  learnCc(api, "arpPattern", 75, 90);
  const s = api();
  assert.equal(s.bindings["arpPattern"], 75);
  assert.equal(s.midiLearn, false);
  assert.equal(s.learnTarget, null);
  // The learning move only binds — the pattern does not change.
  assert.equal(s.arpPattern, "up");
});

test("a bound CC drives the arp rate knob across its full range", async () => {
  installWindowStorage();
  const useSynthStore = await freshStore();
  const api = () => useSynthStore.getState();
  learnCc(api, "arpRate", 74, 64);

  api().applyCc(74, 0);
  assert.equal(api().arpRate, ARP_RATE_MIN);
  api().applyCc(74, 127);
  assert.equal(api().arpRate, ARP_RATE_MAX);
  api().applyCc(74, 64);
  assert.equal(api().arpRate, rateToBpm(64 / 127));
  // Arp CCs never dirty the loaded patch.
  assert.equal(api().activePatch, "Classic Saw");
  // An unbound CC does nothing.
  api().applyCc(99, 127);
  assert.equal(api().arpRate, rateToBpm(64 / 127));
});

test("a bound CC steps the arp pattern through its four slots", async () => {
  installWindowStorage();
  const useSynthStore = await freshStore();
  const api = () => useSynthStore.getState();
  learnCc(api, "arpPattern", 75, 90);

  api().applyCc(75, 0);
  assert.equal(api().arpPattern, "up");
  api().applyCc(75, 31);
  assert.equal(api().arpPattern, "up");
  api().applyCc(75, 32);
  assert.equal(api().arpPattern, "down");
  api().applyCc(75, 64);
  assert.equal(api().arpPattern, "upDown");
  api().applyCc(75, 96);
  assert.equal(api().arpPattern, "random");
  api().applyCc(75, 127);
  assert.equal(api().arpPattern, "random");
  // Arp CCs never dirty the loaded patch.
  assert.equal(api().activePatch, "Classic Saw");
});

test("unlearn removes an arp binding and the CC goes dead", async () => {
  installWindowStorage();
  const useSynthStore = await freshStore();
  const api = () => useSynthStore.getState();
  learnCc(api, "arpRate", 74, 64);
  api().applyCc(74, 127);
  assert.equal(api().arpRate, ARP_RATE_MAX);

  api().unbindCc("arpRate");
  assert.ok(!("arpRate" in api().bindings));
  api().applyCc(74, 0);
  assert.equal(api().arpRate, ARP_RATE_MAX);
});

test("cancel exits learn mode without binding the arp knob", async () => {
  installWindowStorage();
  const useSynthStore = await freshStore();
  const api = () => useSynthStore.getState();

  api().toggleMidiLearn();
  api().setLearnTarget("arpRate");
  api().cancelMidiLearn();
  assert.equal(api().midiLearn, false);
  assert.equal(api().learnTarget, null);

  api().applyCc(74, 64);
  assert.ok(!("arpRate" in api().bindings));
});

test("arp bindings survive a reload", async () => {
  installWindowStorage(); // shared by both "page loads"
  const first = await freshStore();
  const a = () => first.getState();
  learnCc(a, "arpRate", 74, 64);
  learnCc(a, "arpPattern", 75, 90);

  // A fresh module generation reading the same storage, like a page reload.
  const second = await freshStore();
  const b = () => second.getState();
  assert.equal(b().bindings["arpRate"], 74);
  assert.equal(b().bindings["arpPattern"], 75);
  // The reloaded bindings drive the knobs immediately.
  b().applyCc(74, 127);
  assert.equal(b().arpRate, ARP_RATE_MAX);
  b().applyCc(75, 0);
  assert.equal(b().arpPattern, "up");
});

test("arp bindings persist and round-trip through storage", () => {
  const storage = memoryStorage();
  assert.equal(saveMidiBindings({ arpRate: 74, arpPattern: 75 }, storage), true);
  assert.deepEqual(loadMidiBindings(storage), { arpRate: 74, arpPattern: 75 });
});

test("neighboring arp keys that are not learnable are rejected", () => {
  const storage = memoryStorage();
  const bindings: MidiBindings = {
    arpRate: 74,
    arpPattern: 75,
    arpOctaves: 76,
    arp: 77,
  };
  assert.equal(saveMidiBindings(bindings, storage), true);
  assert.deepEqual(loadMidiBindings(storage), { arpRate: 74, arpPattern: 75 });
});

test("factory presets carry no arp state and keep their exact param shape", () => {
  const defaultKeys = Object.keys(DEFAULT_PARAMS).sort();
  assert.ok(FACTORY_PRESETS.length > 0);
  for (const preset of FACTORY_PRESETS) {
    assert.deepEqual(Object.keys(preset.params).sort(), defaultKeys);
    assert.ok(!("arpRate" in preset.params));
    assert.ok(!("arpPattern" in preset.params));
    assert.ok(isSynthParams(preset.params));
  }
});

test("legacy patches load exactly as before (velocity defaults, no arp keys)", () => {
  const legacy = { ...DEFAULT_PARAMS };
  delete (legacy as Partial<SynthParams>).velocity;
  const loaded = copySynthParams(legacy as SynthParams);
  assert.equal(loaded.velocity, 0);
  assert.ok(!("arpRate" in loaded));
  assert.ok(!("arpPattern" in loaded));
  assert.deepEqual(Object.keys(loaded).sort(), Object.keys(DEFAULT_PARAMS).sort());
});
