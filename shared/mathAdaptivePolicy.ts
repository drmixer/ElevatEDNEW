export type MathAdaptiveStrand =
  | 'place_value_operations'
  | 'fractions_decimals'
  | 'ratios_rates_percent'
  | 'expressions_equations_functions'
  | 'geometry_measurement'
  | 'data_probability_statistics'
  | 'problem_solving_modeling';

export const MATH_MASTERY_SCORE_THRESHOLD = 85;
export const MATH_WEAK_SCORE_THRESHOLD = 70;
export const MATH_REPEATED_LOW_SCORE_THRESHOLD = 60;

export type MathMapEntry = {
  slug: string;
  grade: number;
  title: string;
  source_strand: string;
  adaptive_strand: MathAdaptiveStrand;
  concept: string;
  sequence_order: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimated_time_minutes: number;
  prerequisites: string[];
  diagnostic_tags: string[];
  mastery_evidence: string[];
  remediation_targets: string[];
  challenge_targets: string[];
};

export type MathPrerequisiteMap = {
  version: number;
  modules: MathMapEntry[];
};

export type MathEvidence = {
  moduleSlug: string;
  scorePct: number;
  completedAt?: string;
  hintsUsed?: number;
  timeOnTaskMinutes?: number;
};

export type MathStrandState = {
  adaptiveStrand: MathAdaptiveStrand;
  currentModuleSlug?: string;
  workingGrade?: number;
  confidence?: number;
  masteredModuleSlugs?: string[];
  weakModuleSlugs?: string[];
};

export type MathAssignmentInput = {
  map: MathPrerequisiteMap;
  targetStrand?: MathAdaptiveStrand;
  preferredStrand?: MathAdaptiveStrand;
  strandStates?: MathStrandState[];
  recentEvidence?: MathEvidence[];
  rotationHistory?: MathRotationHistoryEntry[];
  completedModuleSlug?: string;
};

export type MathStrandRotationReason =
  | 'explicit_target_strand'
  | 'parent_preferred_strand'
  | 'weak_strand_repair'
  | 'strong_mastery_due_strand'
  | 'continue_current_strand'
  | 'default_foundation_strand';

export type MathStrandRotationDecision = {
  targetStrand: MathAdaptiveStrand;
  reasonCode: MathStrandRotationReason;
  parentSummary: string;
};

export type MathRotationHistoryEntry = {
  date: string;
  targetStrand: MathAdaptiveStrand;
  assignedModuleSlug: string;
  rotationReason: MathStrandRotationReason;
  completedModuleSlug?: string;
  score?: number;
  outcome?: 'mastered' | 'practice' | 'weak';
  parentSummary?: string;
};

export type MathAssignmentAction =
  | 'diagnose'
  | 'continue'
  | 'advance'
  | 'reinforce'
  | 'remediate'
  | 'challenge';

export type MathAssignmentDecision = {
  action: MathAssignmentAction;
  recommendedModuleSlug: string;
  sourceModuleSlug?: string;
  supportingModuleSlugs: string[];
  reasonCode:
    | 'no_state_start_root'
    | 'start_strand_ready_module'
    | 'unmet_prerequisites'
    | 'repeated_low_score'
    | 'partial_score_repair'
    | 'single_low_score_retry'
    | 'steady_continue'
    | 'mastery_advance'
    | 'strong_mastery_challenge'
    | 'weak_state_repair';
  parentSummary: string;
  studentSummary: string;
};

type EvidenceSummary = {
  moduleSlug: string;
  latestScore: number;
  recentScores: number[];
  strongCount: number;
  lowCount: number;
  averageScore: number;
  lowHintUse: boolean;
};

const DEFAULT_TARGET_STRAND: MathAdaptiveStrand = 'place_value_operations';
const STRAND_ROTATION_ORDER: MathAdaptiveStrand[] = [
  'place_value_operations',
  'fractions_decimals',
  'ratios_rates_percent',
  'expressions_equations_functions',
  'geometry_measurement',
  'data_probability_statistics',
  'problem_solving_modeling',
];

const bySequence = (a: MathMapEntry, b: MathMapEntry): number =>
  a.sequence_order - b.sequence_order || a.slug.localeCompare(b.slug);

