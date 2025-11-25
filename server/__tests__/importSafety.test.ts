import { describe, expect, test } from 'vitest';

import {
  countDatasetItems,
  evaluateImportLimits,
  normalizeImportLimits,
} from '../importSafety.js';

describe('importSafety helpers', () => {
  test('normalizeImportLimits ignores invalid values and normalizes numbers', () => {
    expect(normalizeImportLimits({ maxAssets: '25', maxModules: -4 })).toEqual({ maxAssets: 25 });
    expect(normalizeImportLimits(null)).toEqual({});
  });

  test('evaluateImportLimits surfaces errors for breached limits', () => {
    const result = evaluateImportLimits(
      { modules: 3, assets: 12 },
      { maxModules: 2, maxAssets: 10 },
    );

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('exceeds the limit');
  });

  test('countDatasetItems tallies module and lesson assets', () => {
    const dataset = {
      provider: 'openstax',
      modules: [
        {
          moduleSlug: 'one',
          assets: [{ url: 'a' }, { url: 'b' }],
          lessons: [{ assets: [{ url: 'c' }] }],
        },
        {
          moduleSlug: 'two',
          lessons: [{ assets: [{ url: 'd' }, { url: 'e' }] }],
        },
      ],
    };

    const counts = countDatasetItems(dataset as never);

    expect(counts.modules).toBe(2);
    expect(counts.assets).toBe(5);
  });
});
