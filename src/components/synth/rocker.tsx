import { cn } from "@/lib/utils";

type RockerProps = {
  label: string;
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
};

export function Rocker({ label, pressed, onPressedChange }: RockerProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={label}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2",
        "text-micro font-medium uppercase tracking-[0.1em]",
        "transition-[background-color,color,transform] duration-(--motion-quick) ease-(--ease-out)",
        "active:scale-[0.98]",
        pressed ? "bg-walnut text-cream" : "bg-walnut/10 text-panel-muted",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{pressed ? "On" : "Off"}</span>
    </button>
  );
}