const strandPriority = (strand: MathAdaptiveStrand): number => {
  const index = STRAND_ROTATION_ORDER.indexOf(strand);
  return index >= 0 ? index : STRAND_ROTATION_ORDER.length;
};

const clampScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

const normalizeEvidence = (evidence: MathEvidence[]): MathEvidence[] =>
  evidence
    .filter((item) => item.moduleSlug.trim().length > 0 && Number.isFinite(item.scorePct))
    .map((item) => ({ ...item, scorePct: clampScore(item.scorePct) }))
    .sort((a, b) => {
      const aTime = Date.parse(a.completedAt ?? '');
      const bTime = Date.parse(b.completedAt ?? '');
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
      return 0;
    });

const summarizeEvidence = (moduleSlug: string, evidence: MathEvidence[]): EvidenceSummary | null => {
  const rows = normalizeEvidence(evidence).filter((item) => item.moduleSlug === moduleSlug).slice(-4);
  if (rows.length === 0) return null;
  const recentScores = rows.map((item) => item.scorePct);
  const lastTwo = recentScores.slice(-2);
  const latestScore = recentScores[recentScores.length - 1] ?? 0;
  const averageScore = Math.round(recentScores.reduce((total, score) => total + score, 0) / recentScores.length);
  const recentHints = rows.slice(-2).reduce((total, item) => total + (item.hintsUsed ?? 0), 0);

  return {
    moduleSlug,
    latestScore,
    recentScores,
    strongCount: lastTwo.filter((score) => score >= MATH_MASTERY_SCORE_THRESHOLD).length,
    lowCount: lastTwo.filter((score) => score < MATH_REPEATED_LOW_SCORE_THRESHOLD).length,
    averageScore,
    lowHintUse: recentHints <= 1,
  };
};

const buildLookup = (map: MathPrerequisiteMap): Map<string, MathMapEntry> =>
  new Map(map.modules.map((entry) => [entry.slug, entry] as const));

const getMasteredSlugs = (states: MathStrandState[], evidence: MathEvidence[]): Set<string> => {
  const mastered = new Set<string>();
  for (const state of states) {
    for (const slug of state.masteredModuleSlugs ?? []) mastered.add(slug);
  }

  const bySlug = new Map<string, MathEvidence[]>();
  for (const item of normalizeEvidence(evidence)) {
    const rows = bySlug.get(item.moduleSlug) ?? [];
    rows.push(item);
    bySlug.set(item.moduleSlug, rows);
  }

  for (const [slug, rows] of bySlug) {
    const lastTwo = rows.slice(-2);
    if (lastTwo.length >= 2 && lastTwo.every((item) => item.scorePct >= MATH_MASTERY_SCORE_THRESHOLD)) {
      mastered.add(slug);
    }
  }

  return mastered;
};

const prerequisitesMet = (entry: MathMapEntry, masteredSlugs: Set<string>): boolean =>
  entry.prerequisites.every((slug) => masteredSlugs.has(slug));

const firstUnmasteredPrerequisite = (
  entry: MathMapEntry,
  masteredSlugs: Set<string>,
  lookup: Map<string, MathMapEntry>,
): MathMapEntry | null => {
  const missing = entry.prerequisites
    .filter((slug) => !masteredSlugs.has(slug))
    .map((slug) => lookup.get(slug))
    .filter((candidate): candidate is MathMapEntry => Boolean(candidate))
    .sort(bySequence);

  return missing[0] ?? null;
};

const findEarliestReadyModule = (
  map: MathPrerequisiteMap,
  masteredSlugs: Set<string>,
  targetStrand: MathAdaptiveStrand,
): MathMapEntry | null =>
  map.modules
    .filter((entry) => entry.adaptive_strand === targetStrand && !masteredSlugs.has(entry.slug))
    .filter((entry) => prerequisitesMet(entry, masteredSlugs))
    .sort(bySequence)[0] ?? null;

const latestEvidenceForStrand = (
  strand: MathAdaptiveStrand,
  evidence: MathEvidence[],
  lookup: Map<string, MathMapEntry>,
): MathEvidence | null => {
  const rows = normalizeEvidence(evidence).filter((item) => lookup.get(item.moduleSlug)?.adaptive_strand === strand);
  return rows[rows.length - 1] ?? null;
};

