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

  it('prefers an explicitly requested subject key over balanced core ordering', () => {
    const id = selectPlacementAssessmentId(
      [
        { id: 601, module_id: null, metadata: { purpose: 'placement', grade_band: '6-8', subject_key: 'math' } },
        { id: 602, module_id: null, metadata: { purpose: 'placement', grade_band: '6-8', subject_key: 'ela' } },
      ],
      { targetGradeBand: '6-8', subjectKey: 'ela' },
    );

    expect(id).toBe(602);
  });

  it('matches placement level when assessment metadata provides it', () => {
    const id = selectPlacementAssessmentId(
      [
        { id: 701, module_id: null, metadata: { purpose: 'placement', grade_band: '6-8', subject_key: 'math', placement_level: 6 } },
        { id: 702, module_id: null, metadata: { purpose: 'placement', grade_band: '6-8', subject_key: 'math', placement_level: 7 } },
      ],
      { targetGradeBand: '6-8', subjectKey: 'math', targetLevel: 7 },
    );

    expect(id).toBe(702);
  });

  it('prefers the closest anchor level instead of the newest in-window candidate', () => {
    const id = selectPlacementAssessmentId(
      [
        {
          id: 801,
          module_id: null,
          created_at: '2026-04-01T00:00:00.000Z',
          metadata: { purpose: 'diagnostic', grade_band: '6-8', subject_key: 'math', placement_level: 6, placement_window: { min_level: 5, max_level: 7 } },
        },
        {
          id: 802,
          module_id: null,
          created_at: '2026-04-03T00:00:00.000Z',
          metadata: { purpose: 'diagnostic', grade_band: '6-8', subject_key: 'math', placement_level: 8, placement_window: { min_level: 6, max_level: 8 } },
        },
      ],
      { targetGradeBand: '6-8', subjectKey: 'math', targetLevel: 6 },
    );

    expect(id).toBe(801);
  });

  it('prefers the nearer easier anchor before an equally distant harder one', () => {
    const id = selectPlacementAssessmentId(
      [
        {
          id: 901,
          module_id: null,
          metadata: { purpose: 'diagnostic', grade_band: '6-8', subject_key: 'math', placement_level: 5, placement_window: { min_level: 4, max_level: 6 } },
        },
        {
          id: 902,
          module_id: null,
          metadata: { purpose: 'diagnostic', grade_band: '6-8', subject_key: 'math', placement_level: 7, placement_window: { min_level: 6, max_level: 8 } },
        },
      ],
      { targetGradeBand: '6-8', subjectKey: 'math', targetLevel: 6 },
    );

    expect(id).toBe(901);
  });
});
