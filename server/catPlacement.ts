const MIN_PLACEMENT_LEVEL = 0;
const MAX_PLACEMENT_LEVEL = 8;
const DEFAULT_MIN_ITEMS = 8;
const DEFAULT_MAX_ITEMS = 12;
const MAX_STANDARD_GAPS = 4;

export const CAT_V2_ENGINE_VERSION = 'cat_v2';
export const CAT_V2_DIAGNOSTIC_TYPE = 'cat_v2';

export type CatPlacementPhase = 'wide_bracket' | 'narrow' | 'confirm';

export type CatPlacementQuestion = {
  id: string;
  bankQuestionId: number;
  difficulty: number;
  strand: string | null;
  targetStandards: string[];
  metadata?: Record<string, unknown> | null;
};

export type CatPlacementResponse = {
  bankQuestionId: number;
  isCorrect: boolean;
};

export type CatPlacementRouteEntry = {
  bankQuestionId: number;
  servedLevel: number;
  targetLevel: number;
  difficulty: number;
  phase: CatPlacementPhase;
  adaptationReason: string;
  coverageFallbackUsed: boolean;
  fallbackDistance: number;
  strand: string | null;
  targetStandards: string[];
  prerequisiteStandardCodes: string[];
  isCorrect: boolean;
};

export type CatPlacementGap = {
  standardCode: string;
  strand: string | null;
  observedLevel: number;
  evidenceCount: number;
  confidence: number;
};

export type CatPlacementSummary = {
  priorLevelHint: number;
  currentEstimate: number;
  workingLevel: number;
  confidenceLow: number;
  confidenceHigh: number;
  diagnosticConfidence: number;
  phase: CatPlacementPhase;
  lowConfidence: boolean;
  coverageFallbackUsed: boolean;
  terminationReason: string | null;
  itemRoute: CatPlacementRouteEntry[];
  prerequisiteGaps: CatPlacementGap[];
  weakStandardCodes: string[];
  testedLevels: Array<{ level: number; correct: number; total: number; accuracyPct: number }>;
  nextItem: CatPlacementQuestion | null;
  nextItemReason: string | null;
};

type NormalizedCatItem = CatPlacementQuestion & {
  placementLevel: number;
  prerequisiteStandardCodes: string[];
};

type GapCandidate = {
  standardCode: string;
  strand: string | null;
  observedLevel: number;
  missCount: number;
  total: number;
};

const clampLevel = (value: number): number =>
  Math.max(MIN_PLACEMENT_LEVEL, Math.min(MAX_PLACEMENT_LEVEL, value));

const clampEstimate = (value: number): number =>
  Math.max(MIN_PLACEMENT_LEVEL, Math.min(MAX_PLACEMENT_LEVEL, Number(value.toFixed(2))));

const roundLevel = (value: number): number => clampLevel(Math.round(value));

const readPlacementLevel = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return roundLevel(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) {
      return roundLevel(parsed);
    }
  }
  return null;
};

const readStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
};

const normalizeItem = (question: CatPlacementQuestion): NormalizedCatItem | null => {
  const placementLevel =
    readPlacementLevel(question.metadata?.placement_level) ??
    readPlacementLevel(question.metadata?.placementLevel) ??
    readPlacementLevel(question.metadata?.target_level);
  if (placementLevel == null) {
    return null;
  }

  return {
    ...question,
    difficulty: Number.isFinite(question.difficulty) ? Math.max(1, Math.round(question.difficulty)) : 2,
    placementLevel,
    prerequisiteStandardCodes: readStringList(question.metadata?.prerequisite_standard_codes),
  };
};

