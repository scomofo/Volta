export function vibratoRateHz(value: number): number {
  const normalized = Math.min(1, Math.max(0, value));
  return 0.2 * (12 / 0.2) ** normalized;
}

export function vibratoGainHz(frequencyHz: number, depth: number): number {
  const safeFrequency = Number.isFinite(frequencyHz) ? Math.max(0, frequencyHz) : 0;
  const normalized = Math.min(1, Math.max(0, depth));
  const cents = normalized * 40;
  return safeFrequency * (2 ** (cents / 1200) - 1);
}

export function formatVibratoRate(value: number): string {
  const rate = vibratoRateHz(value);
  return rate < 1 ? rate.toFixed(1) + "Hz" : Math.round(rate) + "Hz";
}