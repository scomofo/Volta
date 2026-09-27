import { create } from "zustand";
import { DEFAULT_PARAMS, getEngine, type SynthParams } from "./engine";
import { OCTAVE_MAX, OCTAVE_MIN } from "./notes";

type SynthStore = SynthParams & {
  armed: boolean;
  octave: number;
  held: number[];
  activePatch: string;
  arm: () => void;
  noteOn: (midi: number) => void;
  noteOff: (midi: number) => void;
  patch: (partial: Partial<SynthParams>) => void;
  applyPreset: (params: SynthParams, label: string) => void;
  shiftOctave: (delta: number) => void;
  panic: () => void;
};

function pushHeld(held: number[], midi: number): number[] {
  return held.includes(midi) ? held : [...held, midi];
}

function dropHeld(held: number[], midi: number): number[] {
  return held.filter((n) => n !== midi);
}

export const useSynthStore = create<SynthStore>((set) => ({
  armed: false,
  octave: 0,
  held: [],
  activePatch: "Classic Saw",
  ...DEFAULT_PARAMS,

  arm: () => {
    const ok = getEngine().arm();
    if (!ok) return;
    const s = useSynthStore.getState();
    getEngine().setParams({
      osc1Wave: s.osc1Wave,
      osc1Footage: s.osc1Footage,
      osc2Wave: s.osc2Wave,
      osc2Footage: s.osc2Footage,
      osc2Tune: s.osc2Tune,
      osc3Wave: s.osc3Wave,
      osc3Footage: s.osc3Footage,
      osc3Tune: s.osc3Tune,
      osc3Follow: s.osc3Follow,
      mix1: s.mix1,
      mix2: s.mix2,
      mix3: s.mix3,
      mixNoise: s.mixNoise,
      swarm: s.swarm,
      swarmLock: s.swarmLock,
      cutoff: s.cutoff,
      emphasis: s.emphasis,
      contour: s.contour,
      filterAttack: s.filterAttack,
      filterDecay: s.filterDecay,
      filterSustain: s.filterSustain,
      filterTrack: s.filterTrack,
      ampAttack: s.ampAttack,
      ampDecay: s.ampDecay,
      ampSustain: s.ampSustain,
      glide: s.glide,
      vibratoRate: s.vibratoRate,
      vibratoDepth: s.vibratoDepth,
      pitchMod: s.pitchMod,
      filterMod: s.filterMod,
      volume: s.volume,
      tune: s.tune,
      a440: s.a440,
    });
    set({ armed: true });
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

  patch: (partial) => {
    getEngine().setParams(partial);
    set({ ...partial, activePatch: "Manual" });
  },

  applyPreset: (params, label) => {
    getEngine().setParams(params);
    set({ ...params, activePatch: label });
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
