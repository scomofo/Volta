import { useEffect } from "react";
import { midiOut } from "@/lib/synth/midi-out";
import { useSynthStore } from "@/lib/synth/store";

/**
 * Attaches Web MIDI output once: enumerates output ports so played notes can
 * be mirrored to an external device (the Cantabile live-choir link). Renders
 * nothing.
 */
export function MidiOutput() {
  useEffect(() => {
    const nav = navigator as Navigator & {
      requestMIDIAccess?: () => Promise<MIDIAccess>;
    };
    if (!nav.requestMIDIAccess) {
      useSynthStore.getState().setMidiOutStatus(false, []);
      return;
    }

    let access: MIDIAccess | null = null;
    let cancelled = false;

    const sync = () => {
      if (!access || cancelled) return;
      const infos = midiOut.attach({ outputs: [...access.outputs.values()] });
      useSynthStore
        .getState()
        .setMidiOutStatus(true, infos.map((info) => info.name));
    };

    midiOut.onChange = () => {
      if (cancelled) return;
      const s = useSynthStore.getState();
      s.setMidiOutStatus(s.midiOutSupported, s.midiOutPorts);
    };

    nav
      .requestMIDIAccess()
      .then((a) => {
        if (cancelled) return;
        access = a;
        sync();
        access.onstatechange = sync;
      })
      .catch(() => {
        if (!cancelled) useSynthStore.getState().setMidiOutStatus(false, []);
      });

    return () => {
      cancelled = true;
      midiOut.onChange = null;
      midiOut.detach();
      if (access) access.onstatechange = null;
    };
  }, []);

  return null;
}
