import { describe, expect, it } from 'vitest';

import {
  buildFoundationalDiagnosticDifficultyMap,
  normalizePlacementLevel,
  normalizePlacementSubjectKey,
  parsePlacementSubjectList,
  placementSubjectLabel,
  placementWindowForLevel,
  standardsFromValue,
} from '../placementMetadata.js';

describe('placementMetadata utils', () => {
  it('normalizes numeric and range grade inputs to placement levels', () => {
    expect(normalizePlacementLevel('K')).toBe(0);
    expect(normalizePlacementLevel('1')).toBe(1);
    expect(normalizePlacementLevel('2')).toBe(2);
    expect(normalizePlacementLevel('6')).toBe(6);
    expect(normalizePlacementLevel('6-8')).toBe(7);
    expect(normalizePlacementLevel('K-2')).toBe(1);
    expect(normalizePlacementLevel(10)).toBe(8);
  });

  it('returns a bounded placement window around a level', () => {
    expect(placementWindowForLevel(0)).toEqual({ min_level: 0, max_level: 1 });
    expect(placementWindowForLevel(3)).toEqual({ min_level: 2, max_level: 4 });
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

  it('derives a foundational difficulty ladder when authored K-2 items are flat', () => {
    const items = [
      { id: 'a', standard: 'K.CC.A.1', strand: 'Numbers', difficulty: 1 },
      { id: 'b', standard: 'K.CC.A.1', strand: 'Numbers', difficulty: 1 },
      { id: 'c', standard: 'K.CC.A.1', strand: 'Numbers', difficulty: 1 },
      { id: 'd', standard: 'K.CC.A.1', strand: 'Numbers', difficulty: 1 },
      { id: 'e', standard: 'K.G.A.2', strand: 'Shapes', difficulty: 1 },
      { id: 'f', standard: 'K.G.A.2', strand: 'Shapes', difficulty: 1 },
      { id: 'g', standard: 'K.G.A.2', strand: 'Shapes', difficulty: 1 },
    ];

    expect(Array.from(buildFoundationalDiagnosticDifficultyMap(items, 'K').entries())).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 2],
      ['d', 3],
      ['e', 1],
      ['f', 2],
      ['g', 3],
    ]);
  });

  it('preserves authored ladders outside the foundational flat-difficulty case', () => {
    const items = [
      { id: 'a', standard: '3.OA.A.1', strand: 'Operations', difficulty: 1 },
      { id: 'b', standard: '3.OA.A.1', strand: 'Operations', difficulty: 2 },
    ];

    expect(buildFoundationalDiagnosticDifficultyMap(items, '3').size).toBe(0);
  });
});
