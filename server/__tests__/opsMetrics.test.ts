import { beforeEach, describe, expect, it } from 'vitest';

import { clearOpsEventsForTests, getOpsSnapshot, recordOpsEvent } from '../opsMetrics.js';

describe('opsMetrics adaptive replan summaries', () => {
  beforeEach(() => {
    clearOpsEventsForTests();
  });

  it('aggregates adaptive replans by trigger, subject, mix shift, and oscillation risk', () => {
    recordOpsEvent({
      type: 'adaptive_replan',
      label: 'lesson_completed:math',
      reason: 'lesson_completion',
      metadata: {
        triggerLabel: 'lesson_completed:math',
        primarySupportSubject: 'math',
        mixShiftLabel: 'english×2, math×1 -> math×2, english×1',
        oscillationRisk: false,
      },
    });

    recordOpsEvent({
      type: 'adaptive_replan',
      label: 'practice_answered:english',
      reason: 'stable_support',
      metadata: {
        triggerLabel: 'practice_answered:english',
        primarySupportSubject: 'english',
        mixShiftLabel: 'math×2, english×1 -> english×2, math×1',
        oscillationRisk: true,
        oscillationLabel: 'math -> english',
      },
    });

    recordOpsEvent({
      type: 'adaptive_replan',
      label: 'practice_answered:english',
      reason: 'stable_support',
      metadata: {
        triggerLabel: 'practice_answered:english',
        primarySupportSubject: 'english',
        mixShiftLabel: 'math×2, english×1 -> english×2, math×1',
        oscillationRisk: true,
        oscillationLabel: 'math -> english',
      },
    });

    const snapshot = getOpsSnapshot();

    expect(snapshot.totals.adaptive_replan).toBe(3);
    expect(snapshot.adaptiveReplansByTrigger[0]).toEqual({
      label: 'practice_answered:english',
      count: 2,
    });
    expect(snapshot.adaptiveReplansBySupportSubject[0]).toEqual({
      label: 'english',
      count: 2,
    });
    expect(snapshot.adaptiveReplanMixShifts[0]).toEqual({
      label: 'math×2, english×1 -> english×2, math×1',
      count: 2,
    });
    expect(snapshot.adaptiveOscillationRisks[0]).toEqual({
      label: 'math -> english',
      count: 2,
    });
  });

  it('aggregates CAT coverage gaps and low-confidence sessions by subject', () => {
    recordOpsEvent({
      type: 'cat_content_gap_detected',
      label: 'math',
      reason: 'coverage_fallback',
      metadata: { fallbackDistance: 2 },
    });

    recordOpsEvent({
      type: 'cat_low_confidence',
      label: 'math',
      reason: 'coverage_fallback',
      metadata: { confidenceLow: 4.2, confidenceHigh: 6.8 },
    });

    const snapshot = getOpsSnapshot();

    expect(snapshot.totals.cat_content_gap_detected).toBe(1);
    expect(snapshot.totals.cat_low_confidence).toBe(1);
    expect(snapshot.catContentGapsBySubject[0]).toEqual({ label: 'math', count: 1 });
    expect(snapshot.catLowConfidenceBySubject[0]).toEqual({ label: 'math', count: 1 });
  });
});
