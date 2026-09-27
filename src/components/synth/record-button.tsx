import { useEffect, useRef, useState } from "react";
import { getEngine } from "@/lib/synth/engine";
import { useSynthStore } from "@/lib/synth/store";
import { wavFilename } from "@/lib/synth/wav";
import { cn } from "@/lib/utils";

function formatElapsed(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Record/Stop control for bouncing a take to WAV. Sits in the header next
 * to the MIDI button and follows its pill visual language. Recording taps
 * the master output (what you hear); stopping downloads
 * `volta-<patch>-<timestamp>.wav`.
 */
export function RecordButton() {
  const activePatch = useSynthStore((s) => s.activePatch);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const patchRef = useRef(activePatch);
  patchRef.current = activePatch;
  const noticeTimer = useRef<number | null>(null);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
  };

  useEffect(
    () => () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const finalize = (auto: boolean) => {
    const engine = getEngine();
    const result = engine.stopRecording();
    setRecording(false);
    setElapsed(0);
    if (!result) {
      if (!auto) flashNotice("Nothing recorded");
      return;
    }
    const blob = new Blob([result.wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = wavFilename(result.patchName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    if (result.capped) flashNotice("Stopped at the 5:00 limit — take saved");
  };

  // Poll while recording: update the elapsed readout and catch the
  // engine auto-stopping at the length cap.
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      const engine = getEngine();
      if (!engine.recording) {
        finalize(true);
      } else {
        setElapsed(engine.recordedSeconds());
      }
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  const start = async () => {
    const engine = getEngine();
    const ok = await engine.startRecording(patchRef.current);
    if (!ok) {
      flashNotice("Recording unavailable");
      return;
    }
    setElapsed(0);
    setRecording(true);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          if (recording) finalize(false);
          else void start();
        }}
        aria-pressed={recording}
        aria-label={
          recording
            ? `Stop recording and save take (${formatElapsed(elapsed)})`
            : "Record a take as WAV"
        }
        title={
          recording
            ? "Stop and save the take as a WAV file"
            : "Record what you play — saves a WAV (max 5:00)"
        }
        className={cn(
          "inline-flex items-center gap-2 rounded-full bg-walnut px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] transition-colors",
          recording ? "text-[#e0604f]" : "text-muted hover:text-fg",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            recording ? "animate-pulse bg-[#e0604f]" : "bg-subtle",
          )}
        />
        {recording ? formatElapsed(elapsed) : "Record"}
      </button>
      {notice && (
        <span role="status" className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          {notice}
        </span>
      )}
    </span>
  );
}
