import type {
  DailyHomeschoolPlan,
  DailyPlanBlock,
  DailyPlanBlockKind,
} from './homeschoolDailyPlan';

export const SCIENCE_MASTERY_SCORE_THRESHOLD = 85;
export const SCIENCE_WEAK_SCORE_THRESHOLD = 70;

export type ScienceStrand =
  | 'earth_space'
  | 'life_science'
  | 'physical_science'
  | 'engineering_practices';

export type ScienceAssignmentAction =
  | 'diagnose'
  | 'investigate'
  | 'model'
  | 'explain'
  | 'repair'
  | 'challenge'
  | 'reflect';

export type ScienceAssignmentReason =
  | 'no_recent_evidence'
  | 'weak_science_evidence'
  | 'mastery_advance'
  | 'continue_current_module'
  | 'grade_level_start';

export type ScienceSkeletonModule = {
  grade: string | number;
  subject: string;
  strand: string;
  topic: string;
  subtopic?: string;
};

export type ScienceModuleEntry = {
  slug: string;
  title: string;
  grade: number;
  strand: ScienceStrand;
  sourceStrand: string;
};

export type ScienceModuleMap = {
  generatedAt: string;
  modules: ScienceModuleEntry[];
};

export type ScienceEvidence = {
  moduleSlug: string;
  scorePct: number;
  completedAt?: string;
  estimatedMinutes?: number;
  outcome?: 'mastered' | 'practice' | 'weak';
  reasonCode?: ScienceAssignmentReason;
  nextModuleSlug?: string;
  parentSummary?: string;
  responseKind?: string;
  promptId?: string;
  promptText?: string;
  promptChecklist?: string[];
  contentId?: string;
  contentTitle?: string;
  contentKind?: string;
  contentSourceType?: string;
  contentFocus?: string;
  contentSource?: string;
  contentText?: string;
  contentExcerpt?: string;
  responseText?: string;
  responseExcerpt?: string;
  responseWordCount?: number;
  rubricChecks?: Record<string, boolean>;
};

export type ScienceSubjectState = {
  currentModuleSlug?: string;
  currentStrand?: ScienceStrand;
  workingGrade?: number;
  confidence?: number;
  masteredModuleSlugs?: string[];
  weakModuleSlugs?: string[];
};

export type ScienceAssignmentDecision = {
  action: ScienceAssignmentAction;
  reasonCode: ScienceAssignmentReason;
  targetStrand: ScienceStrand;
  recommendedModuleSlug: string;
  supportingModuleSlugs: string[];
  parentSummary: string;
  studentSummary: string;
};

export type BuildScienceDailyPlanInput = {
  date?: string;
  studentId?: string;
  scienceMap: ScienceModuleMap;
  state?: ScienceSubjectState | null;
  recentEvidence?: ScienceEvidence[];
  targetStrand?: ScienceStrand;
};

const STRAND_PRIORITY: ScienceStrand[] = [
  'earth_space',
  'life_science',
  'physical_science',
  'engineering_practices',
];

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

export const slugifyScience = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

export const inferScienceStrand = (value: string): ScienceStrand => {
  const normalized = value.toLowerCase();
  if (normalized.includes('life') || normalized.includes('biology')) return 'life_science';
  if (normalized.includes('physical') || normalized.includes('chem') || normalized.includes('physics')) return 'physical_science';
  if (normalized.includes('engineer') || normalized.includes('practice')) return 'engineering_practices';
  return 'earth_space';
};

const isScienceSubject = (value: string): boolean => value.toLowerCase() === 'science';

const moduleSlug = (entry: ScienceSkeletonModule): string =>
  slugifyScience([entry.grade, entry.subject, entry.strand, entry.topic, entry.subtopic].filter(Boolean).join('-'));

export const buildScienceModuleMap = (rows: ScienceSkeletonModule[]): ScienceModuleMap => {
  const modules = rows
    .filter((row) => isScienceSubject(row.subject))
    .flatMap((row) => {
      const grade = typeof row.grade === 'number' ? row.grade : Number.parseInt(row.grade, 10);
      if (!Number.isFinite(grade) || grade < 3 || grade > 8) return [];
      return [
        {
          slug: moduleSlug(row),
          title: row.subtopic ? `${row.topic}: ${row.subtopic}` : row.topic,
          grade,
          strand: inferScienceStrand(row.strand),
          sourceStrand: row.strand,
        } satisfies ScienceModuleEntry,
      ];
    })
    .sort((a, b) => {
      const gradeDelta = a.grade - b.grade;
      if (gradeDelta !== 0) return gradeDelta;
      return STRAND_PRIORITY.indexOf(a.strand) - STRAND_PRIORITY.indexOf(b.strand) || a.title.localeCompare(b.title);
    });

  return {
    generatedAt: new Date(0).toISOString(),
    modules,
  };
};

