import { describe, expect, it } from 'vitest';

import { buildLessonNextReasonCard, buildSupportReasonCard } from '../transparencyReason';

describe('transparencyReason', () => {
  it('uses provided lesson suggestion reason when available', () => {
    const card = buildLessonNextReasonCard({
      suggestionReason: 'Review on reading evidence based on recent misses',
      subject: 'english',
      moduleTitle: 'Reading Skills',
    });
    expect(card.title).toBe('Why this lesson now');
    expect(card.detail.toLowerCase()).toContain('review on reading evidence');
  });

  it('falls back to deterministic lesson rationale when suggestion is missing', () => {
    const card = buildLessonNextReasonCard({
      subject: 'social_studies',
      moduleTitle: 'Communities and Government',
    });
    expect(card.detail.toLowerCase()).toContain('social studies');
    expect(card.detail.toLowerCase()).toContain('communities and government');
  });

  it('builds quick review support reason with metrics', () => {
    const card = buildSupportReasonCard({
      mode: 'quick_review',
      topic: 'text_evidence',
      accuracyPct: 58,
      hintRatePct: 67,
    });
    expect(card.title).toContain('quick review');
    expect(card.detail.toLowerCase()).toContain('text evidence');
    expect(card.detail).toContain('58%');
    expect(card.detail).toContain('67%');
  });

  it('builds challenge reason for acceleration state', () => {
    const card = buildSupportReasonCard({
      mode: 'challenge',
      topic: 'place_value',
    });
    expect(card.title).toContain('challenge');
    expect(card.detail.toLowerCase()).toContain('strong understanding');
  });
});
