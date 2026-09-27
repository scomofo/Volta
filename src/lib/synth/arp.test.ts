import test from "node:test";
import assert from "node:assert/strict";
import {
  ARP_OCTAVES_MAX,
  ARP_RATE_DEFAULT,
  ARP_RATE_MAX,
  ARP_RATE_MIN,
  arpStepIndex,
  arpStepMs,
  bpmToRate,
  expandArpNotes,
  rateToBpm,
} from "./arp.ts";

const n = (midi: number, velocity = 100) => ({ midi, velocity });

test("expandArpNotes sorts ascending and keeps velocities", () => {
  const out = expandArpNotes([n(72, 90), n(60, 100), n(67, 110)], 1);
  assert.deepEqual(out, [n(60, 100), n(67, 110), n(72, 90)]);
});

test("expandArpNotes expands octaves low to high", () => {
  const out = expandArpNotes([n(60, 100), n(64, 80)], 2);
  assert.deepEqual(out.map((x) => x.midi), [60, 64, 72, 76]);
  assert.deepEqual(out.map((x) => x.velocity), [100, 80, 100, 80]);
});

test("expandArpNotes clamps octaves to 1..3", () => {
  assert.equal(expandArpNotes([n(60)], 0).length, 1);
  assert.equal(expandArpNotes([n(60)], 9).length, ARP_OCTAVES_MAX);
});

test("expandArpNotes of empty held is empty", () => {
  assert.deepEqual(expandArpNotes([], 3), []);
});

test("arpStepIndex up cycles", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((s) => arpStepIndex("up", s, 3)), [0, 1, 2, 0, 1]);
});

test("arpStepIndex down cycles", () => {
  assert.deepEqual([0, 1, 2, 3].map((s) => arpStepIndex("down", s, 3)), [2, 1, 0, 2]);
});

test("arpStepIndex upDown ping-pongs without repeating endpoints", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7].map((s) => arpStepIndex("upDown", s, 4)),
    [0, 1, 2, 3, 2, 1, 0, 1],
  );
});

test("arpStepIndex upDown with two notes alternates", () => {
  assert.deepEqual([0, 1, 2, 3].map((s) => arpStepIndex("upDown", s, 2)), [0, 1, 0, 1]);
});

test("arpStepIndex with a single note is always 0", () => {
  for (const p of ["up", "down", "upDown", "random"] as const) {
    assert.equal(arpStepIndex(p, 7, 1), 0);
  }
});

test("arpStepIndex random honors the injected rng", () => {
  assert.equal(arpStepIndex("random", 0, 4, () => 0), 0);
  assert.equal(arpStepIndex("random", 0, 4, () => 0.999), 3);
  assert.equal(arpStepIndex("random", 0, 4, () => 0.5), 2);
});

test("arpStepMs is a 16th note", () => {
  assert.equal(arpStepMs(120), 125);
  assert.equal(arpStepMs(60), 250);
  assert.equal(arpStepMs(240), 62.5);
});

test("rate knob maps 0..1 to 60..240 BPM and back", () => {
  assert.equal(rateToBpm(0), ARP_RATE_MIN);
  assert.equal(rateToBpm(1), ARP_RATE_MAX);
  assert.equal(rateToBpm(bpmToRate(ARP_RATE_DEFAULT)), ARP_RATE_DEFAULT);
  assert.ok(Math.abs(bpmToRate(rateToBpm(0.37)) - 0.37) < 0.01);
});
