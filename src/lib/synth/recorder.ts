/**
 * TakeRecorder: accumulates interleaved 16-bit PCM from tap-worklet chunks.
 *
 * Owns the recording state machine: per-chunk float->int16 conversion,
 * a maximum take length (auto-stops), and a minimum length below which a
 * take is discarded as empty. The Web Audio tap itself lives in the
 * engine; this class is pure and unit-testable.
 *
 * Self-contained on purpose: no imports, runnable under
 * `node --experimental-strip-types`.
 */

/** Takes longer than this are auto-stopped. */
export const MAX_RECORD_SECONDS = 300;
/** Takes shorter than this are discarded as empty. */
export const MIN_RECORD_SECONDS = 0.25;

export type FinishedTake = {
  channels: number;
  sampleRate: number;
  chunks: Int16Array[];
};

export class TakeRecorder {
  private chunks: Int16Array[] = [];
  private frames = 0;
  private channels = 0;
  private readonly maxFrames: number;
  private readonly minFrames: number;
  private readonly sampleRate: number;

  /** True once the take hit the length cap; the engine should stop the tap. */
  capped = false;

  constructor(
    sampleRate: number,
    maxSeconds: number = MAX_RECORD_SECONDS,
    minSeconds: number = MIN_RECORD_SECONDS,
  ) {
    this.sampleRate = Math.max(1, Math.floor(sampleRate));
    this.maxFrames = Math.max(1, Math.floor(this.sampleRate * maxSeconds));
    this.minFrames = Math.max(0, Math.ceil(this.sampleRate * minSeconds));
  }

  get recordedFrames(): number {
    return this.frames;
  }

  get recordedSeconds(): number {
    return this.frames / this.sampleRate;
  }

  get channelCount(): number {
    return this.channels;
  }

  /**
   * Append one worklet block. Channel count is learned from the first
   * block; later blocks with a different layout are ignored (they should
   * never happen — the graph is fixed for the life of a take).
   */
  push(channelData: Float32Array[]): void {
    if (this.capped || channelData.length === 0) return;
    if (this.channels === 0) {
      this.channels = channelData.length;
    } else if (channelData.length !== this.channels) {
      return;
    }
    let blockFrames = channelData[0]!.length;
    for (const ch of channelData) {
      if (ch.length < blockFrames) blockFrames = ch.length;
    }
    const take = Math.min(blockFrames, this.maxFrames - this.frames);
    const out = new Int16Array(take * this.channels);
    for (let i = 0; i < take; i++) {
      for (let ch = 0; ch < this.channels; ch++) {
        let v = channelData[ch]![i]!;
        if (v < -1) v = -1;
        else if (v > 1) v = 1;
        out[i * this.channels + ch] = Math.round(v * 32767);
      }
    }
    this.chunks.push(out);
    this.frames += take;
    if (this.frames >= this.maxFrames) this.capped = true;
  }

  /**
   * Finish the take. Returns null when too little was captured to keep
   * (e.g. stop pressed immediately) — the caller should discard quietly.
   */
  finish(): FinishedTake | null {
    if (this.channels === 0 || this.frames < this.minFrames) return null;
    return { channels: this.channels, sampleRate: this.sampleRate, chunks: this.chunks };
  }
}
