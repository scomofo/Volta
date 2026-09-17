import { cn } from "@/lib/utils";
import { WAVEFORMS, type Waveform } from "@/lib/synth/notes";

type WaveformSelectProps = {
  value: Waveform;
  onChange: (wave: Waveform) => void;
};

function WaveIcon({ id }: { id: Waveform }) {
  const d =
    id === "sine"
      ? "M2 12c3-8 5 8 8 0s5 8 8 0"
      : id === "triangle"
        ? "M2 16 L8 8 L14 16 L20 8"
        : id === "sawtooth"
          ? "M3 16 L3 8 L17 16 L17 8"
          : "M4 16 V8 H11 V16 H18 V8";
  return (
    <svg viewBox="0 0 22 24" className="size-5" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WaveformSelect({ value, onChange }: WaveformSelectProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Waveform"
      className="flex rounded-lg bg-surface-2 p-1"
    >
      {WAVEFORMS.map((wave) => {
        const selected = wave.id === value;
        return (
          <button
            key={wave.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={wave.label}
            onClick={() => onChange(wave.id)}
            className={cn(
              "flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-md px-2.5",
              "text-muted transition-[color,background-color,transform] duration-(--motion-quick) ease-(--ease-out)",
              "hover:text-fg active:scale-[0.96]",
              selected && "bg-surface text-accent",
            )}
          >
            <WaveIcon id={wave.id} />
            <span className="sr-only">{wave.label}</span>
          </button>
        );
      })}
    </div>
  );
}
