/**
 * Lesson Components - Barrel Export
 * 
 * New lesson experience with step-by-step stepper navigation.
 */

// Core stepper
export { LessonStepperProvider, useLessonStepper } from './LessonStepper';

// UI components
export { LessonProgressBar, LessonProgressBarCompact } from './LessonProgressBar';
export { LessonNavigation } from './LessonNavigation';
export { LessonCard, LessonCardPadded, LessonCardHeader, LessonCardBody, LessonCardFooter } from './LessonCard';
export { LessonHeader } from './LessonHeader';
export { ContentIssueReport } from './ContentIssueReport';
export { ReflectionPrompt } from './ReflectionPrompt';

// Phase components
export {
    WelcomePhase,
    LearnPhase,
    PracticePhase,
    ReviewPhase,
    CompletePhase,
} from './phases';

// Types re-export for convenience
export type {
    LessonPhase,
    LessonContentStructure,
    LessonSection,
    VocabularyTerm,
    LessonResource,
    LessonStepperState,
    LessonStepperActions,
    LessonStepperContextValue,
} from '../../types/lesson';

export { LESSON_PHASES, PHASE_LABELS } from '../../types/lesson';
