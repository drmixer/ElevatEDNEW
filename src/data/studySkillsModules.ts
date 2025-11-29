import type { Subject } from '../types';

export type StudySkillsModule = {
  id: string;
  title: string;
  gradeBand: string;
  focus: string;
  duration: string;
  description: string;
  habit: string;
  subject: Subject;
  ctaPath?: string;
};

export const studySkillsModules: StudySkillsModule[] = [
  {
    id: 'study-planner',
    title: 'Plan Your Week in 10 Minutes',
    gradeBand: '3-8',
    focus: 'Build a simple weekly study plan with time blocks that match your schedule.',
    duration: '10-15 min',
    description: 'Learners drag-and-drop 20 minute blocks, set one math anchor, and pick two reading sessions for the week.',
    habit: 'Planning & time management',
    subject: 'study_skills' as Subject,
    ctaPath: '/catalog?subject=study_skills',
  },
  {
    id: 'focus-reset',
    title: 'Focus Reset & Distraction Check',
    gradeBand: '5-10',
    focus: 'Practice a 3-step routine to reset attention before lessons.',
    duration: '8-12 min',
    description:
      'Quick breathing, device check, and “one goal” framing to make the next lesson stick—no long lectures.',
    habit: 'Attention & executive functioning',
    subject: 'study_skills' as Subject,
    ctaPath: '/catalog?subject=study_skills',
  },
  {
    id: 'notes-remix',
    title: 'Note-Taking Remix',
    gradeBand: '6-12',
    focus: 'Capture the gist in 3 bullets, then turn them into questions.',
    duration: '12-15 min',
    description: 'A guided walkthrough using a short passage so students can practice paraphrasing and self-quizzing.',
    habit: 'Active note-taking',
    subject: 'study_skills' as Subject,
    ctaPath: '/catalog?subject=study_skills',
  },
  {
    id: 'test-day',
    title: 'Test Day Warmup',
    gradeBand: '4-9',
    focus: 'A repeatable checklist for the night before and the first 10 minutes of a quiz.',
    duration: '10 min',
    description:
      'Sleep, materials, and a mini-retrieval round so learners enter assessments calm and prepared.',
    habit: 'Assessment readiness',
    subject: 'study_skills' as Subject,
    ctaPath: '/catalog?subject=study_skills',
  },
];
