import type { MathAdaptiveStrand, MathStrandRotationReason } from './mathAdaptivePolicy';

export type MathSubjectEvidenceSummary = {
  moduleSlug: string;
  moduleTitle?: string;
  scorePct: number;
  completedAt?: string;
};

export type MathAdaptiveVariantResultSummary = {
  adaptiveVariantId: string;
  adaptiveVariantKind?: string | null;
  moduleSlug: string;
  moduleTitle?: string;
  adaptiveStrand: MathAdaptiveStrand;
  score: number;
  accuracy: number;
  completedAt: string;
  outcome: 'mastered' | 'practice' | 'weak';
  nextModuleSlug: string;
  nextModuleTitle?: string;
  reasonCode: string;
  parentSummary: string;
  practiceItemCount?: number | null;
  practiceItemsScored?: number | null;
};

export type MathRotationHistorySummary = {
  date: string;
  targetStrand: MathAdaptiveStrand;
  assignedModuleSlug: string;
  assignedModuleTitle?: string;
  rotationReason: MathStrandRotationReason;
  completedModuleSlug?: string;
  completedModuleTitle?: string;
  score?: number;
  outcome?: 'mastered' | 'practice' | 'weak';
  parentSummary?: string;
};

export type MathParentPreferenceSummary = {
  preferredStrand?: MathAdaptiveStrand | null;
  weekStart?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

export type MathSubjectStateSummary = {
  subject: 'math';
  placementStatus: string;
  currentStrand: MathAdaptiveStrand;
  currentModuleSlug?: string;
  currentModuleTitle?: string;
  workingGrade?: number;
  confidence?: number;
  masteredModuleSlugs: string[];
  weakModuleSlugs: string[];
  recommendedModuleSlugs: string[];
  lastAdaptiveVariantResult?: MathAdaptiveVariantResultSummary | null;
  recentEvidence: MathSubjectEvidenceSummary[];
  rotationHistory: MathRotationHistorySummary[];
  parentPreference?: MathParentPreferenceSummary | null;
};

export type MathWeeklyRecordModuleSummary = {
  moduleSlug: string;
  moduleTitle?: string;
  completedAt?: string;
  scorePct?: number;
  estimatedMinutes?: number;
  source: 'adaptive_variant' | 'lesson_progress';
  outcome?: 'mastered' | 'practice' | 'weak';
};

export type MathWeeklyRecordSummary = {
  subject: 'math';
  studentId: string;
  weekStart: string;
  weekEnd: string;
  estimatedMinutes: number;
  completedModuleCount: number;
  completedModules: MathWeeklyRecordModuleSummary[];
  masteredModuleSlugs: string[];
  weakModuleSlugs: string[];
  currentModuleSlug?: string;
  currentModuleTitle?: string;
  currentStrand: MathAdaptiveStrand;
  rotationHistory: MathRotationHistorySummary[];
  parentPreference?: MathParentPreferenceSummary | null;
  latestChangeSummary?: string;
  parentNotes: string[];
};
