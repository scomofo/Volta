/**
 * Performance controls for the Cantabile live-choir link: pitch bend, vowel
 * morph (CC1), choir dynamics (CC11), and glide-as-portamento-time (CC5).
 * UI-free and unit-testable; the byte building lives in midi-out.ts.
 *
 * Protocol note: these are standard MIDI messages. The live player in
 * tools/cantabile currently handles notes and all-notes-off only — see
 * LIVE_LINK.md for which messages need companion-side support.
 */

/** MIDI pitch-bend range: 14-bit, center detent at 8192. */
export const PITCH_BEND_CENTER = 8192;
export const PITCH_BEND_MAX = 16383;

/** Volta's pitch wheel bends ±2 semitones, like the hardware. */
export const PITCH_BEND_RANGE_SEMITONES = 2;

/** Choir-link expressive protocol (standard MIDI CC numbers). */
export const CHOIR_VOWEL_CC = 1; // mod wheel → vowel morph (a→e→i→o→u)
export const CHOIR_DYNAMICS_CC = 11; // expression → choir dynamics
export const PORTAMENTO_TIME_CC = 5; // glide knob → portamento time

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** 14-bit pitch-bend value → semitones in [-2, +2]. */
export function pitchBendToSemitones(value14: number): number {
  const v = clamp(value14, 0, PITCH_BEND_MAX);
  return ((v - PITCH_BEND_CENTER) / PITCH_BEND_CENTER) * PITCH_BEND_RANGE_SEMITONES;
}

/** Semitones in [-2, +2] → 14-bit pitch-bend value. */
export function semitonesToPitchBend(semitones: number): number {
  const s = clamp(semitones, -PITCH_BEND_RANGE_SEMITONES, PITCH_BEND_RANGE_SEMITONES);
  const v = PITCH_BEND_CENTER + (s / PITCH_BEND_RANGE_SEMITONES) * PITCH_BEND_CENTER;
  return Math.round(clamp(v, 0, PITCH_BEND_MAX));
}

/** Frequency multiplier for a bend of `semitones`. */
export function bendRatio(semitones: number): number {
  return 2 ** (semitones / 12);
}

/** Volta's normalized glide (0–1) → CC5 portamento-time value (0–127). */
export function glideToPortamentoCc(glide01: number): number {
  return Math.round(clamp(glide01, 0, 1) * 127);
}
