import {
  chooseMathAssignment,
  chooseMathTargetStrand,
  type MathAssignmentDecision,
  type MathAssignmentInput,
  type MathEvidence,
  type MathPrerequisiteMap,
  type MathRotationHistoryEntry,
  type MathStrandRotationDecision,
  type MathStrandState,
} from './mathAdaptivePolicy';
import {
  findMathAdaptiveVariant,
  type MathAdaptiveVariantCatalog,
  type MathAdaptiveVariantKind,
} from './mathAdaptiveVariants';

export type HomeschoolSubject = 'math' | 'ela' | 'science' | 'social_studies' | 'electives';

export type DailyPlanBlockKind =
  | 'warmup'
  | 'diagnostic'
  | 'lesson'
  | 'guided_practice'
  | 'independent_practice'
  | 'repair'
  | 'challenge'
  | 'exit_ticket'
  | 'reflection';

export type DailyPlanBlock = {
  id: string;
  subject: HomeschoolSubject;
  kind: DailyPlanBlockKind;
  title: string;
  moduleSlug: string;
  estimatedMinutes: number;
  required: boolean;
  purpose: string;
  completionEvidence: string[];
  contentVariantId?: string;
  contentVariantKind?: MathAdaptiveVariantKind;
};

export type DailyPlanAction =
  | MathAssignmentDecision['action']
  | 'read'
  | 'write'
  | 'review'
  | 'discuss';

export type DailyPlanSubjectSummary = {
  subject: HomeschoolSubject;
  estimatedMinutes: number;
  primaryModuleSlug: string;
  action: DailyPlanAction;
  targetStrand?: MathAssignmentInput['targetStrand'] | string;
  preferredStrand?: MathAssignmentInput['preferredStrand'];
  parentPreferenceActive?: boolean;
  rotationReason?: MathStrandRotationDecision['reasonCode'];
  parentSummary: string;
  studentSummary: string;
};

export type DailyHomeschoolPlan = {
  date: string;
  studentId?: string;
  estimatedMinutes: number;
  requiredMinutes: number;
  blocks: DailyPlanBlock[];
  subjects: DailyPlanSubjectSummary[];
  parentNotes: string[];
};

export type BuildMathDailyPlanInput = {
  date?: string;
  studentId?: string;
  mathMap: MathPrerequisiteMap;
  variantCatalog?: MathAdaptiveVariantCatalog | null;
  targetStrand?: MathAssignmentInput['targetStrand'];
  preferredStrand?: MathAssignmentInput['preferredStrand'];
  strandStates?: MathStrandState[];
  recentEvidence?: MathEvidence[];
  rotationHistory?: MathRotationHistoryEntry[];
  completedModuleSlug?: string;
};

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const sumMinutes = (blocks: DailyPlanBlock[], requiredOnly = false): number =>
  blocks
    .filter((block) => !requiredOnly || block.required)
    .reduce((total, block) => total + block.estimatedMinutes, 0);

const block = (input: Omit<DailyPlanBlock, 'subject'>): DailyPlanBlock => ({
  subject: 'math',
  ...input,
});

const attachVariant = (
  catalog: MathAdaptiveVariantCatalog | null | undefined,
  moduleSlug: string,
  kind: MathAdaptiveVariantKind,
): Pick<DailyPlanBlock, 'contentVariantId' | 'contentVariantKind'> => {
  const variant = findMathAdaptiveVariant(catalog, moduleSlug, kind);
  return variant
    ? {
        contentVariantId: variant.id,
        contentVariantKind: variant.kind,
      }
    : {};
};

