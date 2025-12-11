import type { Subject } from '../types';

export const SUBJECTS: Subject[] = [
  'math',
  'english',
  'science',
  'social_studies',
  'study_skills',
  'arts_music',
  'financial_literacy',
  'health_pe',
  'computer_science',
];

export const SUBJECT_LABELS: Record<Subject, string> = {
  math: 'Math',
  english: 'Reading & Writing',
  science: 'Science',
  social_studies: 'Social Studies',
  study_skills: 'Study Skills & Executive Functioning',
  arts_music: 'Arts & Music',
  financial_literacy: 'Financial Literacy',
  health_pe: 'Health & PE',
  computer_science: 'Computer Science',
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
  arts_music: 'arts_music',
  arts: 'arts_music',
  art: 'arts_music',
  music: 'arts_music',
  'arts_and_music': 'arts_music',
  'arts & music': 'arts_music',
  'arts_&_music': 'arts_music',
  'arts-and-music': 'arts_music',
  financial_literacy: 'financial_literacy',
  finance: 'financial_literacy',
  financial: 'financial_literacy',
  money: 'financial_literacy',
  budgeting: 'financial_literacy',
  investing: 'financial_literacy',
  banking: 'financial_literacy',
  'financial-literacy': 'financial_literacy',
  health_pe: 'health_pe',
  health: 'health_pe',
  wellness: 'health_pe',
  pe: 'health_pe',
  physical_education: 'health_pe',
  'health-and-pe': 'health_pe',
  'health_and_pe': 'health_pe',
  computer_science: 'computer_science',
  cs: 'computer_science',
  'comp_sci': 'computer_science',
  'computer-science': 'computer_science',
  computing: 'computer_science',
  coding: 'computer_science',
  programming: 'computer_science',
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
