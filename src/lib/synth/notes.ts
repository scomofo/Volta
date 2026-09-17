export type OscWave = "triangle" | "sawtooth" | "square" | "pulse";

export const OSC_WAVES: { id: OscWave; label: string }[] = [
  { id: "triangle", label: "Tri" },
  { id: "sawtooth", label: "Saw" },
  { id: "square", label: "Square" },
  { id: "pulse", label: "Pulse" },
];

export type Footage = "32" | "16" | "8" | "4" | "2" | "LO";

export const FOOTAGES: { id: Footage; label: string; ratio: number }[] = [
  { id: "32", label: "32′", ratio: 0.25 },
  { id: "16", label: "16′", ratio: 0.5 },
  { id: "8", label: "8′", ratio: 1 },
  { id: "4", label: "4′", ratio: 2 },
  { id: "2", label: "2′", ratio: 4 },
  { id: "LO", label: "LO", ratio: 0 },
];

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/** Lowest visible key when octave shift is 0 (C3). */
export const BASE_MIDI = 48;
/** Inclusive span of the on-screen keyboard (C to C, two octaves). */
export const KEYBOARD_SPAN = 24;

export const OCTAVE_MIN = -2;
export const OCTAVE_MAX = 3;

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${oct}`;
}

export function isWhiteMidi(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 0 || pc === 2 || pc === 4 || pc === 5 || pc === 7 || pc === 9 || pc === 11;
}

export function displayedMidi(octave: number, offset: number): number {
  return BASE_MIDI + octave * 12 + offset;
}

/** Physical `event.code` → semitone offset from the displayed bottom C. */
export const CODE_TO_OFFSET: Record<string, number> = {
  KeyZ: 0,
  KeyS: 1,
  KeyX: 2,
  KeyD: 3,
  KeyC: 4,
  KeyV: 5,
  KeyG: 6,
  KeyB: 7,
  KeyH: 8,
  KeyN: 9,
  KeyJ: 10,
  KeyM: 11,
  Comma: 12,
  KeyL: 13,
  Period: 14,
  Semicolon: 15,
  Slash: 16,
  KeyQ: 12,
  Digit2: 13,
  KeyW: 14,
  Digit3: 15,
  KeyE: 16,
  KeyR: 17,
  Digit5: 18,
  KeyT: 19,
  Digit6: 20,
  KeyY: 21,
  Digit7: 22,
  KeyU: 23,
  KeyI: 24,
  Digit9: 25,
  KeyO: 26,
  Digit0: 27,
  KeyP: 28,
};

/** Preferred computer-key glyph for each on-screen offset. */
export const OFFSET_LABEL: Record<number, string> = {
  0: "Z",
  1: "S",
  2: "X",
  3: "D",
  4: "C",
  5: "V",
  6: "G",
  7: "B",
  8: "H",
  9: "N",
  10: "J",
  11: "M",
  12: "Q",
  13: "2",
  14: "W",
  15: "3",
  16: "E",
  17: "R",
  18: "5",
  19: "T",
  20: "6",
  21: "Y",
  22: "7",
  23: "U",
  24: "I",
};

export function buildKeyboard(octave: number) {
  const keys: { midi: number; offset: number; white: boolean; label: string }[] = [];
  for (let offset = 0; offset <= KEYBOARD_SPAN; offset++) {
    const midi = displayedMidi(octave, offset);
    keys.push({
      midi,
      offset,
      white: isWhiteMidi(midi),
      label: OFFSET_LABEL[offset] ?? "",
    });
  }
  return keys;
}

export function expMap(t: number, min: number, max: number): number {
  const x = Math.min(1, Math.max(0, t));
  return min * (max / min) ** x;
}

export function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)}k`;
  return `${Math.round(hz)}Hz`;
}

export function formatMs(seconds: number): string {
  const ms = seconds * 1000;
  if (ms < 10) return `${ms.toFixed(1)}ms`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${seconds.toFixed(2)}s`;
}

export function formatPct(t: number): string {
  return `${Math.round(t * 100)}%`;
}

export function formatTune(t: number): string {
  const st = (t - 0.5) * 14;
  if (Math.abs(st) < 0.05) return "0.0";
  return `${st > 0 ? "+" : ""}${st.toFixed(1)}`;
}

export function footageRatio(footage: Footage): number {
  const found = FOOTAGES.find((f) => f.id === footage);
  return found && found.ratio > 0 ? found.ratio : 1;
}
