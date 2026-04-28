import { describe, expect, it } from 'vitest';

import mathMap from '../../data/curriculum/math_3_8_prerequisite_map.json';
import { buildMathSubjectStateUpdate } from '../mathSubjectState';
import type { MathPrerequisiteMap } from '../../shared/mathAdaptivePolicy';

describe('mathSubjectState', () => {
  const map = mathMap as MathPrerequisiteMap;
  const rootModule = '3-mathematics-number-and-operations-place-value-thousands-millions';

  it('marks a module mastered and recommends the next ready module after a mastery score', () => {
    const update = buildMathSubjectStateUpdate({
      studentId: 'student-1',
      mathMap: map,
      adaptiveVariantId: `${rootModule}::exit_ticket`,
      adaptiveVariantKind: 'exit_ticket',
      moduleSlug: rootModule,
      score: 91,
      completedAt: '2026-04-27T10:00:00.000Z',
    });

    expect(update?.metadata.last_adaptive_variant_result).toEqual(
      expect.objectContaining({
        module_slug: rootModule,
        score: 91,
        outcome: 'mastered',
        reason_code: 'mastery_advance',
      }),
    );
    expect(update?.metadata.mastered_module_slugs).toContain(rootModule);
    expect(update?.metadata.weak_module_slugs).not.toContain(rootModule);
    expect(update?.recommended_module_slugs[0]).toBe(
      '3-mathematics-number-and-operations-multiplication-division',
    );
    expect(update?.metadata.math_rotation_history).toEqual([
      expect.objectContaining({
        date: '2026-04-27',
        target_strand: 'place_value_operations',
        assigned_module_slug: '3-mathematics-number-and-operations-multiplication-division',
        rotation_reason: 'continue_current_strand',
        completed_module_slug: rootModule,
        score: 91,
        outcome: 'mastered',
      }),
    ]);
  });

  it('keeps weak evidence inspectable after a low score', () => {
    const update = buildMathSubjectStateUpdate({
      studentId: 'student-1',
      mathMap: map,
      currentState: {
        expected_level: 3,
        working_level: 3,
        level_confidence: 0.72,
        strand_scores: {},
        weak_standard_codes: [],
        recommended_module_slugs: [],
        metadata: { target_strand: 'place_value_operations' },
      },
      adaptiveVariantId: `${rootModule}::guided_practice`,
      adaptiveVariantKind: 'guided_practice',
      moduleSlug: rootModule,
      score: 64,
      completedAt: '2026-04-27T10:00:00.000Z',
    });

    expect(update?.metadata.last_adaptive_variant_result).toEqual(
      expect.objectContaining({
        module_slug: rootModule,
        score: 64,
        outcome: 'weak',
        reason_code: 'weak_state_repair',
      }),
    );
    expect(update?.metadata.weak_module_slugs).toContain(rootModule);
    expect(update?.weak_standard_codes).toContain(rootModule);
    expect(update?.level_confidence).toBeLessThan(0.72);
    expect(update?.recommended_module_slugs[0]).toBe(rootModule);
  });

  it('records a rotation history entry when mastery makes another strand due', () => {
    const update = buildMathSubjectStateUpdate({
      studentId: 'student-1',
      mathMap: map,
      currentState: {
        expected_level: 3,
        working_level: 3,
        level_confidence: 0.76,
        strand_scores: {
          place_value_operations: {
            adaptive_strand: 'place_value_operations',
            current_module_slug: rootModule,
            working_grade: 3,
            confidence: 0.76,
            mastered_module_slugs: [],
            weak_module_slugs: [],
          },
        },
        weak_standard_codes: [],
        recommended_module_slugs: [rootModule],
        metadata: {
          target_strand: 'place_value_operations',
          strand_state_keys: ['place_value_operations'],
          recent_math_evidence: [
            {
              moduleSlug: rootModule,
              scorePct: 90,
              completedAt: '2026-04-26T10:00:00.000Z',
            },
          ],
        },
      },
      adaptiveVariantId: `${rootModule}::exit_ticket`,
      adaptiveVariantKind: 'exit_ticket',
      moduleSlug: rootModule,
      score: 92,
      completedAt: '2026-04-27T10:00:00.000Z',
    });

    expect(update?.metadata.target_strand).toBe('expressions_equations_functions');
    expect(update?.metadata.current_module_slug).toBe(
      '3-mathematics-depth-and-application-patterns-and-rules',
    );
    expect(update?.metadata.math_rotation_history).toEqual([
      expect.objectContaining({
        date: '2026-04-27',
        target_strand: 'expressions_equations_functions',
        assigned_module_slug: '3-mathematics-depth-and-application-patterns-and-rules',
        rotation_reason: 'strong_mastery_due_strand',
        completed_module_slug: rootModule,
        score: 92,
        outcome: 'mastered',
      }),
    ]);
    expect(update?.strand_scores).toEqual(
      expect.objectContaining({
        place_value_operations: expect.objectContaining({
          mastered_module_slugs: [rootModule],
        }),
        expressions_equations_functions: expect.objectContaining({
          current_module_slug: '3-mathematics-depth-and-application-patterns-and-rules',
        }),
      }),
    );
  });
});
