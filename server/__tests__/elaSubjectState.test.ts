import { describe, expect, it } from 'vitest';

import {
  buildElaSubjectStateUpdate,
  extractElaCompletionEvent,
} from '../elaSubjectState';
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
    {
      slug: '3-english-language-arts-writing-grammar-sentence-combining',
      title: 'Sentence Combining',
      grade: 3,
      strand: 'writing_grammar',
      sourceStrand: 'Writing and Grammar',
    },
  ],
};

describe('elaSubjectState', () => {
  it('marks an ELA module mastered and recommends the next module after a mastery score', () => {
    const update = buildElaSubjectStateUpdate({
      studentId: 'student-1',
      elaMap,
      moduleSlug: '3-english-language-arts-reading-informational-main-idea',
      score: 91,
      completedAt: '2026-04-27T10:00:00.000Z',
      estimatedMinutes: 18,
      payload: {
        response_kind: 'evidence_response',
        prompt_id: 'ela::reading_informational::guided_practice::3-english-language-arts-reading-informational-main-idea',
        prompt_text: "For Main Idea, state the main idea or author's point, then support it with evidence and explanation.",
        prompt_checklist: ['State a claim or main idea', 'Use text evidence or a concrete detail'],
        content_id: 'ela-content::reading_informational::guided_practice::3-english-language-arts-reading-informational-main-idea',
        content_title: 'Main Idea passage',
        content_kind: 'passage',
        content_source_type: 'deterministic_scaffold',
        content_focus: 'identify the main idea or author point with evidence',
        content_source: 'ElevatED deterministic scaffold',
        content_text: "A short scaffold asks the student to find the author's main point.\n\nThe second paragraph asks for one detail and an explanation.",
        content_excerpt: "A short scaffold asks the student to find the author's main point.",
        response_word_count: 42,
        response: 'The main idea is clear because the details all describe how the invention changed daily life.',
        rubric_checks: {
          answered: true,
          evidence: true,
          explained: true,
          revised: true,
        },
      },
    });

    expect(update?.metadata.mastered_module_slugs).toContain(
      '3-english-language-arts-reading-informational-main-idea',
    );
    expect(update?.metadata.weak_module_slugs).not.toContain(
      '3-english-language-arts-reading-informational-main-idea',
    );
    expect(update?.recommended_module_slugs[0]).toBe(
      '3-english-language-arts-reading-informational-text-evidence',
    );
    expect(update?.metadata.last_ela_completion).toEqual(
      expect.objectContaining({
        module_slug: '3-english-language-arts-reading-informational-main-idea',
        score: 91,
        outcome: 'mastered',
        next_module_slug: '3-english-language-arts-reading-informational-text-evidence',
        reason_code: 'mastery_advance',
      }),
    );
    expect(update?.metadata.recent_ela_evidence).toEqual([
      expect.objectContaining({
        moduleSlug: '3-english-language-arts-reading-informational-main-idea',
        scorePct: 91,
        completedAt: '2026-04-27T10:00:00.000Z',
        estimatedMinutes: 18,
        outcome: 'mastered',
        reasonCode: 'mastery_advance',
        nextModuleSlug: '3-english-language-arts-reading-informational-text-evidence',
        parentSummary: expect.stringContaining('ELA marked Main Idea mastered'),
        responseKind: 'evidence_response',
        promptId: 'ela::reading_informational::guided_practice::3-english-language-arts-reading-informational-main-idea',
        promptText: "For Main Idea, state the main idea or author's point, then support it with evidence and explanation.",
        promptChecklist: ['State a claim or main idea', 'Use text evidence or a concrete detail'],
        contentId: 'ela-content::reading_informational::guided_practice::3-english-language-arts-reading-informational-main-idea',
        contentTitle: 'Main Idea passage',
        contentKind: 'passage',
        contentSourceType: 'deterministic_scaffold',
        contentFocus: 'identify the main idea or author point with evidence',
        contentSource: 'ElevatED deterministic scaffold',
        contentText: expect.stringContaining('second paragraph'),
        contentExcerpt: expect.stringContaining("author's main point"),
        responseText: 'The main idea is clear because the details all describe how the invention changed daily life.',
        responseWordCount: 42,
        rubricChecks: {
          answered: true,
          evidence: true,
          explained: true,
          revised: true,
        },
      }),
    ]);
    expect(update?.metadata.last_ela_completion).toEqual(
      expect.objectContaining({
        response_excerpt: expect.stringContaining('The main idea is clear'),
        prompt_id: 'ela::reading_informational::guided_practice::3-english-language-arts-reading-informational-main-idea',
        prompt_text: expect.stringContaining('state the main idea'),
        prompt_checklist: ['State a claim or main idea', 'Use text evidence or a concrete detail'],
        content_id: 'ela-content::reading_informational::guided_practice::3-english-language-arts-reading-informational-main-idea',
        content_title: 'Main Idea passage',
        content_source_type: 'deterministic_scaffold',
        content_text: expect.stringContaining('second paragraph'),
        content_excerpt: expect.stringContaining("author's main point"),
        response_text: 'The main idea is clear because the details all describe how the invention changed daily life.',
        response_word_count: 42,
        rubric_checks: expect.objectContaining({
          evidence: true,
        }),
      }),
    );
  });

  it('keeps weak ELA evidence inspectable after a low score', () => {
    const update = buildElaSubjectStateUpdate({
      studentId: 'student-1',
      elaMap,
      currentState: {
        expected_level: 3,
        working_level: 3,
        level_confidence: 0.72,
        strand_scores: {},
        weak_standard_codes: [],
        recommended_module_slugs: [],
        metadata: {
          current_strand: 'reading_informational',
        },
      },
      moduleSlug: '3-english-language-arts-reading-informational-main-idea',
      score: 63,
      completedAt: '2026-04-27T10:00:00.000Z',
    });

    expect(update?.metadata.weak_module_slugs).toContain(
      '3-english-language-arts-reading-informational-main-idea',
    );
    expect(update?.weak_standard_codes).toContain(
      '3-english-language-arts-reading-informational-main-idea',
    );
    expect(update?.metadata.last_ela_completion).toEqual(
      expect.objectContaining({
        outcome: 'weak',
        reason_code: 'weak_reading_or_writing_evidence',
      }),
    );
    expect(update?.level_confidence).toBeLessThan(0.72);
    expect(update?.recommended_module_slugs[0]).toBe(
      '3-english-language-arts-reading-informational-main-idea',
    );
  });

  it('removes a repaired module from weak slugs when the next score reaches practice range', () => {
    const update = buildElaSubjectStateUpdate({
      studentId: 'student-1',
      elaMap,
      currentState: {
        expected_level: 3,
        working_level: 3,
        level_confidence: 0.48,
        strand_scores: {
          reading_informational: {
            adaptive_strand: 'reading_informational',
            current_module_slug: '3-english-language-arts-reading-informational-main-idea',
            working_grade: 3,
            confidence: 0.48,
            mastered_module_slugs: [],
            weak_module_slugs: ['3-english-language-arts-reading-informational-main-idea'],
          },
        },
        weak_standard_codes: ['3-english-language-arts-reading-informational-main-idea'],
        recommended_module_slugs: ['3-english-language-arts-reading-informational-main-idea'],
        metadata: {
          current_strand: 'reading_informational',
          weak_module_slugs: ['3-english-language-arts-reading-informational-main-idea'],
        },
      },
      moduleSlug: '3-english-language-arts-reading-informational-main-idea',
      score: 76,
      completedAt: '2026-04-27T10:00:00.000Z',
    });

    expect(update?.metadata.last_ela_completion).toEqual(
      expect.objectContaining({
        outcome: 'practice',
        reason_code: 'continue_current_module',
      }),
    );
    expect(update?.metadata.weak_module_slugs).not.toContain(
      '3-english-language-arts-reading-informational-main-idea',
    );
    expect(update?.weak_standard_codes).not.toContain(
      '3-english-language-arts-reading-informational-main-idea',
    );
  });

  it('returns null for an unknown ELA module slug', () => {
    const update = buildElaSubjectStateUpdate({
      studentId: 'student-1',
      elaMap,
      moduleSlug: 'missing-module',
      score: 91,
    });

    expect(update).toBeNull();
  });

  it('extracts ELA completion events from subject or module slug payloads only', () => {
    expect(
      extractElaCompletionEvent(
        {
          subject: 'ELA',
          module_slug: '3-english-language-arts-reading-informational-main-idea',
        },
        88,
        { timeSpentSeconds: 125, completedAt: '2026-04-27T10:00:00.000Z' },
      ),
    ).toEqual(
      expect.objectContaining({
        moduleSlug: '3-english-language-arts-reading-informational-main-idea',
        score: 88,
        estimatedMinutes: 2,
        completedAt: '2026-04-27T10:00:00.000Z',
      }),
    );

    expect(
      extractElaCompletionEvent(
        {
          module_slug: '3-english-language-arts-writing-grammar-sentence-combining',
        },
        72,
      ),
    ).toEqual(
      expect.objectContaining({
        moduleSlug: '3-english-language-arts-writing-grammar-sentence-combining',
        score: 72,
      }),
    );

    expect(
      extractElaCompletionEvent(
        {
          subject: 'math',
          module_slug: '3-mathematics-number-and-operations-place-value',
        },
        88,
      ),
    ).toBeNull();
  });
});
