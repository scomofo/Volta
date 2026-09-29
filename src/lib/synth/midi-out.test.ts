import assert from "node:assert/strict";
import test from "node:test";
import {
  allNotesOffBytes,
  findOutputByName,
  loadMidiOutConfig,
  MidiOutManager,
  noteOffBytes,
  noteOnBytes,
  saveMidiOutConfig,
  type ConfigStorage,
  type MidiAccessLike,
  type MidiOutputLike,
} from "./midi-out.ts";

function memoryStorage(): ConfigStorage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

function fakePort(id: string, name: string, sent: number[][]): MidiOutputLike {
  return {
    id,
    name,
    send: (data) => {
      sent.push([...data]);
    },
  };
}

function fakeAccess(ports: MidiOutputLike[]): MidiAccessLike {
  return { outputs: ports };
}

test("note on/off/all-off bytes use channel 0 with clamped 7-bit values", () => {
  assert.deepEqual(noteOnBytes(60, 100), [0x90, 60, 100]);
  assert.deepEqual(noteOnBytes(200, -5), [0x90, 127, 0]);
  assert.deepEqual(noteOffBytes(61), [0x80, 61, 0]);
  assert.deepEqual(allNotesOffBytes(), [0xb0, 123, 0]);
});

test("config persists by port name and round-trips", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadMidiOutConfig(storage), { portName: null, enabled: false });
  assert.equal(
    saveMidiOutConfig({ portName: "loopMIDI Choir", enabled: true }, storage),
    true,
  );
  assert.deepEqual(loadMidiOutConfig(storage), {
    portName: "loopMIDI Choir",
    enabled: true,
  });
});

test("config rejects garbage without throwing", () => {
  const storage = memoryStorage();
  storage.setItem("volta.midi-out.v1", "{not json");
  assert.deepEqual(loadMidiOutConfig(storage), { portName: null, enabled: false });
  storage.setItem("volta.midi-out.v1", JSON.stringify({ portName: 42, enabled: "yes" }));
  assert.deepEqual(loadMidiOutConfig(storage), { portName: null, enabled: false });
});

test("findOutputByName matches exact names only", () => {
  const outputs = [
    { id: "a", name: "loopMIDI Choir" },
    { id: "b", name: "Other" },
  ];
  assert.deepEqual(findOutputByName(outputs, "loopMIDI Choir"), outputs[0]);
  assert.equal(findOutputByName(outputs, "choir"), null);
  assert.equal(findOutputByName(outputs, null), null);
});

test("manager sends nothing until enabled with a selected port", () => {
  const sent: number[][] = [];
  const manager = new MidiOutManager(memoryStorage());
  manager.attach(fakeAccess([fakePort("p1", "loopMIDI Choir", sent)]));
  assert.equal(manager.sendNoteOn(60, 100), false);
  manager.selectPort("loopMIDI Choir");
  assert.equal(manager.sendNoteOn(60, 100), false);
  manager.setEnabled(true);
  assert.equal(manager.sendNoteOn(60, 100), true);
  assert.deepEqual(sent, [[0x90, 60, 100]]);
  manager.sendNoteOff(60);
  manager.sendAllNotesOff();
  assert.deepEqual(sent, [
    [0x90, 60, 100],
    [0x80, 60, 0],
    [0xb0, 123, 0],
  ]);
});

test("manager restores the persisted port by name after re-attach", () => {
  const storage = memoryStorage();
  const first: number[][] = [];
  const manager = new MidiOutManager(storage);
  manager.attach(fakeAccess([fakePort("old-id", "loopMIDI Choir", first)]));
  manager.selectPort("loopMIDI Choir");
  manager.setEnabled(true);

  // New session: port ids changed, name is stable.
  const second: number[][] = [];
  const again = new MidiOutManager(storage);
  again.attach(fakeAccess([fakePort("new-id", "loopMIDI Choir", second)]));
  assert.equal(again.connected, true);
  assert.equal(again.sendNoteOn(64, 90), true);
  assert.deepEqual(second, [[0x90, 64, 90]]);
});

test("manager drops the port when it disappears and reports disconnected", () => {
  const sent: number[][] = [];
  const manager = new MidiOutManager(memoryStorage());
  const access = fakeAccess([fakePort("p1", "loopMIDI Choir", sent)]);
  manager.attach(access);
  manager.selectPort("loopMIDI Choir");
  manager.setEnabled(true);
  assert.equal(manager.connected, true);
  // Port unplugged: refresh with an empty output list.
  manager.attach(fakeAccess([]));
  assert.equal(manager.connected, false);
  assert.equal(manager.sendNoteOn(60, 100), false);
  assert.deepEqual(sent, []);
});

test("a failing port send does not throw", () => {
  const manager = new MidiOutManager(memoryStorage());
  manager.attach(
    fakeAccess([
      {
        id: "p1",
        name: "Bad Port",
        send: () => {
          throw new Error("device gone");
        },
      },
    ]),
  );
  manager.selectPort("Bad Port");
  manager.setEnabled(true);
  assert.equal(manager.sendNoteOn(60, 100), false);
});
