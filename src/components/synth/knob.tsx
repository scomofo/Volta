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
};

export function Knob({
  label,
  value,
  display,
  onChange,
  defaultValue = 0.5,
  disabled = false,
}: KnobProps) {
  const id = useId();
  const drag = useRef<{ y: number; value: number } | null>(null);
  const t = Math.min(1, Math.max(0, value));
  const angle = MIN_ANGLE + t * (MAX_ANGLE - MIN_ANGLE);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { y: event.clientY, value: t };
    },
    [disabled, t],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!drag.current) return;
      const range = 140;
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
    <div className="flex w-16 flex-col items-center gap-1.5 sm:w-[4.5rem]">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={`${label} ${display}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(t * 100)}
        aria-valuetext={display}
        role="slider"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => onChange(defaultValue)}
        onKeyDown={onKeyDown}
        className={cn(
          "knob relative size-14 touch-none rounded-full sm:size-16",
          "bg-surface-2 text-fg",
          "transition-[box-shadow,transform] duration-(--motion-quick) ease-(--ease-out)",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
          "active:scale-[0.98]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[18%] rounded-full bg-surface"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 origin-center"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <span className="absolute left-1/2 top-[7%] h-[26%] w-[2px] -translate-x-1/2 rounded-full bg-accent" />
        </span>
      </button>
      <label
        htmlFor={id}
        className="font-sans text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted"
      >
        {label}
      </label>
      <span className="font-sans text-xs tabular-nums text-fg">{display}</span>
    </div>
  );
}
