import { describe, expect, it } from 'vitest';

import { createSupabaseClientMock } from '../../src/test/supabaseMock';
import {
  fetchStudentElaDailyPlan,
  fetchStudentElaSubjectState,
  fetchStudentElaWeeklyRecord,
  loadElaModuleMap,
} from '../elaHomeschoolPlans';

describe('elaHomeschoolPlans', () => {
  const elaMap = loadElaModuleMap();
  const readingModule = '6-english-language-arts-reading-informational-science-tech-articles-open-licensed';
  const nextReadingModule = '6-english-language-arts-reading-informational-historical-documents-pd';

  it('builds an ELA diagnostic plan when evidence is missing', async () => {
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({ data: null, error: null }),
      },
      student_progress: {
        query: async () => ({ data: [], error: null }),
      },
    });

    const plan = await fetchStudentElaDailyPlan(supabase as never, 'student-1', {
      date: '2026-04-28',
      elaMap,
    });

    expect(plan.date).toBe('2026-04-28');
    expect(plan.subjects[0]?.subject).toBe('ela');
    expect(plan.subjects[0]?.action).toBe('diagnose');
    expect(plan.blocks.map((block) => block.subject)).toEqual(['ela', 'ela', 'ela']);
    expect(plan.parentNotes[0]).toContain('not enough recent evidence');
  });

  it('summarizes ELA state from subject state and progress evidence', async () => {
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({
          data: {
            subject: 'ela',
            placement_status: 'completed',
            working_level: 6,
            level_confidence: 0.74,
            strand_scores: {},
            weak_standard_codes: [],
            recommended_module_slugs: [readingModule],
            metadata: {
              current_strand: 'reading_informational',
              current_module_slug: readingModule,
              mastered_module_slugs: [],
              weak_module_slugs: [],
              recent_ela_evidence: [
                {
                  moduleSlug: nextReadingModule,
                  scorePct: 64,
                  completedAt: '2026-04-27T10:00:00.000Z',
                  outcome: 'weak',
                },
                {
                  moduleSlug: readingModule,
                  scorePct: 82,
                  completedAt: '2026-04-28T10:00:00.000Z',
                  outcome: 'practice',
                },
              ],
            },
          },
          error: null,
        }),
      },
      student_progress: {
        query: async () => ({ data: [], error: null }),
      },
    });

    const state = await fetchStudentElaSubjectState(supabase as never, 'student-1', { elaMap });

    expect(state?.currentStrand).toBe('reading_informational');
    expect(state?.currentModuleTitle).toBe('Science/Tech Articles (open-licensed)');
    expect(state?.recentEvidence[0]).toEqual(
      expect.objectContaining({
        moduleSlug: readingModule,
        scorePct: 82,
        strand: 'reading_informational',
      }),
    );
    expect(state?.recentEvidence[1]).toEqual(
      expect.objectContaining({
        moduleSlug: nextReadingModule,
        scorePct: 64,
        outcome: 'weak',
      }),
    );
    expect(state?.parentSummary).toContain('continuing');
  });

  it('builds a parent ELA weekly record from completed progress and state evidence', async () => {
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({
          data: {
            subject: 'ela',
            placement_status: 'completed',
            working_level: 6,
            level_confidence: 0.8,
            strand_scores: {},
            weak_standard_codes: [],
            recommended_module_slugs: [nextReadingModule],
            metadata: {
              current_strand: 'reading_informational',
              current_module_slug: nextReadingModule,
              mastered_module_slugs: [readingModule],
              weak_module_slugs: [],
              recent_ela_evidence: [
                {
                  moduleSlug: readingModule,
                  scorePct: 91,
                  completedAt: '2026-04-28T10:00:00.000Z',
                  estimatedMinutes: 20,
                  outcome: 'mastered',
                  reasonCode: 'mastery_advance',
                  nextModuleSlug: nextReadingModule,
                  parentSummary: 'ELA marked Science/Tech Articles mastered because the latest score was 91%. ELA is moving forward because Science/Tech Articles scored 91%.',
                  responseKind: 'evidence_response',
                  promptId: 'ela::reading_informational::guided_practice::6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
                  promptText: "For Science/Tech Articles, state the main idea or author's point, then support it with evidence and explanation.",
                  promptChecklist: ['State a claim or main idea', 'Use text evidence or a concrete detail'],
                  contentId: 'ela-content::reading_informational::guided_practice::6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
                  contentTitle: 'Science/Tech Articles passage',
                  contentKind: 'passage',
                  contentSourceType: 'deterministic_scaffold',
                  contentFocus: 'identify the main idea or author point with evidence',
                  contentSource: 'ElevatED deterministic scaffold',
                  contentText: "A short scaffold asks the student to find the author's main point.\n\nStudents cite one detail and explain why it matters.",
                  contentExcerpt: "A short scaffold asks the student to find the author's main point.",
                  responseText: 'The article shows the main idea through repeated details about the invention.',
                  responseExcerpt: 'The article shows the main idea through repeated details about the invention.',
                  responseWordCount: 13,
                  rubricChecks: {
                    answered: true,
                    evidence: true,
                    explained: true,
                    revised: false,
                  },
                },
              ],
            },
          },
          error: null,
        }),
      },
      student_progress: {
        query: async () => ({
          data: [
            {
              status: 'completed',
              mastery_pct: 76,
              last_activity_at: '2026-04-29T10:00:00.000Z',
              lessons: {
                title: 'Historical documents',
                estimated_duration_minutes: 22,
                modules: {
                  title: 'Historical Documents (PD)',
                  slug: nextReadingModule,
                  subject: 'English Language Arts',
                },
              },
            },
          ],
          error: null,
        }),
      },
    });

    const record = await fetchStudentElaWeeklyRecord(supabase as never, 'student-1', {
      weekStart: '2026-04-27',
      elaMap,
    });

    expect(record.completedModuleCount).toBe(2);
    expect(record.estimatedMinutes).toBe(42);
    expect(record.masteredModuleSlugs).toContain(readingModule);
    expect(record.currentModuleTitle).toBe('Historical Documents (PD)');
    expect(record.latestChangeSummary).toContain('Historical Documents');
    expect(record.parentNotes[0]).toContain('ELA check');
    expect(record.completedModules.find((item) => item.moduleSlug === readingModule)).toEqual(
      expect.objectContaining({
        responseKind: 'evidence_response',
        promptId: 'ela::reading_informational::guided_practice::6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
        promptText: expect.stringContaining("author's point"),
        promptChecklist: ['State a claim or main idea', 'Use text evidence or a concrete detail'],
        contentId: 'ela-content::reading_informational::guided_practice::6-english-language-arts-reading-informational-science-tech-articles-open-licensed',
        contentTitle: 'Science/Tech Articles passage',
        contentKind: 'passage',
        contentSourceType: 'deterministic_scaffold',
        contentText: expect.stringContaining('Students cite one detail'),
        contentExcerpt: expect.stringContaining("author's main point"),
        nextModuleSlug: nextReadingModule,
        nextModuleTitle: 'Historical Documents (PD)',
        parentSummary: expect.stringContaining('moving forward'),
        reasonCode: 'mastery_advance',
        responseText: expect.stringContaining('main idea'),
        responseExcerpt: expect.stringContaining('main idea'),
        responseWordCount: 13,
        rubricChecks: expect.objectContaining({
          evidence: true,
        }),
      }),
    );
  });

  it('prefers durable ELA work samples over duplicate subject-state metadata in weekly records', async () => {
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({
          data: {
            subject: 'ela',
            placement_status: 'completed',
            working_level: 6,
            level_confidence: 0.8,
            strand_scores: {},
            weak_standard_codes: [],
            recommended_module_slugs: [nextReadingModule],
            metadata: {
              current_strand: 'reading_informational',
              current_module_slug: nextReadingModule,
              recent_ela_evidence: [
                {
                  moduleSlug: readingModule,
                  scorePct: 91,
                  completedAt: '2026-04-28T10:00:00.000Z',
                  contentText: 'old metadata copy',
                  responseText: 'old response copy',
                },
              ],
            },
          },
          error: null,
        }),
      },
      student_progress: {
        query: async () => ({ data: [], error: null }),
      },
      student_work_samples: {
        query: async () => ({
          data: [
            {
              module_slug: readingModule,
              module_title: 'Science/Tech Articles (open-licensed)',
              strand: 'reading_informational',
              work_kind: 'evidence_response',
              block_id: `ela-practice-${readingModule}`,
              block_kind: 'guided_practice',
              score_pct: 91,
              outcome: 'mastered',
              reason_code: 'mastery_advance',
              next_module_slug: nextReadingModule,
              next_module_title: 'Historical Documents (PD)',
              parent_summary: 'Durable work sample drove this weekly record.',
              prompt_id: 'ela::reading_informational::guided_practice::durable',
              prompt_text: 'Use evidence from the passage.',
              prompt_checklist: ['State a claim'],
              content_id: 'ela-content::durable',
              content_title: 'Durable passage',
              content_kind: 'passage',
              content_source_type: 'deterministic_scaffold',
              content_focus: 'main idea',
              content_source: 'ElevatED',
              content_text: 'durable content copy',
              content_excerpt: 'durable content',
              response_kind: 'evidence_response',
              response_text: 'durable response copy',
              response_excerpt: 'durable response',
              response_word_count: 3,
              rubric_checks: { answered: true },
              estimated_minutes: 18,
              completed_at: '2026-04-28T10:00:00.000Z',
            },
          ],
          error: null,
        }),
      },
    });

    const record = await fetchStudentElaWeeklyRecord(supabase as never, 'student-1', {
      weekStart: '2026-04-27',
      elaMap,
    });

    expect(record.completedModuleCount).toBe(1);
    expect(record.completedModules[0]).toEqual(
      expect.objectContaining({
        moduleSlug: readingModule,
        contentTitle: 'Durable passage',
        contentText: 'durable content copy',
        responseText: 'durable response copy',
        parentSummary: 'Durable work sample drove this weekly record.',
      }),
    );
  });
});
