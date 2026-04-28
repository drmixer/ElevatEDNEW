import type {
  DailyHomeschoolPlan,
  DailyPlanBlock,
  DailyPlanBlockKind,
} from './homeschoolDailyPlan';

export const ELA_MASTERY_SCORE_THRESHOLD = 85;
export const ELA_WEAK_SCORE_THRESHOLD = 70;

export type ElaStrand =
  | 'reading_literature'
  | 'reading_informational'
  | 'vocabulary'
  | 'writing_grammar'
  | 'speaking_listening';

export type ElaAssignmentAction =
  | 'diagnose'
  | 'read'
  | 'write'
  | 'reinforce'
  | 'repair'
  | 'challenge'
  | 'discuss';

export type ElaAssignmentReason =
  | 'no_recent_evidence'
  | 'weak_reading_or_writing_evidence'
  | 'mastery_advance'
  | 'continue_current_module'
  | 'grade_level_start';

export type ElaSkeletonModule = {
  grade: string | number;
  subject: string;
  strand: string;
  topic: string;
  subtopic?: string;
};

export type ElaModuleEntry = {
  slug: string;
  title: string;
  grade: number;
  strand: ElaStrand;
  sourceStrand: string;
};

export type ElaModuleMap = {
  generatedAt: string;
  modules: ElaModuleEntry[];
};

export type ElaEvidence = {
  moduleSlug: string;
  scorePct: number;
  completedAt?: string;
  estimatedMinutes?: number;
  outcome?: 'mastered' | 'practice' | 'weak';
  reasonCode?: ElaAssignmentReason;
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

export type ElaSubjectState = {
  currentModuleSlug?: string;
  currentStrand?: ElaStrand;
  workingGrade?: number;
  confidence?: number;
  masteredModuleSlugs?: string[];
  weakModuleSlugs?: string[];
};

export type ElaAssignmentDecision = {
  action: ElaAssignmentAction;
  reasonCode: ElaAssignmentReason;
  targetStrand: ElaStrand;
  recommendedModuleSlug: string;
  supportingModuleSlugs: string[];
  parentSummary: string;
  studentSummary: string;
};

export type BuildElaDailyPlanInput = {
  date?: string;
  studentId?: string;
  elaMap: ElaModuleMap;
  state?: ElaSubjectState | null;
  recentEvidence?: ElaEvidence[];
  targetStrand?: ElaStrand;
};

const STRAND_PRIORITY: ElaStrand[] = [
  'reading_informational',
  'reading_literature',
  'vocabulary',
  'writing_grammar',
  'speaking_listening',
];

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

export const slugifyEla = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

export const inferElaStrand = (value: string): ElaStrand => {
  const normalized = value.toLowerCase();
  if (normalized.includes('informational')) return 'reading_informational';
  if (normalized.includes('literature')) return 'reading_literature';
  if (normalized.includes('vocabulary')) return 'vocabulary';
  if (normalized.includes('writing') || normalized.includes('grammar')) return 'writing_grammar';
  return 'speaking_listening';
};

const isElaSubject = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return normalized === 'ela' || normalized === 'english' || normalized.includes('english language arts');
};

const moduleSlug = (entry: ElaSkeletonModule): string =>
  slugifyEla([entry.grade, entry.subject, entry.strand, entry.topic, entry.subtopic].filter(Boolean).join('-'));

