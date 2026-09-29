import assert from "node:assert/strict";
import test from "node:test";
import {
  bendRatio,
  CHOIR_DYNAMICS_CC,
  CHOIR_VOWEL_CC,
  glideToPortamentoCc,
  PITCH_BEND_CENTER,
  PITCH_BEND_MAX,
  PITCH_BEND_RANGE_SEMITONES,
  pitchBendToSemitones,
  PORTAMENTO_TIME_CC,
  semitonesToPitchBend,
} from "./performance.ts";

test("pitch-bend center maps to zero semitones", () => {
  assert.equal(pitchBendToSemitones(PITCH_BEND_CENTER), 0);
  assert.equal(semitonesToPitchBend(0), PITCH_BEND_CENTER);
});

test("pitch-bend extremes map to ±2 semitones", () => {
  assert.equal(pitchBendToSemitones(0), -PITCH_BEND_RANGE_SEMITONES);
  // 16383 is one LSB below full scale: a hair under +2 semitones.
  assert.ok(Math.abs(pitchBendToSemitones(PITCH_BEND_MAX) - 2) < 0.001);
  assert.equal(semitonesToPitchBend(-2), 0);
  assert.equal(semitonesToPitchBend(2), PITCH_BEND_MAX);
});

test("pitch-bend conversion clamps out-of-range input", () => {
  assert.equal(pitchBendToSemitones(-100), -2);
  assert.ok(Math.abs(pitchBendToSemitones(99999) - 2) < 0.001);
  assert.equal(semitonesToPitchBend(-5), 0);
  assert.equal(semitonesToPitchBend(5), PITCH_BEND_MAX);
});

test("pitch-bend round-trips through semitones", () => {
  for (const v of [0, 4096, 8192, 12000, 16383]) {
    const back = semitonesToPitchBend(pitchBendToSemitones(v));
    assert.ok(Math.abs(back - v) <= 1, `round-trip of ${v} gave ${back}`);
  }
});

test("bend ratio doubles frequency per octave", () => {
  assert.equal(bendRatio(0), 1);
  assert.ok(Math.abs(bendRatio(12) - 2) < 1e-12);
  assert.ok(Math.abs(bendRatio(-12) - 0.5) < 1e-12);
  assert.ok(Math.abs(bendRatio(2) - 2 ** (2 / 12)) < 1e-12);
});

test("glide maps to CC5 0–127", () => {
  assert.equal(glideToPortamentoCc(0), 0);
  assert.equal(glideToPortamentoCc(1), 127);
  assert.equal(glideToPortamentoCc(0.5), 64);
  assert.equal(glideToPortamentoCc(-1), 0);
  assert.equal(glideToPortamentoCc(2), 127);
});

test("choir-link protocol uses standard CC numbers", () => {
  assert.equal(CHOIR_VOWEL_CC, 1);
  assert.equal(CHOIR_DYNAMICS_CC, 11);
  assert.equal(PORTAMENTO_TIME_CC, 5);
});
