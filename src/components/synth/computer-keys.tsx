import { useEffect } from "react";
import { getEngine } from "@/lib/synth/engine";
import { CODE_TO_OFFSET, displayedMidi } from "@/lib/synth/notes";
import { useSynthStore } from "@/lib/synth/store";

const downMidi = new Map<string, number>();

export function ComputerKeys() {
  const octave = useSynthStore((s) => s.octave);
  const noteOn = useSynthStore((s) => s.noteOn);
  const noteOff = useSynthStore((s) => s.noteOff);
  const shiftOctave = useSynthStore((s) => s.shiftOctave);
  const panic = useSynthStore((s) => s.panic);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.code === "BracketLeft" || event.code === "Minus") {
        event.preventDefault();
        if (!event.repeat) shiftOctave(-1);
        return;
      }
      if (event.code === "BracketRight" || event.code === "Equal") {
        event.preventDefault();
        if (!event.repeat) shiftOctave(1);
        return;
      }
      if (event.code === "Escape") {
        event.preventDefault();
        panic();
        downMidi.clear();
        return;
      }

      const offset = CODE_TO_OFFSET[event.code];
      if (offset == null) return;
      event.preventDefault();
      if (event.repeat || downMidi.has(event.code)) return;
      const midi = displayedMidi(octave, offset);
      downMidi.set(event.code, midi);
      noteOn(midi);
    };

    const onUp = (event: KeyboardEvent) => {
      const midi = downMidi.get(event.code);
      if (midi == null) return;
      event.preventDefault();
      downMidi.delete(event.code);
      noteOff(midi);
    };

    const flush = () => {
      downMidi.clear();
      panic();
    };

    const onVis = () => {
      if (document.hidden) {
        flush();
        return;
      }
      getEngine().resume();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [noteOff, noteOn, octave, panic, shiftOctave]);

  return null;
}
