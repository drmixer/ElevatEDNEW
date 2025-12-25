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
  // Math
  math: 'math',
  mathematics: 'math',
  numeracy: 'math',

  // English/ELA - comprehensive variations
  english: 'english',
  ela: 'english',
  language_arts: 'english',
  english_language_arts: 'english',
  'english language arts': 'english',
  englishlanguagearts: 'english',
  literacy: 'english',
  reading: 'english',
  writing: 'english',
  'reading_&_writing': 'english',
  'reading & writing': 'english',
  reading_and_writing: 'english',

  // Science
  science: 'science',
  stem: 'science',

  // Social Studies
  social_studies: 'social_studies',
  socialstudies: 'social_studies',
  history: 'social_studies',
  civics: 'social_studies',
  humanities: 'social_studies',

  // Study Skills
  study_skills: 'study_skills',
  studyskills: 'study_skills',
  study_skill: 'study_skills',
  executive_function: 'study_skills',
  executive_functioning: 'study_skills',
  habits: 'study_skills',
  learning_habits: 'study_skills',

  // Arts & Music
  arts_music: 'arts_music',
  artsmusic: 'arts_music',
  arts: 'arts_music',
  art: 'arts_music',
  music: 'arts_music',
  arts_and_music: 'arts_music',
  'arts & music': 'arts_music',
  'arts_&_music': 'arts_music',
  'arts-and-music': 'arts_music',

  // Financial Literacy
  financial_literacy: 'financial_literacy',
  financialliteracy: 'financial_literacy',
  finance: 'financial_literacy',
  financial: 'financial_literacy',
  money: 'financial_literacy',
  budgeting: 'financial_literacy',
  investing: 'financial_literacy',
  banking: 'financial_literacy',
  'financial-literacy': 'financial_literacy',

  // Health & PE
  health_pe: 'health_pe',
  healthpe: 'health_pe',
  health: 'health_pe',
  wellness: 'health_pe',
  pe: 'health_pe',
  physical_education: 'health_pe',
  'health-and-pe': 'health_pe',
  'health_and_pe': 'health_pe',
  'health & pe': 'health_pe',

  // Computer Science
  computer_science: 'computer_science',
  computerscience: 'computer_science',
  cs: 'computer_science',
  comp_sci: 'computer_science',
  'computer-science': 'computer_science',
  computing: 'computer_science',
  coding: 'computer_science',
  programming: 'computer_science',
};

export const normalizeSubject = (input: string | Subject | null | undefined): Subject | null => {
  if (!input) return null;

  // Convert to string and clean up
  let normalized = input.toString().trim().toLowerCase();

  // Handle ampersands - convert "&" to "and" for consistency
  normalized = normalized.replace(/\s*&\s*/g, '_and_');

  // Replace spaces and hyphens with underscores
  normalized = normalized.replace(/[\s-]+/g, '_');

  // Also check without underscores (for cases like "EnglishLanguageArts")
  const noUnderscores = normalized.replace(/_/g, '');

  // Try the normalized version first
  if (SUBJECT_ALIASES[normalized]) {
    return SUBJECT_ALIASES[normalized];
  }

  // Try without underscores
  if (SUBJECT_ALIASES[noUnderscores]) {
    return SUBJECT_ALIASES[noUnderscores];
  }

  // Check if it's already a valid subject
  if (SUBJECTS.includes(normalized as Subject)) {
    return normalized as Subject;
  }

  return null;
};

/**
 * Format a subject for display. Accepts raw strings and normalizes them first.
 * @param subject - The subject to format (can be normalized or raw)
 * @returns A human-readable label for the subject
 */
export const formatSubjectLabel = (subject: Subject | string | null | undefined): string => {
  if (!subject) return '—';

  // If it's already a known Subject, return the label directly
  if (typeof subject === 'string' && SUBJECT_LABELS[subject as Subject]) {
    return SUBJECT_LABELS[subject as Subject];
  }

  // Try to normalize it first
  const normalized = normalizeSubject(subject);
  if (normalized) {
    return SUBJECT_LABELS[normalized];
  }

  // Fallback: clean up the string for display
  return subject.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};