const moduleBySlug = (map: ScienceModuleMap, slug: string | undefined): ScienceModuleEntry | undefined =>
  slug ? map.modules.find((entry) => entry.slug === slug) : undefined;

const nearestGradeModule = (
  map: ScienceModuleMap,
  grade: number,
  strand?: ScienceStrand,
): ScienceModuleEntry | undefined =>
  map.modules.find((entry) => entry.grade >= grade && (!strand || entry.strand === strand)) ??
  map.modules.find((entry) => !strand || entry.strand === strand) ??
  map.modules[0];

const nextModule = (
  map: ScienceModuleMap,
  current: ScienceModuleEntry | undefined,
  masteredSlugs: Set<string>,
): ScienceModuleEntry | undefined => {
  if (!current) return undefined;
  const sameStrand = map.modules.filter((entry) => entry.strand === current.strand);
  const index = sameStrand.findIndex((entry) => entry.slug === current.slug);
  return sameStrand.slice(index + 1).find((entry) => !masteredSlugs.has(entry.slug)) ?? current;
};

const latestEvidence = (evidence: ScienceEvidence[]): ScienceEvidence | undefined =>
  evidence
    .slice()
    .sort((a, b) => Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? ''))[0];

const actionForStrand = (strand: ScienceStrand): ScienceAssignmentAction =>
  strand === 'engineering_practices' ? 'model' : strand === 'earth_space' ? 'investigate' : 'explain';

export const chooseScienceAssignment = (input: BuildScienceDailyPlanInput): ScienceAssignmentDecision => {
  const state = input.state ?? null;
  const masteredSlugs = new Set(state?.masteredModuleSlugs ?? []);
  const weakSlug = state?.weakModuleSlugs?.find((slug) => !masteredSlugs.has(slug));
  const latest = latestEvidence(input.recentEvidence ?? []);
  const current = moduleBySlug(input.scienceMap, state?.currentModuleSlug);
  const grade = state?.workingGrade ?? current?.grade ?? 3;
  const targetStrand = input.targetStrand ?? state?.currentStrand ?? current?.strand ?? 'earth_space';

  if (weakSlug) {
    const module = moduleBySlug(input.scienceMap, weakSlug) ?? nearestGradeModule(input.scienceMap, grade, targetStrand);
    if (module) {
      return {
        action: 'repair',
        reasonCode: 'weak_science_evidence',
        targetStrand: module.strand,
        recommendedModuleSlug: module.slug,
        supportingModuleSlugs: [],
        parentSummary: `Science is repairing ${module.title} because recent evidence was weak.`,
        studentSummary: 'Review the science idea, then explain it with a claim, evidence, and reasoning.',
      };
    }
  }

  if (!latest) {
    const module = nearestGradeModule(input.scienceMap, grade, targetStrand);
    if (!module) throw new Error('Science module map is empty.');
    return {
      action: 'diagnose',
      reasonCode: 'no_recent_evidence',
      targetStrand: module.strand,
      recommendedModuleSlug: module.slug,
      supportingModuleSlugs: [],
      parentSummary: 'Science is starting with a short CER check because there is not enough recent evidence.',
      studentSummary: 'Do a short science check so the app can pick the right investigation work.',
    };
  }

  const latestModule = moduleBySlug(input.scienceMap, latest.moduleSlug) ?? current;
  if (latest.scorePct < SCIENCE_WEAK_SCORE_THRESHOLD && latestModule) {
    return {
      action: 'repair',
      reasonCode: 'weak_science_evidence',
      targetStrand: latestModule.strand,
      recommendedModuleSlug: latestModule.slug,
      supportingModuleSlugs: [],
      parentSummary: `Science is repairing ${latestModule.title} because the latest score was ${latest.scorePct}%.`,
      studentSummary: 'Try again with a clearer claim, evidence, and reasoning.',
    };
  }

  if (latest.scorePct >= SCIENCE_MASTERY_SCORE_THRESHOLD && latestModule) {
    const next = nextModule(input.scienceMap, latestModule, masteredSlugs);
    if (next && next.slug !== latestModule.slug) {
      return {
        action: actionForStrand(next.strand),
        reasonCode: 'mastery_advance',
        targetStrand: next.strand,
        recommendedModuleSlug: next.slug,
        supportingModuleSlugs: [latestModule.slug],
        parentSummary: `Science is moving forward because ${latestModule.title} scored ${latest.scorePct}%.`,
        studentSummary: 'Move to the next science idea and keep explaining with evidence.',
      };
    }
  }

  const module = current ?? latestModule ?? nearestGradeModule(input.scienceMap, grade, targetStrand);
  if (!module) throw new Error('Science module map is empty.');
  return {
    action: latest.scorePct >= SCIENCE_MASTERY_SCORE_THRESHOLD ? 'challenge' : 'explain',
    reasonCode: current ? 'continue_current_module' : 'grade_level_start',
    targetStrand: module.strand,
    recommendedModuleSlug: module.slug,
    supportingModuleSlugs: [],
    parentSummary: `Science is continuing ${module.title} until the explanation evidence is steady.`,
    studentSummary: 'Keep practicing this science idea with a clear claim, evidence, and reasoning.',
  };
};