const normalizePool = (pool: CatPlacementQuestion[]): NormalizedCatItem[] => {
  const deduped = new Map<number, NormalizedCatItem>();
  pool.forEach((question) => {
    const normalized = normalizeItem(question);
    if (normalized) {
      deduped.set(normalized.bankQuestionId, normalized);
    }
  });
  return Array.from(deduped.values()).sort((a, b) => {
    if (a.placementLevel !== b.placementLevel) return a.placementLevel - b.placementLevel;
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return a.bankQuestionId - b.bankQuestionId;
  });
};

const phaseForItemCount = (count: number): CatPlacementPhase => {
  if (count < 3) return 'wide_bracket';
  if (count < 8) return 'narrow';
  return 'confirm';
};

const highestCorrectLevel = (route: CatPlacementRouteEntry[]): number | null => {
  const levels = route.filter((entry) => entry.isCorrect).map((entry) => entry.servedLevel);
  return levels.length ? Math.max(...levels) : null;
};

const lowestIncorrectLevel = (route: CatPlacementRouteEntry[]): number | null => {
  const levels = route.filter((entry) => !entry.isCorrect).map((entry) => entry.servedLevel);
  return levels.length ? Math.min(...levels) : null;
};

const boundaryIncorrectLevel = (route: CatPlacementRouteEntry[]): number | null => {
  const highestCorrect = highestCorrectLevel(route);
  const levels = route
    .filter((entry) => !entry.isCorrect)
    .map((entry) => entry.servedLevel)
    .filter((level) => highestCorrect == null || level >= highestCorrect);
  if (levels.length) {
    return Math.min(...levels);
  }
  return lowestIncorrectLevel(route);
};

const buildLevelStats = (route: CatPlacementRouteEntry[]): Array<{ level: number; correct: number; total: number; accuracyPct: number }> => {
  const buckets = new Map<number, { correct: number; total: number }>();
  route.forEach((entry) => {
    const bucket = buckets.get(entry.servedLevel) ?? { correct: 0, total: 0 };
    if (entry.isCorrect) bucket.correct += 1;
    bucket.total += 1;
    buckets.set(entry.servedLevel, bucket);
  });
  return Array.from(buckets.entries())
    .map(([level, stats]) => ({
      level,
      correct: stats.correct,
      total: stats.total,
      accuracyPct: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    }))
    .sort((a, b) => a.level - b.level);
};

const computeEstimate = (priorLevelHint: number, route: CatPlacementRouteEntry[]): number => {
  let estimate = priorLevelHint;
  route.forEach((entry) => {
    const phaseStep = entry.phase === 'wide_bracket' ? 1.2 : entry.phase === 'narrow' ? 0.7 : 0.4;
    const distance = Math.abs(entry.servedLevel - estimate);
    const multiplier = 1 + Math.min(1, distance * 0.2);
    const direction = entry.isCorrect ? 1 : -1;
    estimate = clampEstimate(estimate + direction * phaseStep * multiplier);
  });
  return estimate;
};

const computeConfidenceWindow = (priorLevelHint: number, route: CatPlacementRouteEntry[]) => {
  const estimate = computeEstimate(priorLevelHint, route);
  const highestCorrect = highestCorrectLevel(route);
  const lowestIncorrect = boundaryIncorrectLevel(route);
  const fallbackCount = route.filter((entry) => entry.coverageFallbackUsed).length;
  const exactMatchCount = route.length - fallbackCount;
  const baseWidth = Math.max(0.9, 4.2 - route.length * 0.35);
  let width = baseWidth + fallbackCount * 0.35;

  if (highestCorrect != null && lowestIncorrect != null && lowestIncorrect >= highestCorrect) {
    width = Math.min(width, Math.max(0.9, lowestIncorrect - highestCorrect + 0.35));
  }

  const positive = route.filter((entry) => entry.isCorrect).length;
  const negative = route.length - positive;
  if (route.length > 0 && Math.abs(positive - negative) <= 1) {
    width += 0.25;
  }

  if (exactMatchCount < Math.ceil(route.length / 2)) {
    width += 0.35;
  }

  const confidenceLow = clampEstimate(estimate - width / 2);
  const confidenceHigh = clampEstimate(estimate + width / 2);
  const diagnosticConfidence = Math.max(0.3, Math.min(0.92, Number((1 - width / 5.5).toFixed(2))));

  return {
    currentEstimate: estimate,
    confidenceLow,
    confidenceHigh,
    diagnosticConfidence,
    lowConfidence: fallbackCount >= 2 || route.some((entry) => entry.fallbackDistance > 1),
    coverageFallbackUsed: fallbackCount > 0,
  };
};

