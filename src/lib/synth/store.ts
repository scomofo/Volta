import { create } from "zustand";
import { DEFAULT_PARAMS, getEngine, type SynthParams } from "./engine";
import { ARP_RATE_DEFAULT, arpStepMs, type ArpPattern, type HeldNote } from "./arp";
import { ArpPlayer } from "./arpPlayer";
import { loadMidiBindings, saveMidiBindings, type MidiBindings } from "./midi";
import { midiOut } from "./midi-out";
import { OCTAVE_MAX, OCTAVE_MIN } from "./notes";

type SynthStore = SynthParams & {
  armed: boolean;
  octave: number;
  held: HeldNote[];
  arp: boolean;
  arpPattern: ArpPattern;
  arpRate: number;
  arpOctaves: number;
  /** Currently sounding arp step, for the Note readout; null when idle. */
  arpNote: number | null;
  activePatch: string;
  midiSupported: boolean;
  midiInputs: string[];
  midiOutSupported: boolean;
  midiOutPorts: string[];
  midiOutName: string | null;
  midiOutEnabled: boolean;
  midiLearn: boolean;
  learnTarget: string | null;
  bindings: MidiBindings;
  arm: () => void;
  noteOn: (midi: number, velocity?: number) => void;
  noteOff: (midi: number) => void;
  toggleArp: () => void;
  setArpPattern: (pattern: ArpPattern) => void;
  setArpRate: (bpm: number) => void;
  setArpOctaves: (octaves: number) => void;
  patch: (partial: Partial<SynthParams>) => void;
  applyPreset: (params: SynthParams, label: string) => void;
  shiftOctave: (delta: number) => void;
  panic: () => void;
  setMidiStatus: (supported: boolean, inputs: string[]) => void;
  setMidiOutStatus: (supported: boolean, ports: string[]) => void;
  selectMidiOut: (name: string | null) => void;
  setMidiOutEnabled: (enabled: boolean) => void;
  toggleMidiLearn: () => void;
  setLearnTarget: (paramKey: string) => void;
  cancelMidiLearn: () => void;
  applyCc: (cc: number, value: number) => void;
  unbindCc: (paramKey: string) => void;
};

function pushHeld(held: HeldNote[], midi: number, velocity: number): HeldNote[] {
  return held.some((h) => h.midi === midi) ? held : [...held, { midi, velocity }];
}

function dropHeld(held: HeldNote[], midi: number): HeldNote[] {
  return held.filter((h) => h.midi !== midi);
}

/**
 * Owns the gate while the arpeggiator runs: user noteOn/noteOff only edit
 * the held list, and the player retriggers the mono engine each step.
 * Callbacks run at runtime only, so the store↔player reference is safe.
 */
const arpPlayer = new ArpPlayer({
  play: (midi, velocity) => getEngine().noteOn(midi, velocity),
  release: (midi) => getEngine().noteOff(midi),
  getHeld: () => useSynthStore.getState().held,
  getPattern: () => useSynthStore.getState().arpPattern,
  getOctaves: () => useSynthStore.getState().arpOctaves,
  getStepMs: () => arpStepMs(useSynthStore.getState().arpRate),
  onStep: (midi) => useSynthStore.setState({ arpNote: midi }),
});

export const useSynthStore = create<SynthStore>((set) => ({
  armed: false,
  octave: 0,
  held: [],
  arp: false,
  arpPattern: "up",
  arpRate: ARP_RATE_DEFAULT,
  arpOctaves: 1,
  arpNote: null,
  activePatch: "Classic Saw",
  midiSupported: false,
  midiInputs: [],
  midiOutSupported: false,
  midiOutPorts: [],
  midiOutName: midiOut.portName,
  midiOutEnabled: midiOut.enabled,
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
    const s = useSynthStore.getState();
    const held = pushHeld(s.held, midi, velocity);
    if (s.arp) {
      // The arp owns the gate: just track the held note; the player
      // retriggers the engine each step.
      set({ armed: true, held });
      if (held.length > 0) arpPlayer.start();
      return;
    }
    engine.noteOn(midi, velocity);
    midiOut.sendNoteOn(midi, velocity);
    set({ armed: true, held });
  },

  noteOff: (midi) => {
    const s = useSynthStore.getState();
    const held = dropHeld(s.held, midi);
    if (s.arp) {
      set({ held });
      if (held.length === 0) arpPlayer.stop();
      return;
    }
    getEngine().noteOff(midi);
    midiOut.sendNoteOff(midi);
    set({ held });
  },

  toggleArp: () => {
    const s = useSynthStore.getState();
    if (!s.arp) {
      // Clear any directly-held note so the arp owns the gate from step 0.
      getEngine().panic();
      set({ arp: true });
      if (s.held.length > 0) arpPlayer.start();
      return;
    }
    arpPlayer.stop();
    set({ arp: false });
  },

  setArpPattern: (arpPattern) => set({ arpPattern }),

  setArpRate: (arpRate) => {
    set({ arpRate });
    arpPlayer.retime();
  },

  setArpOctaves: (arpOctaves) => set({ arpOctaves }),

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
    arpPlayer.stop();
    getEngine().panic();
    midiOut.sendAllNotesOff();
    set({ held: [] });
  },

  setMidiStatus: (supported, inputs) => {
    set({ midiSupported: supported, midiInputs: inputs });
  },

  setMidiOutStatus: (supported, ports) => {
    set({
      midiOutSupported: supported,
      midiOutPorts: ports,
      midiOutName: midiOut.portName,
      midiOutEnabled: midiOut.enabled,
    });
  },

  selectMidiOut: (name) => {
    midiOut.selectPort(name);
    set({ midiOutName: midiOut.portName });
  },

  setMidiOutEnabled: (enabled) => {
    midiOut.setEnabled(enabled);
    set({ midiOutEnabled: midiOut.enabled });
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