const block = (input: Omit<DailyPlanBlock, 'subject'>): DailyPlanBlock => ({
  subject: 'science',
  ...input,
});

const scienceBlockTemplates = (decision: ScienceAssignmentDecision): DailyPlanBlock[] => {
  const slug = decision.recommendedModuleSlug;
  const firstKind: DailyPlanBlockKind = decision.action === 'diagnose' ? 'diagnostic' : decision.action === 'repair' ? 'repair' : 'lesson';

  return [
    block({
      id: `science-${firstKind}-${slug}`,
      kind: firstKind,
      title: decision.action === 'diagnose' ? 'Science starting check' : decision.action === 'repair' ? 'Science repair' : 'Science investigation',
      moduleSlug: slug,
      estimatedMinutes: decision.action === 'diagnose' ? 12 : 18,
      required: true,
      purpose: decision.action === 'repair'
        ? 'Repair the science idea before moving on.'
        : 'Observe a phenomenon and connect it to the target science idea.',
      completionEvidence: ['claim written', 'evidence named'],
    }),
    block({
      id: `science-cer-${slug}`,
      kind: 'guided_practice',
      title: 'Claim, evidence, reasoning',
      moduleSlug: slug,
      estimatedMinutes: 18,
      required: true,
      purpose: 'Write a short CER response using data, an observation, or a model.',
      completionEvidence: ['claim', 'evidence', 'reasoning'],
    }),
    block({
      id: `science-reflection-${slug}`,
      kind: 'reflection',
      title: 'Science reflection',
      moduleSlug: slug,
      estimatedMinutes: 5,
      required: true,
      purpose: 'Name what the evidence showed and what question remains.',
      completionEvidence: ['student reflection', 'next question noted'],
    }),
  ];
};

const sumMinutes = (blocks: DailyPlanBlock[], requiredOnly = false): number =>
  blocks
    .filter((item) => !requiredOnly || item.required)
    .reduce((sum, item) => sum + item.estimatedMinutes, 0);

export const buildScienceDailyPlan = (input: BuildScienceDailyPlanInput): DailyHomeschoolPlan => {
  const decision = chooseScienceAssignment(input);
  const blocks = scienceBlockTemplates(decision);
  const estimatedMinutes = sumMinutes(blocks);
  const requiredMinutes = sumMinutes(blocks, true);

  return {
    date: input.date ?? todayIsoDate(),
    studentId: input.studentId,
    estimatedMinutes,
    requiredMinutes,
    blocks,
    subjects: [
      {
        subject: 'science',
        estimatedMinutes,
        primaryModuleSlug: decision.recommendedModuleSlug,
        action: decision.action,
        targetStrand: decision.targetStrand,
        parentSummary: decision.parentSummary,
        studentSummary: decision.studentSummary,
      },
    ],
    parentNotes: [
      decision.parentSummary,
      `Required science work is about ${requiredMinutes} minutes.`,
    ],
  };
};
