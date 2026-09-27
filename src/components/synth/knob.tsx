import { useCallback, useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

const MIN_ANGLE = -135;
const MAX_ANGLE = 135;

type KnobProps = {
  label: string;
  value: number;
  display: string;
  onChange: (value: number) => void;
  defaultValue?: number;
  disabled?: boolean;
  tone?: "default" | "filter";
  /** Stable param key for MIDI learn. When absent the knob is not learnable. */
  paramKey?: string;
  /** When true, clicking selects this knob as the MIDI-learn target instead of dragging. */
  learnMode?: boolean;
  /** This knob is the current learn target, waiting for a CC. */
  learnTarget?: boolean;
  /** CC number currently bound to this knob, if any. */
  boundCc?: number | null;
  onLearnSelect?: (paramKey: string) => void;
  onUnlearn?: (paramKey: string) => void;
};

export function Knob({
  label,
  value,
  display,
  onChange,
  defaultValue = 0.5,
  disabled = false,
  tone = "default",
  paramKey,
  learnMode = false,
  learnTarget = false,
  boundCc = null,
  onLearnSelect,
  onUnlearn,
}: KnobProps) {
  const id = useId();
  const drag = useRef<{ y: number; value: number } | null>(null);
  const t = Math.min(1, Math.max(0, value));
  const angle = MIN_ANGLE + t * (MAX_ANGLE - MIN_ANGLE);
  const learnable = paramKey != null;

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled || learnMode) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { y: event.clientY, value: t };
    },
    [disabled, learnMode, t],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!drag.current) return;
      const range = 130;
      const fine = event.shiftKey ? 0.35 : 1;
      const next = drag.current.value + ((drag.current.y - event.clientY) / range) * fine;
      onChange(Math.min(1, Math.max(0, next)));
    },
    [onChange],
  );

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const step = event.shiftKey ? 0.01 : 0.04;
      if (event.key === "ArrowUp" || event.key === "ArrowRight") {
        event.preventDefault();
        onChange(Math.min(1, t + step));
      } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        event.preventDefault();
        onChange(Math.max(0, t - step));
      } else if (event.key === "Home") {
        event.preventDefault();
        onChange(0);
      } else if (event.key === "End") {
        event.preventDefault();
        onChange(1);
      }
    },
    [onChange, t],
  );

  return (
    <div className="flex w-14 flex-col items-center gap-1">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={`${label} ${display}${boundCc != null ? `, MIDI CC ${boundCc}` : ""}${learnTarget ? ", waiting for MIDI CC" : ""}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(t * 100)}
        aria-valuetext={display}
        role="slider"
        title={
          boundCc != null
            ? `MIDI CC ${boundCc} — right-click to unlearn`
            : learnMode && learnable
              ? "Click to MIDI-learn this knob"
              : undefined
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => onChange(defaultValue)}
        onClick={() => {
          if (learnMode && learnable) onLearnSelect?.(paramKey);
        }}
        onContextMenu={(event) => {
          if (boundCc != null && learnable) {
            event.preventDefault();
            onUnlearn?.(paramKey);
          }
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "knob relative size-12 touch-none rounded-full",
          tone === "filter" ? "knob-filter" : "bg-walnut text-cream",
          "transition-[box-shadow,transform] duration-(--motion-quick) ease-(--ease-out)",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
          "active:scale-[0.98]",
          learnMode && learnable && "cursor-crosshair",
          learnTarget && "animate-pulse ring-2 ring-accent ring-offset-2 ring-offset-panel",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-[20%] rounded-full",
            tone === "filter" ? "bg-accent/30" : "bg-panel/15",
          )}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 origin-center"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <span
            className={cn(
              "absolute left-1/2 top-[8%] h-[24%] w-0.5 -translate-x-1/2 rounded-full",
              tone === "filter" ? "bg-cream" : "bg-accent",
            )}
          />
        </span>
      </button>
      <label
        htmlFor={id}
        className="text-center font-sans text-micro font-medium uppercase tracking-[0.04em] text-panel-muted"
      >
        {label}
      </label>
      <span className="font-sans text-xs tabular-nums text-panel-fg">{display}</span>
      <span
        aria-hidden
        className="h-3 font-sans text-[0.6rem] font-medium uppercase tracking-[0.08em] text-accent/90"
      >
        {learnTarget ? "listening…" : boundCc != null ? `CC ${boundCc}` : ""}
      </span>
    </div>
  );
}
