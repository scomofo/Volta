import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { FACTORY_PRESETS } from "@/lib/synth/presets";
import { copySynthParams, emptyUserPatches, readUserPatches, USER_PATCH_COUNT, writeUserPatch } from "@/lib/synth/patch-storage";
import { useSynthStore } from "@/lib/synth/store";
import { cn } from "@/lib/utils";

export function PatchShelf() {
  const activePatch = useSynthStore((s) => s.activePatch);
  const applyPreset = useSynthStore((s) => s.applyPreset);
  const [userPatches, setUserPatches] = useState(emptyUserPatches);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setUserPatches(readUserPatches());
  }, []);

  const savePatch = (index: number) => {
    const params = copySynthParams(useSynthStore.getState());
    if (!writeUserPatch(index, params)) {
      setNotice("This browser could not save that patch.");
      return;
    }
    setUserPatches(readUserPatches());
    applyPreset(params, "USER " + (index + 1));
    setNotice("Saved as USER " + (index + 1) + " on this device.");
  };

  return (
    <section
      aria-label="Sound presets"
      className="flex flex-col gap-3 rounded-md border border-border bg-walnut p-3 sm:p-4 lg:flex-row lg:items-center"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-sans text-micro font-medium uppercase tracking-[0.2em] text-muted">
              Patch bank
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Choose a sound, then save your edits in a user slot. Stored on this device.
            </p>
          </div>
          <p className="shrink-0 font-display text-sm font-medium text-fg sm:text-base">
            {activePatch}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Factory patches">
          {FACTORY_PRESETS.map((preset) => {
            const selected = activePatch === preset.name;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.description}
                aria-label={"Load " + preset.name + " patch"}
                aria-pressed={selected}
                onClick={() => applyPreset(preset.params, preset.name)}
                className={cn(
                  "min-h-11 rounded-sm border px-3 py-2 text-left text-xs font-medium transition-colors duration-(--motion-quick) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
                  selected ? "border-accent bg-accent text-cream" : "border-border-strong bg-surface-2 text-fg hover:border-accent/70",
                )}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full shrink-0 lg:w-72">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-sans text-micro font-medium uppercase tracking-[0.2em] text-muted">
            Your patches
          </h3>
          <span className="text-xs text-muted">{USER_PATCH_COUNT} slots</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
          {userPatches.map((patch, index) => {
            const slot = index + 1;
            const selected = activePatch === "USER " + slot;
            return (
              <div
                key={slot}
                role="group"
                aria-label={"User patch slot " + slot}
                className="flex min-w-0 items-center gap-1 rounded-sm border border-border-strong bg-surface p-1"
              >
                <button
                  type="button"
                  disabled={!patch}
                  aria-label={"Load user patch " + slot}
                  aria-pressed={selected}
                  onClick={() => patch && applyPreset(patch, "USER " + slot)}
                  className={cn("min-h-11 min-w-0 flex-1 rounded-sm px-2 text-xs font-medium transition-colors duration-(--motion-quick) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-not-allowed disabled:text-subtle", selected ? "bg-accent text-cream" : "text-fg hover:bg-surface-2")}
                >
                  {patch ? "USER " + slot : "EMPTY"}
                </button>
                <button
                  type="button"
                  title={"Save current sound to user slot " + slot}
                  aria-label={"Save current sound to user slot " + slot}
                  onClick={() => savePatch(index)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-sm text-muted transition-colors duration-(--motion-quick) hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                >
                  <Save aria-hidden="true" className="size-4" strokeWidth={1.8} />
                </button>
              </div>
            );
          })}
        </div>
        <p aria-live="polite" role="status" className="mt-1 min-h-4 text-xs text-muted">
          {notice}
        </p>
      </div>
    </section>
  );
}