export const buildElaModuleMap = (rows: ElaSkeletonModule[]): ElaModuleMap => {
  const modules = rows
    .filter((row) => isElaSubject(row.subject))
    .flatMap((row) => {
      const grade = typeof row.grade === 'number' ? row.grade : Number.parseInt(row.grade, 10);
      if (!Number.isFinite(grade) || grade < 3 || grade > 8) return [];
      return [
        {
          slug: moduleSlug(row),
          title: row.subtopic ? `${row.topic}: ${row.subtopic}` : row.topic,
          grade,
          strand: inferElaStrand(row.strand),
          sourceStrand: row.strand,
        } satisfies ElaModuleEntry,
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

const moduleBySlug = (map: ElaModuleMap, slug: string | undefined): ElaModuleEntry | undefined =>
  slug ? map.modules.find((entry) => entry.slug === slug) : undefined;

const nearestGradeModule = (
  map: ElaModuleMap,
  grade: number,
  strand?: ElaStrand,
): ElaModuleEntry | undefined =>
  map.modules.find((entry) => entry.grade >= grade && (!strand || entry.strand === strand)) ??
  map.modules.find((entry) => !strand || entry.strand === strand) ??
  map.modules[0];

const nextModule = (
  map: ElaModuleMap,
  current: ElaModuleEntry | undefined,
  masteredSlugs: Set<string>,
): ElaModuleEntry | undefined => {
  if (!current) return undefined;
  const sameStrand = map.modules.filter((entry) => entry.strand === current.strand);
  const index = sameStrand.findIndex((entry) => entry.slug === current.slug);
  return sameStrand.slice(index + 1).find((entry) => !masteredSlugs.has(entry.slug)) ?? current;
};

const latestEvidence = (evidence: ElaEvidence[]): ElaEvidence | undefined =>
  evidence
    .slice()
    .sort((a, b) => Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? ''))[0];

const actionForStrand = (strand: ElaStrand): ElaAssignmentAction =>
  strand === 'writing_grammar' ? 'write' : strand === 'speaking_listening' ? 'discuss' : 'read';

export const chooseElaAssignment = (input: BuildElaDailyPlanInput): ElaAssignmentDecision => {
  const state = input.state ?? null;
  const masteredSlugs = new Set(state?.masteredModuleSlugs ?? []);
  const weakSlug = state?.weakModuleSlugs?.find((slug) => !masteredSlugs.has(slug));
  const latest = latestEvidence(input.recentEvidence ?? []);
  const current = moduleBySlug(input.elaMap, state?.currentModuleSlug);
  const grade = state?.workingGrade ?? current?.grade ?? 3;
  const targetStrand = input.targetStrand ?? state?.currentStrand ?? current?.strand ?? 'reading_informational';

  if (weakSlug) {
    const module = moduleBySlug(input.elaMap, weakSlug) ?? nearestGradeModule(input.elaMap, grade, targetStrand);
    if (module) {
      return {
        action: 'repair',
        reasonCode: 'weak_reading_or_writing_evidence',
        targetStrand: module.strand,
        recommendedModuleSlug: module.slug,
        supportingModuleSlugs: [],
        parentSummary: `ELA is repairing ${module.title} because recent evidence marked it as weak.`,
        studentSummary: 'Start by fixing the reading or writing skill that needs the most support.',
      };
    }
  }

  if (!latest) {
    const module = nearestGradeModule(input.elaMap, grade, targetStrand);
    if (!module) throw new Error('ELA module map is empty.');
    return {
      action: 'diagnose',
      reasonCode: 'no_recent_evidence',
      targetStrand: module.strand,
      recommendedModuleSlug: module.slug,
      supportingModuleSlugs: [],
      parentSummary: 'ELA is starting with a short reading and writing check because there is not enough recent evidence.',
      studentSummary: 'Do a short ELA check so the app can pick the right reading and writing work.',
    };
  }

  const latestModule = moduleBySlug(input.elaMap, latest.moduleSlug) ?? current;
  if (latest.scorePct < ELA_WEAK_SCORE_THRESHOLD && latestModule) {
    return {
      action: 'repair',
      reasonCode: 'weak_reading_or_writing_evidence',
      targetStrand: latestModule.strand,
      recommendedModuleSlug: latestModule.slug,
      supportingModuleSlugs: [],
      parentSummary: `ELA is repairing ${latestModule.title} because the latest score was ${latest.scorePct}%.`,
      studentSummary: 'Review the skill, then answer with text evidence or a revised sentence.',
    };
  }

  if (latest.scorePct >= ELA_MASTERY_SCORE_THRESHOLD && latestModule) {
    const next = nextModule(input.elaMap, latestModule, masteredSlugs);
    if (next && next.slug !== latestModule.slug) {
      return {
        action: actionForStrand(next.strand),
        reasonCode: 'mastery_advance',
        targetStrand: next.strand,
        recommendedModuleSlug: next.slug,
        supportingModuleSlugs: [latestModule.slug],
        parentSummary: `ELA is moving forward because ${latestModule.title} scored ${latest.scorePct}%.`,
        studentSummary: 'Move to the next ELA skill and keep using evidence in your answers.',
      };
    }
  }

  const module = current ?? latestModule ?? nearestGradeModule(input.elaMap, grade, targetStrand);
  if (!module) throw new Error('ELA module map is empty.');
  return {
    action: latest.scorePct >= ELA_MASTERY_SCORE_THRESHOLD ? 'challenge' : 'reinforce',
    reasonCode: current ? 'continue_current_module' : 'grade_level_start',
    targetStrand: module.strand,
    recommendedModuleSlug: module.slug,
    supportingModuleSlugs: [],
    parentSummary: `ELA is continuing ${module.title} until reading and writing evidence is steady.`,
    studentSummary: 'Keep practicing this ELA skill with a clear answer, evidence, and explanation.',
  };
};

const block = (input: Omit<DailyPlanBlock, 'subject'>): DailyPlanBlock => ({
  subject: 'ela',
  ...input,
});

const elaBlockTemplates = (decision: ElaAssignmentDecision): DailyPlanBlock[] => {
  const slug = decision.recommendedModuleSlug;
  const isWriting = decision.targetStrand === 'writing_grammar';
  const firstKind: DailyPlanBlockKind = decision.action === 'diagnose' ? 'diagnostic' : decision.action === 'repair' ? 'repair' : 'lesson';

  return [
    block({
      id: `ela-${firstKind}-${slug}`,
      kind: firstKind,
      title: decision.action === 'diagnose' ? 'ELA starting check' : isWriting ? 'Writing mini-lesson' : 'Reading mini-lesson',
      moduleSlug: slug,
      estimatedMinutes: decision.action === 'diagnose' ? 12 : 18,
      required: true,
      purpose: decision.action === 'repair'
        ? 'Repair the reading or writing skill before moving on.'
        : 'Teach the ELA focus skill and model the expected response.',
      completionEvidence: ['lesson completed', 'notes or annotations'],
    }),
    block({
      id: `ela-practice-${slug}`,
      kind: isWriting ? 'independent_practice' : 'guided_practice',
      title: isWriting ? 'Draft and revise' : 'Evidence response',
      moduleSlug: slug,
      estimatedMinutes: isWriting ? 22 : 18,
      required: true,
      purpose: isWriting
        ? 'Write or revise a short response using the target grammar or organization skill.'
        : 'Answer with a claim, text evidence, and explanation.',
      completionEvidence: isWriting
        ? ['draft or revision', 'rubric self-check']
        : ['text evidence selected', 'written explanation'],
    }),
    block({
      id: `ela-reflection-${slug}`,
      kind: 'reflection',
      title: 'ELA reflection',
      moduleSlug: slug,
      estimatedMinutes: 5,
      required: true,
      purpose: 'Capture what was clear and what still needs support.',
      completionEvidence: ['student reflection', 'next question noted'],
    }),
  ];
};

const sumMinutes = (blocks: DailyPlanBlock[], requiredOnly = false): number =>
  blocks
    .filter((item) => !requiredOnly || item.required)
    .reduce((sum, item) => sum + item.estimatedMinutes, 0);

export const buildElaDailyPlan = (input: BuildElaDailyPlanInput): DailyHomeschoolPlan => {
  const decision = chooseElaAssignment(input);
  const blocks = elaBlockTemplates(decision);
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
        subject: 'ela',
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
      `Required ELA work is about ${requiredMinutes} minutes.`,
    ],
  };
};
