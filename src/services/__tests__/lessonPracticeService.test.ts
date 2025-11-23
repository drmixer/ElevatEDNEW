import { describe, expect, it } from 'vitest';

import { calculateMasteryPct } from '../lessonPracticeService';

describe('calculateMasteryPct', () => {
  it('returns a rounded percentage for valid inputs', () => {
    expect(calculateMasteryPct(3, 4)).toBe(75);
    expect(calculateMasteryPct(1, 3)).toBe(33);
  });

  it('clamps to zero when there is no total', () => {
    expect(calculateMasteryPct(2, 0)).toBe(0);
    expect(calculateMasteryPct(0, -1)).toBe(0);
  });

  it('caps at 100 when correct exceeds total', () => {
    expect(calculateMasteryPct(6, 4)).toBe(100);
  });
});
