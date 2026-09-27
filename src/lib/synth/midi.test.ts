import assert from "node:assert/strict";
import test from "node:test";
import {
  loadMidiBindings,
  parseMidiMessage,
  saveMidiBindings,
  type BindingStorage,
} from "./midi.ts";

function memoryStorage(): BindingStorage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

test("MIDI note messages parse with channel, note, and velocity", () => {
  assert.deepEqual(parseMidiMessage([0x90, 60, 100]), {
    kind: "noteOn",
    channel: 0,
    note: 60,
    velocity: 100,
  });
  assert.deepEqual(parseMidiMessage([0x9f, 64, 1]), {
    kind: "noteOn",
    channel: 15,
    note: 64,
    velocity: 1,
  });
  // Velocity 0 on a note-on status is note-off by convention.
  assert.deepEqual(parseMidiMessage([0x90, 60, 0]), {
    kind: "noteOff",
    channel: 0,
    note: 60,
  });
  assert.deepEqual(parseMidiMessage([0x80, 61, 0]), {
    kind: "noteOff",
    channel: 0,
    note: 61,
  });
});

test("MIDI CC messages parse; anything else is unknown", () => {
  assert.deepEqual(parseMidiMessage([0xb0, 74, 64]), {
    kind: "cc",
    channel: 0,
    cc: 74,
    value: 64,
  });
  assert.deepEqual(parseMidiMessage([0xb2, 1, 127]).kind, "cc");
  assert.deepEqual(parseMidiMessage([0xc0, 5]).kind, "unknown");
  assert.deepEqual(parseMidiMessage([]).kind, "unknown");
});

test("bindings persist and round-trip through storage", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadMidiBindings(storage), {});
  assert.equal(saveMidiBindings({ cutoff: 74, volume: 7 }, storage), true);
  assert.deepEqual(loadMidiBindings(storage), { cutoff: 74, volume: 7 });
  // Re-saving merges nothing: the file holds exactly what was saved.
  assert.equal(saveMidiBindings({ cutoff: 74 }, storage), true);
  assert.deepEqual(loadMidiBindings(storage), { cutoff: 74 });
});

test("invalid bindings are dropped on load and save", () => {
  const storage = memoryStorage();
  storage.setItem(
    "volta.midi-bindings.v1",
    JSON.stringify({
      cutoff: 74,
      volume: 200, // CC out of range
      tune: -1, // CC out of range
      mix1: 1.5, // not an integer CC
      notAParam: 10, // unknown param
      emphasis: "74", // wrong type
    }),
  );
  assert.deepEqual(loadMidiBindings(storage), { cutoff: 74 });

  assert.equal(
    saveMidiBindings({ cutoff: 74, notAParam: 10, volume: 300 }, storage),
    true,
  );
  assert.deepEqual(loadMidiBindings(storage), { cutoff: 74 });
});

test("broken or missing storage never throws and yields no bindings", () => {
  const broken: BindingStorage = {
    getItem: () => "{broken",
    setItem: () => undefined,
  };
  assert.deepEqual(loadMidiBindings(broken), {});
  assert.deepEqual(loadMidiBindings(null), {});
  assert.equal(saveMidiBindings({ cutoff: 1 }, null), false);
});
