import type { Subject } from '../types';

export const SUBJECTS: Subject[] = ['math', 'english', 'science', 'social_studies', 'study_skills'];

export const SUBJECT_LABELS: Record<Subject, string> = {
  math: 'Math',
  english: 'Reading & Writing',
  science: 'Science',
  social_studies: 'Social Studies',
  study_skills: 'Study Skills & Executive Functioning',
};

const SUBJECT_ALIASES: Record<string, Subject> = {
  math: 'math',
  mathematics: 'math',
  numeracy: 'math',
  english: 'english',
  ela: 'english',
  language_arts: 'english',
  english_language_arts: 'english',
  literacy: 'english',
  reading: 'english',
  writing: 'english',
  science: 'science',
  stem: 'science',
  social_studies: 'social_studies',
  history: 'social_studies',
  civics: 'social_studies',
  humanities: 'social_studies',
  study_skills: 'study_skills',
  study_skill: 'study_skills',
  executive_function: 'study_skills',
  executive_functioning: 'study_skills',
  habits: 'study_skills',
  learning_habits: 'study_skills',
};

export const normalizeSubject = (input: string | Subject | null | undefined): Subject | null => {
  if (!input) return null;
  const normalized = input.toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (SUBJECT_ALIASES[normalized]) {
    return SUBJECT_ALIASES[normalized];
  }
  if (SUBJECTS.includes(normalized as Subject)) {
    return normalized as Subject;
  }
  return null;
};

export const formatSubjectLabel = (subject: Subject | null | undefined): string => {
  if (!subject) return '—';
  return SUBJECT_LABELS[subject] ?? subject.replace(/_/g, ' ');
};
