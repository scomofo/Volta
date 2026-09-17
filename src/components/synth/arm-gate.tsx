import { useSynthStore } from "@/lib/synth/store";

export function ArmGate() {
  const armed = useSynthStore((s) => s.armed);
  const arm = useSynthStore((s) => s.arm);

  if (armed) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Arm audio engine"
      className="absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-6"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        arm();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          arm();
        }
      }}
    >
      <div className="flex max-w-sm flex-col items-center gap-5 rounded-xl bg-panel px-8 py-8 text-center text-panel-fg shadow-panel">
        <span className="flex size-12 items-center justify-center rounded-full bg-walnut text-accent">
          <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
            <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 8v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <span className="flex flex-col gap-2">
          <span className="font-display text-2xl font-medium tracking-tight text-panel-fg">
            Arm oscillators
          </span>
          <span className="text-pretty text-sm leading-relaxed text-panel-muted">
            Three VCOs and a ladder filter stay silent until a gesture. Tap to start.
          </span>
        </span>
        <span className="rounded-md bg-walnut px-4 py-2.5 text-sm font-medium text-cream">
          Tap to play
        </span>
      </div>
    </div>
  );
}
