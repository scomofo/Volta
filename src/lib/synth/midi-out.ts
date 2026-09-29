/**
 * Web MIDI output: mirror played notes to an external MIDI port (the Cantabile
 * live-choir link). The port plumbing lives in the MidiOutput component; this
 * module stays UI-free so byte building, port matching, and config persistence
 * are unit-testable.
 */

export interface MidiOutPortInfo {
  id: string;
  name: string;
}

export interface MidiOutConfig {
  /** Persisted by port name: Web MIDI ids are not stable across sessions. */
  portName: string | null;
  enabled: boolean;
}

const CONFIG_STORAGE_KEY = "volta.midi-out.v1";

export type ConfigStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): ConfigStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadMidiOutConfig(
  storage: ConfigStorage | null = browserStorage(),
): MidiOutConfig {
  const fallback: MidiOutConfig = { portName: null, enabled: false };
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return fallback;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return fallback;
    }
    const { portName, enabled } = data as Record<string, unknown>;
    return {
      portName: typeof portName === "string" && portName.length > 0 ? portName : null,
      enabled: enabled === true,
    };
  } catch {
    return fallback;
  }
}

export function saveMidiOutConfig(
  config: MidiOutConfig,
  storage: ConfigStorage | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      CONFIG_STORAGE_KEY,
      JSON.stringify({ portName: config.portName, enabled: config.enabled }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Raw channel-voice bytes for a note-on on channel 0. */
export function noteOnBytes(note: number, velocity: number): [number, number, number] {
  return [0x90, clamp7(note), clamp7(velocity)];
}

/** Raw channel-voice bytes for a note-off on channel 0. */
export function noteOffBytes(note: number): [number, number, number] {
  return [0x80, clamp7(note), 0];
}

/** Raw channel-voice bytes for a control change on channel 0. */
export function ccBytes(cc: number, value: number): [number, number, number] {
  return [0xb0, clamp7(cc), clamp7(value)];
}

/**
 * Raw pitch-bend bytes on channel 0. Value is 14-bit (0–16383),
 * center 8192; LSB first, then MSB.
 */
export function pitchBendBytes(value14: number): [number, number, number] {
  const v = clamp14(value14);
  return [0xe0, v & 0x7f, (v >> 7) & 0x7f];
}

/** All-notes-off (CC 123) on channel 0. */
export function allNotesOffBytes(): [number, number, number] {
  return [0xb0, 123, 0];
}

function clamp7(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(127, Math.round(value)));
}

function clamp14(value: number): number {
  if (!Number.isFinite(value)) return 8192;
  return Math.max(0, Math.min(16383, Math.round(value)));
}

/** Find a port by the persisted name; ids are session-scoped, names are stable. */
export function findOutputByName(
  outputs: readonly MidiOutPortInfo[],
  name: string | null,
): MidiOutPortInfo | null {
  if (!name) return null;
  return outputs.find((o) => o.name === name) ?? null;
}

export interface MidiOutputLike {
  id: string;
  name: string | null;
  send(data: number[] | Uint8Array): void;
}

export interface MidiAccessLike {
  readonly outputs: Iterable<MidiOutputLike>;
}

function toPortInfos(access: MidiAccessLike): MidiOutPortInfo[] {
  return [...access.outputs].map((port) => ({
    id: port.id,
    name: port.name ?? "MIDI output",
  }));
}

function findLivePort(
  access: MidiAccessLike,
  id: string | null,
): MidiOutputLike | null {
  if (!id) return null;
  return [...access.outputs].find((port) => port.id === id) ?? null;
}

/**
 * Owns the live Web MIDI output port. The component attaches real MIDIAccess;
 * tests inject a fake. Selection persists by port name across sessions.
 */
export class MidiOutManager {
  private access: MidiAccessLike | null = null;
  private portId: string | null = null;
  private config: MidiOutConfig = { portName: null, enabled: false };
  onChange: (() => void) | null = null;

  constructor(storage: ConfigStorage | null = browserStorage()) {
    this.storage = storage;
    this.config = loadMidiOutConfig(storage);
  }

  private storage: ConfigStorage | null;

  get portName(): string | null {
    return this.config.portName;
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  get connected(): boolean {
    return this.access !== null && findLivePort(this.access, this.portId) !== null;
  }

  attach(access: MidiAccessLike): MidiOutPortInfo[] {
    this.access = access;
    const infos = this.refresh();
    this.emit();
    return infos;
  }

  detach(): void {
    this.access = null;
    this.portId = null;
    this.emit();
  }

  /** Re-read outputs (call on statechange); returns current port infos. */
  refresh(): MidiOutPortInfo[] {
    if (!this.access) return [];
    const infos = toPortInfos(this.access);
    const match = findOutputByName(infos, this.config.portName);
    this.portId = match ? match.id : null;
    return infos;
  }

  selectPort(name: string | null): void {
    this.config = { ...this.config, portName: name };
    saveMidiOutConfig(this.config, this.storage);
    this.refresh();
    this.emit();
  }

  setEnabled(enabled: boolean): void {
    this.config = { ...this.config, enabled };
    saveMidiOutConfig(this.config, this.storage);
    this.emit();
  }

  sendNoteOn(note: number, velocity: number): boolean {
    return this.send(noteOnBytes(note, velocity));
  }

  sendNoteOff(note: number): boolean {
    return this.send(noteOffBytes(note));
  }

  sendAllNotesOff(): boolean {
    return this.send(allNotesOffBytes());
  }

  /** Send a control change (e.g. choir vowel morph, dynamics, portamento time). */
  sendCc(cc: number, value: number): boolean {
    return this.send(ccBytes(cc, value));
  }

  /** Send a 14-bit pitch-bend message (0–16383, center 8192). */
  sendPitchBend(value14: number): boolean {
    return this.send(pitchBendBytes(value14));
  }

  private send(bytes: readonly number[]): boolean {
    if (!this.config.enabled || !this.access) return false;
    const port = findLivePort(this.access, this.portId);
    if (!port) return false;
    try {
      port.send([...bytes]);
    } catch {
      return false;
    }
    return true;
  }

  private emit(): void {
    this.onChange?.();
  }
}

/** Process-wide manager used by the store and the MidiOutput component. */
export const midiOut = new MidiOutManager();