const computeWorkingLevel = (
  priorLevelHint: number,
  route: CatPlacementRouteEntry[],
  testedLevels: Array<{ level: number; correct: number; total: number; accuracyPct: number }>,
): number => {
  const window = computeConfidenceWindow(priorLevelHint, route);
  const highestCorrect = highestCorrectLevel(route);
  const lowestIncorrect = boundaryIncorrectLevel(route);
  const passingLevels = testedLevels.filter((entry) => entry.total >= 1 && entry.accuracyPct >= 67);

  if (lowestIncorrect != null) {
    const bounded = clampLevel(lowestIncorrect - 1);
    if (highestCorrect != null) {
      return Math.max(highestCorrect, bounded);
    }
    return bounded;
  }

  if (passingLevels.length) {
    return passingLevels.at(-1)?.level ?? roundLevel(window.currentEstimate);
  }

  if (highestCorrect != null) {
    return highestCorrect;
  }

  return clampLevel(Math.floor(window.currentEstimate));
};

const computeGapCandidates = (
  workingLevel: number,
  route: CatPlacementRouteEntry[],
): GapCandidate[] => {
  const standards = new Map<string, GapCandidate>();

  route.forEach((entry) => {
    if (entry.isCorrect) return;
    if (entry.servedLevel > workingLevel) return;

    const codes = entry.prerequisiteStandardCodes.length ? entry.prerequisiteStandardCodes : entry.targetStandards;
    codes.forEach((standardCode) => {
      const current = standards.get(standardCode) ?? {
        standardCode,
        strand: entry.strand,
        observedLevel: entry.servedLevel,
        missCount: 0,
        total: 0,
      };
      current.missCount += 1;
      current.total += 1;
      current.observedLevel = Math.min(current.observedLevel, entry.servedLevel);
      standards.set(standardCode, current);
    });
  });

  return Array.from(standards.values())
    .sort((a, b) => {
      if (b.missCount !== a.missCount) return b.missCount - a.missCount;
      if (a.observedLevel !== b.observedLevel) return a.observedLevel - b.observedLevel;
      return a.standardCode.localeCompare(b.standardCode);
    })
    .slice(0, MAX_STANDARD_GAPS);
};

const buildPrerequisiteGaps = (workingLevel: number, route: CatPlacementRouteEntry[]): CatPlacementGap[] =>
  computeGapCandidates(workingLevel, route).map((gap) => ({
    standardCode: gap.standardCode,
    strand: gap.strand,
    observedLevel: gap.observedLevel,
    evidenceCount: gap.missCount,
    confidence: Number(Math.min(0.85, 0.4 + gap.missCount * 0.15).toFixed(2)),
  }));

