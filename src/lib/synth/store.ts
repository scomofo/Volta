import { create } from "zustand";
import { getEngine, type SynthParams } from "./engine";
import { OCTAVE_MAX, OCTAVE_MIN, type Waveform } from "./notes";

type SynthStore = SynthParams & {
  armed: boolean;
  octave: number;
  held: number[];
  arm: () => void;
  noteOn: (midi: number) => void;
  noteOff: (midi: number) => void;
  setWaveform: (waveform: Waveform) => void;
  setCutoff: (cutoff: number) => void;
  setResonance: (resonance: number) => void;
  setAttack: (attack: number) => void;
  setDecay: (decay: number) => void;
  setSustain: (sustain: number) => void;
  setRelease: (release: number) => void;
  setVolume: (volume: number) => void;
  shiftOctave: (delta: number) => void;
  panic: () => void;
};

function syncEngine(partial: Partial<SynthParams>) {
  getEngine().setParams(partial);
}

function pushHeld(held: number[], midi: number): number[] {
  return held.includes(midi) ? held : [...held, midi];
}

function dropHeld(held: number[], midi: number): number[] {
  return held.filter((n) => n !== midi);
}

export const useSynthStore = create<SynthStore>((set, get) => ({
  armed: false,
  octave: 0,
  held: [],
  waveform: "sawtooth",
  cutoff: 0.72,
  resonance: 0.18,
  attack: 0.1,
  decay: 0.28,
  sustain: 0.68,
  release: 0.32,
  volume: 0.72,

  arm: () => {
    const ok = getEngine().arm();
    if (ok) set({ armed: true });
  },

  noteOn: (midi) => {
    const engine = getEngine();
    engine.arm();
    engine.noteOn(midi);
    set((s) => ({
      armed: true,
      held: pushHeld(s.held, midi),
    }));
  },

  noteOff: (midi) => {
    getEngine().noteOff(midi);
    set((s) => ({ held: dropHeld(s.held, midi) }));
  },

  setWaveform: (waveform) => {
    syncEngine({ waveform });
    set({ waveform });
  },
  setCutoff: (cutoff) => {
    syncEngine({ cutoff });
    set({ cutoff });
  },
  setResonance: (resonance) => {
    syncEngine({ resonance });
    set({ resonance });
  },
  setAttack: (attack) => {
    syncEngine({ attack });
    set({ attack });
  },
  setDecay: (decay) => {
    syncEngine({ decay });
    set({ decay });
  },
  setSustain: (sustain) => {
    syncEngine({ sustain });
    set({ sustain });
  },
  setRelease: (release) => {
    syncEngine({ release });
    set({ release });
  },
  setVolume: (volume) => {
    syncEngine({ volume });
    set({ volume });
  },

  shiftOctave: (delta) => {
    set((s) => ({
      octave: Math.min(OCTAVE_MAX, Math.max(OCTAVE_MIN, s.octave + delta)),
    }));
  },

  panic: () => {
    getEngine().panic();
    set({ held: [] });
  },
}));

