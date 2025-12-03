import { describe, expect, it } from 'vitest';
import { describePathEntryReason } from '../pathReason';
import type { StudentPathEntry } from '../../services/onboardingService';

const buildEntry = (overrides: Partial<StudentPathEntry> = {}): StudentPathEntry => ({
  id: 1,
  type: 'lesson',
  status: 'not_started',
  position: 1,
  lesson_id: 10,
  module_id: 20,
  metadata: {},
  target_standard_codes: [],
  ...overrides,
});

describe('describePathEntryReason', () => {
  it('covers primary reason variants', () => {
    const entries: StudentPathEntry[] = [
      buildEntry({ metadata: { reason: 'placement', standard_code: 'math.geo_1' } }),
      buildEntry({ metadata: { reason: 'remediation', standard_code: 'ela.read_2' } }),
      buildEntry({ metadata: { reason: 'stretch', standard_code: 'sci.wave_3' } }),
      buildEntry({ metadata: { reason: 'baseline' } }),
      buildEntry({ metadata: { standard_code: 'math.num_1' } }),
    ];

    const copy = entries.map((entry) => describePathEntryReason(entry));
    expect(copy).toMatchSnapshot();
  });
});