const determineTargetLevel = (priorLevelHint: number, route: CatPlacementRouteEntry[]): { phase: CatPlacementPhase; targetLevel: number; reason: string } => {
  const phase = phaseForItemCount(route.length);
  const estimate = computeEstimate(priorLevelHint, route);
  const highestCorrect = highestCorrectLevel(route);
  const lowestIncorrect = boundaryIncorrectLevel(route);
  const last = route.at(-1) ?? null;

  if (phase === 'wide_bracket') {
    if (!last) {
      return { phase, targetLevel: roundLevel(priorLevelHint), reason: 'seed_prior_probe' };
    }

    if (route.length === 1) {
      return {
        phase,
        targetLevel: clampLevel(last.servedLevel + (last.isCorrect ? 2 : -2)),
        reason: last.isCorrect ? 'step_up_aggressively' : 'step_down_aggressively',
      };
    }

    if (highestCorrect != null && lowestIncorrect != null && highestCorrect < lowestIncorrect) {
      return {
        phase,
        targetLevel: roundLevel((highestCorrect + lowestIncorrect) / 2),
        reason: 'bracket_midpoint_probe',
      };
    }

    const servedLevels = route.map((entry) => entry.servedLevel);
    const boundary = last.isCorrect ? Math.max(...servedLevels) + 1 : Math.min(...servedLevels) - 1;
    return {
      phase,
      targetLevel: clampLevel(boundary),
      reason: last.isCorrect ? 'continue_step_up' : 'continue_step_down',
    };
  }

  if (phase === 'narrow') {
    if (highestCorrect != null && lowestIncorrect != null && highestCorrect < lowestIncorrect - 1) {
      return {
        phase,
        targetLevel: roundLevel((highestCorrect + lowestIncorrect) / 2),
        reason: 'narrow_bracket_midpoint',
      };
    }
    return {
      phase,
      targetLevel: roundLevel(estimate),
      reason: 'narrow_current_estimate',
    };
  }

  const workingLevel = computeWorkingLevel(priorLevelHint, route, buildLevelStats(route));
  const gapCandidates = computeGapCandidates(workingLevel, route);
  const confirmLowerProbeSeen = route.some((entry) => entry.phase === 'confirm' && entry.servedLevel < workingLevel);
  if (!confirmLowerProbeSeen && workingLevel > MIN_PLACEMENT_LEVEL) {
    return {
      phase,
      targetLevel: clampLevel(workingLevel - 1),
      reason: 'probe_prerequisite_dependency',
    };
  }

  if (gapCandidates.length) {
    const lowestGapLevel = Math.max(MIN_PLACEMENT_LEVEL, gapCandidates[0]?.observedLevel ?? workingLevel - 1);
    return {
      phase,
      targetLevel: lowestGapLevel,
      reason: 'confirm_prerequisite_gap',
    };
  }

  if (highestCorrect != null && lowestIncorrect != null && highestCorrect < lowestIncorrect) {
    return {
      phase,
      targetLevel: highestCorrect,
      reason: 'confirm_boundary',
    };
  }

  return {
    phase,
    targetLevel: workingLevel,
    reason: 'confirm_working_level',
  };
};

const scoreCandidate = (
  item: NormalizedCatItem,
  params: {
    targetLevel: number;
    phase: CatPlacementPhase;
    reason: string;
    route: CatPlacementRouteEntry[];
  },
): number => {
  const levelDistance = Math.abs(item.placementLevel - params.targetLevel);
  const easierTieBias = item.placementLevel > params.targetLevel ? 0.15 : 0;
  const lastStrands = params.route.slice(-2).map((entry) => entry.strand).filter((strand): strand is string => Boolean(strand));
  const sameRecentStrandPenalty = item.strand && lastStrands.every((strand) => strand === item.strand) ? 0.4 : 0;
  const seenStandards = new Set(params.route.flatMap((entry) => entry.targetStandards));
  const allStandardsSeen = item.targetStandards.length > 0 && item.targetStandards.every((code) => seenStandards.has(code));
  const standardReusePenalty = allStandardsSeen ? 0.25 : 0;

  let difficultyPenalty = 0;
  if (params.phase === 'wide_bracket') {
    difficultyPenalty = Math.abs(item.difficulty - 2.5) * 0.2;
  } else if (params.phase === 'narrow') {
    difficultyPenalty = Math.abs(item.difficulty - 2) * 0.15;
  } else if (params.reason === 'confirm_prerequisite_gap') {
    difficultyPenalty = Math.abs(item.difficulty - 1.5) * 0.2;
  } else {
    difficultyPenalty = Math.abs(item.difficulty - 2) * 0.1;
  }

  const gapMatchBonus =
    params.reason === 'confirm_prerequisite_gap' &&
    params.route.some(
      (entry) =>
        !entry.isCorrect &&
        (entry.targetStandards.some((code) => item.targetStandards.includes(code)) ||
          entry.prerequisiteStandardCodes.some((code) => item.targetStandards.includes(code))),
    )
      ? -0.35
      : 0;

  return levelDistance + easierTieBias + sameRecentStrandPenalty + standardReusePenalty + difficultyPenalty + gapMatchBonus;
};

