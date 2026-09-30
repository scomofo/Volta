import { Minus, Plus } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { attackSec, cutoffHz, decaySec, DEFAULT_PARAMS, glideSec } from "@/lib/synth/engine";
import {
  ARP_OCTAVES_MAX,
  ARP_OCTAVES_MIN,
  ARP_PATTERNS,
  ARP_RATE_DEFAULT,
  bpmToRate,
  rateToBpm,
  type ArpPattern,
} from "@/lib/synth/arp";
import {
  formatHz,
  formatMs,
  formatPct,
  formatTune,
  midiToName,
  type Footage,
  type OscWave,
} from "@/lib/synth/notes";
import { formatVibratoRate } from "@/lib/synth/modulation";
import {
  formatChorusDepth,
  formatChorusRate,
  formatDelayTime,
  formatDriveLevel,
  formatDriveTone,
} from "@/lib/synth/effects";
import { useSynthStore } from "@/lib/synth/store";
import { cn } from "@/lib/utils";
import { ArmGate } from "./arm-gate";
import { PatchShelf } from "./patch-shelf";
import { ComputerKeys } from "./computer-keys";
import { FootageSelect } from "./footage-select";
import { Keyboard } from "./keyboard";
import { Wheels } from "./wheels";
import { Knob } from "./knob";
import { LevelMeter } from "./level-meter";
import { MidiInput } from "./midi-input";
import { MidiOutput } from "./midi-output";
import { RecordButton } from "./record-button";
import { Rocker } from "./rocker";
import { Scope } from "./scope";
import { WaveformSelect } from "./waveform-select";

function silk(title: string) {
  return (
    <h2 className="font-sans text-micro font-medium uppercase tracking-[0.2em] text-panel-muted">
      {title}
    </h2>
  );
}

type LearnKnobProps = Omit<
  ComponentProps<typeof Knob>,
  "learnMode" | "learnTarget" | "boundCc" | "onLearnSelect" | "onUnlearn"
> & { paramKey: string };

/** Knob wired into MIDI-learn: shows bound CC, highlights while learning. */
function LearnKnob({ paramKey, ...props }: LearnKnobProps) {
  const learnMode = useSynthStore((s) => s.midiLearn);
  const learnTarget = useSynthStore((s) => s.learnTarget);
  const boundCc = useSynthStore((s) => s.bindings[paramKey] ?? null);
  const setLearnTarget = useSynthStore((s) => s.setLearnTarget);
  const unbindCc = useSynthStore((s) => s.unbindCc);
  return (
    <Knob
      {...props}
      paramKey={paramKey}
      learnMode={learnMode}
      learnTarget={learnTarget === paramKey}
      boundCc={boundCc}
      onLearnSelect={setLearnTarget}
      onUnlearn={unbindCc}
    />
  );
}

function MidiLearnButton() {
  const midiSupported = useSynthStore((s) => s.midiSupported);
  const midiInputs = useSynthStore((s) => s.midiInputs);
  const midiLearn = useSynthStore((s) => s.midiLearn);
  const toggleMidiLearn = useSynthStore((s) => s.toggleMidiLearn);

  const label = midiLearn
    ? "Learning…"
    : !midiSupported
      ? "No MIDI"
      : midiInputs.length > 0
        ? `MIDI · ${midiInputs.length}`
        : "MIDI";

  return (
    <button
      type="button"
      onClick={toggleMidiLearn}
      aria-pressed={midiLearn}
      title={
        midiLearn
          ? "Click a knob, then move a control on your MIDI device. Esc cancels."
          : "Map knobs to your MIDI controller"
      }
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-walnut px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] transition-colors",
        midiLearn ? "text-accent" : "text-muted hover:text-fg",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          midiLearn ? "animate-pulse bg-accent" : midiSupported && midiInputs.length > 0 ? "bg-accent" : "bg-subtle",
        )}
      />
      {label}
    </button>
  );
}