const mathBlockTemplates = (
  decision: MathAssignmentDecision,
  variantCatalog?: MathAdaptiveVariantCatalog | null,
): DailyPlanBlock[] => {
  const slug = decision.recommendedModuleSlug;
  const supportSlugs = decision.supportingModuleSlugs;
  const supportSlug = supportSlugs[0] ?? slug;

  if (decision.action === 'diagnose') {
    return [
      block({
        id: `math-diagnostic-${slug}`,
        kind: 'diagnostic',
        title: 'Math starting check',
        moduleSlug: slug,
        estimatedMinutes: 12,
        required: true,
        purpose: 'Find the right starting point before assigning harder math.',
        completionEvidence: ['diagnostic score', 'missed skill tags'],
      }),
      block({
        id: `math-lesson-${slug}`,
        kind: 'lesson',
        title: 'Core math lesson',
        moduleSlug: slug,
        estimatedMinutes: 20,
        required: true,
        purpose: 'Teach and model the first skill in the current math strand.',
        completionEvidence: ['lesson completed', 'worked example reviewed'],
      }),
      block({
        id: `math-exit-${slug}`,
        kind: 'exit_ticket',
        title: 'Math exit ticket',
        moduleSlug: slug,
        estimatedMinutes: 5,
        required: true,
        purpose: 'Confirm whether tomorrow should continue, repair, or move ahead.',
        completionEvidence: ['exit ticket accuracy', 'student explanation'],
      }),
    ];
  }

  if (decision.action === 'remediate') {
    return [
      block({
        id: `math-warmup-${supportSlug}`,
        kind: 'warmup',
        title: 'Prerequisite warmup',
        moduleSlug: supportSlug,
        estimatedMinutes: 5,
        required: true,
        purpose: 'Reactivate the earlier skill before the repair lesson.',
        completionEvidence: ['warmup attempt', 'accuracy check'],
      }),
      block({
        id: `math-repair-${slug}`,
        kind: 'repair',
        title: 'Math repair lesson',
        moduleSlug: slug,
        estimatedMinutes: 20,
        required: true,
        purpose: 'Rebuild the missing prerequisite that is blocking the next skill.',
        completionEvidence: ['repair lesson completed', 'worked example corrected'],
        ...attachVariant(variantCatalog, slug, 'repair_lesson'),
      }),
      block({
        id: `math-guided-${slug}`,
        kind: 'guided_practice',
        title: 'Guided repair practice',
        moduleSlug: slug,
        estimatedMinutes: 12,
        required: true,
        purpose: 'Practice the repaired skill with support before independent work.',
        completionEvidence: ['guided practice accuracy'],
        ...attachVariant(variantCatalog, slug, 'guided_repair_practice'),
      }),
      block({
        id: `math-exit-${slug}`,
        kind: 'exit_ticket',
        title: 'Repair exit ticket',
        moduleSlug: slug,
        estimatedMinutes: 5,
        required: true,
        purpose: 'Check whether the prerequisite is ready to use tomorrow.',
        completionEvidence: ['exit ticket accuracy', 'student explanation'],
        ...attachVariant(variantCatalog, slug, 'exit_ticket'),
      }),
    ];
  }

  if (decision.action === 'challenge') {
    return [
      block({
        id: `math-warmup-${decision.sourceModuleSlug ?? slug}`,
        kind: 'warmup',
        title: 'Mastery warmup',
        moduleSlug: decision.sourceModuleSlug ?? slug,
        estimatedMinutes: 5,
        required: true,
        purpose: 'Keep the mastered skill fresh before stretching it.',
        completionEvidence: ['warmup attempt'],
      }),
      block({
        id: `math-challenge-${slug}`,
        kind: 'challenge',
        title: 'Math challenge task',
        moduleSlug: slug,
        estimatedMinutes: 25,
        required: true,
        purpose: 'Extend strong mastery into a harder connected skill.',
        completionEvidence: ['challenge task score', 'strategy explanation'],
        ...attachVariant(variantCatalog, slug, 'challenge_task'),
      }),
      block({
        id: `math-reflection-${slug}`,
        kind: 'reflection',
        title: 'Strategy reflection',
        moduleSlug: slug,
        estimatedMinutes: 7,
        required: false,
        purpose: 'Explain what changed from the mastered skill to the challenge skill.',
        completionEvidence: ['written reflection'],
      }),
      block({
        id: `math-exit-${slug}`,
        kind: 'exit_ticket',
        title: 'Challenge exit ticket',
        moduleSlug: slug,
        estimatedMinutes: 5,
        required: true,
        purpose: 'Decide whether the challenge becomes the new working level.',
        completionEvidence: ['exit ticket accuracy'],
        ...attachVariant(variantCatalog, slug, 'exit_ticket'),
      }),
    ];
  }

  if (decision.action === 'reinforce' || decision.action === 'continue') {
    return [
      block({
        id: `math-warmup-${slug}`,
        kind: 'warmup',
        title: 'Math warmup',
        moduleSlug: slug,
        estimatedMinutes: 5,
        required: true,
        purpose: 'Restart the skill without overwhelming the student.',
        completionEvidence: ['warmup attempt'],
      }),
      block({
        id: `math-guided-${slug}`,
        kind: 'guided_practice',
        title: 'Guided math practice',
        moduleSlug: slug,
        estimatedMinutes: 15,
        required: true,
        purpose: 'Practice with enough support to correct mistakes quickly.',
        completionEvidence: ['guided practice accuracy'],
      }),
      block({
        id: `math-independent-${slug}`,
        kind: 'independent_practice',
        title: 'Independent math practice',
        moduleSlug: slug,
        estimatedMinutes: 15,
        required: true,
        purpose: 'Show whether the skill is becoming independent.',
        completionEvidence: ['independent practice accuracy'],
      }),
      block({
        id: `math-exit-${slug}`,
        kind: 'exit_ticket',
        title: 'Math exit ticket',
        moduleSlug: slug,
        estimatedMinutes: 5,
        required: true,
        purpose: 'Choose tomorrow’s advance, repair, or reinforce path.',
        completionEvidence: ['exit ticket accuracy', 'student explanation'],
      }),
    ];
  }

  return [
    block({
      id: `math-warmup-${decision.sourceModuleSlug ?? slug}`,
      kind: 'warmup',
      title: 'Math warmup',
      moduleSlug: decision.sourceModuleSlug ?? slug,
      estimatedMinutes: 5,
      required: true,
      purpose: 'Review the skill that unlocked today’s next step.',
      completionEvidence: ['warmup attempt'],
    }),
    block({
      id: `math-lesson-${slug}`,
      kind: 'lesson',
      title: 'New math lesson',
      moduleSlug: slug,
      estimatedMinutes: 25,
      required: true,
      purpose: 'Teach the next ready skill in the current math strand.',
      completionEvidence: ['lesson completed', 'worked example reviewed'],
    }),
    block({
      id: `math-guided-${slug}`,
      kind: 'guided_practice',
      title: 'Guided practice',
      moduleSlug: slug,
      estimatedMinutes: 12,
      required: true,
      purpose: 'Try the new skill with support.',
      completionEvidence: ['guided practice accuracy'],
    }),
    block({
      id: `math-exit-${slug}`,
      kind: 'exit_ticket',
      title: 'Math exit ticket',
      moduleSlug: slug,
      estimatedMinutes: 5,
      required: true,
      purpose: 'Decide whether tomorrow should continue or move forward.',
      completionEvidence: ['exit ticket accuracy', 'student explanation'],
    }),
  ];
};

