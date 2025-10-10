import { describe, expect, test } from 'vitest';

import {
  loadModuleStandards,
  normalizeEntry,
  parseStandardToken,
} from '../import_module_standards.js';

describe('module standards importer', () => {
  test('default mapping yields stable module and standards counts', async () => {
    const modules = await loadModuleStandards('mappings/module_standards.json');
    const totalStandards = modules.reduce(
      (sum, module) => sum + module.entries.length,
      0,
    );

    expect(modules).toHaveLength(2);
    expect(totalStandards).toBe(4);

    modules.forEach(({ moduleSlug, entries }) => {
      expect(moduleSlug).toMatch(/^6-[a-z0-9-]+$/);
      entries.forEach((entry) => {
        expect(entry.framework.length).toBeGreaterThan(0);
        expect(entry.code.length).toBeGreaterThan(0);
        expect(entry.metadata).toBeTypeOf('object');
      });
    });
  });

  test('string tokens and object entries normalize consistently', () => {
    const token = 'CCSS:ELA-LITERACY.W.6.1';
    const parsed = parseStandardToken(token);
    expect(parsed.framework).toBe('CCSS');
    expect(parsed.code).toBe('ELA-LITERACY.W.6.1');

    const normalizedFromString = normalizeEntry('demo-module', token, null);
    expect(normalizedFromString.framework).toBe('CCSS');
    expect(normalizedFromString.alignment).toBeNull();
    expect(normalizedFromString.metadata).toEqual({});

    const normalizedFromObject = normalizeEntry(
      'demo-module',
      {
        framework: 'Common Core',
        code: '6.RP.A.1',
        alignment: 'anchor',
        extra: 'value',
      },
      null,
    );
    expect(normalizedFromObject.framework).toBe('Common Core');
    expect(normalizedFromObject.alignment).toBe('anchor');
    expect(normalizedFromObject.metadata).toHaveProperty('extra', 'value');
  });
});
