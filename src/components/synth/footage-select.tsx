import { cn } from "@/lib/utils";
import { FOOTAGES, type Footage } from "@/lib/synth/notes";

type FootageSelectProps = {
  value: Footage;
  onChange: (footage: Footage) => void;
  allowLo?: boolean;
  label?: string;
};

export function FootageSelect({
  value,
  onChange,
  allowLo = false,
  label = "Range",
}: FootageSelectProps) {
  const options = allowLo ? FOOTAGES : FOOTAGES.filter((f) => f.id !== "LO");
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap justify-center gap-0.5">
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.id)}
            className={cn(
              "min-h-8 min-w-8 rounded-sm px-1.5 font-sans text-micro font-medium tracking-wide",
              "text-panel-muted transition-[color,background-color] duration-(--motion-quick) ease-(--ease-out)",
              "hover:text-panel-fg",
              selected && "bg-walnut text-cream",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
