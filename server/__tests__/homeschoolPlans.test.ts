import { describe, expect, it } from 'vitest';

import { createSupabaseClientMock } from '../../src/test/supabaseMock';
import mathMap from '../../data/curriculum/math_3_8_prerequisite_map.json';
import {
  fetchMathAdaptiveVariant,
  fetchStudentMathDailyPlan,
  fetchStudentMathSubjectState,
  fetchStudentMathWeeklyRecord,
  updateStudentMathParentPreference,
} from '../homeschoolPlans';
import type { MathPrerequisiteMap } from '../../shared/mathAdaptivePolicy';
import type { MathAdaptiveVariantCatalog } from '../../shared/mathAdaptiveVariants';
import variantCatalog from '../../data/curriculum/math_adaptive_variants_3_8.json';

describe('homeschoolPlans', () => {
  it('finds a math adaptive variant by id', () => {
    const variant = fetchMathAdaptiveVariant(
      '5-mathematics-number-and-operations-fractions-concepts-equivalence::repair_lesson',
      variantCatalog as MathAdaptiveVariantCatalog,
    );

    expect(variant?.moduleSlug).toBe(
      '5-mathematics-number-and-operations-fractions-concepts-equivalence',
    );
    expect(variant?.kind).toBe('repair_lesson');
  });

  it('rotates a live math daily plan from subject state and recent strong progress', async () => {
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({
          data: {
            subject: 'math',
            working_level: 6,
            level_confidence: 0.78,
            strand_scores: {},
            weak_standard_codes: [],
            recommended_module_slugs: [],
            metadata: {
              target_strand: 'ratios_rates_percent',
              mastered_module_slugs: [
                '5-mathematics-number-and-operations-fractions-concepts-equivalence',
                '5-mathematics-number-and-operations-decimals-intro',
                '5-mathematics-number-and-operations-multiplication-division',
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
              mastery_pct: 89,
              attempts: 1,
              last_activity_at: '2026-04-02T00:00:00Z',
              lessons: {
                id: 2,
                module_id: 22,
                modules: {
                  slug: '6-mathematics-number-and-operations-ratios-and-proportional-reasoning',
                  subject: 'Mathematics',
                },
              },
            },
            {
              status: 'completed',
              mastery_pct: 87,
              attempts: 1,
              last_activity_at: '2026-04-01T00:00:00Z',
              lessons: {
                id: 1,
                module_id: 22,
                modules: {
                  slug: '6-mathematics-number-and-operations-ratios-and-proportional-reasoning',
                  subject: 'Mathematics',
                },
              },
            },
          ],
          error: null,
        }),
      },
    });

    const plan = await fetchStudentMathDailyPlan(supabase as never, 'student-1', {
      date: '2026-04-27',
      mathMap: mathMap as MathPrerequisiteMap,
      variantCatalog: variantCatalog as MathAdaptiveVariantCatalog,
    });

    expect(plan.date).toBe('2026-04-27');
    expect(plan.subjects[0]?.action).toBe('continue');
    expect(plan.subjects[0]?.targetStrand).toBe('fractions_decimals');
    expect(plan.subjects[0]?.rotationReason).toBe('strong_mastery_due_strand');
    expect(plan.subjects[0]?.primaryModuleSlug).toBe(
      '6-mathematics-number-and-operations-integers-and-rational-numbers',
    );
    expect(plan.blocks.map((block) => block.kind)).toEqual([
      'warmup',
      'guided_practice',
      'independent_practice',
      'exit_ticket',
    ]);
  });

  it('falls back to a diagnostic day when the student has no usable math state', async () => {
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({ data: null, error: null }),
      },
      student_progress: {
        query: async () => ({ data: [], error: null }),
      },
    });

    const plan = await fetchStudentMathDailyPlan(supabase as never, 'student-2', {
      date: '2026-04-27',
      mathMap: mathMap as MathPrerequisiteMap,
    });

    expect(plan.subjects[0]?.action).toBe('diagnose');
    expect(plan.subjects[0]?.primaryModuleSlug).toBe(
      '3-mathematics-number-and-operations-place-value-thousands-millions',
    );
  });

  it('passes the parent weekly math focus into the live daily plan', async () => {
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({
          data: {
            subject: 'math',
            working_level: 3,
            level_confidence: 0.72,
            strand_scores: {
              place_value_operations: {
                adaptive_strand: 'place_value_operations',
                current_module_slug: '3-mathematics-number-and-operations-place-value-thousands-millions',
                working_grade: 3,
                confidence: 0.72,
                mastered_module_slugs: [],
                weak_module_slugs: [],
              },
            },
            weak_standard_codes: [],
            recommended_module_slugs: [],
            metadata: {
              target_strand: 'place_value_operations',
              math_parent_preference: {
                preferred_strand: 'geometry_measurement',
                week_start: '2026-04-27',
                updated_at: '2026-04-27T10:00:00.000Z',
                updated_by: 'parent-1',
              },
            },
          },
          error: null,
        }),
      },
      student_progress: {
        query: async () => ({ data: [], error: null }),
      },
    });

    const plan = await fetchStudentMathDailyPlan(supabase as never, 'student-parent-focus', {
      date: '2026-04-28',
      mathMap: mathMap as MathPrerequisiteMap,
      variantCatalog: variantCatalog as MathAdaptiveVariantCatalog,
    });

    expect(plan.subjects[0]?.targetStrand).toBe('geometry_measurement');
    expect(plan.subjects[0]?.preferredStrand).toBe('geometry_measurement');
    expect(plan.subjects[0]?.parentPreferenceActive).toBe(true);
    expect(plan.subjects[0]?.rotationReason).toBe('parent_preferred_strand');
  });

  it('can advance from adaptive variant evidence stored in math subject state', async () => {
    const rootModule = '3-mathematics-number-and-operations-place-value-thousands-millions';
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({
          data: {
            subject: 'math',
            working_level: 3,
            level_confidence: 0.76,
            strand_scores: {
              place_value_operations: {
                adaptive_strand: 'place_value_operations',
                current_module_slug: '3-mathematics-number-and-operations-multiplication-division',
                working_grade: 3,
                confidence: 0.76,
                mastered_module_slugs: [rootModule],
                weak_module_slugs: [],
              },
            },
            weak_standard_codes: [],
            recommended_module_slugs: ['3-mathematics-number-and-operations-multiplication-division'],
            metadata: {
              target_strand: 'place_value_operations',
              strand_state_keys: ['place_value_operations'],
              recent_math_evidence: [
                {
                  moduleSlug: rootModule,
                  scorePct: 91,
                  completedAt: '2026-04-27T10:00:00.000Z',
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

    const plan = await fetchStudentMathDailyPlan(supabase as never, 'student-3', {
      date: '2026-04-28',
      mathMap: mathMap as MathPrerequisiteMap,
      variantCatalog: variantCatalog as MathAdaptiveVariantCatalog,
    });

    expect(plan.subjects[0]?.action).toBe('advance');
    expect(plan.subjects[0]?.primaryModuleSlug).toBe(
      '3-mathematics-number-and-operations-multiplication-division',
    );
  });

  it('can remediate from weak adaptive variant evidence stored in math subject state', async () => {
    const rootModule = '3-mathematics-number-and-operations-place-value-thousands-millions';
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({
          data: {
            subject: 'math',
            working_level: 3,
            level_confidence: 0.53,
            strand_scores: {
              place_value_operations: {
                adaptive_strand: 'place_value_operations',
                current_module_slug: rootModule,
                working_grade: 3,
                confidence: 0.53,
                mastered_module_slugs: [],
                weak_module_slugs: [rootModule],
              },
            },
            weak_standard_codes: [rootModule],
            recommended_module_slugs: [rootModule],
            metadata: {
              target_strand: 'place_value_operations',
              strand_state_keys: ['place_value_operations'],
              recent_math_evidence: [
                {
                  moduleSlug: rootModule,
                  scorePct: 64,
                  completedAt: '2026-04-27T10:00:00.000Z',
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

    const plan = await fetchStudentMathDailyPlan(supabase as never, 'student-4', {
      date: '2026-04-28',
      mathMap: mathMap as MathPrerequisiteMap,
      variantCatalog: variantCatalog as MathAdaptiveVariantCatalog,
    });

    expect(plan.subjects[0]?.action).toBe('remediate');
    expect(plan.subjects[0]?.primaryModuleSlug).toBe(rootModule);
    expect(plan.parentNotes[0]).toContain('weak area');
  });

  it('returns an inspectable math subject state summary', async () => {
    const rootModule = '3-mathematics-number-and-operations-place-value-thousands-millions';
    const nextModule = '3-mathematics-number-and-operations-multiplication-division';
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({
          data: {
            subject: 'math',
            placement_status: 'completed',
            working_level: 3,
            level_confidence: 0.76,
            strand_scores: {
              place_value_operations: {
                adaptive_strand: 'place_value_operations',
                current_module_slug: nextModule,
                working_grade: 3,
                confidence: 0.76,
                mastered_module_slugs: [rootModule],
                weak_module_slugs: [],
              },
            },
            weak_standard_codes: [],
            recommended_module_slugs: [nextModule],
            metadata: {
              target_strand: 'place_value_operations',
              strand_state_keys: ['place_value_operations'],
              recent_math_evidence: [
                {
                  moduleSlug: rootModule,
                  scorePct: 91,
                  completedAt: '2026-04-27T10:00:00.000Z',
                },
              ],
              last_adaptive_variant_result: {
                adaptive_variant_id: `${rootModule}::exit_ticket`,
                adaptive_variant_kind: 'exit_ticket',
                module_slug: rootModule,
                adaptive_strand: 'place_value_operations',
                score: 91,
                accuracy: 91,
                completed_at: '2026-04-27T10:00:00.000Z',
                outcome: 'mastered',
                next_module_slug: nextModule,
                reason_code: 'mastery_advance',
                parent_summary: 'Math advanced because the latest check was strong.',
                practice_item_count: 4,
                practice_items_scored: 4,
              },
              math_rotation_history: [
                {
                  date: '2026-04-27',
                  target_strand: 'place_value_operations',
                  assigned_module_slug: nextModule,
                  rotation_reason: 'continue_current_strand',
                  completed_module_slug: rootModule,
                  score: 91,
                  outcome: 'mastered',
                  parent_summary: 'Math advanced because the latest check was strong.',
                },
              ],
            },
          },
          error: null,
        }),
      },
    });

    const state = await fetchStudentMathSubjectState(supabase as never, 'student-5', {
      mathMap: mathMap as MathPrerequisiteMap,
    });

    expect(state?.currentModuleSlug).toBe(nextModule);
    expect(state?.currentModuleTitle).toBe('Multiplication/Division');
    expect(state?.masteredModuleSlugs).toContain(rootModule);
    expect(state?.lastAdaptiveVariantResult).toEqual(
      expect.objectContaining({
        adaptiveVariantId: `${rootModule}::exit_ticket`,
        reasonCode: 'mastery_advance',
        nextModuleTitle: 'Multiplication/Division',
      }),
    );
    expect(state?.recentEvidence[0]).toEqual(
      expect.objectContaining({
        moduleSlug: rootModule,
        moduleTitle: 'Place Value (thousands/millions)',
        scorePct: 91,
      }),
    );
    expect(state?.rotationHistory[0]).toEqual(
      expect.objectContaining({
        targetStrand: 'place_value_operations',
        assignedModuleSlug: nextModule,
        assignedModuleTitle: 'Multiplication/Division',
        completedModuleTitle: 'Place Value (thousands/millions)',
        rotationReason: 'continue_current_strand',
      }),
    );
  });

  it('builds a parent weekly math record from adaptive evidence and completed progress', async () => {
    const rootModule = '3-mathematics-number-and-operations-place-value-thousands-millions';
    const nextModule = '3-mathematics-number-and-operations-multiplication-division';
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({
          data: {
            subject: 'math',
            placement_status: 'completed',
            working_level: 3,
            level_confidence: 0.76,
            strand_scores: {
              place_value_operations: {
                adaptive_strand: 'place_value_operations',
                current_module_slug: nextModule,
                working_grade: 3,
                confidence: 0.76,
                mastered_module_slugs: [rootModule],
                weak_module_slugs: [],
              },
            },
            weak_standard_codes: [],
            recommended_module_slugs: [nextModule],
            metadata: {
              target_strand: 'place_value_operations',
              strand_state_keys: ['place_value_operations'],
              recent_math_evidence: [
                {
                  moduleSlug: rootModule,
                  scorePct: 91,
                  completedAt: '2026-04-28T10:00:00.000Z',
                },
                {
                  moduleSlug: nextModule,
                  scorePct: 65,
                  completedAt: '2026-04-20T10:00:00.000Z',
                },
              ],
              math_rotation_history: [
                {
                  date: '2026-04-28',
                  target_strand: 'place_value_operations',
                  assigned_module_slug: nextModule,
                  completed_module_slug: rootModule,
                  rotation_reason: 'continue_current_strand',
                  score: 91,
                  outcome: 'mastered',
                },
              ],
              last_adaptive_variant_result: {
                adaptive_variant_id: `${rootModule}::exit_ticket`,
                adaptive_variant_kind: 'exit_ticket',
                module_slug: rootModule,
                adaptive_strand: 'place_value_operations',
                score: 91,
                accuracy: 91,
                completed_at: '2026-04-28T10:00:00.000Z',
                outcome: 'mastered',
                next_module_slug: nextModule,
                reason_code: 'mastery_advance',
                parent_summary: 'Math advanced because the latest check was strong.',
              },
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
              mastery_pct: 88,
              last_activity_at: '2026-04-29T10:00:00.000Z',
              lessons: {
                title: 'Multiplication practice',
                estimated_duration_minutes: 25,
                modules: {
                  title: 'Multiplication/Division',
                  slug: nextModule,
                  subject: 'Mathematics',
                },
              },
            },
            {
              status: 'completed',
              mastery_pct: 55,
              last_activity_at: '2026-04-20T10:00:00.000Z',
              lessons: {
                title: 'Prior week work',
                estimated_duration_minutes: 25,
                modules: {
                  title: 'Place Value (thousands/millions)',
                  slug: rootModule,
                  subject: 'Mathematics',
                },
              },
            },
          ],
          error: null,
        }),
      },
    });

    const record = await fetchStudentMathWeeklyRecord(supabase as never, 'student-7', {
      weekStart: '2026-04-27',
      mathMap: mathMap as MathPrerequisiteMap,
    });

    expect(record.weekStart).toBe('2026-04-27');
    expect(record.weekEnd).toBe('2026-05-04');
    expect(record.estimatedMinutes).toBe(25);
    expect(record.completedModuleCount).toBe(2);
    expect(record.completedModules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          moduleSlug: rootModule,
          source: 'adaptive_variant',
          outcome: 'mastered',
        }),
      ]),
    );
    expect(record.masteredModuleSlugs).toEqual(
      expect.arrayContaining([rootModule, nextModule]),
    );
    expect(record.weakModuleSlugs).toEqual([]);
    expect(record.rotationHistory[0]).toEqual(
      expect.objectContaining({
        completedModuleTitle: 'Place Value (thousands/millions)',
        outcome: 'mastered',
      }),
    );
    expect(record.latestChangeSummary).toContain('This week changed because');
    expect(record.latestChangeSummary).toContain('91%');
    expect(record.parentNotes[1]).toContain('25 estimated minutes');
  });

  it('updates the parent weekly math strand preference in subject state metadata', async () => {
    let upsertPayload: Record<string, unknown> | null = null;
    const supabase = createSupabaseClientMock({
      student_subject_state: {
        maybeSingle: async () => ({
          data: {
            subject: 'math',
            expected_level: 5,
            placement_status: 'completed',
            working_level: 5,
            level_confidence: 0.7,
            strand_scores: {},
            weak_standard_codes: [],
            recommended_module_slugs: [],
            metadata: {
              target_strand: 'place_value_operations',
            },
          },
          error: null,
        }),
        upsert: async (payload) => {
          upsertPayload = payload as Record<string, unknown>;
          return { data: null, error: null };
        },
      },
    });

    const preference = await updateStudentMathParentPreference(
      supabase as never,
      'student-6',
      'parent-1',
      'geometry_measurement',
    );

    expect(preference.preferredStrand).toBe('geometry_measurement');
    expect(upsertPayload?.metadata).toEqual(
      expect.objectContaining({
        target_strand: 'place_value_operations',
        math_parent_preference: expect.objectContaining({
          preferred_strand: 'geometry_measurement',
          updated_by: 'parent-1',
        }),
      }),
    );
  });
});
