/**
 * Clean-room parameter mappings for the Volta FX section (Drive → Chorus → Delay).
 *
 * The topologies here are textbook DSP — waveshaper distortion, an
 * LFO-modulated delay-line chorus, and a feedback delay line — of the kind
 * described in the classic audio-effects literature. Every function maps the
 * 0..1 knob range to concrete DSP units; they are pure and unit-tested so the
 * curves can be reasoned about without audio hardware.
 */

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.min(1, Math.max(0, t));
}

/** Delay Time knob → seconds, exponential 1 ms .. 1 s. */
export function delayTimeSec(t: number): number {
  return 0.001 * 1000 ** clamp01(t);
}

/**
 * Delay Feedback knob → loop gain. Capped at 0.95 so the loop can never run
 * away no matter where the knob sits.
 */
export function delayFeedbackGain(t: number): number {
  return clamp01(t) * 0.95;
}

/** Chorus Rate knob → LFO frequency in Hz, exponential 0.05 .. 8 Hz. */
export function chorusRateHz(t: number): number {
  return 0.05 * 160 ** clamp01(t);
}

/**
 * Chorus Depth knob → LFO delay deviation in seconds, 0 .. 6 ms.
 * Never exceeds the smallest chorus tap base delay (12 ms), so the
 * modulated delay time always stays positive.
 */
export function chorusDepthSec(t: number): number {
  return clamp01(t) * 0.006;
}

/** Base delay offsets for the two chorus taps, in seconds. */
export const CHORUS_TAP_A_SEC = 0.012;
export const CHORUS_TAP_B_SEC = 0.019;

/**
 * Drive knob → pre-gain into a fixed tanh waveshaper, 1 .. 40.
 * At 1 the shaper is near-transparent; pushing it harder folds the
 * waveform into saturation and then hard clipping.
 */
export function drivePregain(t: number): number {
  return 1 + clamp01(t) * 39;
}

/** High-shelf corner for the drive tone control, in Hz. */
export const DRIVE_TONE_FREQ_HZ = 3500;

/** Tone knob → high-shelf gain in dB, -12 .. +12, flat at center. */
export function driveToneDb(t: number): number {
  return (clamp01(t) - 0.5) * 24;
}

/**
 * Level knob → post-drive output gain. 0.5 is unity; the ±12 dB range
 * restores loudness after heavy drive settings.
 */
export function driveLevelGain(t: number): number {
  return 10 ** (((clamp01(t) - 0.5) * 24) / 20);
}

export function formatChorusRate(t: number): string {
  const hz = chorusRateHz(t);
  return hz < 1 ? `${hz.toFixed(2)}Hz` : `${hz < 10 ? hz.toFixed(1) : Math.round(hz)}Hz`;
}

export function formatChorusDepth(t: number): string {
  return `${(chorusDepthSec(t) * 1000).toFixed(1)}ms`;
}

export function formatDelayTime(t: number): string {
  const ms = delayTimeSec(t) * 1000;
  return ms < 100 ? `${ms.toFixed(1)}ms` : `${Math.round(ms)}ms`;
}

export function formatDriveTone(t: number): string {
  const db = driveToneDb(t);
  return `${db >= 0 ? "+" : ""}${db.toFixed(1)}dB`;
}

export function formatDriveLevel(t: number): string {
  const db = 20 * Math.log10(Math.max(1e-6, driveLevelGain(t)));
  return `${db >= 0 ? "+" : ""}${db.toFixed(1)}dB`;
}
