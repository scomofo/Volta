import {
  arpStepIndex,
  expandArpNotes,
  type ArpPattern,
  type HeldNote,
} from "./arp.ts";

export type ArpPlayerDeps = {
  /** Sound a note now (engine.noteOn). */
  play: (midi: number, velocity: number) => void;
  /** Silence a note (engine.noteOff). */
  release: (midi: number) => void;
  getHeld: () => HeldNote[];
  getPattern: () => ArpPattern;
  getOctaves: () => number;
  getStepMs: () => number;
  /** UI hook: currently sounding step, or null when idle. */
  onStep: (midi: number | null) => void;
  rand?: () => number;
};

/**
 * Minimal arpeggiator scheduler. The interval calls tick(); tests drive
 * tick() directly so no timers are involved. Each step releases the
 * previous note before sounding the next, so the mono engine retriggers
 * its envelopes every step.
 */
export class ArpPlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private sounding: number | null = null;
  private deps: ArpPlayerDeps;

  constructor(deps: ArpPlayerDeps) {
    this.deps = deps;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    this.step = 0;
    if (!this.tick()) return;
    this.timer = setInterval(() => this.tick(), this.deps.getStepMs());
  }

  /** Advance one step. Returns false when there is nothing to play. */
  tick(): boolean {
    const held = this.deps.getHeld();
    if (held.length === 0) {
      this.stop();
      return false;
    }
    const notes = expandArpNotes(held, this.deps.getOctaves());
    const note = notes[arpStepIndex(this.deps.getPattern(), this.step, notes.length, this.deps.rand)]!;
    if (this.sounding !== null) this.deps.release(this.sounding);
    this.deps.play(note.midi, note.velocity);
    this.sounding = note.midi;
    this.deps.onStep(note.midi);
    this.step++;
    return true;
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.sounding !== null) {
      this.deps.release(this.sounding);
      this.sounding = null;
    }
    this.deps.onStep(null);
  }

  /** Restart the interval with the current rate, keeping the step position. */
  retime(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), this.deps.getStepMs());
  }
}
