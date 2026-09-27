import { LEARNABLE_KEYS } from "./patch-storage.ts";

/**
 * Web MIDI input: message parsing plus persistent CC→param bindings for MIDI learn.
 * The live port plumbing lives in the MidiInput component; this module stays
 * UI-free so the parsing and storage round-trip are unit-testable.
 */

export type MidiMessage =
  | { kind: "noteOn"; channel: number; note: number; velocity: number }
  | { kind: "noteOff"; channel: number; note: number }
  | { kind: "cc"; channel: number; cc: number; value: number }
  | { kind: "unknown" };

export function parseMidiMessage(data: ArrayLike<number>): MidiMessage {
  const status = data[0] ?? 0;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;
  const channel = status & 0x0f;
  switch (status & 0xf0) {
    case 0x90:
      // Velocity 0 on a note-on status is note-off by convention.
      return d2 === 0
        ? { kind: "noteOff", channel, note: d1 }
        : { kind: "noteOn", channel, note: d1, velocity: d2 };
    case 0x80:
      return { kind: "noteOff", channel, note: d1 };
    case 0xb0:
      return { kind: "cc", channel, cc: d1, value: d2 };
    default:
      return { kind: "unknown" };
  }
}

/** Param key → MIDI CC number. */
export type MidiBindings = Record<string, number>;

const BINDINGS_STORAGE_KEY = "volta.midi-bindings.v1";

export type BindingStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): BindingStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isValidBinding(key: string, cc: unknown): cc is number {
  return (
    (LEARNABLE_KEYS as readonly string[]).includes(key) &&
    typeof cc === "number" &&
    Number.isInteger(cc) &&
    cc >= 0 &&
    cc <= 127
  );
}

export function loadMidiBindings(
  storage: BindingStorage | null = browserStorage(),
): MidiBindings {
  if (!storage) return {};
  try {
    const raw = storage.getItem(BINDINGS_STORAGE_KEY);
    if (!raw) return {};
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return {};
    const bindings: MidiBindings = {};
    for (const [key, cc] of Object.entries(data as Record<string, unknown>)) {
      if (isValidBinding(key, cc)) bindings[key] = cc;
    }
    return bindings;
  } catch {
    return {};
  }
}

export function saveMidiBindings(
  bindings: MidiBindings,
  storage: BindingStorage | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    const clean: MidiBindings = {};
    for (const [key, cc] of Object.entries(bindings)) {
      if (isValidBinding(key, cc)) clean[key] = cc;
    }
    storage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}