function ChoirLinkButton() {
  const midiOutSupported = useSynthStore((s) => s.midiOutSupported);
  const midiOutPorts = useSynthStore((s) => s.midiOutPorts);
  const midiOutName = useSynthStore((s) => s.midiOutName);
  const midiOutEnabled = useSynthStore((s) => s.midiOutEnabled);
  const selectMidiOut = useSynthStore((s) => s.selectMidiOut);
  const setMidiOutEnabled = useSynthStore((s) => s.setMidiOutEnabled);
  const choirDynamics = useSynthStore((s) => s.choirDynamics);
  const setChoirDynamics = useSynthStore((s) => s.setChoirDynamics);
  const [open, setOpen] = useState(false);

  const active = midiOutEnabled && midiOutName !== null;
  const label = !midiOutSupported
    ? "No MIDI"
    : active
      ? "Choir · on"
      : "Choir link";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Mirror played notes to a MIDI output — the Cantabile live-choir link"
        className={cn(
          "inline-flex items-center gap-2 rounded-full bg-walnut px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] transition-colors",
          active ? "text-accent" : "text-muted hover:text-fg",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            active ? "bg-accent" : "bg-subtle",
          )}
        />
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Choir link settings"
          className="absolute right-0 z-30 mt-2 w-64 rounded-lg bg-walnut p-3 shadow-xl"
        >
          <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.12em] text-fg">
            Send notes to choir
            <input
              type="checkbox"
              checked={midiOutEnabled}
              onChange={(e) => setMidiOutEnabled(e.target.checked)}
              className="size-4 accent-[var(--color-accent)]"
            />
          </label>
          <label className="mt-3 block text-xs font-medium uppercase tracking-[0.12em] text-muted">
            MIDI output port
            <select
              value={midiOutName ?? ""}
              onChange={(e) => selectMidiOut(e.target.value || null)}
              disabled={!midiOutSupported || midiOutPorts.length === 0}
              className="mt-1 w-full rounded-md bg-bg px-2 py-1.5 text-xs normal-case tracking-normal text-fg"
            >
              <option value="">Select a port…</option>
              {midiOutPorts.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Play Volta&apos;s keyboard and Cantabile&apos;s singers sing the notes
            live. The pitch wheel bends the choir, the mod wheel morphs its
            vowel, and the dynamics slider shapes its volume. MIDI coming in
            plays Volta&apos;s own synth directly — it is never echoed back to
            the choir. Needs a virtual MIDI cable (e.g. loopMIDI) between the
            two apps.
          </p>
          <label className="mt-3 block text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Choir dynamics (CC11)
            <input
              type="range"
              min={0}
              max={127}
              value={choirDynamics}
              onChange={(e) => setChoirDynamics(Number(e.target.value))}
              className="mt-1 w-full accent-[var(--color-accent)]"
              aria-label="Choir dynamics"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function MidiLearnHint() {
  const midiLearn = useSynthStore((s) => s.midiLearn);
  const learnTarget = useSynthStore((s) => s.learnTarget);
  const cancelMidiLearn = useSynthStore((s) => s.cancelMidiLearn);
  if (!midiLearn) return null;
  return (
    <p
      role="status"
      className="rounded-md bg-walnut px-3 py-2 text-center text-xs font-medium uppercase tracking-[0.12em] text-accent"
    >
      {learnTarget
        ? "Move a control on your MIDI device to bind it — Esc cancels"
        : "Click a knob to MIDI-learn it — Esc cancels"}
      <button
        type="button"
        onClick={cancelMidiLearn}
        className="ml-3 underline underline-offset-2 hover:text-fg"
      >
        Cancel
      </button>
    </p>
  );
}

function ArpPatternSelect({
  value,
  onChange,
}: {
  value: ArpPattern;
  onChange: (pattern: ArpPattern) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Arp pattern" className="grid grid-cols-2 gap-1">
      {ARP_PATTERNS.map((pattern) => {
        const selected = pattern.id === value;
        return (
          <button
            key={pattern.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(pattern.id)}
            className={cn(
              "min-h-9 rounded-md px-1 text-micro font-medium uppercase tracking-[0.1em]",
              "transition-[background-color,color,transform] duration-(--motion-quick) ease-(--ease-out)",
              "hover:text-panel-fg active:scale-[0.96]",
              selected ? "bg-walnut text-cream" : "bg-walnut/10 text-panel-muted",
            )}
          >
            {pattern.label}
          </button>
        );
      })}
    </div>
  );
}

export function VoltaApp() {
  const armed = useSynthStore((s) => s.armed);
  const octave = useSynthStore((s) => s.octave);
  const held = useSynthStore((s) => s.held);
  const patch = useSynthStore((s) => s.patch);
  const shiftOctave = useSynthStore((s) => s.shiftOctave);
  const s = useSynthStore();

  const lowest = midiToName(48 + octave * 12);
  const current =
    s.arp && s.arpNote != null
      ? midiToName(s.arpNote)
      : held.length
        ? midiToName(held[held.length - 1]!.midi)
        : "—";

  return (
    <main
      className="flex min-h-dvh flex-col overflow-x-hidden bg-bg text-fg"
      data-armed={armed ? "true" : "false"}
      data-waveform={s.osc1Wave}
      data-octave={octave}
    >
      <ComputerKeys />
      <MidiInput />
      <MidiOutput />
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-3 px-3 py-4 sm:gap-4 sm:px-5 sm:py-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="font-sans text-micro font-medium uppercase tracking-[0.22em] text-muted">
              Monophonic ladder
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              VOLTA
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full bg-walnut px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em]",
                armed ? "text-accent" : "text-muted",
              )}
            >
              <span className={cn("size-1.5 rounded-full", armed ? "bg-accent" : "bg-subtle")} />
              {armed ? "Live" : "Standby"}
            </span>
            <span className="hidden text-xs font-medium uppercase tracking-[0.14em] text-muted sm:inline">
              Last note · 3 VCO
            </span>
            <MidiLearnButton />
            <ChoirLinkButton />
            <RecordButton />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Octave down"
                onClick={() => shiftOctave(-1)}
                className="flex size-11 items-center justify-center rounded-md bg-walnut text-fg transition-transform duration-(--motion-quick) ease-(--ease-out) hover:text-accent active:scale-[0.96]"
              >
                <Minus className="size-4" strokeWidth={2} />
              </button>
              <div className="min-w-14 text-center">
                <span className="block font-display text-lg font-medium tabular-nums text-fg">
                  {octave > 0 ? `+${octave}` : octave}
                </span>
                <span className="text-micro uppercase tracking-[0.14em] text-muted">{lowest}</span>
              </div>
              <button
                type="button"
                aria-label="Octave up"
                onClick={() => shiftOctave(1)}
                className="flex size-11 items-center justify-center rounded-md bg-walnut text-fg transition-transform duration-(--motion-quick) ease-(--ease-out) hover:text-accent active:scale-[0.96]"
              >
                <Plus className="size-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </header>

        <MidiLearnHint />

        <section className="relative flex min-w-0 flex-1 flex-col gap-3">
          <PatchShelf />

          <div className="wood-frame min-w-0">
            <div className="overflow-x-auto overscroll-x-contain bg-panel text-panel-fg">
              <div className="flex w-max gap-1.5 p-3">
              <div className="flex w-36 shrink-0 flex-col gap-3">
                {silk("Controllers")}
                <div className="flex justify-center gap-1">
                  <LearnKnob
                    label="Tune"
                    value={s.tune}
                    display={formatTune(s.tune)}
                    paramKey="tune"
                    onChange={(tune) => patch({ tune })}
                    defaultValue={DEFAULT_PARAMS.tune}
                  />
                  <LearnKnob
                    label="Glide"
                    value={s.glide}
                    display={s.glide < 0.02 ? "Off" : formatMs(glideSec(s.glide))}
                    paramKey="glide"
                    onChange={(glide) => patch({ glide })}
                    defaultValue={DEFAULT_PARAMS.glide}
                  />
                </div>
                <div className="flex justify-center gap-1">
                  <LearnKnob
                    label="Pitch mod"
                    value={s.pitchMod}
                    display={formatPct(s.pitchMod)}
                    paramKey="pitchMod"
                    onChange={(pitchMod) => patch({ pitchMod })}
                    defaultValue={DEFAULT_PARAMS.pitchMod}
                  />
                  <LearnKnob
                    label="Filt mod"
                    value={s.filterMod}
                    display={formatPct(s.filterMod)}
                    paramKey="filterMod"
                    onChange={(filterMod) => patch({ filterMod })}
                    defaultValue={DEFAULT_PARAMS.filterMod}
                  />
                </div>
                <div className="flex justify-center gap-1">
                  <LearnKnob
                    label="Vib rate"
                    value={s.vibratoRate}
                    display={formatVibratoRate(s.vibratoRate)}
                    paramKey="vibratoRate"
                    onChange={(vibratoRate) => patch({ vibratoRate })}
                    defaultValue={DEFAULT_PARAMS.vibratoRate}
                  />
                  <LearnKnob
                    label="Vib depth"
                    value={s.vibratoDepth}
                    display={formatPct(s.vibratoDepth)}
                    paramKey="vibratoDepth"
                    onChange={(vibratoDepth) => patch({ vibratoDepth })}
                    defaultValue={DEFAULT_PARAMS.vibratoDepth}
                  />
                </div>
                <Rocker
                  label="Osc 3 control"
                  pressed={s.osc3Follow}
                  onPressedChange={(osc3Follow) => patch({ osc3Follow })}
                />
                <Rocker
                  label="A-440"
                  pressed={s.a440}
                  onPressedChange={(a440) => patch({ a440 })}
                />
                <div className="border-t border-walnut/25 pt-3">
                  <Rocker label="Arp" pressed={s.arp} onPressedChange={s.toggleArp} />
                </div>
                <ArpPatternSelect value={s.arpPattern} onChange={s.setArpPattern} />
                <div className="flex justify-center gap-1">
                  <Knob
                    label="Rate"
                    value={bpmToRate(s.arpRate)}
                    display={`${s.arpRate} BPM`}
                    onChange={(t) => s.setArpRate(rateToBpm(t))}
                    defaultValue={bpmToRate(ARP_RATE_DEFAULT)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md bg-walnut/10 px-2 py-1.5">
                  <span className="text-micro font-medium uppercase tracking-[0.1em] text-panel-muted">
                    Oct
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Fewer arp octaves"
                      onClick={() => s.setArpOctaves(Math.max(ARP_OCTAVES_MIN, s.arpOctaves - 1))}
                      className="flex size-7 items-center justify-center rounded-sm text-panel-muted transition-colors hover:text-panel-fg active:scale-[0.96]"
                    >
                      <Minus className="size-3" strokeWidth={2} />
                    </button>
                    <span className="min-w-4 text-center text-sm font-medium tabular-nums text-panel-fg">
                      {s.arpOctaves}
                    </span>
                    <button
                      type="button"
                      aria-label="More arp octaves"
                      onClick={() => s.setArpOctaves(Math.min(ARP_OCTAVES_MAX, s.arpOctaves + 1))}
                      className="flex size-7 items-center justify-center rounded-sm text-panel-muted transition-colors hover:text-panel-fg active:scale-[0.96]"
                    >
                      <Plus className="size-3" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="silk-rule hidden self-stretch sm:block" />

              <div className="flex min-w-72 flex-1 flex-col gap-3 sm:min-w-0">
                {silk("Oscillator bank")}
                <div className="grid grid-cols-3 gap-2">
                  <OscColumn
                    title="Osc 1"
                    wave={s.osc1Wave}
                    footage={s.osc1Footage}
                    onWave={(osc1Wave) => patch({ osc1Wave })}
                    onFootage={(osc1Footage) => patch({ osc1Footage })}
                  />
                  <OscColumn
                    title="Osc 2"
                    wave={s.osc2Wave}
                    footage={s.osc2Footage}
                    onWave={(osc2Wave) => patch({ osc2Wave })}
                    onFootage={(osc2Footage) => patch({ osc2Footage })}
                    tune={s.osc2Tune}
                    onTune={(osc2Tune) => patch({ osc2Tune })}
                  />
                  <OscColumn
                    title="Osc 3"
                    wave={s.osc3Wave}
                    footage={s.osc3Footage}
                    onWave={(osc3Wave) => patch({ osc3Wave })}
                    onFootage={(osc3Footage) => patch({ osc3Footage })}
                    tune={s.osc3Tune}
                    onTune={(osc3Tune) => patch({ osc3Tune })}
                    allowLo
                  />
                </div>
              </div>

              <div className="silk-rule hidden self-stretch sm:block" />

              <div className="flex shrink-0 flex-col gap-3">
                {silk("Mixer")}
                <div className="flex justify-center gap-1">
                  <LearnKnob
                    label="Osc 1"
                    value={s.mix1}
                    display={formatPct(s.mix1)}
                    paramKey="mix1"
                    onChange={(mix1) => patch({ mix1 })}
                    defaultValue={DEFAULT_PARAMS.mix1}
                  />
                  <LearnKnob
                    label="Osc 2"
                    value={s.mix2}
                    display={formatPct(s.mix2)}
                    paramKey="mix2"
                    onChange={(mix2) => patch({ mix2 })}
                    defaultValue={DEFAULT_PARAMS.mix2}
                  />
                </div>
                <div className="flex justify-center gap-1">
                  <LearnKnob
                    label="Osc 3"
                    value={s.mix3}
                    display={formatPct(s.mix3)}
                    paramKey="mix3"
                    onChange={(mix3) => patch({ mix3 })}
                    defaultValue={DEFAULT_PARAMS.mix3}
                  />
                  <LearnKnob
                    label="Noise"
                    value={s.mixNoise}
                    display={formatPct(s.mixNoise)}
                    paramKey="mixNoise"
                    onChange={(mixNoise) => patch({ mixNoise })}
                    defaultValue={DEFAULT_PARAMS.mixNoise}
                  />
                </div>
              </div>

              <div className="silk-rule hidden self-stretch sm:block" />

              <div className="flex shrink-0 flex-col gap-3">
                {silk("Swarm")}
                <div className="flex justify-center gap-1">
                  <LearnKnob
                    label="Swarm"
                    value={s.swarm}
                    display={formatPct(s.swarm)}
                    paramKey="swarm"
                    onChange={(swarm) => patch({ swarm })}
                    defaultValue={DEFAULT_PARAMS.swarm}
                  />
                  <LearnKnob
                    label="Lock"
                    value={s.swarmLock}
                    display={formatPct(s.swarmLock)}
                    paramKey="swarmLock"
                    onChange={(swarmLock) => patch({ swarmLock })}
                    defaultValue={DEFAULT_PARAMS.swarmLock}
                  />
                </div>
                <p className="text-center text-micro uppercase tracking-[0.08em] text-panel-muted">
                  Osc drift → lock
                </p>
              </div>

              <div className="silk-rule hidden self-stretch sm:block" />

              <div className="flex shrink-0 flex-col gap-3">
                {silk("Modifiers")}
                <div className="flex justify-center gap-1">
                  <LearnKnob
                    label="Cutoff"
                    value={s.cutoff}
                    display={formatHz(cutoffHz(s.cutoff))}
                    paramKey="cutoff"
                    onChange={(cutoff) => patch({ cutoff })}
                    defaultValue={DEFAULT_PARAMS.cutoff}
                    tone="filter"
                  />
                  <LearnKnob
                    label="Emphasis"
                    value={s.emphasis}
                    display={formatPct(s.emphasis)}
                    paramKey="emphasis"
                    onChange={(emphasis) => patch({ emphasis })}
                    defaultValue={DEFAULT_PARAMS.emphasis}
                    tone="filter"
                  />
                  <LearnKnob
                    label="Contour"
                    value={s.contour}
                    display={formatPct(s.contour)}
                    paramKey="contour"
                    onChange={(contour) => patch({ contour })}
                    defaultValue={DEFAULT_PARAMS.contour}
                    tone="filter"
                  />
                </div>
                <p className="text-center text-micro uppercase tracking-[0.16em] text-panel-muted">
                  Filter contour
                </p>
                <div className="flex justify-center gap-1">
                  <LearnKnob
                    label="Attack"
                    value={s.filterAttack}
                    display={formatMs(attackSec(s.filterAttack))}
                    paramKey="filterAttack"
                    onChange={(filterAttack) => patch({ filterAttack })}
                    defaultValue={DEFAULT_PARAMS.filterAttack}
                    tone="filter"
                  />
                  <LearnKnob
                    label="Decay"
                    value={s.filterDecay}
                    display={formatMs(decaySec(s.filterDecay))}
                    paramKey="filterDecay"
                    onChange={(filterDecay) => patch({ filterDecay })}
                    defaultValue={DEFAULT_PARAMS.filterDecay}
                    tone="filter"
                  />
                  <LearnKnob
                    label="Sustain"
                    value={s.filterSustain}
                    display={formatPct(s.filterSustain)}
                    paramKey="filterSustain"
                    onChange={(filterSustain) => patch({ filterSustain })}
                    defaultValue={DEFAULT_PARAMS.filterSustain}
                    tone="filter"
                  />
                </div>
                <LearnKnob
                  label="Kbd track"
                  value={s.filterTrack}
                  display={formatPct(s.filterTrack)}
                  paramKey="filterTrack"
                    onChange={(filterTrack) => patch({ filterTrack })}
                  defaultValue={DEFAULT_PARAMS.filterTrack}
                  tone="filter"
                />
              </div>

              <div className="silk-rule hidden self-stretch sm:block" />

              <div className="flex shrink-0 flex-col gap-3">
                {silk("Loudness")}
                <p className="text-center text-micro uppercase tracking-[0.16em] text-panel-muted">
                  Decay is release
                </p>
                <div className="flex justify-center gap-1">
                  <LearnKnob
                    label="Attack"
                    value={s.ampAttack}
                    display={formatMs(attackSec(s.ampAttack))}
                    paramKey="ampAttack"
                    onChange={(ampAttack) => patch({ ampAttack })}
                    defaultValue={DEFAULT_PARAMS.ampAttack}
                  />
                  <LearnKnob
                    label="Decay"
                    value={s.ampDecay}
                    display={formatMs(decaySec(s.ampDecay))}
                    paramKey="ampDecay"
                    onChange={(ampDecay) => patch({ ampDecay })}
                    defaultValue={DEFAULT_PARAMS.ampDecay}
                  />
                  <LearnKnob
                    label="Sustain"
                    value={s.ampSustain}
                    display={formatPct(s.ampSustain)}
                    paramKey="ampSustain"
                    onChange={(ampSustain) => patch({ ampSustain })}
                    defaultValue={DEFAULT_PARAMS.ampSustain}
                  />
                </div>
                <div className="flex items-end justify-center gap-3">
                  <LearnKnob
                    label="Volume"
                    value={s.volume}
                    display={formatPct(s.volume)}
                    paramKey="volume"
                    onChange={(volume) => patch({ volume })}
                    defaultValue={DEFAULT_PARAMS.volume}
                  />
                  <LearnKnob
                    label="Velocity"
                    value={s.velocity}
                    display={s.velocity <= 0 ? "Off" : formatPct(s.velocity)}
                    paramKey="velocity"
                    onChange={(velocity) => patch({ velocity })}
                    defaultValue={DEFAULT_PARAMS.velocity}
                  />
                  <div className="flex w-14 flex-col items-center gap-1 pb-1">
                    <span className="font-sans text-micro font-medium uppercase tracking-[0.12em] text-panel-muted">
                      Note
                    </span>
                    <span className="font-display text-lg font-medium tabular-nums text-panel-fg">
                      {current}
                    </span>
                  </div>
                </div>
              </div>
            </div>

              <div className="silk-rule hidden self-stretch sm:block" />

              <div className="flex shrink-0 flex-col gap-3">
                {silk("Effects")}
                <div className="flex gap-3">
                  <FxColumn
                    title="Drive"
                    enabled={s.fxDriveOn}
                    onEnabledChange={(fxDriveOn) => patch({ fxDriveOn })}
                  >
                    <LearnKnob
                      label="Drive"
                      value={s.fxDriveAmount}
                      display={formatPct(s.fxDriveAmount)}
                      paramKey="fxDriveAmount"
                      onChange={(fxDriveAmount) => patch({ fxDriveAmount })}
                      defaultValue={DEFAULT_PARAMS.fxDriveAmount}
                    />
                    <LearnKnob
                      label="Tone"
                      value={s.fxDriveTone}
                      display={formatDriveTone(s.fxDriveTone)}
                      paramKey="fxDriveTone"
                      onChange={(fxDriveTone) => patch({ fxDriveTone })}
                      defaultValue={DEFAULT_PARAMS.fxDriveTone}
                    />
                    <LearnKnob
                      label="Level"
                      value={s.fxDriveLevel}
                      display={formatDriveLevel(s.fxDriveLevel)}
                      paramKey="fxDriveLevel"
                      onChange={(fxDriveLevel) => patch({ fxDriveLevel })}
                      defaultValue={DEFAULT_PARAMS.fxDriveLevel}
                    />
                  </FxColumn>
                  <FxColumn
                    title="Chorus"
                    enabled={s.fxChorusOn}
                    onEnabledChange={(fxChorusOn) => patch({ fxChorusOn })}
                  >
                    <LearnKnob
                      label="Rate"
                      value={s.fxChorusRate}
                      display={formatChorusRate(s.fxChorusRate)}
                      paramKey="fxChorusRate"
                      onChange={(fxChorusRate) => patch({ fxChorusRate })}
                      defaultValue={DEFAULT_PARAMS.fxChorusRate}
                    />
                    <LearnKnob
                      label="Depth"
                      value={s.fxChorusDepth}
                      display={formatChorusDepth(s.fxChorusDepth)}
                      paramKey="fxChorusDepth"
                      onChange={(fxChorusDepth) => patch({ fxChorusDepth })}
                      defaultValue={DEFAULT_PARAMS.fxChorusDepth}
                    />
                    <LearnKnob
                      label="Mix"
                      value={s.fxChorusMix}
                      display={formatPct(s.fxChorusMix)}
                      paramKey="fxChorusMix"
                      onChange={(fxChorusMix) => patch({ fxChorusMix })}
                      defaultValue={DEFAULT_PARAMS.fxChorusMix}
                    />
                  </FxColumn>
                  <FxColumn
                    title="Delay"
                    enabled={s.fxDelayOn}
                    onEnabledChange={(fxDelayOn) => patch({ fxDelayOn })}
                  >
                    <LearnKnob
                      label="Time"
                      value={s.fxDelayTime}
                      display={formatDelayTime(s.fxDelayTime)}
                      paramKey="fxDelayTime"
                      onChange={(fxDelayTime) => patch({ fxDelayTime })}
                      defaultValue={DEFAULT_PARAMS.fxDelayTime}
                    />
                    <LearnKnob
                      label="Fdbk"
                      value={s.fxDelayFeedback}
                      display={formatPct(s.fxDelayFeedback)}
                      paramKey="fxDelayFeedback"
                      onChange={(fxDelayFeedback) => patch({ fxDelayFeedback })}
                      defaultValue={DEFAULT_PARAMS.fxDelayFeedback}
                    />
                    <LearnKnob
                      label="Mix"
                      value={s.fxDelayMix}
                      display={formatPct(s.fxDelayMix)}
                      paramKey="fxDelayMix"
                      onChange={(fxDelayMix) => patch({ fxDelayMix })}
                      defaultValue={DEFAULT_PARAMS.fxDelayMix}
                    />
                  </FxColumn>
                </div>
              </div>
          </div>
          </div>

          <div className="flex min-w-0 items-stretch gap-3">
            <div className="min-w-0 flex-1">
              <Scope armed={armed} />
            </div>
            <LevelMeter armed={armed} />
          </div>

          <div className="flex min-w-0 items-stretch gap-2 overflow-hidden rounded-lg bg-walnut p-1.5">
            <Wheels />
            <div className="min-w-0 flex-1">
              <Keyboard />
            </div>
          </div>

          <p className="px-1 text-pretty text-xs leading-relaxed text-muted">
            Three free-running oscillators feed a 24 dB ladder. Add pitch motion with
            the LFO controls. Computer keys Z–M and Q–I (hold Shift for accent); [ and ]
            shift octave; Esc silences. MIDI keyboards play with real velocity — press
            the MIDI button to map knobs to your controller. Flip the Arp rocker to
            arpeggiate held notes in the chosen pattern, rate and octave range.
          </p>

          <ArmGate />
        </section>
      </div>
    </main>
  );
}

