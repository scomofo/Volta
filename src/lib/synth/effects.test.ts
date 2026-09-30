import assert from "node:assert/strict";
import test from "node:test";
import {
  CHORUS_TAP_A_SEC,
  CHORUS_TAP_B_SEC,
  chorusDepthSec,
  chorusRateHz,
  delayFeedbackGain,
  delayTimeSec,
  driveLevelGain,
  drivePregain,
  driveToneDb,
  formatChorusDepth,
  formatChorusRate,
  formatDelayTime,
  formatDriveTone,
} from "./effects.ts";

test("delay time spans 1ms..1s exponentially", () => {
  assert.equal(delayTimeSec(0), 0.001);
  assert.equal(delayTimeSec(1), 1);
  assert.ok(Math.abs(delayTimeSec(0.5) - Math.sqrt(0.001)) < 1e-9);
  assert.ok(delayTimeSec(0.25) < delayTimeSec(0.75));
  assert.equal(delayTimeSec(-5), 0.001);
  assert.equal(delayTimeSec(2), 1);
  assert.equal(delayTimeSec(Number.NaN), 0.001);
});

test("delay feedback is capped below runaway", () => {
  assert.equal(delayFeedbackGain(0), 0);
  assert.equal(delayFeedbackGain(1), 0.95);
  for (const t of [0, 0.1, 0.5, 0.9, 1]) {
    const g = delayFeedbackGain(t);
    assert.ok(g >= 0 && g < 1, `feedback must stay below 1, got ${g}`);
  }
});

test("chorus rate spans 0.05..8 Hz", () => {
  assert.equal(chorusRateHz(0), 0.05);
  assert.equal(chorusRateHz(1), 8);
  assert.ok(chorusRateHz(0.5) > chorusRateHz(0) && chorusRateHz(0.5) < chorusRateHz(1));
});

test("chorus depth never exceeds the smallest tap base delay", () => {
  assert.equal(chorusDepthSec(0), 0);
  assert.equal(chorusDepthSec(1), 0.006);
  const minTap = Math.min(CHORUS_TAP_A_SEC, CHORUS_TAP_B_SEC);
  assert.ok(chorusDepthSec(1) < minTap, "modulated delay must stay positive");
});

test("drive pre-gain spans clean to saturated", () => {
  assert.equal(drivePregain(0), 1);
  assert.equal(drivePregain(1), 40);
  assert.ok(drivePregain(0.5) > 1 && drivePregain(0.5) < 40);
});

test("drive tone is flat at center, ±12 dB at the ends", () => {
  assert.equal(driveToneDb(0.5), 0);
  assert.equal(driveToneDb(0), -12);
  assert.equal(driveToneDb(1), 12);
});

test("drive level is unity at center", () => {
  assert.equal(driveLevelGain(0.5), 1);
  assert.ok(Math.abs(driveLevelGain(0) - 10 ** (-12 / 20)) < 1e-9);
  assert.ok(Math.abs(driveLevelGain(1) - 10 ** (12 / 20)) < 1e-9);
});

test("display formatters produce readable readouts", () => {
  assert.equal(formatDelayTime(0), "1.0ms");
  assert.equal(formatDelayTime(1), "1000ms");
  assert.equal(formatChorusRate(0), "0.05Hz");
  assert.equal(formatChorusRate(1), "8.0Hz");
  assert.equal(formatChorusDepth(0), "0.0ms");
  assert.equal(formatChorusDepth(1), "6.0ms");
  assert.equal(formatDriveTone(0.5), "+0.0dB");
  assert.equal(formatDriveTone(0), "-12.0dB");
});