const latestHistoryForStrand = (
  strand: MathAdaptiveStrand,
  history: MathRotationHistoryEntry[],
): MathRotationHistoryEntry | null => {
  const rows = history
    .filter((item) => item.targetStrand === strand)
    .sort((a, b) => {
      const aTime = Date.parse(a.date);
      const bTime = Date.parse(b.date);
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
      return 0;
    });
  return rows[rows.length - 1] ?? null;
};

const evidenceTime = (item: MathEvidence | null): number => {
  const time = Date.parse(item?.completedAt ?? '');
  return Number.isFinite(time) ? time : 0;
};

const historyTime = (item: MathRotationHistoryEntry | null): number => {
  const time = Date.parse(item?.date ?? '');
  return Number.isFinite(time) ? time : 0;
};

const latestStrandActivityTime = (
  strand: MathAdaptiveStrand,
  evidence: MathEvidence[],
  history: MathRotationHistoryEntry[],
  lookup: Map<string, MathMapEntry>,
): number =>
  Math.max(
    evidenceTime(latestEvidenceForStrand(strand, evidence, lookup)),
    historyTime(latestHistoryForStrand(strand, history)),
  );

const findNextReadyModule = (
  map: MathPrerequisiteMap,
  source: MathMapEntry,
  masteredSlugs: Set<string>,
): MathMapEntry | null =>
  map.modules
    .filter((entry) => entry.adaptive_strand === source.adaptive_strand)
    .filter((entry) => entry.sequence_order > source.sequence_order)
    .filter((entry) => !masteredSlugs.has(entry.slug))
    .filter((entry) => prerequisitesMet(entry, masteredSlugs))
    .sort(bySequence)[0] ?? null;

const findChallengeModule = (
  source: MathMapEntry,
  lookup: Map<string, MathMapEntry>,
  masteredSlugs: Set<string>,
): MathMapEntry | null =>
  source.challenge_targets
    .map((slug) => lookup.get(slug))
    .filter((entry): entry is MathMapEntry => Boolean(entry))
    .filter((entry) => !masteredSlugs.has(entry.slug))
    .filter((entry) => prerequisitesMet(entry, new Set([...masteredSlugs, source.slug])))
    .sort(bySequence)[0] ?? null;

const pickCurrentEntry = (
  map: MathPrerequisiteMap,
  input: MathAssignmentInput,
  lookup: Map<string, MathMapEntry>,
): MathMapEntry | null => {
  const explicitSlug = input.completedModuleSlug;
  const explicitEntry = explicitSlug ? lookup.get(explicitSlug) ?? null : null;
  if (!input.targetStrand && explicitEntry) return explicitEntry;
  if (input.targetStrand && explicitEntry?.adaptive_strand === input.targetStrand) return explicitEntry;

  if (input.targetStrand) {
    const targetState = input.strandStates?.find((candidate) => candidate.adaptiveStrand === input.targetStrand);
    if (targetState?.currentModuleSlug) return lookup.get(targetState.currentModuleSlug) ?? null;

    const latestTargetEvidence = latestEvidenceForStrand(input.targetStrand, input.recentEvidence ?? [], lookup);
    if (latestTargetEvidence) return lookup.get(latestTargetEvidence.moduleSlug) ?? null;

    return null;
  }

  const evidence = normalizeEvidence(input.recentEvidence ?? []);
  const latestEvidence = evidence[evidence.length - 1];
  if (latestEvidence) {
    const entry = lookup.get(latestEvidence.moduleSlug);
    if (entry) return entry;
  }

  const targetStrand = input.targetStrand ?? DEFAULT_TARGET_STRAND;
  const state = input.strandStates?.find((candidate) => candidate.adaptiveStrand === targetStrand);
  if (state?.currentModuleSlug) return lookup.get(state.currentModuleSlug) ?? null;

  return null;
};

const formatTitle = (entry: MathMapEntry): string => `grade ${entry.grade} ${entry.title}`;

const decision = (details: MathAssignmentDecision): MathAssignmentDecision => details;

