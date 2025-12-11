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
  if (pref.studyMode === 'catch_up') {
    ordered = ordered.sort((a, b) => {
      const aScore = a.difficulty === 'hard' ? 2 : a.difficulty === 'medium' ? 1 : 0;
      const bScore = b.difficulty === 'hard' ? 2 : b.difficulty === 'medium' ? 1 : 0;
      return aScore - bScore;
    });
  } else if (pref.studyMode === 'get_ahead') {
    ordered = ordered.sort((a, b) => {
      const aScore = a.difficulty === 'hard' ? 2 : a.difficulty === 'medium' ? 1 : 0;
      const bScore = b.difficulty === 'hard' ? 2 : b.difficulty === 'medium' ? 1 : 0;
      return bScore - aScore;
    });
  }

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

  const coreLessons = ordered.filter((lesson) => !lesson.isMixIn && !lesson.isElective);
  const mixIns = ordered.filter((lesson) => lesson.isMixIn);
  const electives = ordered.filter((lesson) => lesson.isElective);

  const baseCore = coreLessons.slice(0, Math.max(1, Math.min(cappedLength, coreLessons.length)));
  const remainingSlotsAfterCore = Math.max(0, cappedLength - baseCore.length);
  const mixInSlots = Math.min(2, remainingSlotsAfterCore);
  const mixInPicks = mixIns.slice(0, mixInSlots);
  const remainingAfterMixIns = Math.max(0, remainingSlotsAfterCore - mixInPicks.length);
  const electivePicks = electives.slice(0, remainingAfterMixIns);

  const filler =
    remainingAfterMixIns > electivePicks.length
      ? ordered
          .filter(
            (lesson) =>
              !baseCore.find((core) => core.id === lesson.id) &&
              !mixInPicks.find((mix) => mix.id === lesson.id) &&
              !electivePicks.find((elec) => elec.id === lesson.id),
          )
          .slice(0, Math.max(0, cappedLength - baseCore.length - mixInPicks.length - electivePicks.length))
      : [];

  return [...baseCore, ...mixInPicks, ...electivePicks, ...filler].slice(0, Math.max(1, cappedLength));
};
