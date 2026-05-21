export const roundCurrency = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const clampPercentage = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};
