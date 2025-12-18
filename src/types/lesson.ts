/**
 * Lesson Content Structure Types
 * 
 * These types define the structured format for lesson content
 * after parsing from markdown into a step-by-step format.
 */

export type LessonPhase = 'welcome' | 'learn' | 'practice' | 'review' | 'complete';

export const LESSON_PHASES: LessonPhase[] = ['welcome', 'learn', 'practice', 'review', 'complete'];

export const PHASE_LABELS: Record<LessonPhase, string> = {
  welcome: 'Welcome',
  learn: 'Learn',
  practice: 'Practice',
  review: 'Review',
  complete: 'Complete',
};

export interface LessonSection {
  id: string;
  title: string;
  content: string; // markdown
  type: 'concept' | 'example' | 'explanation' | 'activity' | 'general';
}

export interface VocabularyTerm {
  term: string;
  definition: string;
}

export interface LessonResource {
  title: string;
  url: string;
  type: 'video' | 'article' | 'interactive' | 'document' | 'link';
  description?: string;
}

export interface LessonContentStructure {
  /** Welcome phase data */
  welcome: {
    title: string;
    subject: string;
    gradeBand: string;
    objectives: string[];
    estimatedMinutes: number | null;
    hook?: string;
  };

  /** Learn phase - content broken into sections */
  learnSections: LessonSection[];

  /** Vocabulary terms from the lesson */
  vocabulary: VocabularyTerm[];

  /** Summary/review content */
  summary: string | null;

  /** Additional resources */
  resources: LessonResource[];

  /** Raw content fallback if parsing fails */
  rawContent: string;
}

export interface LessonStepperState {
  currentPhase: LessonPhase;
  currentSectionIndex: number; // For learn phase with multiple sections
  completedPhases: LessonPhase[];
  practiceScore: {
    correct: number;
    total: number;
  };
}

export interface LessonStepperActions {
  goToPhase: (phase: LessonPhase) => void;
  nextPhase: () => void;
  previousPhase: () => void;
  nextSection: () => void;
  previousSection: () => void;
  markPhaseComplete: (phase: LessonPhase) => void;
  updatePracticeScore: (correct: number, total: number) => void;
  reset: () => void;
}

export type LessonStepperContextValue = LessonStepperState & LessonStepperActions & {
  totalSections: number;
  progress: number; // 0-100
  canGoNext: boolean;
  canGoBack: boolean;
  hasPracticeQuestions: boolean;
  isPhaseComplete: (phase: LessonPhase) => boolean;
};
