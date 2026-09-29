import { useCallback, useRef, type PointerEvent } from "react";
import { useSynthStore } from "@/lib/synth/store";
import { PITCH_BEND_CENTER, PITCH_BEND_MAX } from "@/lib/synth/performance";
import { cn } from "@/lib/utils";

/**
 * Pitch + mod performance wheels, Minimoog-style, sitting left of the keys.
 * The pitch wheel bends Volta's own oscillators ±2 semitones and transmits
 * MIDI pitch bend on the choir link; it springs back to center on release.
 * The mod wheel transmits CC1 (choir vowel morph) and stays where put.
 */

const DRAG_PX = 140; // pointer travel for full scale

function Wheel({
  label,
  sub,
  fraction,
  valueText,
  getValue,
  range,
  onChange,
  onRelease,
}: {
  label: string;
  sub: string;
  /** 0..1 grip position, 0 = bottom. */
  fraction: number;
  valueText: string;
  getValue: () => number;
  range: number;
  onChange: (value: number) => void;
  onRelease?: () => void;
}) {
  const drag = useRef<{ startY: number; startValue: number } | null>(null);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { startY: event.clientY, startValue: getValue() };
    },
    [getValue],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      const dy = d.startY - event.clientY; // drag up = increase
      onChange(d.startValue + (dy / DRAG_PX) * range);
    },
    [onChange, range],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!drag.current) return;
      drag.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      onRelease?.();
    },
    [onRelease],
  );

  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div className="flex w-12 flex-col items-center gap-1">
      <span className="font-sans text-micro font-medium uppercase tracking-[0.12em] text-panel-muted">
        {label}
      </span>
      <div
        role="slider"
        aria-label={label}
        aria-valuetext={valueText}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "relative h-32 w-9 cursor-ns-resize touch-none rounded-full bg-bg",
          "shadow-[inset_0_2px_6px_rgba(0,0,0,0.55)]",
          "focus-visible:outline-2 focus-visible:outline-accent",
        )}
      >
        <div
          className="absolute left-1 right-1 h-6 rounded-full bg-panel shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
          style={{ top: `calc(${(1 - clamped) * 100}% - 12px)` }}
        >
          <div className="mx-1.5 mt-1 space-y-1">
            <div className="h-px bg-subtle" />
            <div className="h-px bg-subtle" />
            <div className="h-px bg-subtle" />
          </div>
        </div>
      </div>
      <span className="font-sans text-micro uppercase tracking-[0.12em] text-panel-muted">
        {sub}
      </span>
    </div>
  );
}

export function Wheels() {
  const pitchBend = useSynthStore((s) => s.pitchBend);
  const choirVowel = useSynthStore((s) => s.choirVowel);
  const setPitchBend = useSynthStore((s) => s.setPitchBend);
  const setChoirVowel = useSynthStore((s) => s.setChoirVowel);

  const getPitch = useCallback(
    () => useSynthStore.getState().pitchBend,
    [],
  );
  const getVowel = useCallback(
    () => useSynthStore.getState().choirVowel,
    [],
  );
  const springPitch = useCallback(
    () => setPitchBend(PITCH_BEND_CENTER),
    [setPitchBend],
  );

  const semis =
    ((pitchBend - PITCH_BEND_CENTER) / PITCH_BEND_CENTER) * 2;

  return (
    <div className="flex items-stretch gap-2 self-center">
      <Wheel
        label="Pitch"
        sub="±2 st"
        fraction={pitchBend / PITCH_BEND_MAX}
        valueText={`${semis >= 0 ? "+" : ""}${semis.toFixed(2)} semitones`}
        getValue={getPitch}
        range={PITCH_BEND_MAX}
        onChange={setPitchBend}
        onRelease={springPitch}
      />
      <Wheel
        label="Mod"
        sub="vowel"
        fraction={choirVowel / 127}
        valueText={`vowel morph ${Math.round((choirVowel / 127) * 100)} percent`}
        getValue={getVowel}
        range={127}
        onChange={setChoirVowel}
      />
    </div>
  );
}
