const CENTS_PER_MINUTE = 5;

export function estimateCostCents(durationSec: number): number {
  return Math.ceil((durationSec * CENTS_PER_MINUTE) / 60);
}
