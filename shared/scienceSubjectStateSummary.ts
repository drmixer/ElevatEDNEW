import type { ScienceAssignmentReason, ScienceStrand } from './scienceHomeschool';

export type ScienceSubjectEvidenceSummary = {
  moduleSlug: string;
  moduleTitle?: string;
  strand?: ScienceStrand;
  scorePct: number;
  completedAt?: string;
  estimatedMinutes?: number;
  outcome?: 'mastered' | 'practice' | 'weak';
  reasonCode?: ScienceAssignmentReason;
  nextModuleSlug?: string;
  nextModuleTitle?: string;
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

export type ScienceSubjectStateSummary = {
  subject: 'science';
  placementStatus: string;
  currentStrand: ScienceStrand;
  currentModuleSlug?: string;
  currentModuleTitle?: string;
  workingGrade?: number;
  confidence?: number;
  masteredModuleSlugs: string[];
  weakModuleSlugs: string[];
  recommendedModuleSlugs: string[];
  recentEvidence: ScienceSubjectEvidenceSummary[];
  reasonCode?: ScienceAssignmentReason;
  parentSummary?: string;
};

export type ScienceWeeklyRecordModuleSummary = ScienceSubjectEvidenceSummary;

export type ScienceWeeklyRecordSummary = {
  subject: 'science';
  studentId: string;
  weekStart: string;
  weekEnd: string;
  estimatedMinutes: number;
  completedModuleCount: number;
  completedModules: ScienceWeeklyRecordModuleSummary[];
  masteredModuleSlugs: string[];
  weakModuleSlugs: string[];
  currentModuleSlug?: string;
  currentModuleTitle?: string;
  currentStrand: ScienceStrand;
  latestChangeSummary?: string;
  parentNotes: string[];
};
