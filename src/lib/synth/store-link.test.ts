import assert from "node:assert/strict";
import test from "node:test";
import { midiOut, type MidiOutputLike } from "./midi-out.ts";
import { useSynthStore } from "./store.ts";

/**
 * Bidirectional link + expressive control at the store level.
 * The engine is a safe no-op under node (no AudioContext), so these tests
 * assert the MIDI-out traffic contract: local notes echo, external notes
 * never echo, and performance controls send the documented messages.
 */

function fakePort(sent: number[][]): MidiOutputLike {
  return {
    id: "p1",
    name: "loopMIDI Choir",
    send: (data) => {
      sent.push([...data]);
    },
  };
}

function linkUp(sent: number[][]): void {
  midiOut.attach({ outputs: [fakePort(sent)] });
  const s = useSynthStore.getState();
  s.selectMidiOut("loopMIDI Choir");
  s.setMidiOutEnabled(true);
}

function linkDown(): void {
  const s = useSynthStore.getState();
  s.setMidiOutEnabled(false);
  s.selectMidiOut(null);
  midiOut.detach();
}

test("external (Cantabile) notes play the engine but never echo to MIDI out", () => {
  const sent: number[][] = [];
  linkUp(sent);
  const s = useSynthStore.getState();
  try {
    s.noteOnExternal(60, 100);
    s.noteOffExternal(60);
    assert.deepEqual(sent, [], "external notes must not be re-sent");
  } finally {
    linkDown();
  }
});

test("local notes still echo to MIDI out", () => {
  const sent: number[][] = [];
  linkUp(sent);
  const s = useSynthStore.getState();
  try {
    s.noteOn(61, 100);
    s.noteOff(61);
    assert.deepEqual(sent, [
      [0x90, 61, 100],
      [0x80, 61, 0],
    ]);
  } finally {
    linkDown();
  }
});

test("pitch wheel sends 14-bit bend and updates state", () => {
  const sent: number[][] = [];
  linkUp(sent);
  const s = useSynthStore.getState();
  try {
    s.setPitchBend(16383);
    s.setPitchBend(8192);
    assert.deepEqual(sent, [
      [0xe0, 0x7f, 0x7f],
      [0xe0, 0x00, 0x40],
    ]);
    assert.equal(useSynthStore.getState().pitchBend, 8192);
    s.setPitchBend(-50);
    assert.equal(useSynthStore.getState().pitchBend, 0);
  } finally {
    linkDown();
  }
});

test("vowel and dynamics send CC1 / CC11", () => {
  const sent: number[][] = [];
  linkUp(sent);
  const s = useSynthStore.getState();
  try {
    s.setChoirVowel(64);
    s.setChoirDynamics(100);
    assert.deepEqual(sent, [
      [0xb0, 1, 64],
      [0xb0, 11, 100],
    ]);
    assert.equal(useSynthStore.getState().choirVowel, 64);
    assert.equal(useSynthStore.getState().choirDynamics, 100);
  } finally {
    linkDown();
  }
});

test("glide knob changes send CC5 portamento time", () => {
  const sent: number[][] = [];
  linkUp(sent);
  const s = useSynthStore.getState();
  try {
    s.patch({ glide: 0.5 });
    assert.deepEqual(sent, [[0xb0, 5, 64]]);
    // Unrelated params send nothing.
    s.patch({ volume: 0.8 });
    assert.deepEqual(sent, [[0xb0, 5, 64]]);
  } finally {
    linkDown();
  }
});

test("nothing is sent when the link is disabled", () => {
  const sent: number[][] = [];
  linkUp(sent);
  linkDown();
  const s = useSynthStore.getState();
  s.setPitchBend(16383);
  s.setChoirVowel(64);
  s.noteOnExternal(60, 100);
  assert.deepEqual(sent, []);
});
