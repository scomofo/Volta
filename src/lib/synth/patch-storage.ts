import type { SynthParams } from "./engine";

export const USER_PATCH_COUNT = 4;
const USER_PATCH_STORAGE_KEY = "volta.user-patches.v1";
const USER_PATCH_FILE_FORMAT = "volta-user-patches";
const MAX_USER_PATCH_FILE_LENGTH = 65_536;

const PARAMETER_KEYS: readonly (keyof SynthParams)[] = [
  "osc1Wave", "osc1Footage", "osc2Wave", "osc2Footage", "osc2Tune",
  "osc3Wave", "osc3Footage", "osc3Tune", "osc3Follow",
  "mix1", "mix2", "mix3", "mixNoise", "swarm", "swarmLock",
  "cutoff", "emphasis", "contour", "filterAttack", "filterDecay",
  "filterSustain", "filterTrack", "ampAttack", "ampDecay", "ampSustain",
  "glide", "vibratoRate", "vibratoDepth", "pitchMod", "filterMod", "velocity", "volume",
  "tune", "a440",
];

const NUMERIC_KEYS: readonly (keyof SynthParams)[] = [
  "osc2Tune", "osc3Tune", "mix1", "mix2", "mix3", "mixNoise", "swarm",
  "swarmLock", "cutoff", "emphasis", "contour", "filterAttack", "filterDecay",
  "filterSustain", "filterTrack", "ampAttack", "ampDecay", "ampSustain",
  "glide", "vibratoRate", "vibratoDepth", "pitchMod", "filterMod", "velocity", "volume", "tune",
];

/** Numeric params a MIDI CC can be learned to. */
export const LEARNABLE_KEYS: readonly (keyof SynthParams)[] = NUMERIC_KEYS;

export type PatchStorage = Pick<Storage, "getItem" | "setItem">;

export function emptyUserPatches(): Array<SynthParams | null> {
  return Array.from({ length: USER_PATCH_COUNT }, () => null);
}

export function copySynthParams(params: SynthParams): SynthParams {
  const entries = PARAMETER_KEYS.map((key) => {
    // Patches saved before velocity existed load as 0 = legacy behavior.
    const value = key === "velocity" && params[key] === undefined ? 0 : params[key];
    return [key, value] as const;
  });
  return Object.fromEntries(entries) as unknown as SynthParams;
}

export function isSynthParams(value: unknown): value is SynthParams {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const waves = ["triangle", "sawtooth", "square", "pulse"];
  const footages = ["32", "16", "8", "4", "2", "LO"];
  for (const key of NUMERIC_KEYS) {
    const parameter = candidate[key];
    // velocity is optional: patches saved before it existed stay valid.
    if (key === "velocity" && parameter === undefined) continue;
    if (typeof parameter !== "number" || !Number.isFinite(parameter) || parameter < 0 || parameter > 1) {
      return false;
    }
  }
  return (
    waves.includes(candidate.osc1Wave as string) &&
    waves.includes(candidate.osc2Wave as string) &&
    waves.includes(candidate.osc3Wave as string) &&
    footages.includes(candidate.osc1Footage as string) &&
    footages.includes(candidate.osc2Footage as string) &&
    footages.includes(candidate.osc3Footage as string) &&
    typeof candidate.osc3Follow === "boolean" &&
    typeof candidate.a440 === "boolean"
  );
}

function browserStorage(): PatchStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readUserPatches(
  storage: PatchStorage | null = browserStorage(),
): Array<SynthParams | null> {
  if (!storage) return emptyUserPatches();
  try {
    const raw = storage.getItem(USER_PATCH_STORAGE_KEY);
    if (!raw) return emptyUserPatches();
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return emptyUserPatches();
    const record = data as Record<string, unknown>;
    const slots = record.slots;
    if (record.version !== 1 || !Array.isArray(slots)) return emptyUserPatches();
    return Array.from({ length: USER_PATCH_COUNT }, (_, index) => {
      const patch = slots[index];
      return isSynthParams(patch) ? copySynthParams(patch) : null;
    });
  } catch {
    return emptyUserPatches();
  }
}


function isUserPatchBank(value: readonly unknown[]): value is readonly (SynthParams | null)[] {
  return (
    Array.isArray(value) &&
    value.length === USER_PATCH_COUNT &&
    value.every((patch) => patch === null || isSynthParams(patch))
  );
}

export function serializeUserPatchFile(patches: readonly unknown[]): string | null {
  if (!isUserPatchBank(patches)) return null;

  return JSON.stringify(
    {
      format: USER_PATCH_FILE_FORMAT,
      version: 1,
      slots: patches.map((patch) => (patch === null ? null : copySynthParams(patch))),
    },
    null,
    2,
  );
}

export function parseUserPatchFile(content: string): Array<SynthParams | null> | null {
  if (content.length > MAX_USER_PATCH_FILE_LENGTH) return null;

  try {
    const data: unknown = JSON.parse(content);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
    const record = data as Record<string, unknown>;
    const slots = record.slots;
    if (
      record.format !== USER_PATCH_FILE_FORMAT ||
      record.version !== 1 ||
      !Array.isArray(slots) ||
      !isUserPatchBank(slots)
    ) {
      return null;
    }

    return slots.map((patch) => (patch === null ? null : copySynthParams(patch)));
  } catch {
    return null;
  }
}

export function writeUserPatches(
  patches: readonly unknown[],
  storage: PatchStorage | null = browserStorage(),
): boolean {
  if (!storage || !isUserPatchBank(patches)) return false;

  try {
    const slots = patches.map((patch) => (patch === null ? null : copySynthParams(patch)));
    storage.setItem(USER_PATCH_STORAGE_KEY, JSON.stringify({ version: 1, slots }));
    return true;
  } catch {
    return false;
  }
}

export function writeUserPatch(
  index: number,
  params: SynthParams,
  storage: PatchStorage | null = browserStorage(),
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= USER_PATCH_COUNT || !isSynthParams(params)) {
    return false;
  }
  const slots = readUserPatches(storage);
  slots[index] = copySynthParams(params);
  return writeUserPatches(slots, storage);
}