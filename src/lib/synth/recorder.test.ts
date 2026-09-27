import test from "node:test";
import assert from "node:assert/strict";
import { TakeRecorder, MAX_RECORD_SECONDS, MIN_RECORD_SECONDS } from "./recorder.ts";

function block(channels: number, frames: number, value: number): Float32Array[] {
  const out: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    out.push(new Float32Array(frames).fill(value));
  }
  return out;
}

test("push accumulates frames and interleaves stereo", () => {
  const rec = new TakeRecorder(48000, 300, 0); // no minimum for this unit check
  const left = new Float32Array([0.5, -0.5]);
  const right = new Float32Array([0.25, -0.25]);
  rec.push([left, right]);
  assert.equal(rec.channelCount, 2);
  assert.equal(rec.recordedFrames, 2);
  assert.equal(rec.recordedSeconds, 2 / 48000);
  const take = rec.finish();
  assert.ok(take);
  assert.equal(take.chunks.length, 1);
  assert.deepEqual(
    Array.from(take.chunks[0]!),
    [16384, 8192, -16383, -8192],
  );
});

test("channel count is learned from the first block; mismatches ignored", () => {
  const rec = new TakeRecorder(48000);
  rec.push(block(1, 128, 0.1));
  assert.equal(rec.channelCount, 1);
  rec.push(block(2, 128, 0.1)); // stray layout: ignored
  assert.equal(rec.recordedFrames, 128);
  rec.push([]);
  assert.equal(rec.recordedFrames, 128);
});

test("finish returns null below the minimum length", () => {
  const rec = new TakeRecorder(48000, 300, MIN_RECORD_SECONDS);
  rec.push(block(1, 10, 0.5)); // 10 frames << 0.25s * 48000
  assert.equal(rec.finish(), null);
});

test("finish returns null with no audio at all", () => {
  const rec = new TakeRecorder(48000);
  assert.equal(rec.finish(), null);
});

test("cap auto-stops at maxSeconds and keeps whole blocks under it", () => {
  const rec = new TakeRecorder(1000, 1, 0); // 1s cap, no minimum
  rec.push(block(1, 600, 0.5));
  assert.equal(rec.capped, false);
  rec.push(block(1, 600, 0.5)); // would exceed: truncated to 400
  assert.equal(rec.capped, true);
  assert.equal(rec.recordedFrames, 1000);
  rec.push(block(1, 600, 0.5)); // after cap: ignored
  assert.equal(rec.recordedFrames, 1000);
  const take = rec.finish();
  assert.ok(take);
  assert.equal(take.sampleRate, 1000);
  let total = 0;
  for (const c of take.chunks) total += c.length;
  assert.equal(total, 1000);
});

test("clipping is clamped to int16 range", () => {
  const rec = new TakeRecorder(48000, 300, 0);
  rec.push([new Float32Array([1.5, -1.5])]);
  const take = rec.finish();
  assert.ok(take);
  assert.deepEqual(Array.from(take.chunks[0]!), [32767, -32767]);
});

test("default constants are sane", () => {
  assert.equal(MAX_RECORD_SECONDS, 300);
  assert.equal(MIN_RECORD_SECONDS, 0.25);
});
