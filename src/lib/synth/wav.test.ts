import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeWav,
  floatToInt16,
  sanitizePatchName,
  wavFilename,
} from "./wav.ts";

function ascii(view: DataView, offset: number, length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

test("floatToInt16 converts and clamps", () => {
  assert.equal(floatToInt16(0), 0);
  assert.equal(floatToInt16(1), 32767);
  assert.equal(floatToInt16(-1), -32767);
  assert.equal(floatToInt16(0.5), 16384);
  assert.equal(floatToInt16(-0.5), -16383); // Math.round(-16383.5) rounds toward +inf
  assert.equal(floatToInt16(2), 32767);
  assert.equal(floatToInt16(-2), -32767);
});

test("encodeWav writes a byte-exact 16-bit PCM header", () => {
  const chunks = [new Int16Array([0, 16384, -16384, 32767])];
  const wav = encodeWav({ channels: 1, sampleRate: 48000, chunks });
  const view = new DataView(wav);
  assert.equal(wav.byteLength, 44 + 8);
  assert.equal(ascii(view, 0, 4), "RIFF");
  assert.equal(view.getUint32(4, true), 36 + 8);
  assert.equal(ascii(view, 8, 4), "WAVE");
  assert.equal(ascii(view, 12, 4), "fmt ");
  assert.equal(view.getUint32(16, true), 16);
  assert.equal(view.getUint16(20, true), 1); // PCM
  assert.equal(view.getUint16(22, true), 1); // mono
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint32(28, true), 48000 * 2); // byte rate
  assert.equal(view.getUint16(32, true), 2); // block align
  assert.equal(view.getUint16(34, true), 16); // bits
  assert.equal(ascii(view, 36, 4), "data");
  assert.equal(view.getUint32(40, true), 8);
  assert.equal(view.getInt16(44, true), 0);
  assert.equal(view.getInt16(46, true), 16384);
  assert.equal(view.getInt16(48, true), -16384);
  assert.equal(view.getInt16(50, true), 32767);
});

test("encodeWav handles stereo and multiple chunks", () => {
  const chunks = [new Int16Array([1, 2, 3, 4]), new Int16Array([5, 6])];
  const wav = encodeWav({ channels: 2, sampleRate: 44100, chunks });
  const view = new DataView(wav);
  assert.equal(wav.byteLength, 44 + 12);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(28, true), 44100 * 4);
  assert.equal(view.getUint16(32, true), 4);
  assert.equal(view.getUint32(40, true), 12);
  for (let i = 0; i < 6; i++) {
    assert.equal(view.getInt16(44 + i * 2, true), i + 1);
  }
});

test("encodeWav with no chunks is a valid empty file", () => {
  const wav = encodeWav({ channels: 2, sampleRate: 48000, chunks: [] });
  const view = new DataView(wav);
  assert.equal(wav.byteLength, 44);
  assert.equal(ascii(view, 0, 4), "RIFF");
  assert.equal(view.getUint32(4, true), 36);
  assert.equal(view.getUint32(40, true), 0);
});

test("sanitizePatchName keeps filenames safe", () => {
  assert.equal(sanitizePatchName("Classic Saw"), "Classic-Saw");
  assert.equal(sanitizePatchName("  Bass/Lead: v2? "), "Bass-Lead-v2");
  assert.equal(sanitizePatchName("a__b"), "a__b");
  assert.equal(sanitizePatchName(""), "patch");
  assert.equal(sanitizePatchName("///"), "patch");
  assert.equal(sanitizePatchName("User 1"), "User-1");
});

test("wavFilename includes patch name and timestamp", () => {
  const d = new Date(2026, 8, 27, 4, 28, 1); // local time
  assert.equal(wavFilename("Classic Saw", d), "volta-Classic-Saw-20260927-042801.wav");
  assert.equal(wavFilename("Bass/Lead", d), "volta-Bass-Lead-20260927-042801.wav");
});
