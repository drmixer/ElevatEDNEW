import { describe, expect, test } from 'vitest';

import { loadStructuredFile } from '../utils/files.js';
import {
  normalizeGutenbergEntries,
  type GutenbergMapping,
} from '../import_gutenberg.js';

describe('gutenberg mapping regression', () => {
  test('mapping retains expected module and asset counts', async () => {
    const mapping = await loadStructuredFile<GutenbergMapping>('mappings/gutenberg.json');
    const moduleSlugs = Object.keys(mapping);
    const totalEntries = Object.values(mapping).reduce((sum, value) => sum + value.length, 0);

    expect(moduleSlugs).toHaveLength(3);
    expect(totalEntries).toBe(6);
    expect(moduleSlugs).not.toContain('');
  });

  test('entries normalize into asset payloads with deterministic metadata', async () => {
    const mapping = await loadStructuredFile<GutenbergMapping>('mappings/gutenberg.json');
    let normalizedCount = 0;

    for (const [moduleSlug, value] of Object.entries(mapping)) {
      expect(moduleSlug).toMatch(/^[a-z0-9-]+$/);
      const normalized = normalizeGutenbergEntries(value);
      normalizedCount += normalized.length;

      normalized.forEach((entry, index) => {
        expect(entry.kind).toBe('link');
        expect(entry.metadata).toBeTypeOf('object');
        expect(Array.isArray(entry.tags)).toBe(true);
        expect(entry.tags.every((tag) => typeof tag === 'string')).toBe(true);
        expect(entry.url).toMatch(/^https?:\/\//);

        if (typeof value[index] === 'string') {
          expect(entry.title).toBeNull();
          expect(entry.description).toBeNull();
        }
      });
    }

    expect(normalizedCount).toBe(6);
  });
});
