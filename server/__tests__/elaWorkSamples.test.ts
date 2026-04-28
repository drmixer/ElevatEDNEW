import { describe, expect, it } from 'vitest';

import { createSupabaseClientMock } from '../../src/test/supabaseMock';
import {
  recordElaWorkSampleFromSubjectStateUpdate,
  workSampleRowsToEvidence,
} from '../elaWorkSamples';
import type { ElaModuleMap } from '../../shared/elaHomeschool';

const elaMap: ElaModuleMap = {
  generatedAt: new Date(0).toISOString(),
  modules: [
    {
      slug: '3-english-language-arts-reading-informational-main-idea',
      title: 'Main Idea',
      grade: 3,
      strand: 'reading_informational',
      sourceStrand: 'Reading Informational',
    },
    {
      slug: '3-english-language-arts-reading-informational-text-evidence',
      title: 'Text Evidence',
      grade: 3,
      strand: 'reading_informational',
      sourceStrand: 'Reading Informational',
    },
  ],
};

describe('elaWorkSamples', () => {
  it('records a durable ELA work sample from the subject-state completion summary', async () => {
    let inserted: unknown = null;
    const supabase = createSupabaseClientMock({
      student_work_samples: {
        insert: (payload) => {
          inserted = payload;
          return { data: null, error: null };
        },
      },
    });

    const recorded = await recordElaWorkSampleFromSubjectStateUpdate(
      supabase as never,
      'student-1',
      {
        metadata: {
          last_ela_completion: {
            module_slug: '3-english-language-arts-reading-informational-main-idea',
            module_title: 'Main Idea',
            strand: 'reading_informational',
            score: 91,
            completed_at: '2026-04-27T10:00:00.000Z',
            estimated_minutes: 18,
            prompt_id: 'ela::prompt',
            prompt_text: 'State the main idea with evidence.',
            prompt_checklist: ['State a claim', 'Use evidence'],
            content_id: 'ela-content::main-idea',
            content_title: 'Main Idea passage',
            content_kind: 'passage',
            content_source_type: 'deterministic_scaffold',
            content_text: 'A short passage.',
            response_kind: 'evidence_response',
            response_text: 'The main idea is supported by repeated details.',
            response_excerpt: 'The main idea is supported by repeated details.',
            response_word_count: 9,
            rubric_checks: { answered: true, evidence: true },
            outcome: 'mastered',
            reason_code: 'mastery_advance',
            next_module_slug: '3-english-language-arts-reading-informational-text-evidence',
            parent_summary: 'ELA marked Main Idea mastered because the latest score was 91%.',
          },
        },
      },
      {
        eventType: 'lesson_completed',
        eventCreatedAt: '2026-04-27T10:00:00.000Z',
        payload: {
          block_id: 'ela-practice-3-english-language-arts-reading-informational-main-idea',
          block_kind: 'guided_practice',
        },
        elaMap,
      },
    );

    expect(recorded).toBe(true);
    expect(inserted).toEqual(
      expect.objectContaining({
        student_id: 'student-1',
        subject: 'ela',
        module_slug: '3-english-language-arts-reading-informational-main-idea',
        module_title: 'Main Idea',
        strand: 'reading_informational',
        block_id: 'ela-practice-3-english-language-arts-reading-informational-main-idea',
        block_kind: 'guided_practice',
        score_pct: 91,
        outcome: 'mastered',
        next_module_title: 'Text Evidence',
        response_text: 'The main idea is supported by repeated details.',
        rubric_checks: { answered: true, evidence: true },
      }),
    );
  });

  it('maps durable work-sample rows back to ELA evidence summaries', () => {
    const evidence = workSampleRowsToEvidence([
      {
        module_slug: '3-english-language-arts-reading-informational-main-idea',
        module_title: 'Main Idea',
        strand: 'reading_informational',
        work_kind: 'evidence_response',
        block_id: 'ela-practice-main-idea',
        block_kind: 'guided_practice',
        score_pct: '91',
        outcome: 'mastered',
        reason_code: 'mastery_advance',
        next_module_slug: '3-english-language-arts-reading-informational-text-evidence',
        next_module_title: 'Text Evidence',
        parent_summary: 'ELA moved forward.',
        prompt_id: 'ela::prompt',
        prompt_text: 'State the main idea.',
        prompt_checklist: ['State a claim'],
        content_id: 'ela-content::main-idea',
        content_title: 'Main Idea passage',
        content_kind: 'passage',
        content_source_type: 'deterministic_scaffold',
        content_focus: 'main idea',
        content_source: 'ElevatED',
        content_text: 'A short passage.',
        content_excerpt: 'A short passage.',
        response_kind: 'evidence_response',
        response_text: 'The main idea is clear.',
        response_excerpt: 'The main idea is clear.',
        response_word_count: 5,
        rubric_checks: { answered: true },
        estimated_minutes: 18,
        completed_at: '2026-04-27T10:00:00.000Z',
      },
    ]);

    expect(evidence).toEqual([
      expect.objectContaining({
        moduleSlug: '3-english-language-arts-reading-informational-main-idea',
        moduleTitle: 'Main Idea',
        scorePct: 91,
        nextModuleTitle: 'Text Evidence',
        contentText: 'A short passage.',
        responseText: 'The main idea is clear.',
        rubricChecks: { answered: true },
      }),
    ]);
  });
});
