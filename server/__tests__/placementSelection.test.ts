import { describe, expect, it } from 'vitest';

import { selectPlacementAssessmentId } from '../placementSelection.js';

describe('selectPlacementAssessmentId', () => {
  it('prefers core placement over elective placement for balanced onboarding', () => {
    const id = selectPlacementAssessmentId(
      [
        {
          id: 101,
          module_id: null,
          metadata: { purpose: 'placement', grade_band: '6-8', subject_key: 'computer_science' },
        },
        { id: 102, module_id: null, metadata: { purpose: 'placement', grade_band: '7', subject_key: 'math' } },
      ],
      { targetGradeBand: '6-8' },
    );

    expect(id).toBe(102);
  });

  it('falls back to core diagnostic when only elective placement exists', () => {
    const id = selectPlacementAssessmentId(
      [
        {
          id: 201,
          module_id: null,
          metadata: { purpose: 'placement', grade_band: '6-8', subject_key: 'computer_science' },
        },
        { id: 202, module_id: null, metadata: { purpose: 'diagnostic', grade_band: '6-8', subject_key: 'ela' } },
      ],
      { targetGradeBand: '6-8' },
    );

    expect(id).toBe(202);
  });

  it('respects goalFocus when provided (including electives)', () => {
    const id = selectPlacementAssessmentId(
      [
        { id: 301, module_id: null, metadata: { purpose: 'placement', grade_band: '6-8', subject_key: 'math' } },
        {
          id: 302,
          module_id: null,
          metadata: { purpose: 'placement', grade_band: '6-8', subject_key: 'computer_science' },
        },
      ],
      { targetGradeBand: '6-8', goalFocus: 'computer_science' },
    );

    expect(id).toBe(302);
  });

  it('ignores module-linked and baseline assessments', () => {
    const id = selectPlacementAssessmentId(
      [
        { id: 401, module_id: 55, metadata: { purpose: 'placement', grade_band: '6-8', subject_key: 'math' } },
        { id: 402, module_id: null, metadata: { purpose: 'baseline', grade_band: '6-8', subject_key: 'math' } },
        { id: 403, module_id: null, metadata: { purpose: 'diagnostic', grade_band: '6-8', subject_key: 'science' } },
      ],
      { targetGradeBand: '6-8' },
    );

    expect(id).toBe(403);
  });

  it('accepts mixed-subject placement assessments via metadata.subjects', () => {
    const id = selectPlacementAssessmentId(
      [
        { id: 501, module_id: null, metadata: { purpose: 'placement', grade_band: '6-8', subjects: ['math', 'ela', 'science'] } },
      ],
      { targetGradeBand: '6-8' },
    );

    expect(id).toBe(501);
  });
});