export const selectNextCatPlacementItem = (params: {
  itemPool: CatPlacementQuestion[];
  priorLevelHint: number;
  itemRoute: CatPlacementRouteEntry[];
}): {
  item: CatPlacementQuestion | null;
  targetLevel: number | null;
  phase: CatPlacementPhase;
  adaptationReason: string | null;
  coverageFallbackUsed: boolean;
  fallbackDistance: number;
} => {
  const normalizedPool = normalizePool(params.itemPool);
  const route = params.itemRoute;
  const { phase, targetLevel, reason } = determineTargetLevel(params.priorLevelHint, route);
  const usedIds = new Set(route.map((entry) => entry.bankQuestionId));
  const candidates = normalizedPool.filter((item) => !usedIds.has(item.bankQuestionId));

  if (!candidates.length) {
    return {
      item: null,
      targetLevel: null,
      phase,
      adaptationReason: null,
      coverageFallbackUsed: false,
      fallbackDistance: 0,
    };
  }

  const ranked = [...candidates].sort((a, b) => {
    const aScore = scoreCandidate(a, { targetLevel, phase, reason, route });
    const bScore = scoreCandidate(b, { targetLevel, phase, reason, route });
    if (aScore !== bScore) return aScore - bScore;
    if (a.placementLevel !== b.placementLevel) {
      const aDistance = Math.abs(a.placementLevel - targetLevel);
      const bDistance = Math.abs(b.placementLevel - targetLevel);
      if (aDistance === bDistance) return a.placementLevel - b.placementLevel;
      return aDistance - bDistance;
    }
    return a.bankQuestionId - b.bankQuestionId;
  });

  const chosen = ranked[0] ?? null;
  if (!chosen) {
    return {
      item: null,
      targetLevel: null,
      phase,
      adaptationReason: null,
      coverageFallbackUsed: false,
      fallbackDistance: 0,
    };
  }

  const fallbackDistance = Math.abs(chosen.placementLevel - targetLevel);
  return {
    item: {
      id: chosen.id,
      bankQuestionId: chosen.bankQuestionId,
      difficulty: chosen.difficulty,
      strand: chosen.strand,
      targetStandards: chosen.targetStandards,
      metadata: chosen.metadata ?? null,
    },
    targetLevel,
    phase,
    adaptationReason: reason,
    coverageFallbackUsed: fallbackDistance > 0,
    fallbackDistance,
  };
};

const applyResponseToRoute = (
  itemPool: CatPlacementQuestion[],
  priorLevelHint: number,
  route: CatPlacementRouteEntry[],
  response: CatPlacementResponse,
): CatPlacementRouteEntry | null => {
  const normalizedPool = normalizePool(itemPool);
  const itemById = new Map(normalizedPool.map((item) => [item.bankQuestionId, item]));
  const selection = selectNextCatPlacementItem({
    itemPool,
    priorLevelHint,
    itemRoute: route,
  });
  const item = itemById.get(response.bankQuestionId) ?? (selection.item ? itemById.get(selection.item.bankQuestionId) ?? null : null);
  if (!item) {
    return null;
  }

  return {
    bankQuestionId: item.bankQuestionId,
    servedLevel: item.placementLevel,
    targetLevel: selection.targetLevel ?? item.placementLevel,
    difficulty: item.difficulty,
    phase: selection.phase,
    adaptationReason:
      selection.item?.bankQuestionId === item.bankQuestionId
        ? selection.adaptationReason ?? 'route_applied'
        : 'external_route_override',
    coverageFallbackUsed:
      selection.item?.bankQuestionId === item.bankQuestionId
        ? selection.coverageFallbackUsed
        : Math.abs(item.placementLevel - (selection.targetLevel ?? item.placementLevel)) > 0,
    fallbackDistance: Math.abs(item.placementLevel - (selection.targetLevel ?? item.placementLevel)),
    strand: item.strand,
    targetStandards: item.targetStandards,
    prerequisiteStandardCodes: item.prerequisiteStandardCodes,
    isCorrect: response.isCorrect,
  };
};

