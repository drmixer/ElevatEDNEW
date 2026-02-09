import { describe, expect, it } from 'vitest';

import {
  applyCoachingSuggestionQualityChecks,
  buildCoachingSuggestions,
  summarizeCoachingSuggestionQuality,
} from '../parentSuggestions';
import type { ParentChildSnapshot } from '../../types';

const makeChild = (overrides: Partial<ParentChildSnapshot> = {}): ParentChildSnapshot => ({
  id: 'child-1',
  name: 'Avery',
  grade: 5,
  level: 4,
  xp: 1200,
  streakDays: 6,
  strengths: [],
  focusAreas: ['Math word problems'],
  lessonsCompletedWeek: 1,
  practiceMinutesWeek: 35,
  xpEarnedWeek: 110,
  masteryBySubject: [{ subject: 'math', mastery: 58, trend: 'down' }],
  recentActivity: [],
  ...overrides,
});

describe('parent suggestion quality guardrails', () => {
  it('repairs weak why-now copy using child context', () => {
    const child = makeChild();
    const [repaired] = applyCoachingSuggestionQualityChecks(child, [
      {
        id: 'weak-why',
        subject: 'math',
        action: 'Talk through one missed math problem together',
        timeMinutes: 6,
        why: 'Builds confidence.',
        source: 'library',
      },
    ]);

    expect(repaired.qualityStatus).toBe('auto_repaired');
    expect(repaired.qualityIssues).toContain('weak_why_now');
    expect(repaired.why.startsWith('Why now:')).toBe(true);
    expect(repaired.why).toMatch(/this week|right now|recent|% mastery/i);
  });

  it('flags rationale when there are not enough recent signals', () => {
    const child = makeChild({
      name: 'Sam',
      focusAreas: [],
      masteryBySubject: [],
      recentActivity: [],
      subjectStatuses: [],
    });
    const [flagged] = applyCoachingSuggestionQualityChecks(child, [
      {
        id: 'missing-why',
        subject: 'science',
        action: 'Review one science question from this week together',
        timeMinutes: 5,
        why: '',
        source: 'library',
      },
    ]);

    expect(flagged.qualityStatus).toBe('flagged');
    expect(flagged.qualityIssues).toContain('missing_context_signal');
    expect(flagged.why.startsWith('Why now:')).toBe(true);
    expect(flagged.why.toLowerCase()).toContain('limited');
  });

  it('builds suggestions with actionable steps and quality summaries', () => {
    const child = makeChild({ id: 'child-2', grade: 6, masteryBySubject: [{ subject: 'english', mastery: 62, trend: 'steady' }] });
    const suggestions = buildCoachingSuggestions(child, { max: 4, seed: '2026-02-09' });
    const summary = summarizeCoachingSuggestionQuality(suggestions);

    expect(suggestions.length).toBeGreaterThan(0);
    suggestions.forEach((suggestion) => {
      expect(suggestion.action.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(4);
      expect(suggestion.why.startsWith('Why now:')).toBe(true);
    });
    expect(summary.total).toBe(suggestions.length);
    expect(summary.autoRepaired + summary.flagged).toBeLessThanOrEqual(summary.total);
  });
});
