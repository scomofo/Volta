import { Minus, Plus } from "lucide-react";
import { attackSec, cutoffHz, decaySec, DEFAULT_PARAMS, glideSec } from "@/lib/synth/engine";
import {
  formatHz,
  formatMs,
  formatPct,
  formatTune,
  midiToName,
  type Footage,
  type OscWave,
} from "@/lib/synth/notes";
import { useSynthStore } from "@/lib/synth/store";
import { cn } from "@/lib/utils";
import { ArmGate } from "./arm-gate";
import { ComputerKeys } from "./computer-keys";
import { FootageSelect } from "./footage-select";
import { Keyboard } from "./keyboard";
import { Knob } from "./knob";
import { LevelMeter } from "./level-meter";
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

export function VoltaApp() {
  const armed = useSynthStore((s) => s.armed);
  const octave = useSynthStore((s) => s.octave);
  const held = useSynthStore((s) => s.held);
  const patch = useSynthStore((s) => s.patch);
  const shiftOctave = useSynthStore((s) => s.shiftOctave);
  const s = useSynthStore();

  const lowest = midiToName(48 + octave * 12);
  const current = held.length ? midiToName(held[held.length - 1]!) : "—";

  return (
    <main
      className="flex min-h-dvh flex-col overflow-x-hidden bg-bg text-fg"
      data-armed={armed ? "true" : "false"}
      data-waveform={s.osc1Wave}
      data-octave={octave}
    >
      <ComputerKeys />
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

        <section className="relative flex min-w-0 flex-1 flex-col gap-3">
          <div className="wood-frame min-w-0">
            <div className="overflow-x-auto overscroll-x-contain bg-panel text-panel-fg">
              <div className="flex w-max gap-3 p-3 sm:p-4">
              <div className="flex shrink-0 flex-col gap-3 sm:min-w-40">
                {silk("Controllers")}
                <div className="flex justify-center gap-1">
                  <Knob
                    label="Tune"
                    value={s.tune}
                    display={formatTune(s.tune)}
                    onChange={(tune) => patch({ tune })}
                    defaultValue={DEFAULT_PARAMS.tune}
                  />
                  <Knob
                    label="Glide"
                    value={s.glide}
                    display={s.glide < 0.02 ? "Off" : formatMs(glideSec(s.glide))}
                    onChange={(glide) => patch({ glide })}
                    defaultValue={DEFAULT_PARAMS.glide}
                  />
                </div>
                <div className="flex justify-center gap-1">
                  <Knob
                    label="Pitch mod"
                    value={s.pitchMod}
                    display={formatPct(s.pitchMod)}
                    onChange={(pitchMod) => patch({ pitchMod })}
                    defaultValue={DEFAULT_PARAMS.pitchMod}
                  />
                  <Knob
                    label="Filt mod"
                    value={s.filterMod}
                    display={formatPct(s.filterMod)}
                    onChange={(filterMod) => patch({ filterMod })}
                    defaultValue={DEFAULT_PARAMS.filterMod}
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
              </div>

              <div className="silk-rule hidden self-stretch sm:block" />

              <div className="flex min-w-72 flex-1 flex-col gap-3 sm:min-w-0">
                {silk("Oscillator bank")}
                <div className="grid grid-cols-3 gap-3">
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
                  <Knob
                    label="Osc 1"
                    value={s.mix1}
                    display={formatPct(s.mix1)}
                    onChange={(mix1) => patch({ mix1 })}
                    defaultValue={DEFAULT_PARAMS.mix1}
                  />
                  <Knob
                    label="Osc 2"
                    value={s.mix2}
                    display={formatPct(s.mix2)}
                    onChange={(mix2) => patch({ mix2 })}
                    defaultValue={DEFAULT_PARAMS.mix2}
                  />
                </div>
                <div className="flex justify-center gap-1">
                  <Knob
                    label="Osc 3"
                    value={s.mix3}
                    display={formatPct(s.mix3)}
                    onChange={(mix3) => patch({ mix3 })}
                    defaultValue={DEFAULT_PARAMS.mix3}
                  />
                  <Knob
                    label="Noise"
                    value={s.mixNoise}
                    display={formatPct(s.mixNoise)}
                    onChange={(mixNoise) => patch({ mixNoise })}
                    defaultValue={DEFAULT_PARAMS.mixNoise}
                  />
                </div>
              </div>

              <div className="silk-rule hidden self-stretch sm:block" />

              <div className="flex shrink-0 flex-col gap-3">
                {silk("Modifiers")}
                <div className="flex justify-center gap-1">
                  <Knob
                    label="Cutoff"
                    value={s.cutoff}
                    display={formatHz(cutoffHz(s.cutoff))}
                    onChange={(cutoff) => patch({ cutoff })}
                    defaultValue={DEFAULT_PARAMS.cutoff}
                    tone="filter"
                  />
                  <Knob
                    label="Emphasis"
                    value={s.emphasis}
                    display={formatPct(s.emphasis)}
                    onChange={(emphasis) => patch({ emphasis })}
                    defaultValue={DEFAULT_PARAMS.emphasis}
                    tone="filter"
                  />
                  <Knob
                    label="Contour"
                    value={s.contour}
                    display={formatPct(s.contour)}
                    onChange={(contour) => patch({ contour })}
                    defaultValue={DEFAULT_PARAMS.contour}
                    tone="filter"
                  />
                </div>
                <p className="text-center text-micro uppercase tracking-[0.16em] text-panel-muted">
                  Filter contour
                </p>
                <div className="flex justify-center gap-1">
                  <Knob
                    label="Attack"
                    value={s.filterAttack}
                    display={formatMs(attackSec(s.filterAttack))}
                    onChange={(filterAttack) => patch({ filterAttack })}
                    defaultValue={DEFAULT_PARAMS.filterAttack}
                    tone="filter"
                  />
                  <Knob
                    label="Decay"
                    value={s.filterDecay}
                    display={formatMs(decaySec(s.filterDecay))}
                    onChange={(filterDecay) => patch({ filterDecay })}
                    defaultValue={DEFAULT_PARAMS.filterDecay}
                    tone="filter"
                  />
                  <Knob
                    label="Sustain"
                    value={s.filterSustain}
                    display={formatPct(s.filterSustain)}
                    onChange={(filterSustain) => patch({ filterSustain })}
                    defaultValue={DEFAULT_PARAMS.filterSustain}
                    tone="filter"
                  />
                </div>
                <Knob
                  label="Kbd track"
                  value={s.filterTrack}
                  display={formatPct(s.filterTrack)}
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
                  <Knob
                    label="Attack"
                    value={s.ampAttack}
                    display={formatMs(attackSec(s.ampAttack))}
                    onChange={(ampAttack) => patch({ ampAttack })}
                    defaultValue={DEFAULT_PARAMS.ampAttack}
                  />
                  <Knob
                    label="Decay"
                    value={s.ampDecay}
                    display={formatMs(decaySec(s.ampDecay))}
                    onChange={(ampDecay) => patch({ ampDecay })}
                    defaultValue={DEFAULT_PARAMS.ampDecay}
                  />
                  <Knob
                    label="Sustain"
                    value={s.ampSustain}
                    display={formatPct(s.ampSustain)}
                    onChange={(ampSustain) => patch({ ampSustain })}
                    defaultValue={DEFAULT_PARAMS.ampSustain}
                  />
                </div>
                <div className="flex items-end justify-center gap-3">
                  <Knob
                    label="Volume"
                    value={s.volume}
                    display={formatPct(s.volume)}
                    onChange={(volume) => patch({ volume })}
                    defaultValue={DEFAULT_PARAMS.volume}
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
          </div>
          </div>

          <div className="flex min-w-0 items-stretch gap-3">
            <div className="min-w-0 flex-1">
              <Scope armed={armed} />
            </div>
            <LevelMeter armed={armed} />
          </div>

          <div className="min-w-0 overflow-hidden rounded-lg bg-walnut p-1.5">
            <Keyboard />
          </div>

          <p className="px-1 text-pretty text-xs leading-relaxed text-muted">
            Three free-running oscillators into a 24 dB ladder. Last-note mono, decay is
            release. Computer keys Z–M and Q–I. [ and ] shift octave. Esc silences.
          </p>

          <ArmGate />
        </section>
      </div>
    </main>
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
    <div className="flex flex-col items-center gap-2">
      <p className="font-sans text-micro font-medium uppercase tracking-[0.16em] text-panel-fg">
        {title}
      </p>
      <FootageSelect value={footage} onChange={onFootage} allowLo={allowLo} label={`${title} range`} />
      <WaveformSelect value={wave} onChange={onWave} label={`${title} waveform`} />
      {onTune != null && tune != null ? (
        <Knob
          label="Freq"
          value={tune}
          display={formatTune(tune)}
          onChange={onTune}
          defaultValue={title === "Osc 2" ? DEFAULT_PARAMS.osc2Tune : DEFAULT_PARAMS.osc3Tune}
        />
      ) : (
        <div className="h-[5.75rem]" />
      )}
    </div>
  );
}