export const buildCatPlacementSummary = (params: {
  itemPool: CatPlacementQuestion[];
  priorLevelHint: number;
  responses: CatPlacementResponse[];
  minItems?: number;
  maxItems?: number;
}): CatPlacementSummary => {
  const minItems = Math.max(1, Math.round(params.minItems ?? DEFAULT_MIN_ITEMS));
  const maxItems = Math.max(minItems, Math.round(params.maxItems ?? DEFAULT_MAX_ITEMS));
  const normalizedPool = normalizePool(params.itemPool);
  const priorLevelHint = clampLevel(params.priorLevelHint);
  const itemRoute: CatPlacementRouteEntry[] = [];

  params.responses.forEach((response) => {
    const entry = applyResponseToRoute(normalizedPool, priorLevelHint, itemRoute, response);
    if (entry) {
      itemRoute.push(entry);
    }
  });

  const testedLevels = buildLevelStats(itemRoute);
  const window = computeConfidenceWindow(priorLevelHint, itemRoute);
  const workingLevel = computeWorkingLevel(priorLevelHint, itemRoute, testedLevels);
  const prerequisiteGaps = buildPrerequisiteGaps(workingLevel, itemRoute);
  const weakStandardCodes = prerequisiteGaps.map((gap) => gap.standardCode);
  const nextSelection = selectNextCatPlacementItem({
    itemPool: normalizedPool,
    priorLevelHint,
    itemRoute,
  });
  const shouldStop =
    itemRoute.length >= maxItems ||
    (itemRoute.length >= minItems && window.confidenceHigh - window.confidenceLow <= 1.25);

  return {
    priorLevelHint,
    currentEstimate: window.currentEstimate,
    workingLevel,
    confidenceLow: window.confidenceLow,
    confidenceHigh: window.confidenceHigh,
    diagnosticConfidence: window.diagnosticConfidence,
    phase: phaseForItemCount(itemRoute.length),
    lowConfidence: window.lowConfidence,
    coverageFallbackUsed: window.coverageFallbackUsed,
    terminationReason:
      itemRoute.length >= maxItems
        ? 'max_items'
        : shouldStop
          ? 'confidence_converged'
          : null,
    itemRoute,
    prerequisiteGaps,
    weakStandardCodes,
    testedLevels,
    nextItem: shouldStop ? null : nextSelection.item,
    nextItemReason: shouldStop ? null : nextSelection.adaptationReason,
  };
};

export const isCatV2SubjectEligible = (subject: string | null | undefined): boolean => {
  const normalized = subject?.trim().toLowerCase();
  return normalized === 'math' || normalized === 'ela' || normalized === 'english';
};

export const isCatV2GradeBandEligible = (gradeBand: string | null | undefined): boolean => {
  if (!gradeBand?.trim().length) return false;
  const normalized = gradeBand.trim().toUpperCase();
  if (normalized === '3-5' || normalized === '6-8') return true;
  const numeric = Number.parseInt(normalized, 10);
  return Number.isFinite(numeric) && numeric >= 3 && numeric <= 8;
};
