import { describe, expect, it } from 'vitest';

import { buildScienceModuleMap, type ScienceSkeletonModule } from '../../shared/scienceHomeschool';
import {
  buildScienceSubjectStateUpdate,
  extractScienceCompletionEvent,
} from '../scienceSubjectState';

const scienceMap = buildScienceModuleMap([
  { grade: 3, subject: 'Science', strand: 'Earth & Space', topic: 'Weather & Seasons' },
  { grade: 3, subject: 'Science', strand: 'Earth & Space', topic: 'Rocks and Soil' },
] satisfies ScienceSkeletonModule[]);

describe('scienceSubjectState', () => {
  it('extracts science completions from student event payloads', () => {
    const event = extractScienceCompletionEvent(
      {
        subject: 'science',
        module_slug: '3-science-earth-and-space-weather-and-seasons',
        response: 'My claim uses evidence from the observation.',
      },
      88,
      { completedAt: '2026-04-27T12:00:00.000Z', timeSpentSeconds: 900 },
    );

    expect(event).toMatchObject({
      moduleSlug: '3-science-earth-and-space-weather-and-seasons',
      score: 88,
      completedAt: '2026-04-27T12:00:00.000Z',
      estimatedMinutes: 15,
    });
  });

  it('stores mastery evidence and moves to the next science module', () => {
    const update = buildScienceSubjectStateUpdate({
      studentId: 'student-1',
      scienceMap,
      moduleSlug: '3-science-earth-and-space-rocks-and-soil',
      score: 92,
      completedAt: '2026-04-27T12:00:00.000Z',
      estimatedMinutes: 18,
      payload: {
        response: 'The claim is that water runs off packed soil. The evidence is that loose soil absorbed water longer. That supports the claim because more spaces let water soak in.',
        response_word_count: 27,
        rubric_checks: { claim: true, evidence: true, reasoning: true, science_words: true },
        prompt_text: 'Write a short science explanation.',
        content_text: 'Phenomenon and data table.',
      },
    });

    expect(update).not.toBeNull();
    expect(update?.subject).toBe('science');
    expect(update?.recommended_module_slugs[0]).toBe('3-science-earth-and-space-weather-and-seasons');
    expect(update?.metadata.last_science_completion).toMatchObject({
      module_slug: '3-science-earth-and-space-rocks-and-soil',
      score: 92,
      outcome: 'mastered',
      next_module_slug: '3-science-earth-and-space-weather-and-seasons',
    });
    expect(update?.metadata.recent_science_evidence).toHaveLength(1);
  });

  it('marks weak science evidence for repair', () => {
    const update = buildScienceSubjectStateUpdate({
      studentId: 'student-1',
      scienceMap,
      moduleSlug: '3-science-earth-and-space-weather-and-seasons',
      score: 58,
    });

    expect(update?.weak_standard_codes).toEqual(['3-science-earth-and-space-weather-and-seasons']);
    expect(update?.metadata.last_science_completion).toMatchObject({
      outcome: 'weak',
      reason_code: 'weak_science_evidence',
    });
  });
});
