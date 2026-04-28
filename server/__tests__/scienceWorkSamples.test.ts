import { describe, expect, it } from 'vitest';

import { createSupabaseClientMock } from '../../src/test/supabaseMock';
import type { ScienceModuleMap } from '../../shared/scienceHomeschool';
import {
  recordScienceWorkSampleFromSubjectStateUpdate,
  scienceWorkSampleRowsToEvidence,
} from '../scienceWorkSamples';

const scienceMap: ScienceModuleMap = {
  generatedAt: new Date(0).toISOString(),
  modules: [
    {
      slug: '3-science-earth-and-space-weather-and-seasons',
      title: 'Weather and Seasons',
      grade: 3,
      strand: 'earth_space',
      sourceStrand: 'Earth & Space',
    },
    {
      slug: '3-science-earth-and-space-rocks-and-soil',
      title: 'Rocks and Soil',
      grade: 3,
      strand: 'earth_space',
      sourceStrand: 'Earth & Space',
    },
  ],
};

describe('scienceWorkSamples', () => {
  it('records a durable science work sample from subject-state metadata', async () => {
    let inserted: unknown = null;
    const supabase = createSupabaseClientMock({
      student_work_samples: {
        insert: (payload) => {
          inserted = payload;
          return { data: null, error: null };
        },
      },
    });

    const recorded = await recordScienceWorkSampleFromSubjectStateUpdate(
      supabase as never,
      'student-1',
      {
        metadata: {
          last_science_completion: {
            module_slug: '3-science-earth-and-space-weather-and-seasons',
            module_title: 'Weather and Seasons',
            strand: 'earth_space',
            score: 92,
            completed_at: '2026-04-27T10:00:00.000Z',
            estimated_minutes: 18,
            prompt_id: 'science::prompt',
            prompt_text: 'Write a CER explanation.',
            prompt_checklist: ['State a claim', 'Use evidence'],
            content_id: 'science-content::weather',
            content_title: 'Weather evidence block',
            content_kind: 'phenomenon',
            content_source_type: 'deterministic_scaffold',
            content_text: 'A phenomenon and data table.',
            response_kind: 'science_cer',
            response_text: 'The claim is supported by the runoff data.',
            response_excerpt: 'The claim is supported by the runoff data.',
            response_word_count: 8,
            rubric_checks: { claim: true, evidence: true },
            outcome: 'mastered',
            reason_code: 'mastery_advance',
            next_module_slug: '3-science-earth-and-space-rocks-and-soil',
            parent_summary: 'Science marked Weather and Seasons mastered because the latest score was 92%.',
          },
        },
      },
      {
        eventType: 'lesson_completed',
        eventCreatedAt: '2026-04-27T10:00:00.000Z',
        payload: {
          block_id: 'science-cer-3-science-earth-and-space-weather-and-seasons',
          block_kind: 'guided_practice',
        },
        scienceMap,
      },
    );

    expect(recorded).toBe(true);
    expect(inserted).toEqual(
      expect.objectContaining({
        student_id: 'student-1',
        subject: 'science',
        module_slug: '3-science-earth-and-space-weather-and-seasons',
        module_title: 'Weather and Seasons',
        strand: 'earth_space',
        score_pct: 92,
        outcome: 'mastered',
        next_module_title: 'Rocks and Soil',
        response_text: 'The claim is supported by the runoff data.',
        rubric_checks: { claim: true, evidence: true },
      }),
    );
  });

  it('maps durable science rows back to evidence summaries', () => {
    const evidence = scienceWorkSampleRowsToEvidence([
      {
        module_slug: '3-science-earth-and-space-weather-and-seasons',
        module_title: 'Weather and Seasons',
        strand: 'earth_space',
        work_kind: 'science_cer',
        block_id: 'science-cer-weather',
        block_kind: 'guided_practice',
        score_pct: '92',
        outcome: 'mastered',
        reason_code: 'mastery_advance',
        next_module_slug: '3-science-earth-and-space-rocks-and-soil',
        next_module_title: 'Rocks and Soil',
        parent_summary: 'Science moved forward.',
        prompt_id: 'science::prompt',
        prompt_text: 'Write a CER.',
        prompt_checklist: ['State a claim'],
        content_id: 'science-content::weather',
        content_title: 'Weather evidence block',
        content_kind: 'phenomenon',
        content_source_type: 'deterministic_scaffold',
        content_focus: 'CER',
        content_source: 'ElevatED',
        content_text: 'A phenomenon.',
        content_excerpt: 'A phenomenon.',
        response_kind: 'science_cer',
        response_text: 'The claim fits the evidence.',
        response_excerpt: 'The claim fits the evidence.',
        response_word_count: 5,
        rubric_checks: { claim: true },
        estimated_minutes: 18,
        completed_at: '2026-04-27T10:00:00.000Z',
      },
    ]);

    expect(evidence).toEqual([
      expect.objectContaining({
        moduleSlug: '3-science-earth-and-space-weather-and-seasons',
        moduleTitle: 'Weather and Seasons',
        scorePct: 92,
        nextModuleTitle: 'Rocks and Soil',
        contentText: 'A phenomenon.',
        responseText: 'The claim fits the evidence.',
        rubricChecks: { claim: true },
      }),
    ]);
  });
});