export const chooseMathTargetStrand = (input: MathAssignmentInput): MathStrandRotationDecision => {
  const lookup = buildLookup(input.map);
  const states = input.strandStates ?? [];
  const evidence = normalizeEvidence(input.recentEvidence ?? []);
  const rotationHistory = input.rotationHistory ?? [];
  const masteredSlugs = getMasteredSlugs(states, evidence);
  const latestEvidence = evidence[evidence.length - 1] ?? null;
  const latestEntry = latestEvidence ? lookup.get(latestEvidence.moduleSlug) ?? null : null;
  const currentEntry = pickCurrentEntry(input.map, { ...input, targetStrand: undefined }, lookup);
  const currentStrand = currentEntry?.adaptive_strand ?? latestEntry?.adaptive_strand ?? states[0]?.adaptiveStrand ?? DEFAULT_TARGET_STRAND;

  if (input.targetStrand) {
    return {
      targetStrand: input.targetStrand,
      reasonCode: 'explicit_target_strand',
      parentSummary: `Math is using the requested ${input.targetStrand.replaceAll('_', ' ')} strand.`,
    };
  }

  const weakState = states
    .filter((state) => state.weakModuleSlugs?.some((slug) => lookup.has(slug) && !masteredSlugs.has(slug)))
    .sort((a, b) => {
      const aTime = latestStrandActivityTime(a.adaptiveStrand, evidence, rotationHistory, lookup);
      const bTime = latestStrandActivityTime(b.adaptiveStrand, evidence, rotationHistory, lookup);
      return aTime - bTime || strandPriority(a.adaptiveStrand) - strandPriority(b.adaptiveStrand);
    })[0];

  if (weakState) {
    return {
      targetStrand: weakState.adaptiveStrand,
      reasonCode: 'weak_strand_repair',
      parentSummary: `Math is prioritizing ${weakState.adaptiveStrand.replaceAll('_', ' ')} because it has a weak area marked for repair.`,
    };
  }

  if (input.preferredStrand) {
    const preferredState = states.find((state) => state.adaptiveStrand === input.preferredStrand);
    const preferredEvidence = latestEvidenceForStrand(input.preferredStrand, evidence, lookup);
    const preferredReady = findEarliestReadyModule(input.map, masteredSlugs, input.preferredStrand);
    if (preferredState?.currentModuleSlug || preferredEvidence || preferredReady) {
      return {
        targetStrand: input.preferredStrand,
        reasonCode: 'parent_preferred_strand',
        parentSummary: `Math is prioritizing ${input.preferredStrand.replaceAll('_', ' ')} because it is the parent-selected weekly focus.`,
      };
    }
  }

  if (!latestEntry) {
    return {
      targetStrand: currentStrand,
      reasonCode: currentEntry ? 'continue_current_strand' : 'default_foundation_strand',
      parentSummary: currentEntry
        ? `Math is continuing ${currentStrand.replaceAll('_', ' ')} until there is score evidence for rotation.`
        : 'Math is starting with the foundation strand until there is enough score evidence to rotate.',
    };
  }

  const latestSummary = summarizeEvidence(latestEntry.slug, evidence);
  const latestIsStrong =
    latestSummary != null &&
    latestSummary.latestScore >= MATH_MASTERY_SCORE_THRESHOLD &&
    latestSummary.strongCount >= 2;

  if (!latestIsStrong) {
    return {
      targetStrand: currentStrand,
      reasonCode: 'continue_current_strand',
      parentSummary: `Math is staying with ${currentStrand.replaceAll('_', ' ')} because the latest evidence is not ready for strand rotation yet.`,
    };
  }

  const workingGrade =
    states.find((state) => state.adaptiveStrand === currentStrand)?.workingGrade ??
    currentEntry?.grade ??
    latestEntry.grade;
  const knownStrands = new Set<MathAdaptiveStrand>([
    ...states.map((state) => state.adaptiveStrand),
    ...evidence
      .map((item) => lookup.get(item.moduleSlug)?.adaptive_strand)
      .filter((strand): strand is MathAdaptiveStrand => Boolean(strand)),
    ...rotationHistory.map((item) => item.targetStrand),
  ]);

  const dueCandidates = STRAND_ROTATION_ORDER.flatMap((strand) => {
    if (strand === latestEntry.adaptive_strand) return [];
    const ready = findEarliestReadyModule(input.map, masteredSlugs, strand);
    if (!ready) return [];
    const isKnown = knownStrands.has(strand);
    const isGradeAppropriate = ready.grade >= workingGrade - 1;
    if (!isKnown && !isGradeAppropriate) return [];
    return [
      {
        strand,
        latestActivityTime: latestStrandActivityTime(strand, evidence, rotationHistory, lookup),
        known: isKnown,
      },
    ];
  }).sort((a, b) => {
    return (
      a.latestActivityTime - b.latestActivityTime ||
      (a.known === b.known ? 0 : a.known ? -1 : 1) ||
      strandPriority(a.strand) - strandPriority(b.strand)
    );
  });

  const due = dueCandidates[0];
  if (due) {
    return {
      targetStrand: due.strand,
      reasonCode: 'strong_mastery_due_strand',
      parentSummary: `Math is rotating to ${due.strand.replaceAll('_', ' ')} because the latest check was strong and this strand is due for attention.`,
    };
  }

  return {
    targetStrand: currentStrand,
    reasonCode: 'continue_current_strand',
    parentSummary: `Math is continuing ${currentStrand.replaceAll('_', ' ')} because no other ready strand is due yet.`,
  };
};

