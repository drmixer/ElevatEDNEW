import { describe, expect, it } from 'vitest';

import {
  buildCatPlacementSummary,
  isCatV2GradeBandEligible,
  isCatV2SubjectEligible,
  selectNextCatPlacementItem,
  type CatPlacementQuestion,
} from '../catPlacement.js';

const makeQuestion = (
  bankQuestionId: number,
  placementLevel: number,
  difficulty: number,
  standard: string,
  strand = `strand-${placementLevel}`,
): CatPlacementQuestion => ({
  id: `q-${bankQuestionId}`,
  bankQuestionId,
  difficulty,
  strand,
  targetStandards: [standard],
  metadata: {
    placement_level: placementLevel,
    prerequisite_standard_codes: placementLevel < 6 ? [standard] : [],
  },
});

const buildPool = (): CatPlacementQuestion[] => [
  makeQuestion(301, 3, 2, '3.NF.A.1', 'fractions'),
  makeQuestion(401, 4, 2, '4.NF.A.1', 'fractions'),
  makeQuestion(501, 5, 2, '5.NF.A.1', 'fractions'),
  makeQuestion(502, 5, 2, '5.NF.A.1', 'fractions'),
  makeQuestion(503, 5, 1, '5.NF.A.1', 'fractions'),
  makeQuestion(601, 6, 2, '6.EE.A.1', 'expressions'),
  makeQuestion(602, 6, 2, '6.EE.A.1', 'expressions'),
  makeQuestion(603, 6, 2, '6.EE.A.1', 'expressions'),
  makeQuestion(604, 6, 2, '6.EE.A.1', 'expressions'),
  makeQuestion(605, 6, 2, '6.EE.A.1', 'expressions'),
  makeQuestion(701, 7, 3, '7.RP.A.1', 'ratios'),
  makeQuestion(702, 7, 2, '7.RP.A.1', 'ratios'),
  makeQuestion(703, 7, 2, '7.RP.A.1', 'ratios'),
  makeQuestion(801, 8, 3, '8.F.A.1', 'functions'),
];

describe('catPlacement', () => {
  it('steps up, then brackets back to the midpoint during early routing', () => {
    const pool = buildPool();

    const initial = selectNextCatPlacementItem({
      itemPool: pool,
      priorLevelHint: 5,
      itemRoute: [],
    });
    expect(initial.targetLevel).toBe(5);
    expect(initial.item?.bankQuestionId).toBe(501);

    const afterOne = buildCatPlacementSummary({
      itemPool: pool,
      priorLevelHint: 5,
      responses: [{ bankQuestionId: 501, isCorrect: true }],
    });
    const second = selectNextCatPlacementItem({
      itemPool: pool,
      priorLevelHint: 5,
      itemRoute: afterOne.itemRoute,
    });
    expect(second.targetLevel).toBe(7);
    expect(second.item?.bankQuestionId).toBe(701);

    const afterTwo = buildCatPlacementSummary({
      itemPool: pool,
      priorLevelHint: 5,
      responses: [
        { bankQuestionId: 501, isCorrect: true },
        { bankQuestionId: 701, isCorrect: false },
      ],
    });
    const third = selectNextCatPlacementItem({
      itemPool: pool,
      priorLevelHint: 5,
      itemRoute: afterTwo.itemRoute,
    });
    expect(third.targetLevel).toBe(6);
    expect(third.item?.bankQuestionId).toBe(601);
  });

  it('prefers the nearer easier level when exact-level coverage is missing', () => {
    const pool = [
      makeQuestion(501, 5, 2, '5.NF.A.1', 'fractions'),
      makeQuestion(701, 7, 2, '7.RP.A.1', 'ratios'),
    ];

    const selection = selectNextCatPlacementItem({
      itemPool: pool,
      priorLevelHint: 6,
      itemRoute: [],
    });

    expect(selection.targetLevel).toBe(6);
    expect(selection.item?.bankQuestionId).toBe(501);
    expect(selection.coverageFallbackUsed).toBe(true);
    expect(selection.fallbackDistance).toBe(1);
  });

  it('keeps the overall working level stable while surfacing lower-level prerequisite gaps', () => {
    const summary = buildCatPlacementSummary({
      itemPool: buildPool(),
      priorLevelHint: 5,
      responses: [
        { bankQuestionId: 501, isCorrect: true },
        { bankQuestionId: 701, isCorrect: false },
        { bankQuestionId: 601, isCorrect: true },
        { bankQuestionId: 602, isCorrect: true },
        { bankQuestionId: 702, isCorrect: false },
        { bankQuestionId: 603, isCorrect: true },
        { bankQuestionId: 703, isCorrect: false },
        { bankQuestionId: 604, isCorrect: true },
        { bankQuestionId: 503, isCorrect: false },
        { bankQuestionId: 502, isCorrect: false },
      ],
    });

    expect(summary.workingLevel).toBe(6);
    expect(summary.confidenceLow).toBeLessThanOrEqual(6);
    expect(summary.confidenceHigh).toBeGreaterThanOrEqual(6);
    expect(summary.diagnosticConfidence).toBeGreaterThanOrEqual(0.7);
    expect(summary.lowConfidence).toBe(false);
    expect(summary.terminationReason).toBe('confidence_converged');
    expect(summary.prerequisiteGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          standardCode: '5.NF.A.1',
          observedLevel: 5,
        }),
      ]),
    );
    expect(summary.weakStandardCodes).toContain('5.NF.A.1');
    expect(summary.testedLevels.find((entry) => entry.level === 6)).toMatchObject({
      correct: 4,
      total: 4,
      accuracyPct: 100,
    });
  });

  it('flags CAT v2 eligibility only for the intended Phase 3 slice', () => {
    expect(isCatV2SubjectEligible('math')).toBe(true);
    expect(isCatV2SubjectEligible('english')).toBe(true);
    expect(isCatV2SubjectEligible('science')).toBe(false);

    expect(isCatV2GradeBandEligible('3')).toBe(true);
    expect(isCatV2GradeBandEligible('6-8')).toBe(true);
    expect(isCatV2GradeBandEligible('K-2')).toBe(false);
    expect(isCatV2GradeBandEligible('9-12')).toBe(false);
  });
});
