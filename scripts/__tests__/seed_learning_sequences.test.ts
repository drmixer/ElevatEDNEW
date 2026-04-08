import { describe, expect, it } from 'vitest';

import { buildPayload } from '../seed_learning_sequences.js';

describe('seed_learning_sequences buildPayload', () => {
  it('preserves explicit prerequisite metadata from authored sequence entries', () => {
    const payload = buildPayload(
      [
        {
          grade_band: '6',
          subject: 'math',
          sequence: [
            {
              position: 1,
              module_slug: 'math-a',
              module_title: 'Math A',
              strand: 'Number & Operations',
              standard_codes: ['6.NS.A.1'],
            },
            {
              position: 2,
              module_slug: 'math-b',
              module_title: 'Math B',
              strand: 'Number & Operations',
              standard_codes: ['6.RP.A.1'],
              prerequisite_standard_codes: ['5.NF.A.1'],
              metadata: { priority: 'coverage_anchor' },
            },
          ],
        },
      ],
      new Map([
        ['math-a', { id: 101 }],
        ['math-b', { id: 102 }],
      ]),
    );

    expect(payload[1]?.metadata).toEqual({
      priority: 'coverage_anchor',
      prerequisite_standard_codes: ['5.NF.A.1'],
    });
  });

  it('infers adjacent prerequisite metadata for eligible grades and subjects when none is authored', () => {
    const payload = buildPayload(
      [
        {
          grade_band: '4',
          subject: 'ela',
          sequence: [
            {
              position: 1,
              module_slug: 'ela-a',
              module_title: 'ELA A',
              strand: 'Reading Informational',
              standard_codes: ['CCSS.ELA-LITERACY.RI.4.1'],
            },
            {
              position: 2,
              module_slug: 'ela-b',
              module_title: 'ELA B',
              strand: 'Reading Informational',
              standard_codes: ['CCSS.ELA-LITERACY.RI.4.2'],
            },
          ],
        },
      ],
      new Map([
        ['ela-a', { id: 201 }],
        ['ela-b', { id: 202 }],
      ]),
    );

    expect(payload[1]?.metadata).toEqual({
      prerequisite_standard_codes: ['CCSS.ELA-LITERACY.RI.4.1'],
      prerequisite_metadata_source: 'adjacent_sequence_inference',
    });
  });

  it('does not infer prerequisite metadata for ineligible subjects or repeated standards', () => {
    const payload = buildPayload(
      [
        {
          grade_band: '6',
          subject: 'science',
          sequence: [
            {
              position: 1,
              module_slug: 'science-a',
              module_title: 'Science A',
              strand: 'Physical Science',
              standard_codes: ['MS-PS1-1'],
            },
            {
              position: 2,
              module_slug: 'science-b',
              module_title: 'Science B',
              strand: 'Physical Science',
              standard_codes: ['MS-PS1-2'],
            },
          ],
        },
        {
          grade_band: '5',
          subject: 'math',
          sequence: [
            {
              position: 1,
              module_slug: 'math-c',
              module_title: 'Math C',
              strand: 'Geometry & Measurement',
              standard_codes: ['5.MD.A.1'],
            },
            {
              position: 2,
              module_slug: 'math-d',
              module_title: 'Math D',
              strand: 'Geometry & Measurement',
              standard_codes: ['5.MD.A.1'],
            },
          ],
        },
      ],
      new Map([
        ['science-a', { id: 301 }],
        ['science-b', { id: 302 }],
        ['math-c', { id: 401 }],
        ['math-d', { id: 402 }],
      ]),
    );

    expect(payload[1]?.metadata).toEqual({});
    expect(payload[3]?.metadata).toEqual({});
  });
});
