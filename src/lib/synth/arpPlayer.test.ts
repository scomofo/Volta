import test from "node:test";
import assert from "node:assert/strict";
import { ArpPlayer, type ArpPlayerDeps } from "./arpPlayer.ts";
import type { ArpPattern, HeldNote } from "./arp.ts";

function makePlayer(overrides: Partial<ArpPlayerDeps> = {}) {
  const played: [number, number][] = [];
  const released: number[] = [];
  const stepped: (number | null)[] = [];
  let held: HeldNote[] = [];
  let pattern: ArpPattern = "up";
  let octaves = 1;
  const deps: ArpPlayerDeps = {
    play: (midi, velocity) => played.push([midi, velocity]),
    release: (midi) => released.push(midi),
    getHeld: () => held,
    getPattern: () => pattern,
    getOctaves: () => octaves,
    getStepMs: () => 125,
    onStep: (midi) => stepped.push(midi),
    ...overrides,
  };
  const player = new ArpPlayer(deps);
  return {
    player,
    played,
    released,
    stepped,
    setHeld: (h: HeldNote[]) => (held = h),
    setPattern: (p: ArpPattern) => (pattern = p),
    setOctaves: (o: number) => (octaves = o),
  };
}

const n = (midi: number, velocity = 100): HeldNote => ({ midi, velocity });

test("start with no held notes plays nothing and stays stopped", () => {
  const { player, played, stepped } = makePlayer();
  player.start();
  assert.deepEqual(played, []);
  assert.equal(player.running, false);
  assert.deepEqual(stepped, [null]);
});

test("up pattern walks held notes low to high with their velocities", () => {
  const t = makePlayer();
  t.setHeld([n(67, 90), n(60, 100)]);
  t.player.start();
  try {
    t.player.tick();
    t.player.tick();
    assert.deepEqual(t.played, [
      [60, 100],
      [67, 90],
      [60, 100],
    ]);
    // each step releases the previous note first (mono retrigger)
    assert.deepEqual(t.released, [60, 67]);
  } finally {
    t.player.stop();
  }
});

test("down pattern walks high to low", () => {
  const t = makePlayer();
  t.setPattern("down");
  t.setHeld([n(60), n(67)]);
  t.player.start();
  try {
    t.player.tick();
    t.player.tick();
    assert.deepEqual(
      t.played.map(([m]) => m),
      [67, 60, 67],
    );
  } finally {
    t.player.stop();
  }
});

test("up-down pattern ping-pongs", () => {
  const t = makePlayer();
  t.setPattern("upDown");
  t.setHeld([n(60), n(64), n(67)]);
  t.player.start();
  try {
    for (let i = 0; i < 4; i++) t.player.tick();
    assert.deepEqual(
      t.played.map(([m]) => m),
      [60, 64, 67, 64, 60],
    );
  } finally {
    t.player.stop();
  }
});

test("octaves expand the pattern", () => {
  const t = makePlayer();
  t.setOctaves(2);
  t.setHeld([n(60), n(64)]);
  t.player.start();
  try {
    t.player.tick();
    t.player.tick();
    assert.deepEqual(
      t.played.map(([m]) => m),
      [60, 64, 72],
    );
  } finally {
    t.player.stop();
  }
});

test("random pattern uses the injected rng", () => {
  const seq = [0.99, 0.0];
  let i = 0;
  const t = makePlayer({ getPattern: () => "random", rand: () => seq[i++ % seq.length]! });
  t.setHeld([n(60), n(64), n(67)]);
  t.player.start();
  try {
    t.player.tick();
    t.player.tick();
    assert.deepEqual(
      t.played.map(([m]) => m),
      [67, 60, 67],
    );
  } finally {
    t.player.stop();
  }
});

test("releasing all notes stops the player and silences the sounding note", () => {
  const t = makePlayer();
  t.setHeld([n(60)]);
  t.player.start();
  try {
    assert.equal(t.player.running, true);
    t.setHeld([]);
    assert.equal(t.player.tick(), false);
    assert.equal(t.player.running, false);
    assert.deepEqual(t.released, [60]);
    assert.equal(t.stepped[t.stepped.length - 1], null);
  } finally {
    t.player.stop();
  }
});

test("stop releases the sounding note and reports idle", () => {
  const t = makePlayer();
  t.setHeld([n(60)]);
  t.player.start();
  t.player.stop();
  assert.deepEqual(t.released, [60]);
  assert.equal(t.stepped[t.stepped.length - 1], null);
  assert.equal(t.player.running, false);
});

test("retime is a no-op when stopped", () => {
  const { player } = makePlayer();
  player.retime();
  assert.equal(player.running, false);
});