export const buildMathDailyPlan = (input: BuildMathDailyPlanInput): DailyHomeschoolPlan => {
  const rotation = chooseMathTargetStrand({
    map: input.mathMap,
    targetStrand: input.targetStrand,
    preferredStrand: input.preferredStrand,
    strandStates: input.strandStates,
    recentEvidence: input.recentEvidence,
    rotationHistory: input.rotationHistory,
    completedModuleSlug: input.completedModuleSlug,
  });
  const assignment = chooseMathAssignment({
    map: input.mathMap,
    targetStrand: rotation.targetStrand,
    strandStates: input.strandStates,
    recentEvidence: input.recentEvidence,
    completedModuleSlug: input.completedModuleSlug,
  });
  const blocks = mathBlockTemplates(assignment, input.variantCatalog);
  const estimatedMinutes = sumMinutes(blocks);
  const requiredMinutes = sumMinutes(blocks, true);
  const parentSummary =
    rotation.reasonCode === 'explicit_target_strand' || rotation.reasonCode === 'continue_current_strand'
      ? assignment.parentSummary
      : `${rotation.parentSummary} ${assignment.parentSummary}`;

  return {
    date: input.date ?? todayIsoDate(),
    studentId: input.studentId,
    estimatedMinutes,
    requiredMinutes,
    blocks,
    subjects: [
      {
        subject: 'math',
        estimatedMinutes,
        primaryModuleSlug: assignment.recommendedModuleSlug,
        action: assignment.action,
        targetStrand: rotation.targetStrand,
        preferredStrand: input.preferredStrand,
        parentPreferenceActive: rotation.reasonCode === 'parent_preferred_strand',
        rotationReason: rotation.reasonCode,
        parentSummary,
        studentSummary: assignment.studentSummary,
      },
    ],
    parentNotes: [
      parentSummary,
      `Required math work is about ${requiredMinutes} minutes. Optional work brings the block to about ${estimatedMinutes} minutes.`,
    ],
  };
};
