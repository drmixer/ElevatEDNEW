import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildMathDailyPlan } from '../../shared/homeschoolDailyPlan';
import type { MathPrerequisiteMap } from '../../shared/mathAdaptivePolicy';
import type { MathAdaptiveVariantCatalog } from '../../shared/mathAdaptiveVariants';

const loadMap = (): MathPrerequisiteMap => {
  const mapPath = path.resolve(process.cwd(), 'data/curriculum/math_3_8_prerequisite_map.json');
  return JSON.parse(fs.readFileSync(mapPath, 'utf8')) as MathPrerequisiteMap;
};

const loadVariantCatalog = (): MathAdaptiveVariantCatalog => {
  const catalogPath = path.resolve(process.cwd(), 'data/curriculum/math_adaptive_variants_3_8.json');
  return JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as MathAdaptiveVariantCatalog;
};

describe('homeschoolDailyPlan', () => {
  const mathMap = loadMap();
  const variantCatalog = loadVariantCatalog();

  it('builds a diagnostic math day when no evidence exists', () => {
    const plan = buildMathDailyPlan({
      date: '2026-04-27',
      studentId: 'student-1',
      mathMap,
      targetStrand: 'place_value_operations',
    });

    expect(plan.date).toBe('2026-04-27');
    expect(plan.studentId).toBe('student-1');
    expect(plan.subjects[0]?.action).toBe('diagnose');
    expect(plan.blocks.map((block) => block.kind)).toEqual(['diagnostic', 'lesson', 'exit_ticket']);
    expect(plan.requiredMinutes).toBe(37);
    expect(plan.parentNotes[0]).toContain('not enough recent evidence');
  });

  it('builds a repair-focused math day after repeated low scores', () => {
    const plan = buildMathDailyPlan({
      mathMap,
      variantCatalog,
      completedModuleSlug: '7-mathematics-number-and-operations-expressions-and-equations',
      strandStates: [
        {
          adaptiveStrand: 'expressions_equations_functions',
          masteredModuleSlugs: [
            '6-mathematics-number-and-operations-expressions-and-equations',
            '7-mathematics-depth-and-application-patterns-and-rules',
            '7-mathematics-number-and-operations-integers-and-rational-numbers',
          ],
        },
      ],
      recentEvidence: [
        {
          moduleSlug: '7-mathematics-number-and-operations-expressions-and-equations',
          scorePct: 55,
          completedAt: '2026-04-01T00:00:00Z',
        },
        {
          moduleSlug: '7-mathematics-number-and-operations-expressions-and-equations',
          scorePct: 52,
          completedAt: '2026-04-02T00:00:00Z',
        },
      ],
    });

    expect(plan.subjects[0]?.action).toBe('remediate');
    expect(plan.blocks.map((block) => block.kind)).toEqual([
      'warmup',
      'repair',
      'guided_practice',
      'exit_ticket',
    ]);
    expect(plan.blocks[1]?.moduleSlug).toBe(
      '6-mathematics-number-and-operations-expressions-and-equations',
    );
    expect(plan.blocks[1]?.contentVariantId).toBe(
      '6-mathematics-number-and-operations-expressions-and-equations::repair_lesson',
    );
    expect(plan.blocks[2]?.contentVariantId).toBe(
      '6-mathematics-number-and-operations-expressions-and-equations::guided_repair_practice',
    );
    expect(plan.requiredMinutes).toBe(42);
  });

  it('includes optional reflection on a challenge math day', () => {
    const plan = buildMathDailyPlan({
      mathMap,
      variantCatalog,
      completedModuleSlug: '5-mathematics-number-and-operations-fractions-concepts-equivalence',
      strandStates: [
        {
          adaptiveStrand: 'fractions_decimals',
          masteredModuleSlugs: [
            '4-mathematics-number-and-operations-fractions-concepts-equivalence',
            '4-mathematics-number-and-operations-decimals-intro',
            '5-mathematics-number-and-operations-place-value-thousands-millions',
            '5-mathematics-number-and-operations-multiplication-division',
          ],
        },
      ],
      recentEvidence: [
        {
          moduleSlug: '5-mathematics-number-and-operations-fractions-concepts-equivalence',
          scorePct: 95,
          hintsUsed: 0,
          completedAt: '2026-04-01T00:00:00Z',
        },
        {
          moduleSlug: '5-mathematics-number-and-operations-fractions-concepts-equivalence',
          scorePct: 96,
          hintsUsed: 0,
          completedAt: '2026-04-02T00:00:00Z',
        },
      ],
    });

    expect(plan.subjects[0]?.action).toBe('challenge');
    expect(plan.blocks.some((block) => block.kind === 'reflection' && !block.required)).toBe(true);
    expect(plan.blocks.find((block) => block.kind === 'challenge')?.contentVariantId).toBe(
      '5-mathematics-number-and-operations-decimals-intro::challenge_task',
    );
    expect(plan.estimatedMinutes).toBe(42);
    expect(plan.requiredMinutes).toBe(35);
  });

  it('rotates to a due math strand after repeated mastery checks', () => {
    const plan = buildMathDailyPlan({
      mathMap,
      variantCatalog,
      completedModuleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
      strandStates: [
        {
          adaptiveStrand: 'place_value_operations',
          currentModuleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
          workingGrade: 3,
        },
      ],
      recentEvidence: [
        {
          moduleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
          scorePct: 90,
          completedAt: '2026-04-01T00:00:00Z',
        },
        {
          moduleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
          scorePct: 92,
          completedAt: '2026-04-02T00:00:00Z',
        },
      ],
    });

    expect(plan.subjects[0]?.targetStrand).toBe('expressions_equations_functions');
    expect(plan.subjects[0]?.rotationReason).toBe('strong_mastery_due_strand');
    expect(plan.subjects[0]?.primaryModuleSlug).toBe(
      '3-mathematics-depth-and-application-patterns-and-rules',
    );
    expect(plan.parentNotes[0]).toContain('rotating');
  });

  it('uses recent rotation history to choose a different due strand', () => {
    const plan = buildMathDailyPlan({
      mathMap,
      variantCatalog,
      completedModuleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
      strandStates: [
        {
          adaptiveStrand: 'place_value_operations',
          currentModuleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
          workingGrade: 3,
        },
      ],
      recentEvidence: [
        {
          moduleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
          scorePct: 90,
          completedAt: '2026-04-01T00:00:00Z',
        },
        {
          moduleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
          scorePct: 92,
          completedAt: '2026-04-02T00:00:00Z',
        },
      ],
      rotationHistory: [
        {
          date: '2026-04-02',
          targetStrand: 'expressions_equations_functions',
          assignedModuleSlug: '3-mathematics-depth-and-application-patterns-and-rules',
          rotationReason: 'strong_mastery_due_strand',
        },
      ],
    });

    expect(plan.subjects[0]?.targetStrand).toBe('geometry_measurement');
    expect(plan.subjects[0]?.primaryModuleSlug).toBe(
      '3-mathematics-geometry-and-measurement-angles-and-lines',
    );
  });

  it('uses a parent preferred strand when no weak repair is waiting', () => {
    const plan = buildMathDailyPlan({
      mathMap,
      variantCatalog,
      preferredStrand: 'geometry_measurement',
      strandStates: [
        {
          adaptiveStrand: 'place_value_operations',
          currentModuleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
          workingGrade: 3,
        },
      ],
      recentEvidence: [
        {
          moduleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
          scorePct: 74,
          completedAt: '2026-04-02T00:00:00Z',
        },
      ],
    });

    expect(plan.subjects[0]?.targetStrand).toBe('geometry_measurement');
    expect(plan.subjects[0]?.preferredStrand).toBe('geometry_measurement');
    expect(plan.subjects[0]?.parentPreferenceActive).toBe(true);
    expect(plan.subjects[0]?.rotationReason).toBe('parent_preferred_strand');
    expect(plan.subjects[0]?.primaryModuleSlug).toBe(
      '3-mathematics-geometry-and-measurement-angles-and-lines',
    );
  });
});
