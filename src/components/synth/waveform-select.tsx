import { cn } from "@/lib/utils";
import { OSC_WAVES, type OscWave } from "@/lib/synth/notes";

type WaveformSelectProps = {
  value: OscWave;
  onChange: (wave: OscWave) => void;
  label?: string;
};

function WaveIcon({ id }: { id: OscWave }) {
  const d =
    id === "triangle"
      ? "M2 16 L8 8 L14 16 L20 8"
      : id === "sawtooth"
        ? "M3 16 L3 8 L17 16 L17 8"
        : id === "square"
          ? "M4 16 V8 H11 V16 H18 V8"
          : "M4 16 V8 H7 V16 H20";
  return (
    <svg viewBox="0 0 22 24" className="size-4" aria-hidden>
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

export function WaveformSelect({ value, onChange, label = "Waveform" }: WaveformSelectProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md bg-walnut/10 p-0.5">
      {OSC_WAVES.map((wave) => {
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
              "flex min-h-9 min-w-9 flex-1 items-center justify-center rounded-sm px-1.5",
              "text-panel-muted transition-[color,background-color,transform] duration-(--motion-quick) ease-(--ease-out)",
              "hover:text-panel-fg active:scale-[0.96]",
              selected && "bg-walnut text-cream",
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
