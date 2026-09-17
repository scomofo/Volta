import { useCallback, useEffect, useMemo, useRef, type PointerEvent } from "react";
import { buildKeyboard, midiToName } from "@/lib/synth/notes";
import { useSynthStore } from "@/lib/synth/store";
import { cn } from "@/lib/utils";

export function Keyboard() {
  const octave = useSynthStore((s) => s.octave);
  const held = useSynthStore((s) => s.held);
  const noteOn = useSynthStore((s) => s.noteOn);
  const noteOff = useSynthStore((s) => s.noteOff);
  const arm = useSynthStore((s) => s.arm);

  const keys = useMemo(() => buildKeyboard(octave), [octave]);
  const whites = keys.filter((k) => k.white);
  const blacks = keys.filter((k) => !k.white);
  const bedRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, number>());

  const midiFromPoint = useCallback((clientX: number, clientY: number): number | null => {
    const bed = bedRef.current;
    if (!bed) return null;
    const hits = document.elementsFromPoint(clientX, clientY);
    for (const el of hits) {
      if (!(el instanceof HTMLElement)) continue;
      if (!bed.contains(el)) continue;
      const midi = el.dataset.midi;
      if (midi) return Number(midi);
    }
    return null;
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.preventDefault();
      arm();
      event.currentTarget.setPointerCapture(event.pointerId);
      const midi = midiFromPoint(event.clientX, event.clientY);
      if (midi == null) return;
      pointers.current.set(event.pointerId, midi);
      noteOn(midi);
    },
    [arm, midiFromPoint, noteOn],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(event.pointerId)) return;
      const midi = midiFromPoint(event.clientX, event.clientY);
      const prev = pointers.current.get(event.pointerId);
      if (midi === prev) return;
      if (prev != null && prev >= 0) noteOff(prev);
      if (midi != null) {
        pointers.current.set(event.pointerId, midi);
        noteOn(midi);
      } else {
        pointers.current.set(event.pointerId, -1);
      }
    },
    [midiFromPoint, noteOff, noteOn],
  );

  const endPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const prev = pointers.current.get(event.pointerId);
      pointers.current.delete(event.pointerId);
      if (prev != null && prev >= 0) noteOff(prev);
    },
    [noteOff],
  );

  useEffect(() => {
    const onLost = () => {
      for (const midi of pointers.current.values()) {
        if (midi >= 0) noteOff(midi);
      }
      pointers.current.clear();
    };
    window.addEventListener("blur", onLost);
    return () => window.removeEventListener("blur", onLost);
  }, [noteOff]);

  return (
    <div
      ref={bedRef}
      className="keybed relative isolate flex h-36 touch-none select-none sm:h-44"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onContextMenu={(e) => e.preventDefault()}
      role="group"
      aria-label="Piano keyboard"
    >
      {whites.map((key) => {
        const on = held.includes(key.midi);
        return (
          <button
            key={key.midi}
            type="button"
            data-midi={key.midi}
            tabIndex={-1}
            aria-label={midiToName(key.midi)}
            aria-pressed={on}
            className={cn("key-white relative z-0 min-w-0 flex-1", on && "is-on")}
          >
            <span className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center gap-0.5">
              <span className="hidden text-[0.65rem] font-medium text-subtle sm:block">
                {key.label}
              </span>
              <span className="text-[0.6rem] font-medium tabular-nums text-subtle/80">
                {midiToName(key.midi)}
              </span>
            </span>
          </button>
        );
      })}
      {blacks.map((key) => {
        const whitesBefore = whites.filter((w) => w.offset < key.offset).length;
        const left = (whitesBefore / whites.length) * 100;
        const width = (1 / whites.length) * 100 * 0.62;
        const on = held.includes(key.midi);
        return (
          <button
            key={key.midi}
            type="button"
            data-midi={key.midi}
            tabIndex={-1}
            aria-label={midiToName(key.midi)}
            aria-pressed={on}
            style={{ left: `calc(${left}% - ${width / 2}%)`, width: `${width}%` }}
            className={cn("key-black absolute top-0 z-10 h-[58%]", on && "is-on")}
          >
            <span className="pointer-events-none absolute inset-x-0 bottom-2 hidden text-center text-[0.6rem] font-medium text-current sm:block">
              {key.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
