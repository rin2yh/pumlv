export const MIN_SCALE = 0.1;
export const MAX_SCALE = 50;

export function clampScale(value: number): number {
  if (value < MIN_SCALE) return MIN_SCALE;
  if (value > MAX_SCALE) return MAX_SCALE;
  return value;
}