function FxColumn({
  title,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex w-44 flex-col items-center gap-2">
      <p className="font-sans text-micro font-medium uppercase tracking-[0.16em] text-panel-fg">
        {title}
      </p>
      <Rocker label={title} pressed={enabled} onPressedChange={onEnabledChange} />
      <div className="flex justify-center gap-1">{children}</div>
    </div>
  );
}

function OscColumn({
  title,
  wave,
  footage,
  onWave,
  onFootage,
  tune,
  onTune,
  allowLo = false,
}: {
  title: string;
  wave: OscWave;
  footage: Footage;
  onWave: (wave: OscWave) => void;
  onFootage: (footage: Footage) => void;
  tune?: number;
  onTune?: (tune: number) => void;
  allowLo?: boolean;
}) {
  return (
    <div className="flex w-28 flex-col items-center gap-2">
      <p className="font-sans text-micro font-medium uppercase tracking-[0.16em] text-panel-fg">
        {title}
      </p>
      <FootageSelect value={footage} onChange={onFootage} allowLo={allowLo} label={`${title} range`} />
      <WaveformSelect value={wave} onChange={onWave} label={`${title} waveform`} />
      {onTune != null && tune != null ? (
        <LearnKnob
          paramKey={title === "Osc 2" ? "osc2Tune" : "osc3Tune"}
          label="Freq"
          value={tune}
          display={formatTune(tune)}
          onChange={onTune}
          defaultValue={title === "Osc 2" ? DEFAULT_PARAMS.osc2Tune : DEFAULT_PARAMS.osc3Tune}
        />
      ) : (
        <div className="h-[6.75rem]" />
      )}
    </div>
  );
}
