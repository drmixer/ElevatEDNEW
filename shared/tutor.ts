export type TutorHelpMode = 'hint' | 'break_down' | 'another_way' | 'check_thinking' | 'solution';

export type TutorChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
};

export type TutorLessonPhase = 'learn' | 'example' | 'practice' | 'review';

export type TutorLessonContext = {
  phase?: TutorLessonPhase;
  subject?: string | null;
  moduleId?: number | string | null;
  moduleTitle?: string | null;
  lessonId?: number | string | null;
  lessonTitle?: string | null;
  sectionId?: number | string | null;
  sectionTitle?: string | null;
  visibleText?: string | null;
  questionStem?: string | null;
  answerChoices?: string[];
  learnerAnswer?: string | string[] | null;
  correctAnswer?: string | string[] | null;
  rubric?: string | null;
  workedExample?: string | null;
};

export type TutorLearnerContext = {
  gradeLevel?: string;
  readingLevel?: string;
  supportLevel?: 'default' | 'extra_scaffold';
};

export type TutorOpenRequest = {
  prompt?: string;
  source?: string;
  helpMode?: TutorHelpMode;
  lesson?: TutorLessonContext;
};

export type TutorAnsweredEventDetail = {
  lessonId?: number | string | null;
  phase?: TutorLessonPhase;
  sectionId?: number | string | null;
  questionStem?: string | null;
  helpMode: TutorHelpMode;
  deliveryMode: 'ai_direct' | 'deterministic_fallback';
  subject?: string | null;
  timestamp: number;
};
