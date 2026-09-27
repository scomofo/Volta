import { create } from "zustand";
import { DEFAULT_PARAMS, getEngine, type SynthParams } from "./engine";
import { loadMidiBindings, saveMidiBindings, type MidiBindings } from "./midi";
import { OCTAVE_MAX, OCTAVE_MIN } from "./notes";

type SynthStore = SynthParams & {
  armed: boolean;
  octave: number;
  held: number[];
  activePatch: string;
  midiSupported: boolean;
  midiInputs: string[];
  midiLearn: boolean;
  learnTarget: string | null;
  bindings: MidiBindings;
  arm: () => void;
  noteOn: (midi: number, velocity?: number) => void;
  noteOff: (midi: number) => void;
  patch: (partial: Partial<SynthParams>) => void;
  applyPreset: (params: SynthParams, label: string) => void;
  shiftOctave: (delta: number) => void;
  panic: () => void;
  setMidiStatus: (supported: boolean, inputs: string[]) => void;
  toggleMidiLearn: () => void;
  setLearnTarget: (paramKey: string) => void;
  cancelMidiLearn: () => void;
  applyCc: (cc: number, value: number) => void;
  unbindCc: (paramKey: string) => void;
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
  midiSupported: false,
  midiInputs: [],
  midiLearn: false,
  learnTarget: null,
  bindings: loadMidiBindings(),
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
      velocity: s.velocity,
      volume: s.volume,
      tune: s.tune,
      a440: s.a440,
    });
    set({ armed: true });
  },

  noteOn: (midi, velocity = 100) => {
    const engine = getEngine();
    engine.arm();
    engine.noteOn(midi, velocity);
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

  setMidiStatus: (supported, inputs) => {
    set({ midiSupported: supported, midiInputs: inputs });
  },

  toggleMidiLearn: () => {
    set((s) => ({
      midiLearn: !s.midiLearn,
      learnTarget: null,
    }));
  },

  setLearnTarget: (paramKey) => {
    set({ learnTarget: paramKey });
  },

  cancelMidiLearn: () => {
    set({ midiLearn: false, learnTarget: null });
  },

  applyCc: (cc, value) => {
    const s = useSynthStore.getState();
    if (s.midiLearn && s.learnTarget) {
      const bindings = { ...s.bindings, [s.learnTarget]: cc };
      saveMidiBindings(bindings);
      set({ bindings, midiLearn: false, learnTarget: null });
      return;
    }
    const entry = Object.entries(s.bindings).find(([, bound]) => bound === cc);
    if (!entry) return;
    const paramKey = entry[0] as keyof SynthParams;
    getEngine().setParams({ [paramKey]: value / 127 } as Partial<SynthParams>);
    set({ [paramKey]: value / 127, activePatch: "Manual" } as Partial<SynthStore>);
  },

  unbindCc: (paramKey) => {
    const s = useSynthStore.getState();
    if (!(paramKey in s.bindings)) return;
    const bindings = { ...s.bindings };
    delete bindings[paramKey];
    saveMidiBindings(bindings);
    set({ bindings });
  },
}));
