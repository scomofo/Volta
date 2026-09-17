import { useEffect, useRef } from "react";
import { getEngine } from "@/lib/synth/engine";

function readToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function Scope({ armed }: { armed: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    let frame = 0;
    let alive = true;

    const draw = () => {
      if (!alive) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

      const bg = readToken("--color-bg", "#0a0b0c");
      const grid = readToken("--color-border", "#2a2c31");
      const accent = readToken("--color-accent", "#7dcea0");
      const muted = readToken("--color-subtle", "#5c616a");

      ctx2d.fillStyle = bg;
      ctx2d.fillRect(0, 0, width, height);

      ctx2d.strokeStyle = grid;
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      for (let i = 1; i < 4; i++) {
        const y = (height / 4) * i;
        ctx2d.moveTo(0, y);
        ctx2d.lineTo(width, y);
      }
      ctx2d.moveTo(width / 2, 0);
      ctx2d.lineTo(width / 2, height);
      ctx2d.stroke();

      ctx2d.beginPath();
      const engine = getEngine();
      const data = armed ? engine.getByteTimeDomain() : null;
      if (!data) {
        ctx2d.strokeStyle = muted;
        ctx2d.moveTo(0, height / 2);
        ctx2d.lineTo(width, height / 2);
      } else {
        ctx2d.strokeStyle = accent;
        ctx2d.lineWidth = 1.6;
        ctx2d.shadowColor = accent;
        ctx2d.shadowBlur = 8;
        const n = data.length;
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * width;
          const y = (data[i]! / 255) * height;
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
      }
      ctx2d.stroke();
      ctx2d.shadowBlur = 0;

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [armed]);

  return (
    <div className="scope-well relative min-h-[7.5rem] overflow-hidden rounded-md bg-bg">
      <canvas
        ref={canvasRef}
        className="block h-32 w-full sm:h-36"
        aria-label="Oscilloscope"
      />
      <span className="pointer-events-none absolute left-3 top-2 font-sans text-[0.65rem] font-medium uppercase tracking-[0.16em] text-subtle">
        Scope
      </span>
    </div>
  );
}
