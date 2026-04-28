import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  chooseMathAssignment,
  chooseMathTargetStrand,
  type MathPrerequisiteMap,
} from '../../shared/mathAdaptivePolicy';

const loadMap = (): MathPrerequisiteMap => {
  const mapPath = path.resolve(process.cwd(), 'data/curriculum/math_3_8_prerequisite_map.json');
  return JSON.parse(fs.readFileSync(mapPath, 'utf8')) as MathPrerequisiteMap;
};

describe('mathAdaptivePolicy', () => {
  const map = loadMap();

  it('starts with a diagnostic root when there is no math evidence yet', () => {
    const decision = chooseMathAssignment({ map, targetStrand: 'place_value_operations' });

    expect(decision.action).toBe('diagnose');
    expect(decision.recommendedModuleSlug).toBe(
      '3-mathematics-number-and-operations-place-value-thousands-millions',
    );
    expect(decision.reasonCode).toBe('no_state_start_root');
  });

  it('backfills unmet prerequisites before assigning a later module', () => {
    const decision = chooseMathAssignment({
      map,
      completedModuleSlug: '6-mathematics-number-and-operations-ratios-and-proportional-reasoning',
      recentEvidence: [
        {
          moduleSlug: '6-mathematics-number-and-operations-ratios-and-proportional-reasoning',
          scorePct: 91,
        },
      ],
    });

    expect(decision.action).toBe('remediate');
    expect(decision.recommendedModuleSlug).toBe(
      '5-mathematics-number-and-operations-multiplication-division',
    );
    expect(decision.reasonCode).toBe('unmet_prerequisites');
    expect(decision.parentSummary).toContain('backfilling');
  });

  it('advances after two mastery checks when prerequisites are mastered', () => {
    const decision = chooseMathAssignment({
      map,
      completedModuleSlug: '6-mathematics-number-and-operations-ratios-and-proportional-reasoning',
      strandStates: [
        {
          adaptiveStrand: 'ratios_rates_percent',
          masteredModuleSlugs: [
            '5-mathematics-number-and-operations-fractions-concepts-equivalence',
            '5-mathematics-number-and-operations-decimals-intro',
            '5-mathematics-number-and-operations-multiplication-division',
          ],
        },
      ],
      recentEvidence: [
        {
          moduleSlug: '6-mathematics-number-and-operations-ratios-and-proportional-reasoning',
          scorePct: 87,
          completedAt: '2026-04-01T00:00:00Z',
        },
        {
          moduleSlug: '6-mathematics-number-and-operations-ratios-and-proportional-reasoning',
          scorePct: 89,
          completedAt: '2026-04-02T00:00:00Z',
        },
      ],
    });

    expect(decision.action).toBe('advance');
    expect(decision.recommendedModuleSlug).toBe(
      '6-mathematics-number-and-operations-percent-and-rates',
    );
    expect(decision.reasonCode).toBe('mastery_advance');
  });

  it('routes to a challenge after very strong repeated mastery', () => {
    const decision = chooseMathAssignment({
      map,
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

    expect(decision.action).toBe('challenge');
    expect(decision.recommendedModuleSlug).toBe(
      '5-mathematics-number-and-operations-decimals-intro',
    );
    expect(decision.reasonCode).toBe('strong_mastery_challenge');
  });

  it('repairs prerequisites after repeated low scores', () => {
    const decision = chooseMathAssignment({
      map,
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

    expect(decision.action).toBe('remediate');
    expect(decision.reasonCode).toBe('repeated_low_score');
    expect(decision.recommendedModuleSlug).toBe(
      '6-mathematics-number-and-operations-expressions-and-equations',
    );
  });

  it('rotates to a ready due strand after repeated mastery evidence', () => {
    const rotation = chooseMathTargetStrand({
      map,
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

    expect(rotation.targetStrand).toBe('expressions_equations_functions');
    expect(rotation.reasonCode).toBe('strong_mastery_due_strand');
  });

  it('prioritizes a weak strand before rotating to new content', () => {
    const rotation = chooseMathTargetStrand({
      map,
      completedModuleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
      strandStates: [
        {
          adaptiveStrand: 'place_value_operations',
          workingGrade: 3,
        },
        {
          adaptiveStrand: 'geometry_measurement',
          currentModuleSlug: '3-mathematics-geometry-and-measurement-angles-and-lines',
          workingGrade: 3,
          weakModuleSlugs: ['3-mathematics-geometry-and-measurement-angles-and-lines'],
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

    expect(rotation.targetStrand).toBe('geometry_measurement');
    expect(rotation.reasonCode).toBe('weak_strand_repair');
  });

  it('uses recent rotation history to avoid repeating a due strand', () => {
    const rotation = chooseMathTargetStrand({
      map,
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

    expect(rotation.targetStrand).toBe('geometry_measurement');
    expect(rotation.reasonCode).toBe('strong_mastery_due_strand');
  });

  it('uses a parent preferred strand when no weak repair is waiting', () => {
    const rotation = chooseMathTargetStrand({
      map,
      preferredStrand: 'geometry_measurement',
      strandStates: [
        {
          adaptiveStrand: 'place_value_operations',
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

    expect(rotation.targetStrand).toBe('geometry_measurement');
    expect(rotation.reasonCode).toBe('parent_preferred_strand');
  });

  it('lets weak repair override a parent preferred strand', () => {
    const rotation = chooseMathTargetStrand({
      map,
      preferredStrand: 'geometry_measurement',
      strandStates: [
        {
          adaptiveStrand: 'fractions_decimals',
          currentModuleSlug: '3-mathematics-number-and-operations-fractions-concepts-equivalence',
          workingGrade: 3,
          weakModuleSlugs: ['3-mathematics-number-and-operations-fractions-concepts-equivalence'],
        },
      ],
      recentEvidence: [
        {
          moduleSlug: '3-mathematics-number-and-operations-place-value-thousands-millions',
          scorePct: 92,
          completedAt: '2026-04-02T00:00:00Z',
        },
      ],
    });

    expect(rotation.targetStrand).toBe('fractions_decimals');
    expect(rotation.reasonCode).toBe('weak_strand_repair');
  });
});
