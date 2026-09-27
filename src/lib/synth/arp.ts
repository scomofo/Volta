/**
 * Pure arpeggiator logic — no imports, so it runs under
 * `node --experimental-strip-types` like notes.ts / swarm.ts.
 */

/** A held note with the velocity it was struck at (1..127). */
export type HeldNote = { midi: number; velocity: number };

export type ArpPattern = "up" | "down" | "upDown" | "random";

export const ARP_PATTERNS: { id: ArpPattern; label: string }[] = [
  { id: "up", label: "Up" },
  { id: "down", label: "Down" },
  { id: "upDown", label: "Up-Dn" },
  { id: "random", label: "Random" },
];

export const ARP_RATE_MIN = 60;
export const ARP_RATE_MAX = 240;
export const ARP_RATE_DEFAULT = 120;
export const ARP_OCTAVES_MIN = 1;
export const ARP_OCTAVES_MAX = 3;

/** 16th-note step duration in ms for a BPM rate. */
export function arpStepMs(bpm: number): number {
  return 60000 / Math.max(1, bpm) / 4;
}

/** Rate knob position 0..1 → BPM. */
export function rateToBpm(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return Math.round(ARP_RATE_MIN + x * (ARP_RATE_MAX - ARP_RATE_MIN));
}

/** BPM → rate knob position 0..1. */
export function bpmToRate(bpm: number): number {
  return (
    (Math.min(ARP_RATE_MAX, Math.max(ARP_RATE_MIN, bpm)) - ARP_RATE_MIN) /
    (ARP_RATE_MAX - ARP_RATE_MIN)
  );
}

/**
 * Sort held notes ascending and expand across octaves (each +12 semitones),
 * preserving each note's strike velocity. The "up" pattern walks this list
 * in order; other patterns index into it.
 */
export function expandArpNotes(held: HeldNote[], octaves: number): HeldNote[] {
  const sorted = [...held].sort((a, b) => a.midi - b.midi);
  const out: HeldNote[] = [];
  const n = Math.min(ARP_OCTAVES_MAX, Math.max(ARP_OCTAVES_MIN, Math.round(octaves)));
  for (let o = 0; o < n; o++) {
    for (const note of sorted) {
      out.push({ midi: note.midi + 12 * o, velocity: note.velocity });
    }
  }
  return out;
}

/**
 * Index into the expanded note list for a given step. `rand` is injectable
 * so the random pattern is deterministic in tests.
 */
export function arpStepIndex(
  pattern: ArpPattern,
  step: number,
  length: number,
  rand: () => number = Math.random,
): number {
  if (length <= 1) return 0;
  switch (pattern) {
    case "up":
      return step % length;
    case "down":
      return length - 1 - (step % length);
    case "upDown": {
      const cycle = 2 * length - 2;
      const c = step % cycle;
      return c < length ? c : cycle - c;
    }
    case "random":
      return Math.floor(rand() * length);
  }
}
