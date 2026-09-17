import { useEffect, useRef } from "react";
import { getEngine } from "@/lib/synth/engine";
import { cn } from "@/lib/utils";

const SEGMENTS = 16;

export function LevelMeter({ armed }: { armed: boolean }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const peakRef = useRef<HTMLDivElement>(null);
  const peakHold = useRef(0);

  useEffect(() => {
    let frame = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const rms = armed ? getEngine().rms() : 0;
      const level = Math.min(1, rms * 3.2);
      peakHold.current = Math.max(level, peakHold.current * 0.96);
      if (peakHold.current < 0.02) peakHold.current = 0;
      if (fillRef.current) {
        fillRef.current.style.height = `${level * 100}%`;
      }
      if (peakRef.current) {
        peakRef.current.style.bottom = `${peakHold.current * 100}%`;
        peakRef.current.style.opacity = peakHold.current > 0.02 ? "1" : "0";
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [armed]);

  return (
    <div className="flex h-full min-h-[7.5rem] flex-col items-center gap-2">
      <span className="font-sans text-micro font-medium uppercase tracking-[0.16em] text-muted">
        Lvl
      </span>
      <div
        className="relative flex h-full w-6 flex-col-reverse overflow-hidden rounded-sm bg-surface-2"
        aria-label="Output level"
      >
        <div className="absolute inset-0 flex flex-col-reverse">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 border-t border-bg/80",
                i > 13 ? "bg-fg/10" : "bg-transparent",
              )}
            />
          ))}
        </div>
        <div
          ref={fillRef}
          className="absolute bottom-0 left-0 right-0 bg-accent/80"
          style={{ height: "0%" }}
        />
        <div
          ref={peakRef}
          className="absolute left-0 right-0 h-0.5 bg-fg opacity-0"
          style={{ bottom: "0%" }}
        />
      </div>
    </div>
  );
}
