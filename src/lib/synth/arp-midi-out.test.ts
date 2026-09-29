import test, { mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useSynthStore } from "./store.ts";
import { midiOut, type MidiOutputLike } from "./midi-out.ts";
import { arpStepMs, ARP_RATE_DEFAULT } from "./arp.ts";

// The store wires the ArpPlayer's play/release through the same
// engine + midiOut.send* pairing as a directly played note. These tests
// drive the real store (engine is a no-op under Node) and capture the
// bytes a fake MIDI output port receives.

mock.timers.enable({ apis: ["setInterval"] });

const STEP_MS = arpStepMs(ARP_RATE_DEFAULT); // 125 at the default 120 BPM

let sent: number[][] = [];

function fakePort(): MidiOutputLike {
  return {
    id: "p1",
    name: "Test Out",
    send: (data) => {
      sent.push([...data]);
    },
  };
}

beforeEach(() => {
  sent = [];
  midiOut.detach();
  midiOut.setEnabled(false);
  // Stop any running player and clear held notes while MIDI is disabled,
  // so the reset itself sends nothing.
  useSynthStore.getState().panic();
  const s = useSynthStore.getState();
  if (!s.arp) s.toggleArp();
  useSynthStore.getState().setArpPattern("up");
  midiOut.attach({ outputs: [fakePort()] });
  midiOut.selectPort("Test Out");
  midiOut.setEnabled(true);
});

test("arp steps mirror noteOn/noteOff to the MIDI output", () => {
  const store = useSynthStore.getState();
  store.noteOn(60, 100); // arp starts; step 0 sounds 60 immediately
  store.noteOn(64, 90); // joins the held chord
  mock.timers.tick(STEP_MS); // step 1: release 60, sound 64
  assert.deepEqual(sent, [
    [0x90, 60, 100], // step 0 noteOn
    [0x80, 60, 0], // step 1 releases the previous step first
    [0x90, 64, 90], // step 1 noteOn, with the held velocity
  ]);
});

test("releasing all held notes sends noteOff for the sounding step", () => {
  const store = useSynthStore.getState();
  store.noteOn(60, 100);
  store.noteOn(64, 90);
  mock.timers.tick(STEP_MS); // sounding: 64
  store.noteOff(60);
  store.noteOff(64); // held empty -> player stops, releases 64
  assert.deepEqual(sent, [
    [0x90, 60, 100],
    [0x80, 60, 0],
    [0x90, 64, 90],
    [0x80, 64, 0],
  ]);
});

test("panic silences the sounding step and sends all-notes-off", () => {
  const store = useSynthStore.getState();
  store.noteOn(60, 100); // step 0 sounds 60
  store.panic();
  assert.deepEqual(sent, [
    [0x90, 60, 100],
    [0x80, 60, 0], // player stop releases the sounding step
    [0xb0, 123, 0], // panic all-notes-off
  ]);
});

test("no MIDI bytes are sent when the output is disabled", () => {
  midiOut.setEnabled(false);
  const store = useSynthStore.getState();
  store.noteOn(60, 100);
  mock.timers.tick(STEP_MS);
  store.noteOff(60);
  assert.deepEqual(sent, []);
});
