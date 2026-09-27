/**
 * 16-bit PCM WAV encoding for recorded takes. Hand-rolled header, no
 * dependencies.
 *
 * Self-contained on purpose: this module has no imports so it can be
 * exercised directly under `node --experimental-strip-types`.
 */

export type WavPcm = {
  channels: number;
  sampleRate: number;
  /** Interleaved Int16 chunks, concatenated in order. */
  chunks: Int16Array[];
};

/** Clamp a float sample to 16-bit signed PCM. */
export function floatToInt16(v: number): number {
  const clamped = v < -1 ? -1 : v > 1 ? 1 : v;
  const scaled = Math.round(clamped * 32767);
  return scaled < -32768 ? -32768 : scaled > 32767 ? 32767 : scaled;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Encode interleaved 16-bit PCM chunks as a complete WAV file.
 * Channel count and sample rate are written honestly from the input.
 */
export function encodeWav(pcm: WavPcm): ArrayBuffer {
  const channels = Math.max(1, Math.floor(pcm.channels));
  const sampleRate = Math.max(1, Math.floor(pcm.sampleRate));
  let totalSamples = 0;
  for (const chunk of pcm.chunks) totalSamples += chunk.length;

  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); // byte rate
  view.setUint16(32, channels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const chunk of pcm.chunks) {
    for (let i = 0; i < chunk.length; i++) {
      view.setInt16(offset, chunk[i]!, true);
      offset += 2;
    }
  }
  return buffer;
}

/** Make a patch name safe for a filename: `Classic Saw` -> `Classic-Saw`. */
export function sanitizePatchName(name: string): string {
  const clean = name
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || "patch";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `volta-Classic-Saw-20260927-042801.wav`, local time. */
export function wavFilename(patchName: string, now: Date = new Date()): string {
  const stamp =
    `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}` +
    `-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `volta-${sanitizePatchName(patchName)}-${stamp}.wav`;
}
