import { useEffect } from "react";
import { parseMidiMessage } from "@/lib/synth/midi";
import { useSynthStore } from "@/lib/synth/store";

/**
 * Attaches Web MIDI input once: routes note on/off (with real velocity) into
 * the synth engine directly — never echoed back to MIDI out, so the
 * Cantabile → Volta direction can't loop — and CC messages into MIDI learn /
 * learned bindings. Renders nothing.
 */
export function MidiInput() {
  useEffect(() => {
    const nav = navigator as Navigator & {
      requestMIDIAccess?: () => Promise<MIDIAccess>;
    };
    if (!nav.requestMIDIAccess) {
      useSynthStore.getState().setMidiStatus(false, []);
      return;
    }

    let access: MIDIAccess | null = null;
    let cancelled = false;

    const handleData = (data: Uint8Array<ArrayBufferLike> | null) => {
      if (!data) return;
      const msg = parseMidiMessage(data);
      const s = useSynthStore.getState();
      if (msg.kind === "noteOn") {
        s.noteOnExternal(msg.note, msg.velocity);
      } else if (msg.kind === "noteOff") {
        s.noteOffExternal(msg.note);
      } else if (msg.kind === "cc") {
        s.applyCc(msg.cc, msg.value);
      }
    };

    const attach = () => {
      if (!access || cancelled) return;
      const names: string[] = [];
      access.inputs.forEach((port) => {
        names.push(port.name ?? "MIDI device");
        port.onmidimessage = (event) => handleData(event.data);
      });
      useSynthStore.getState().setMidiStatus(true, names);
    };

    nav
      .requestMIDIAccess()
      .then((a) => {
        if (cancelled) return;
        access = a;
        attach();
        access.onstatechange = attach;
      })
      .catch(() => {
        if (!cancelled) useSynthStore.getState().setMidiStatus(false, []);
      });

    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") useSynthStore.getState().cancelMidiLearn();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      if (access) {
        access.onstatechange = null;
        access.inputs.forEach((port) => {
          port.onmidimessage = null;
        });
      }
    };
  }, []);

  return null;
}