export const chooseMathAssignment = (input: MathAssignmentInput): MathAssignmentDecision => {
  const lookup = buildLookup(input.map);
  const states = input.strandStates ?? [];
  const evidence = input.recentEvidence ?? [];
  const masteredSlugs = getMasteredSlugs(states, evidence);
  const source = pickCurrentEntry(input.map, input, lookup);
  const targetStrand = input.targetStrand ?? source?.adaptive_strand ?? DEFAULT_TARGET_STRAND;
  const weakSlug = states
    .find((state) => state.adaptiveStrand === targetStrand)
    ?.weakModuleSlugs?.find((slug) => lookup.has(slug) && !masteredSlugs.has(slug));

  if (weakSlug) {
    const weakEntry = lookup.get(weakSlug);
    if (weakEntry) {
      return decision({
        action: 'remediate',
        recommendedModuleSlug: weakEntry.slug,
        supportingModuleSlugs: weakEntry.remediation_targets,
        reasonCode: 'weak_state_repair',
        parentSummary: `Math is routing back to ${formatTitle(weakEntry)} because it is still marked as a weak area.`,
        studentSummary: `Start with a repair lesson on ${weakEntry.title} so the next math step feels easier.`,
      });
    }
  }

  if (!source) {
    const ready = findEarliestReadyModule(input.map, masteredSlugs, targetStrand) ?? input.map.modules.slice().sort(bySequence)[0];
    if (!ready) {
      throw new Error('Math assignment policy could not find any modules in the prerequisite map.');
    }
    return decision({
      action: ready.prerequisites.length === 0 ? 'diagnose' : 'continue',
      recommendedModuleSlug: ready.slug,
      supportingModuleSlugs: ready.prerequisites,
      reasonCode: ready.prerequisites.length === 0 ? 'no_state_start_root' : 'start_strand_ready_module',
      parentSummary: `Math is starting with ${formatTitle(ready)} because there is not enough recent evidence yet.`,
      studentSummary: `Start here so the app can see what math level fits best.`,
    });
  }

  const missingPrerequisite = firstUnmasteredPrerequisite(source, masteredSlugs, lookup);
  if (missingPrerequisite) {
    return decision({
      action: 'remediate',
      recommendedModuleSlug: missingPrerequisite.slug,
      sourceModuleSlug: source.slug,
      supportingModuleSlugs: source.prerequisites,
      reasonCode: 'unmet_prerequisites',
      parentSummary: `${formatTitle(source)} depends on ${formatTitle(missingPrerequisite)}, so the plan is backfilling that prerequisite first.`,
      studentSummary: `Review ${missingPrerequisite.title} first. It is a building block for ${source.title}.`,
    });
  }

  const summary = summarizeEvidence(source.slug, evidence);
  if (!summary) {
    return decision({
      action: 'continue',
      recommendedModuleSlug: source.slug,
      sourceModuleSlug: source.slug,
      supportingModuleSlugs: source.prerequisites,
      reasonCode: 'steady_continue',
      parentSummary: `Math will continue with ${formatTitle(source)} until there is enough score evidence to move.`,
      studentSummary: `Keep working on ${source.title}. The next step depends on how this check goes.`,
    });
  }

  if (summary.lowCount >= 2) {
    const repair = source.remediation_targets.map((slug) => lookup.get(slug)).find(Boolean) ?? source;
    return decision({
      action: 'remediate',
      recommendedModuleSlug: repair.slug,
      sourceModuleSlug: source.slug,
      supportingModuleSlugs: source.remediation_targets,
      reasonCode: 'repeated_low_score',
      parentSummary: `Two recent checks on ${formatTitle(source)} were below ${MATH_REPEATED_LOW_SCORE_THRESHOLD}%, so math is backfilling ${formatTitle(repair)} before trying again.`,
      studentSummary: `Let's repair the earlier skill first, then come back stronger.`,
    });
  }

  if (
    summary.latestScore >= MATH_REPEATED_LOW_SCORE_THRESHOLD &&
    summary.latestScore < MATH_WEAK_SCORE_THRESHOLD
  ) {
    const repair = source.remediation_targets.map((slug) => lookup.get(slug)).find(Boolean) ?? source;
    return decision({
      action: 'remediate',
      recommendedModuleSlug: repair.slug,
      sourceModuleSlug: source.slug,
      supportingModuleSlugs: source.remediation_targets,
      reasonCode: 'partial_score_repair',
      parentSummary: `${formatTitle(source)} is close but not solid yet at ${summary.latestScore}%, so the next assignment repairs a prerequisite before advancing.`,
      studentSummary: `You are close. A short repair lesson will make the next try smoother.`,
    });
  }

  if (summary.latestScore < MATH_REPEATED_LOW_SCORE_THRESHOLD) {
    return decision({
      action: 'reinforce',
      recommendedModuleSlug: source.slug,
      sourceModuleSlug: source.slug,
      supportingModuleSlugs: source.remediation_targets,
      reasonCode: 'single_low_score_retry',
      parentSummary: `${formatTitle(source)} had one low check at ${summary.latestScore}%, so the plan retries with support before moving backward.`,
      studentSummary: `Try ${source.title} again with support. One tough check does not mean you need to move back yet.`,
    });
  }

  if (summary.latestScore < MATH_MASTERY_SCORE_THRESHOLD) {
    return decision({
      action: 'reinforce',
      recommendedModuleSlug: source.slug,
      sourceModuleSlug: source.slug,
      supportingModuleSlugs: source.prerequisites,
      reasonCode: 'steady_continue',
      parentSummary: `${formatTitle(source)} is in the practice zone at ${summary.latestScore}%, so math will reinforce before advancing.`,
      studentSummary: `Keep practicing ${source.title}. You are building toward mastery.`,
    });
  }

  const masteredWithCurrent = new Set([...masteredSlugs, source.slug]);
  const shouldChallenge = summary.strongCount >= 2 && summary.averageScore >= 92 && summary.lowHintUse;
  const challenge = shouldChallenge ? findChallengeModule(source, lookup, masteredWithCurrent) : null;
  if (challenge) {
    return decision({
      action: 'challenge',
      recommendedModuleSlug: challenge.slug,
      sourceModuleSlug: source.slug,
      supportingModuleSlugs: [source.slug],
      reasonCode: 'strong_mastery_challenge',
      parentSummary: `Two strong checks averaging ${summary.averageScore}% show readiness to stretch from ${formatTitle(source)} to ${formatTitle(challenge)}.`,
      studentSummary: `You showed strong mastery. Try a challenge next.`,
    });
  }

  const next = findNextReadyModule(input.map, source, masteredWithCurrent);
  if (next) {
    return decision({
      action: 'advance',
      recommendedModuleSlug: next.slug,
      sourceModuleSlug: source.slug,
      supportingModuleSlugs: [source.slug],
      reasonCode: 'mastery_advance',
      parentSummary: `${formatTitle(source)} is mastered, so math is advancing to ${formatTitle(next)}.`,
      studentSummary: `Nice work. Move on to ${next.title}.`,
    });
  }

  return decision({
    action: 'continue',
    recommendedModuleSlug: source.slug,
    sourceModuleSlug: source.slug,
    supportingModuleSlugs: source.challenge_targets,
    reasonCode: 'steady_continue',
    parentSummary: `${formatTitle(source)} is the best current assignment; no ready follow-up was found in this strand yet.`,
    studentSummary: `Stay with ${source.title} while the app finds the next best step.`,
  });
};
