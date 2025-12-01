import { describe, expect, it } from 'vitest';

import { mergeTutorLimits } from '../ai';

describe('mergeTutorLimits', () => {
  it('prefers stricter learner limit over plan limit', () => {
    expect(mergeTutorLimits(3, 1)).toBe(1);
  });

  it('returns plan limit when learner limit is missing', () => {
    expect(mergeTutorLimits(3, null)).toBe(3);
    expect(mergeTutorLimits('unlimited', undefined)).toBe('unlimited');
  });

  it('handles unlimited plan by using learner limit', () => {
    expect(mergeTutorLimits('unlimited', 2)).toBe(2);
  });

  it('normalizes negative learner limits to zero', () => {
    expect(mergeTutorLimits(5, -2)).toBe(0);
  });

  it('returns learner limit when plan limit is absent', () => {
    expect(mergeTutorLimits(null, 4)).toBe(4);
  });
});
