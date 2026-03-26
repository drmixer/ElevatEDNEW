import { describe, expect, it } from 'vitest';

import {
  normalizePlacementLevel,
  normalizePlacementSubjectKey,
  parsePlacementSubjectList,
  placementSubjectLabel,
  placementWindowForLevel,
  standardsFromValue,
} from '../placementMetadata.js';

describe('placementMetadata utils', () => {
  it('normalizes numeric and range grade inputs to placement levels', () => {
    expect(normalizePlacementLevel('6')).toBe(6);
    expect(normalizePlacementLevel('6-8')).toBe(7);
    expect(normalizePlacementLevel('K-2')).toBe(3);
    expect(normalizePlacementLevel(10)).toBe(8);
  });

  it('returns a bounded placement window around a level', () => {
    expect(placementWindowForLevel(3)).toEqual({ min_level: 3, max_level: 4 });
    expect(placementWindowForLevel(7)).toEqual({ min_level: 6, max_level: 8 });
  });

  it('normalizes placement subject keys and lists', () => {
    expect(normalizePlacementSubjectKey('Mathematics')).toBe('math');
    expect(normalizePlacementSubjectKey('english-language-arts')).toBe('ela');
    expect(parsePlacementSubjectList('math, english, science, math')).toEqual(['math', 'ela', 'science']);
    expect(parsePlacementSubjectList(null)).toEqual(['math', 'ela']);
  });

  it('returns user-facing placement subject labels', () => {
    expect(placementSubjectLabel('math')).toBe('Mathematics');
    expect(placementSubjectLabel('ela')).toBe('English Language Arts');
  });

  it('normalizes standards into a unique list', () => {
    expect(standardsFromValue('6.RP.A.3')).toEqual(['6.RP.A.3']);
    expect(standardsFromValue(['6.RP.A.3', '6.RP.A.3', ' 7.EE.A.1 '])).toEqual(['6.RP.A.3', '7.EE.A.1']);
    expect(standardsFromValue(null)).toEqual([]);
  });
});
