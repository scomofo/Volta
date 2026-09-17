import { Minus, Plus } from "lucide-react";
import { attackSec, cutoffHz, decaySec, releaseSec } from "@/lib/synth/engine";
import { formatHz, formatMs, formatPct, midiToName } from "@/lib/synth/notes";
import { useSynthStore } from "@/lib/synth/store";
import { cn } from "@/lib/utils";
import { ArmGate } from "./arm-gate";
import { ComputerKeys } from "./computer-keys";
import { Keyboard } from "./keyboard";
import { Knob } from "./knob";
import { LevelMeter } from "./level-meter";
import { Scope } from "./scope";
import { WaveformSelect } from "./waveform-select";

export function VoltaApp() {
  const armed = useSynthStore((s) => s.armed);
  const waveform = useSynthStore((s) => s.waveform);
  const octave = useSynthStore((s) => s.octave);
  const held = useSynthStore((s) => s.held);
  const cutoff = useSynthStore((s) => s.cutoff);
  const resonance = useSynthStore((s) => s.resonance);
  const attack = useSynthStore((s) => s.attack);
  const decay = useSynthStore((s) => s.decay);
  const sustain = useSynthStore((s) => s.sustain);
  const release = useSynthStore((s) => s.release);
  const volume = useSynthStore((s) => s.volume);
  const setWaveform = useSynthStore((s) => s.setWaveform);
  const setCutoff = useSynthStore((s) => s.setCutoff);
  const setResonance = useSynthStore((s) => s.setResonance);
  const setAttack = useSynthStore((s) => s.setAttack);
  const setDecay = useSynthStore((s) => s.setDecay);
  const setSustain = useSynthStore((s) => s.setSustain);
  const setRelease = useSynthStore((s) => s.setRelease);
  const setVolume = useSynthStore((s) => s.setVolume);
  const shiftOctave = useSynthStore((s) => s.shiftOctave);

  const lowest = midiToName(48 + octave * 12);
  const current = held.length ? midiToName(held[held.length - 1]!) : "—";

  return (
    <main
      className="flex min-h-dvh flex-col bg-bg text-fg"
      data-armed={armed ? "true" : "false"}
      data-waveform={waveform}
      data-octave={octave}
    >
      <ComputerKeys />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-6 sm:py-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-sans text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted">
              Subtractive instrument
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              VOLTA
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.14em] text-muted">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5",
                armed ? "text-accent" : "text-muted",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  armed ? "bg-accent" : "bg-subtle",
                )}
              />
              {armed ? "Live" : "Standby"}
            </span>
            <span className="hidden tabular-nums sm:inline">8 voice</span>
          </div>
        </header>

        <section className="relative flex flex-1 flex-col gap-4 rounded-xl bg-surface p-3 shadow-panel sm:gap-5 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1">
              <Scope armed={armed} />
            </div>
            <div className="flex items-stretch gap-3 sm:gap-4">
              <LevelMeter armed={armed} />
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <span className="font-sans text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted">
                    Wave
                  </span>
                  <WaveformSelect value={waveform} onChange={setWaveform} />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="font-sans text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted">
                    Octave
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Octave down"
                      onClick={() => shiftOctave(-1)}
                      className="flex size-11 items-center justify-center rounded-md bg-surface-2 text-fg transition-transform duration-(--motion-quick) ease-(--ease-out) hover:text-accent active:scale-[0.96]"
                    >
                      <Minus className="size-4" strokeWidth={2} />
                    </button>
                    <div className="flex min-w-16 flex-1 flex-col items-center">
                      <span className="font-display text-xl font-medium tabular-nums text-fg">
                        {octave > 0 ? `+${octave}` : octave}
                      </span>
                      <span className="text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                        {lowest}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label="Octave up"
                      onClick={() => shiftOctave(1)}
                      className="flex size-11 items-center justify-center rounded-md bg-surface-2 text-fg transition-transform duration-(--motion-quick) ease-(--ease-out) hover:text-accent active:scale-[0.96]"
                    >
                      <Plus className="size-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 justify-items-center gap-y-4 sm:grid-cols-8">
            <Knob
              label="Cutoff"
              value={cutoff}
              display={formatHz(cutoffHz(cutoff))}
              onChange={setCutoff}
              defaultValue={0.72}
            />
            <Knob
              label="Res"
              value={resonance}
              display={formatPct(resonance)}
              onChange={setResonance}
              defaultValue={0.18}
            />
            <Knob
              label="Attack"
              value={attack}
              display={formatMs(attackSec(attack))}
              onChange={setAttack}
              defaultValue={0.1}
            />
            <Knob
              label="Decay"
              value={decay}
              display={formatMs(decaySec(decay))}
              onChange={setDecay}
              defaultValue={0.28}
            />
            <Knob
              label="Sustain"
              value={sustain}
              display={formatPct(sustain)}
              onChange={setSustain}
              defaultValue={0.68}
            />
            <Knob
              label="Release"
              value={release}
              display={formatMs(releaseSec(release))}
              onChange={setRelease}
              defaultValue={0.32}
            />
            <Knob
              label="Volume"
              value={volume}
              display={formatPct(volume)}
              onChange={setVolume}
              defaultValue={0.72}
            />
            <div className="flex w-16 flex-col items-center justify-center gap-1 sm:w-[4.5rem]">
              <span className="font-sans text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted">
                Note
              </span>
              <span className="font-display text-lg font-medium tabular-nums text-fg">
                {current}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-bg p-1.5">
            <Keyboard />
          </div>

          <p className="px-1 text-pretty text-xs leading-relaxed text-muted">
            Computer keys Z–M and Q–I play two octaves. [ and ] shift octave. Esc silences.
            Drag knobs vertically — double-tap to reset.
          </p>

          <ArmGate />
        </section>
      </div>
    </main>
  );
}
