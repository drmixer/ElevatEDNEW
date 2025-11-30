import { defaultLearningPreferences, type DashboardLesson, type LearningPreferences } from '../types';

export const maxLessonsForSession: Record<LearningPreferences['sessionLength'], number> = {
  short: 2,
  standard: 3,
  long: 4,
};

export const applyLearningPreferencesToPlan = (
  plan: DashboardLesson[],
  preferences: LearningPreferences,
): DashboardLesson[] => {
  if (!plan.length) return plan;
  const pref = preferences ?? defaultLearningPreferences;
  const cappedLength = maxLessonsForSession[pref.sessionLength] ?? 4;

  let ordered = plan.slice();
  if (pref.focusSubject && pref.focusSubject !== 'balanced') {
    const focusLessons = ordered.filter((lesson) => lesson.subject === pref.focusSubject);
    const nonFocus = ordered.filter((lesson) => lesson.subject !== pref.focusSubject);
    if (pref.focusIntensity === 'focused') {
      ordered = [...focusLessons, ...nonFocus];
    } else if (focusLessons.length) {
      const [firstFocus] = focusLessons;
      ordered = [firstFocus, ...ordered.filter((lesson) => lesson.id !== firstFocus.id)];
    }
  }

  return ordered.slice(0, Math.max(1, cappedLength));
};

