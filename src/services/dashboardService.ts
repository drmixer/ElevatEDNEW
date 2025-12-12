import supabase from '../lib/supabaseClient';
import { describeSuggestionReason } from './adaptiveService';
import type {
  Admin,
  AdminAlert,
  AdminDashboardData,
  AdminDashboardMetrics,
  AdminGrowthPoint,
  AdminSubjectPerformance,
  AdminTopStudent,
  AdminSuccessMetrics,
  AssessmentSummary,
  DashboardLesson,
  DashboardActivity,
  LearningPathItem,
  Badge,
  Parent,
  ParentActivityPoint,
  ParentAlert,
  ParentChildSnapshot,
  ParentDashboardData,
  ParentWeeklyReport,
  Mission,
  CelebrationMoment,
  SubjectWeeklyTrend,
  AvatarOption,
  SkillGapInsight,
  Student,
  StudentDashboardData,
  StudentDailyActivity,
  Subject,
  SubjectMastery,
  XPTimelinePoint,
  LearningPreferences,
  ChildGoalTargets,
} from '../types';
import { defaultLearningPreferences } from '../types';
import { castLearningPreferences } from './profileService';
import { formatSubjectLabel, normalizeSubject, SUBJECT_LABELS } from '../lib/subjects';
import { getActivitiesForModule, getHomeExtensionActivities, activityModuleSlugs } from '../lib/activityAssets';
import { getCanonicalSequence } from '../lib/learningPaths';
import { applyLearningPreferencesToPlan, maxLessonsForSession } from '../lib/learningPlan';
import { listPlanOptOuts } from './optOutService';
import { STUDENT_AVATARS, isStudentAvatarUnlocked } from '../../shared/avatarManifests';
import { computeSubjectStatuses } from '../lib/onTrack';
import { buildCoachingSuggestions } from '../lib/parentSuggestions';

const allowSyntheticDashboardData =
  typeof import.meta !== 'undefined' &&
  typeof import.meta.env !== 'undefined' &&
  (import.meta.env.DEV || import.meta.env.VITE_ALLOW_FAKE_DASHBOARD_DATA === 'true');

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

type SubjectRow = {
  id: number;
  name: string;
};

type SkillRow = {
  id: number;
  subject_id: number | null;
};

type StudentMasteryRow = {
  skill_id: number;
  mastery_pct: number;
  updated_at?: string;
};

type SubjectMasteryAggregateRow = {
  student_id?: string;
  subject: string | null;
  mastery: number | null;
  cohort_average: number | null;
};

type XpEventRow = {
  id: number;
  source: string;
  xp_change: number;
  reason: string | null;
  created_at: string;
};

type AssessmentAttemptRow = {
  status: 'in_progress' | 'completed' | 'abandoned' | null;
  completed_at: string | null;
};

type StudentDailyActivityRow = {
  student_id: string;
  activity_date: string;
  lessons_completed: number | null;
  practice_minutes: number | null;
  ai_sessions: number | null;
  xp_earned: number | null;
  streak_preserved: boolean | null;
};

type StudentAssignmentRow = {
  id: number;
  status: 'not_started' | 'in_progress' | 'completed';
  due_at: string | null;
  assignments: {
    id: number;
    title: string;
    metadata: Record<string, unknown> | null;
  } | null;
};

type StudentProgressLessonRow = {
  lesson_id: number;
  status: 'not_started' | 'in_progress' | 'completed';
  mastery_pct: number | null;
  attempts: number | null;
  last_activity_at: string | null;
  lessons: {
    id: number;
    title: string;
    estimated_duration_minutes: number | null;
    open_track: boolean | null;
    module_id: number | null;
    modules: {
      id: number;
      title: string;
      subject: string | null;
    } | null;
  } | null;
};

type StudentProgressSubjectRow = {
  student_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  last_activity_at: string | null;
  lessons: {
    modules: {
      subject: string | null;
    } | null;
  } | null;
};

type LessonMetadataEntry = {
  lessonId: number;
  title: string;
  subject: Subject | null;
  moduleTitle: string | null;
  moduleSlug?: string | null;
  estimatedDuration: number | null;
  status: 'not_started' | 'in_progress' | 'completed';
  masteryPct: number | null;
};

type ParentDashboardChildRow = {
  parent_id: string;
  student_id: string;
  first_name: string | null;
  last_name: string | null;
  grade: number | null;
  level: number | null;
  xp: number | null;
  streak_days: number | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  lessons_completed_week: number | null;
  practice_minutes_week: number | null;
  xp_earned_week: number | null;
  mastery_breakdown: unknown;
  weekly_lessons_target?: number | null;
  practice_minutes_target?: number | null;
  mastery_targets?: Record<string, unknown> | null;
};

type ParentGoalRow = {
  weekly_lessons_target?: number | null;
  practice_minutes_target?: number | null;
  mastery_targets?: Record<string, unknown> | null;
};

const difficultyFromValue = (value: number | undefined | null): 'easy' | 'medium' | 'hard' => {
  if (!value || value <= 2) return 'easy';
  if (value === 3) return 'medium';
  return 'hard';
};

const difficultyFromDuration = (
  minutes: number | undefined | null,
): 'easy' | 'medium' | 'hard' => {
  if (!minutes || minutes <= 10) return 'easy';
  if (minutes <= 20) return 'medium';
  return 'hard';
};

const formatIsoDate = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
};

const ensureLearningPreferences = (student: Student): LearningPreferences => {
  if (!student.learningPreferences) {
    student.learningPreferences = { ...defaultLearningPreferences };
  }
  return student.learningPreferences;
};

const computeWeeklyPlanTargets = (
  parentGoals: ChildGoalTargets | null,
  weeklyPlanIntensity: LearningPreferences['weeklyPlanIntensity'],
) => {
  const lessonBase = parentGoals?.weeklyLessons ?? 5;
  const minutesBase = parentGoals?.practiceMinutes ?? 60;
  const factor =
    !lessonBase
      ? 1
      : weeklyPlanIntensity === 'light'
        ? 0.8
        : weeklyPlanIntensity === 'challenge'
          ? 1.2
          : 1;
  return {
    lessons: Math.max(1, Math.round(lessonBase * factor)),
    minutes: Math.max(15, Math.round(minutesBase * factor)),
  };
};

const computeWeeklyProgress = (activity: StudentDailyActivity[]) => {
  return activity.reduce(
    (acc, entry) => {
      acc.lessons += entry.lessonsCompleted ?? 0;
      acc.minutes += entry.practiceMinutes ?? 0;
      return acc;
    },
    { lessons: 0, minutes: 0 },
  );
};

const CROSS_SUBJECT_PAIRS: Partial<Record<Subject, Subject[]>> = {
  math: ['science', 'study_skills'],
  science: ['math', 'english'],
  english: ['social_studies', 'science'],
  social_studies: ['english', 'study_skills'],
  study_skills: ['english', 'math'],
};

export const injectMixInsIntoPlan = (
  lessons: DashboardLesson[],
  preferences: LearningPreferences,
  weeklyTargets: { lessons: number; minutes: number },
  weeklyProgress: { lessons: number; minutes: number },
  optOuts: Set<string>,
  crossPool: DashboardLesson[] = [],
) => {
  const mode = preferences.mixInMode ?? 'auto';
  if (mode === 'core_only') return lessons;
  const lightLoad =
    preferences.weeklyPlanIntensity === 'light' ||
    (weeklyTargets.lessons > 0 && weeklyProgress.lessons <= Math.max(1, weeklyTargets.lessons - 2));
  const today = new Date();
  const midWeek = today.getDay() >= 3; // mid-week loosen threshold
  const nearlyLight =
    weeklyTargets.lessons > 0 && weeklyTargets.lessons - weeklyProgress.lessons <= 2 && midWeek;
  if (!lightLoad && !nearlyLight && mode !== 'cross_subject') return lessons;

  const focusSubject = preferences.weeklyPlanFocus ?? preferences.focusSubject ?? 'balanced';
  const crossTargets =
    focusSubject && focusSubject !== 'balanced' ? CROSS_SUBJECT_PAIRS[focusSubject] ?? [] : undefined;
  const seen = new Set<string>();
  const existingIds = new Set(lessons.map((lesson) => lesson.id));
  const activeCore = lessons.filter(
    (lesson) => !lesson.isMixIn && !lesson.isElective && lesson.status !== 'completed',
  );
  const coreSubjectCounts = new Map<Subject, number>();
  activeCore.forEach((lesson) => {
    coreSubjectCounts.set(lesson.subject, (coreSubjectCounts.get(lesson.subject) ?? 0) + 1);
  });

  const statusRank = (status: DashboardLesson['status']) =>
    status === 'in_progress' ? 0 : status === 'not_started' ? 1 : 2;
  const availableCrossPool = (crossPool.length ? crossPool : fallbackStudentLessons()).filter((lesson) => {
    if (existingIds.has(lesson.id)) return false;
    if (optOuts.has(lesson.id)) return false;
    if (lesson.isElective) return false;
    if (lesson.status === 'completed') return false;
    if (focusSubject && focusSubject !== 'balanced' && crossTargets?.length) {
      return crossTargets.includes(lesson.subject);
    }
    return focusSubject === 'balanced' ? true : lesson.subject !== focusSubject;
  });
  const preferredSubjects: Subject[] =
    focusSubject && focusSubject !== 'balanced' && crossTargets?.length
      ? crossTargets.slice()
      : Array.from(new Set(availableCrossPool.map((lesson) => lesson.subject))).sort((a, b) => {
          const aCount = coreSubjectCounts.get(a) ?? 0;
          const bCount = coreSubjectCounts.get(b) ?? 0;
          return aCount - bCount;
        });
  const preferredRank = new Map<Subject, number>();
  preferredSubjects.forEach((subject, index) => preferredRank.set(subject, index));
  const priorityRank = (subject: Subject) =>
    preferredRank.get(subject) ?? preferredRank.size + (coreSubjectCounts.get(subject) ?? 0);
  const sortByStatusAndPriority = (a: DashboardLesson, b: DashboardLesson) => {
    const statusDiff = statusRank(a.status) - statusRank(b.status);
    if (statusDiff !== 0) return statusDiff;
    const priorityDiff = priorityRank(a.subject) - priorityRank(b.subject);
    if (priorityDiff !== 0) return priorityDiff;
    const titleDiff = a.title.localeCompare(b.title);
    if (titleDiff !== 0) return titleDiff;
    return a.id.localeCompare(b.id);
  };

  const pickLessons = (
    pool: DashboardLesson[],
    limit: number,
    usedSubjects: Set<Subject>,
  ): DashboardLesson[] => {
    const picks: DashboardLesson[] = [];
    const excludedIds = new Set<string>();
    for (const lesson of pool) {
      if (picks.length >= limit) break;
      if (excludedIds.has(lesson.id)) continue;
      if (usedSubjects.has(lesson.subject)) continue;
      excludedIds.add(lesson.id);
      usedSubjects.add(lesson.subject);
      picks.push(lesson);
    }
    if (picks.length < limit) {
      for (const lesson of pool) {
        if (picks.length >= limit) break;
        if (excludedIds.has(lesson.id)) continue;
        excludedIds.add(lesson.id);
        picks.push(lesson);
      }
    }
    return picks;
  };

  const candidates = lessons
    .filter((lesson) => {
      if (lesson.isMixIn) return false;
      if (lesson.isElective) return false;
      if (lesson.status === 'completed') return false;
      if (optOuts.has(lesson.id)) return false;
      if (focusSubject && focusSubject !== 'balanced' && crossTargets?.length) {
        return crossTargets.includes(lesson.subject);
      }
      return focusSubject === 'balanced' ? true : lesson.subject !== focusSubject;
    })
    .sort(sortByStatusAndPriority)
    .slice(0, 6);

  const usedSubjects = new Set<Subject>();
  let mixInPicks = pickLessons(candidates, 2, usedSubjects);
  if (mixInPicks.length < 2) {
    const fallback = availableCrossPool.sort(sortByStatusAndPriority);
    mixInPicks = [...mixInPicks, ...pickLessons(fallback, 2 - mixInPicks.length, usedSubjects)];
  }

  const reasonFor = (subject: Subject) => {
    const partner =
      focusSubject && focusSubject !== 'balanced'
        ? `Mix-in: apply ${formatSubjectLabel(focusSubject)} with ${formatSubjectLabel(subject)}`
        : `Mix-in: switch to ${formatSubjectLabel(subject)}`;
    return partner;
  };

  const withInjected = lessons.slice();
  mixInPicks.forEach((pick) => {
    if (existingIds.has(pick.id)) return;
    if (optOuts.has(pick.id)) return;
    withInjected.push({
      ...pick,
      isMixIn: true,
      suggestionReason: pick.suggestionReason ?? reasonFor(pick.subject),
    });
  });

  return withInjected.map((lesson) => {
    if (mixInPicks.find((item) => item.id === lesson.id) && !seen.has(lesson.id) && !optOuts.has(lesson.id)) {
      seen.add(lesson.id);
      return {
        ...lesson,
        isMixIn: true,
        suggestionReason: lesson.suggestionReason ?? reasonFor(lesson.subject),
      };
    }
    return lesson;
  });
};

export const selectElectiveSuggestion = (
  lessons: DashboardLesson[],
  preferences: LearningPreferences,
  weeklyTargets: { lessons: number; minutes: number },
  weeklyProgress: { lessons: number; minutes: number },
  student?: Student,
  optOuts?: Set<string>,
) => {
  if ((preferences.electiveEmphasis ?? 'light') === 'off') {
    return { plan: lessons, elective: null };
  }
  const day = new Date().getDay();
  const daysRemaining = Math.max(0, 6 - day);
  const aheadOnLessons =
    weeklyTargets.lessons === 0 || weeklyProgress.lessons >= weeklyTargets.lessons;
  const aheadOnMinutes =
    weeklyTargets.minutes === 0 || weeklyProgress.minutes >= Math.round(weeklyTargets.minutes * 0.9);
  const nearlyAhead =
    weeklyTargets.lessons > 0 &&
    weeklyProgress.lessons >= Math.max(1, weeklyTargets.lessons - 1) &&
    weeklyProgress.minutes >= Math.round(weeklyTargets.minutes * 0.85) &&
    daysRemaining >= 1;
  if (!aheadOnLessons || !aheadOnMinutes) {
    if (!nearlyAhead) {
      return { plan: lessons, elective: null };
    }
  }

  const allowed = (preferences.allowedElectiveSubjects ?? []).length
    ? preferences.allowedElectiveSubjects ?? []
    : ([
        'study_skills',
        'social_studies',
        'science',
        'arts_music',
        'financial_literacy',
        'health_pe',
        'computer_science',
      ] as Subject[]);
  const focusSubject = preferences.weeklyPlanFocus ?? preferences.focusSubject ?? null;
  const weekSeed = new Date().toISOString().slice(0, 10);
  const weekIndex = Math.floor(new Date(weekSeed).getTime() / (1000 * 60 * 60 * 24 * 7));

  let pool = lessons.filter(
    (lesson) =>
      !lesson.isMixIn &&
      !lesson.isElective &&
      allowed.includes(lesson.subject) &&
      (focusSubject === null || focusSubject === 'balanced' || lesson.subject !== focusSubject),
  );

  if (!pool.length && student) {
    const pathLessons = buildLessonsFromLearningPath(student);
    const existingIds = new Set(lessons.map((lesson) => lesson.id));
    pool = pathLessons.filter(
      (lesson) =>
        !existingIds.has(lesson.id) &&
        allowed.includes(lesson.subject) &&
        lesson.status !== 'completed' &&
        (focusSubject === null || focusSubject === 'balanced' || lesson.subject !== focusSubject),
    );
  }
  if (!pool.length) {
    pool = fallbackStudentLessons().filter(
      (lesson) =>
        allowed.includes(lesson.subject) &&
        (focusSubject === null || focusSubject === 'balanced' || lesson.subject !== focusSubject),
    );
  }

  const statusRank = (status: DashboardLesson['status']) =>
    status === 'in_progress' ? 0 : status === 'not_started' ? 1 : 2;
  const sortedPool = pool
    .slice()
    .sort((a, b) => {
      const statusDiff = statusRank(a.status) - statusRank(b.status);
      if (statusDiff !== 0) return statusDiff;
      const subjectDiff = String(a.subject).localeCompare(String(b.subject));
      if (subjectDiff !== 0) return subjectDiff;
      const titleDiff = a.title.localeCompare(b.title);
      if (titleDiff !== 0) return titleDiff;
      return a.id.localeCompare(b.id);
    });
  const eligiblePool = sortedPool.filter((item) => !(optOuts?.has(item.id) ?? false));
  if (!eligiblePool.length) return { plan: lessons, elective: null };
  const rotationSubjects = allowed.length
    ? allowed.filter((subject) => eligiblePool.some((lesson) => lesson.subject === subject))
    : Array.from(new Set(eligiblePool.map((lesson) => lesson.subject)));
  const subjectSeed =
    rotationSubjects.length > 0
      ? weekIndex % rotationSubjects.length
      : 0;
  let elective: DashboardLesson | null = null;
  if (rotationSubjects.length) {
    for (let offset = 0; offset < rotationSubjects.length; offset += 1) {
      const subject = rotationSubjects[(subjectSeed + offset) % rotationSubjects.length];
      elective = eligiblePool.find((lesson) => lesson.subject === subject) ?? null;
      if (elective) break;
    }
  }
  elective = elective ?? eligiblePool[0] ?? null;
  if (!elective) return { plan: lessons, elective: null };

  const reasonText =
    elective.suggestionReason ??
    `Elective boost: try a ${formatSubjectLabel(elective.subject)} mini-lesson since you’re ahead`;

  const withFlag = lessons
    .map((lesson) =>
      lesson.id === elective.id
        ? {
            ...lesson,
            isElective: true,
            suggestionReason: lesson.suggestionReason ?? reasonText,
          }
        : lesson,
    )
    .slice();

  if (!withFlag.find((lesson) => lesson.id === elective.id)) {
    withFlag.push({
      ...elective,
      isElective: true,
      suggestionReason: reasonText,
    });
  }

  return {
    plan: withFlag,
    elective,
  };
};

const ensureStudentQuickStats = (
  student: Student,
  activity: StudentDailyActivity[],
): StudentDashboardData['quickStats'] => {
  const minutesThisWeek = activity.reduce((acc, item) => acc + item.practiceMinutes, 0);
  return {
    totalXp: student.xp,
    level: student.level,
    streakDays: student.streakDays,
    hoursThisWeek: Math.round((minutesThisWeek / 60) * 10) / 10,
    assessmentCompleted: student.assessmentCompleted,
  };
};

const fallbackStudentLessons = (): DashboardLesson[] => {
  if (!allowSyntheticDashboardData) return [];
  return [
    {
      id: 'fallback-math',
      subject: 'math',
      title: 'Adaptive Algebra Warm-up',
      status: 'in_progress',
      difficulty: 'medium',
      xpReward: 45,
    },
    {
      id: 'fallback-english',
      subject: 'english',
      title: 'Compare & Contrast Passages',
      status: 'not_started',
      difficulty: 'hard',
      xpReward: 60,
    },
    {
      id: 'fallback-science',
      subject: 'science',
      title: 'Photosynthesis Interactive Lab',
      status: 'completed',
      difficulty: 'easy',
      xpReward: 25,
    },
    {
      id: 'fallback-study-skills',
      subject: 'study_skills',
      title: 'Focus Reset & Planner Sprint',
      status: 'not_started',
      difficulty: 'easy',
      xpReward: 20,
    },
  ];
};

const fallbackStudentMastery = (): SubjectMastery[] => {
  if (!allowSyntheticDashboardData) return [];
  return [
    {
      subject: 'math',
      mastery: 68,
      trend: 'up',
      cohortAverage: 62,
      goal: 80,
      delta: 6,
    },
    {
      subject: 'english',
      mastery: 82,
      trend: 'steady',
      cohortAverage: 78,
      goal: 85,
      delta: -3,
    },
    {
      subject: 'science',
      mastery: 57,
      trend: 'up',
      cohortAverage: 50,
      goal: 75,
      delta: 7,
    },
    {
      subject: 'social_studies',
      mastery: 45,
      trend: 'down',
      cohortAverage: 52,
      goal: 70,
      delta: -7,
    },
    {
      subject: 'study_skills',
      mastery: 61,
      trend: 'steady',
      cohortAverage: 58,
      goal: 75,
      delta: 2,
    },
  ];
};

const fallbackStudentActivity = (): StudentDailyActivity[] => {
  if (!allowSyntheticDashboardData) return [];
  const today = new Date();
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      date: date.toISOString(),
      lessonsCompleted: Math.floor(Math.random() * 3),
      practiceMinutes: 30 + Math.floor(Math.random() * 25),
      aiSessions: Math.floor(Math.random() * 2),
      xpEarned: 40 + Math.floor(Math.random() * 35),
      streakPreserved: true,
    };
  });
};

const fallbackParentWeeklyReport = (parentName: string): ParentWeeklyReport => {
  const today = new Date();
  const monday = new Date(today);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);

  if (!allowSyntheticDashboardData) {
    return {
      weekStart: monday.toISOString(),
      summary: 'No weekly report available yet.',
      highlights: [],
      recommendations: [],
      aiGenerated: false,
    };
  }

  return {
    weekStart: monday.toISOString(),
    summary: `${parentName}'s crew stayed engaged this week with steady progress across core subjects.`,
    highlights: [
      'Emma unlocked the Grammar Expert badge after mastering 3 new writing skills.',
      'Alex improved multiplication accuracy by 18% with targeted practice sets.',
    ],
    recommendations: [
      'Schedule a 20-minute review session on geometry fundamentals for Emma.',
      'Celebrate Alex’s consistency streak to reinforce positive study habits.',
    ],
    aiGenerated: true,
  };
};

const fallbackParentChildren = (parentName: string): ParentChildSnapshot[] => {
  if (!allowSyntheticDashboardData) return [];
  const children: ParentChildSnapshot[] = [
    {
      id: 'fallback-child-1',
      name: `${parentName.split(' ')[0]} Jr.`,
      grade: 6,
      level: 5,
      xp: 1325,
      streakDays: 8,
      strengths: ['Algebraic Reasoning', 'Reading Comprehension'],
      focusAreas: ['Geometry', 'Scientific Method'],
      lessonsCompletedWeek: 9,
      practiceMinutesWeek: 240,
      xpEarnedWeek: 310,
      masteryBySubject: fallbackStudentMastery(),
      recentActivity: [
        {
          id: 'act-1',
          description: 'Completed Diagnostic Review with 92%',
          subject: 'math',
          xp: 120,
          occurredAt: new Date().toISOString(),
        },
        {
          id: 'act-2',
          description: 'Asked for AI hint during Essay Planning lesson',
          subject: 'english',
          xp: 20,
          occurredAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        },
      ],
      goals: {
        weeklyLessons: 6,
        practiceMinutes: 240,
        masteryTargets: {
          math: 80,
          english: 85,
        },
      },
    goalProgress: 78,
    cohortComparison: 64,
    adaptivePlanNotes: [
      'Dialed up Geometry practice this week based on recent misconceptions.',
      'Keeping English steady while we rebuild Science confidence.',
    ],
    learningPreferences: defaultLearningPreferences,
    diagnosticStatus: 'completed',
    diagnosticCompletedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    masteryConfidence: 0.82,
  },
  ];

  return children.map((child) => ({
    ...child,
    skillGaps: buildSkillGapInsights(child),
  }));
};

const normalizeMasteryTargets = (input: unknown): Partial<Record<Subject, number>> => {
  if (!input || typeof input !== 'object') return {};
  const result: Partial<Record<Subject, number>> = {};
  Object.entries(input as Record<string, unknown>).forEach(([rawSubject, value]) => {
    const subject = normalizeSubject(rawSubject);
    if (!subject) return;
    if (typeof value === 'number') {
      result[subject] = value;
    } else if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        result[subject] = parsed;
      }
    }
  });
  return result;
};

const mapParentDashboardChildRow = (row: ParentDashboardChildRow): ParentChildSnapshot => {
  const masteryTargets = normalizeMasteryTargets(row.mastery_targets);
  const masteryBreakdown = Array.isArray(row.mastery_breakdown)
    ? (row.mastery_breakdown as SubjectMastery[])
    : [];

  const masteryBySubject = masteryBreakdown
    .map((entry) => {
      const subject = normalizeSubject((entry as SubjectMastery).subject ?? null);
      if (!subject) return null;
      const mastery = (entry as SubjectMastery).mastery ?? 0;
      const cohortAverage = (entry as SubjectMastery).cohortAverage;
      const goal = masteryTargets[subject] ?? (entry as SubjectMastery).goal;
      const delta =
        cohortAverage !== undefined
          ? Math.round((mastery - cohortAverage) * 100) / 100
          : undefined;
      const trend: SubjectMastery['trend'] =
        delta === undefined ? 'steady' : delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'steady';

      return {
        subject,
        mastery,
        trend,
        cohortAverage,
        goal,
        delta,
      } satisfies SubjectMastery;
    })
    .filter((entry): entry is SubjectMastery => Boolean(entry));

  return {
    id: row.student_id,
    name: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Student',
    grade: row.grade ?? 1,
    level: row.level ?? 1,
    xp: row.xp ?? 0,
    streakDays: row.streak_days ?? 0,
    strengths: row.strengths ?? [],
    focusAreas: row.weaknesses ?? [],
    lessonsCompletedWeek: row.lessons_completed_week ?? 0,
    practiceMinutesWeek: row.practice_minutes_week ?? 0,
    xpEarnedWeek: row.xp_earned_week ?? 0,
    weeklyChange: {
      lessons: row.lessons_completed_week ?? 0,
      minutes: row.practice_minutes_week ?? 0,
      xp: row.xp_earned_week ?? 0,
      deltaLessons: 0,
      deltaMinutes: 0,
      deltaXp: 0,
    },
    masteryBySubject: masteryBySubject.length ? masteryBySubject : fallbackStudentMastery(),
    recentActivity: [],
    goals: {
      weeklyLessons: row.weekly_lessons_target ?? null,
      practiceMinutes: row.practice_minutes_target ?? null,
      masteryTargets: Object.keys(masteryTargets).length ? masteryTargets : null,
    },
    goalProgress: undefined,
    cohortComparison: undefined,
    adaptivePlanNotes: [],
    learningPreferences: defaultLearningPreferences,
    diagnosticStatus: 'not_started',
    diagnosticCompletedAt: null,
    masteryConfidence: null,
  };
};

const fallbackParentAlerts = (): ParentAlert[] => {
  if (!allowSyntheticDashboardData) return [];
  return [
    {
      id: 'alert-1',
      type: 'warning',
      message: 'Emma missed her scheduled science practice yesterday. Encourage a make-up session.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      studentId: 'fallback-child-1',
    },
    {
      id: 'alert-2',
      type: 'info',
      message: 'Alex is close to earning the “Math Momentum” badge. 2 more lessons to go!',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
      studentId: 'fallback-child-1',
    },
  ];
};

const fallbackAdminData = (admin: Admin): AdminDashboardData => ({
  admin,
  metrics: {
    totalStudents: allowSyntheticDashboardData ? 2480 : 0,
    totalParents: allowSyntheticDashboardData ? 940 : 0,
    totalAdmins: allowSyntheticDashboardData ? 6 : 0,
    activeStudents7d: allowSyntheticDashboardData ? 1860 : 0,
    practiceMinutes7d: allowSyntheticDashboardData ? 68450 : 0,
    assessments30d: allowSyntheticDashboardData ? 742 : 0,
    xpEarned30d: allowSyntheticDashboardData ? 912330 : 0,
    averageStudentXp: allowSyntheticDashboardData ? 1285 : 0,
    activeSubscriptions: allowSyntheticDashboardData ? 812 : 0,
    lessonCompletionRate: undefined,
  },
  successMetrics: {
    lookbackDays: 7,
    diagnosticsCompleted: allowSyntheticDashboardData ? 1820 : 0,
    diagnosticsTotal: allowSyntheticDashboardData ? 2480 : 0,
    diagnosticCompletionRate: allowSyntheticDashboardData ? 73 : null,
    assignmentsCompleted: allowSyntheticDashboardData ? 420 : 0,
    assignmentsTotal: allowSyntheticDashboardData ? 620 : 0,
    assignmentFollowThroughRate: allowSyntheticDashboardData ? 68 : null,
    weeklyAccuracyDeltaAvg: allowSyntheticDashboardData ? 1.2 : null,
    dailyPlanCompletionRateAvg: allowSyntheticDashboardData ? 64 : null,
    alertResolutionHoursAvg: allowSyntheticDashboardData ? 10.4 : null,
  },
  growthSeries: allowSyntheticDashboardData
    ? Array.from({ length: 8 }).map((_, index) => {
        const pointDate = new Date();
        pointDate.setDate(pointDate.getDate() - (7 - index) * 7);
        return {
          date: pointDate.toISOString(),
          newStudents: 120 + Math.round(Math.random() * 40),
          activeStudents: 1600 + Math.round(Math.random() * 200),
        };
      })
    : [],
  subjectPerformance: allowSyntheticDashboardData
    ? [
        { subject: 'math', mastery: 68, trend: 4 },
        { subject: 'english', mastery: 74, trend: 2 },
        { subject: 'science', mastery: 59, trend: 5 },
        { subject: 'social_studies', mastery: 62, trend: -1 },
      ]
    : [],
  alerts: allowSyntheticDashboardData
    ? [
        {
          id: 'admin-alert-1',
          severity: 'medium',
          title: 'Rising Support Tickets',
          description: 'Support volume increased 18% week-over-week. Investigate onboarding emails.',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        },
        {
          id: 'admin-alert-2',
          severity: 'high',
          title: 'Assessment Completion Dip',
          description: 'Grade 6 science assessments dropped below 60% completion in the last 7 days.',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        },
      ]
    : [],
  topStudents: allowSyntheticDashboardData
    ? [
        {
          id: 'top-1',
          name: 'Avery Chen',
          grade: 7,
          xpEarnedWeek: 680,
          lessonsCompletedWeek: 14,
        },
        {
          id: 'top-2',
          name: 'Mateo Rivera',
          grade: 5,
          xpEarnedWeek: 540,
          lessonsCompletedWeek: 11,
        },
      ]
    : [],
});

const groupMasteryBySubject = (
  masteryRows: StudentMasteryRow[],
  skills: SkillRow[],
  subjects: SubjectRow[],
): SubjectMastery[] => {
  if (!masteryRows.length) {
    return fallbackStudentMastery();
  }

  const skillSubjectMap = new Map<number, Subject>();
  skills.forEach((skill) => {
    const subjectId = skill.subject_id;
    const subjectRow = subjects.find((subject) => subject.id === subjectId);
    const normalized = normalizeSubject(subjectRow?.name ?? null);
    if (normalized) {
      skillSubjectMap.set(skill.id, normalized);
    }
  });

  const subjectAggregation = new Map<Subject, { total: number; count: number }>();

  masteryRows.forEach((row) => {
    const subject = skillSubjectMap.get(row.skill_id);
    if (!subject) {
      return;
    }
    const entry = subjectAggregation.get(subject) ?? { total: 0, count: 0 };
    entry.total += row.mastery_pct;
    entry.count += 1;
    subjectAggregation.set(subject, entry);
  });

  if (!subjectAggregation.size) {
    return fallbackStudentMastery();
  }

  return Array.from(subjectAggregation.entries()).map(([subject, value]) => ({
    subject,
    mastery: Math.round((value.total / value.count) * 10) / 10,
    trend: 'steady',
  }));
};

const mapSubjectMasteryFromRollup = (
  rows: SubjectMasteryAggregateRow[] | null | undefined,
): SubjectMastery[] => {
  if (!rows?.length) {
    return fallbackStudentMastery();
  }

  const mapped = rows
    .map((row) => {
      const subject = normalizeSubject(row.subject);
      if (!subject) return null;
      const mastery = row.mastery ?? 0;
      const cohort = row.cohort_average ?? null;
      const trend: SubjectMastery['trend'] =
        cohort == null ? 'steady' : mastery >= cohort ? 'up' : 'down';
      return {
        subject,
        mastery,
        trend,
      } satisfies SubjectMastery;
    })
    .filter(Boolean) as SubjectMastery[];

  return mapped.length ? mapped : fallbackStudentMastery();
};

const buildLessonsFromLearningPath = (student: Student): DashboardLesson[] => {
  if (!student.learningPath?.length) {
    return fallbackStudentLessons();
  }

  return student.learningPath.slice(0, 4).map((item) => {
    const numericId = Number.parseInt(item.id, 10);
    const hasNumericId = !Number.isNaN(numericId);
    return {
      id: item.id,
      subject: item.subject,
      title: item.topic,
      moduleSlug: item.moduleSlug ?? item.id,
      suggestionReason: item.concept
        ? `From your grade-level path (${item.concept.replace(/_/g, ' ')})`
        : 'From your grade-level path',
      status:
        item.status === 'completed' || item.status === 'mastered'
          ? 'completed'
          : item.status === 'in_progress'
          ? 'in_progress'
          : 'not_started',
      difficulty: difficultyFromValue(item.difficulty),
      xpReward: item.xpReward,
      launchUrl: hasNumericId ? `/lesson/${numericId}` : null,
    };
  });
};

const normalizePlanBySubject = (
  lessons: DashboardLesson[],
  preferences: LearningPreferences,
): DashboardLesson[] => {
  if (!lessons.length) return lessons;
  const grouped = new Map<Subject, DashboardLesson[]>();

  lessons.forEach((lesson) => {
    const subject = lesson.subject;
    const list = grouped.get(subject) ?? [];
    if (list.length < 4) {
      list.push(lesson);
      grouped.set(subject, list);
    }
  });

  const subjectOrder = Array.from(grouped.keys()).sort((a, b) => {
    if (preferences.focusSubject && preferences.focusSubject !== 'balanced') {
      if (a === preferences.focusSubject) return -1;
      if (b === preferences.focusSubject) return 1;
    }
    return a.localeCompare(b);
  });

  const flattened: DashboardLesson[] = [];
  subjectOrder.forEach((subject) => {
    const pool = grouped.get(subject) ?? [];
    const capped = pool.slice(0, Math.max(2, Math.min(4, pool.length)));
    flattened.push(...capped);
  });

  return applyLearningPreferencesToPlan(flattened, preferences);
};

const mapProgressLessons = (
  rows: StudentProgressLessonRow[],
): {
  lessons: DashboardLesson[];
  metadata: Map<number, LessonMetadataEntry>;
} => {
  if (!rows.length) {
    return { lessons: [], metadata: new Map() };
  }

  const metadata = new Map<number, LessonMetadataEntry>();

  rows.forEach((row) => {
    const lesson = row.lessons;
    if (!lesson) return;
    const subject = normalizeSubject(lesson.modules?.subject ?? null);
    metadata.set(lesson.id, {
      lessonId: lesson.id,
      title: lesson.title,
      subject,
      moduleTitle: lesson.modules?.title ?? null,
      moduleSlug: (lesson.modules as { slug?: string } | null)?.slug ?? null,
      estimatedDuration: lesson.estimated_duration_minutes ?? null,
      status: row.status,
      masteryPct: row.mastery_pct ?? null,
    });
  });

  const rank: Record<'not_started' | 'in_progress' | 'completed', number> = {
    in_progress: 0,
    not_started: 1,
    completed: 2,
  };

  const sorted = rows
    .filter((row) => row.lessons)
    .sort((a, b) => {
      const statusCompare = rank[a.status] - rank[b.status];
      if (statusCompare !== 0) return statusCompare;
      const timeA = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const timeB = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return timeB - timeA;
    })
    .slice(0, 6);

  const lessons: DashboardLesson[] = sorted.map((row) => {
    const lesson = row.lessons!;
    const normalizedSubject = (metadata.get(lesson.id)?.subject ?? 'math') as Subject;
    const xpReward = Math.max(30, (lesson.estimated_duration_minutes ?? 15) * 3);

    return {
      id: lesson.id.toString(),
      subject: normalizedSubject,
      title: lesson.title,
      moduleSlug: metadata.get(lesson.id)?.moduleSlug ?? null,
      status: row.status,
      difficulty: difficultyFromDuration(lesson.estimated_duration_minutes),
      xpReward,
      launchUrl: `/lesson/${lesson.id}`,
      completedAt: row.status === 'completed' ? row.last_activity_at ?? null : null,
    } satisfies DashboardLesson;
  });

  return { lessons, metadata };
};

const resolveModuleSlugForLesson = (
  lesson: DashboardLesson,
  metadata: Map<number, LessonMetadataEntry>,
): string | null => {
  if (lesson.moduleSlug) {
    return lesson.moduleSlug;
  }
  const numericId = Number.parseInt(lesson.id, 10);
  if (!Number.isNaN(numericId)) {
    const meta = metadata.get(numericId);
    if (meta?.moduleSlug) {
      return meta.moduleSlug;
    }
  }
  return null;
};

const fallbackModuleSlugsForGrade = (
  grade: number | string | null | undefined,
): string[] => {
  if (grade === null || grade === undefined) return [];
  const parsedGrade =
    typeof grade === 'number' && Number.isFinite(grade)
      ? grade
      : Number.parseInt(String(grade), 10);
  if (!Number.isFinite(parsedGrade)) return [];

  const subjects: Subject[] = ['math', 'english'];
  const slugs: string[] = [];

  subjects.forEach((subject) => {
    const seq = getCanonicalSequence(parsedGrade, subject) ?? [];
    seq.forEach((entry) => {
      if (
        entry.module_slug &&
        activityModuleSlugs.has(entry.module_slug) &&
        !slugs.includes(entry.module_slug)
      ) {
        slugs.push(entry.module_slug);
      }
    });
  });

  if (slugs.length === 0) {
    activityModuleSlugs.forEach((slug) => {
      if (slugs.length < 2) {
        slugs.push(slug);
      }
    });
  }

  return slugs;
};

const buildActivityLineup = (
  plan: DashboardLesson[],
  metadata: Map<number, LessonMetadataEntry>,
  grade?: number | null,
): DashboardActivity[] => {
  const modules: string[] = [];
  const activities: DashboardActivity[] = [];
  const seen = new Set<string>();

  for (const lesson of plan) {
    const slug = resolveModuleSlugForLesson(lesson, metadata);
    if (slug && !modules.includes(slug)) {
      modules.push(slug);
    }
  }

  if (modules.length === 0) {
    fallbackModuleSlugsForGrade(grade).forEach((slug) => {
      if (!modules.includes(slug)) {
        modules.push(slug);
      }
    });
  }

  for (const slug of modules) {
    const entries = getActivitiesForModule(slug);
    for (const activity of entries) {
      if (seen.has(activity.id)) {
        continue;
      }
      seen.add(activity.id);
      activities.push(activity);
    }
    if (activities.length >= 12) {
      break;
    }
  }

  return activities;
};

const buildHomeExtensions = (
  grade: number | string | null | undefined,
  mastery: SubjectMastery[],
): DashboardActivity[] => {
  const sorted = mastery
    .filter((item) => item.subject === 'math' || item.subject === 'english')
    .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0));

  const subjects: Subject[] =
    sorted.length > 0
      ? Array.from(new Set(sorted.map((entry) => entry.subject))) as Subject[]
      : (['math', 'english'] as Subject[]);

  const suggestions: DashboardActivity[] = [];
  const seen = new Set<string>();

  subjects.forEach((subject) => {
    const seq = getCanonicalSequence(grade ?? undefined, subject) ?? [];
    const moduleSlug = seq.find((entry) => {
      if (!entry.module_slug) return false;
      if (!activityModuleSlugs.has(entry.module_slug)) return false;
      return getHomeExtensionActivities(entry.module_slug).length > 0;
    })?.module_slug;

    if (!moduleSlug) {
      return;
    }

    getHomeExtensionActivities(moduleSlug).forEach((activity) => {
      if (seen.has(activity.id)) return;
      seen.add(activity.id);
      suggestions.push(activity);
    });
  });

  if (suggestions.length === 0) {
    activityModuleSlugs.forEach((slug) => {
      if (suggestions.length >= 3) return;
      getHomeExtensionActivities(slug).forEach((activity) => {
        if (seen.has(activity.id) || suggestions.length >= 4) return;
        seen.add(activity.id);
        suggestions.push(activity);
      });
    });
  }

  return suggestions.slice(0, 4);
};

type SuggestionRow = {
  lesson_id: number | null;
  reason: string | null;
  confidence: number | null;
};

const buildSuggestionPlan = (
  suggestions: SuggestionRow[],
  metadata: Map<number, LessonMetadataEntry>,
): { lessons: DashboardLesson[]; messages: string[]; learningPath: LearningPathItem[] } => {
  if (!suggestions.length) {
    return { lessons: [], messages: [], learningPath: [] };
  }

  const lessons: DashboardLesson[] = [];
  const messages: string[] = [];
  const learningPath: LearningPathItem[] = [];

  suggestions.forEach((suggestion) => {
    if (!suggestion.lesson_id) return;
    const entry = metadata.get(suggestion.lesson_id);
    if (!entry) return;

    const subject = (entry.subject ?? 'math') as Subject;
    const message = describeSuggestionReason(
      suggestion.reason,
      entry.title,
      subject,
      suggestion.confidence,
    );

    messages.push(message);

    lessons.push({
      id: suggestion.lesson_id.toString(),
      subject,
      title: entry.title,
      moduleSlug: entry.moduleSlug ?? null,
      status: entry.status ?? 'not_started',
      difficulty: difficultyFromDuration(entry.estimatedDuration),
      xpReward: Math.max(30, (entry.estimatedDuration ?? 15) * 3),
      launchUrl: `/lesson/${suggestion.lesson_id}`,
      suggestionReason: message,
      suggestionConfidence: suggestion.confidence ?? null,
    });

    learningPath.push({
      id: suggestion.lesson_id.toString(),
      subject,
      topic: entry.moduleTitle ?? entry.title,
      concept: suggestion.reason ?? 'adaptive_recommendation',
      difficulty: entry.estimatedDuration ?? 15,
      status: entry.status ?? 'not_started',
      xpReward: Math.max(30, (entry.estimatedDuration ?? 15) * 3),
    });
  });

  return { lessons, messages, learningPath };
};

const mapDailyActivity = (rows: StudentDailyActivityRow[]): StudentDailyActivity[] => {
  if (!rows.length) {
    return fallbackStudentActivity();
  }

  return rows
    .sort((a, b) => new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime())
    .map((row) => ({
      date: formatIsoDate(row.activity_date),
      lessonsCompleted: row.lessons_completed ?? 0,
      practiceMinutes: row.practice_minutes ?? 0,
      aiSessions: row.ai_sessions ?? 0,
      xpEarned: row.xp_earned ?? 0,
      streakPreserved: row.streak_preserved ?? false,
    }));
};

const buildXpTimeline = (rows: XpEventRow[]): XPTimelinePoint[] => {
  if (!rows.length) {
    return allowSyntheticDashboardData
      ? [
          {
            date: new Date().toISOString(),
            xpEarned: 120,
            description: 'Completed adaptive assessment with 92% mastery.',
          },
          {
            date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
            xpEarned: 45,
            description: 'Unlocked Algebra practice streak bonus.',
          },
        ]
      : [];
  }

  return rows.map((row) => ({
    date: formatIsoDate(row.created_at),
    xpEarned: row.xp_change,
    description: row.reason ?? row.source,
  }));
};

const buildAssessmentsSummary = (rows: StudentAssignmentRow[]): AssessmentSummary[] => {
  if (!rows.length) {
    return allowSyntheticDashboardData
      ? [
          {
            id: 'upcoming-1',
            title: 'Math Benchmark Checkpoint',
            scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
            status: 'scheduled',
            masteryTarget: 75,
          },
          {
            id: 'upcoming-2',
            title: 'Science Concept Review',
            scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
            status: 'scheduled',
            masteryTarget: 70,
          },
        ]
      : [];
  }

  return rows.map((row) => {
    const dueAt = row.due_at ? new Date(row.due_at) : null;
    const now = new Date();
    let status: AssessmentSummary['status'] = 'scheduled';
    if (row.status === 'completed') status = 'completed';
    else if (dueAt && dueAt < now) status = 'overdue';

    const masteryTarget =
      (row.assignments?.metadata?.target_mastery as number | undefined | null) ?? undefined;

    return {
      id: row.id.toString(),
      title: row.assignments?.title ?? 'Assignment',
      scheduledAt: dueAt ? dueAt.toISOString() : null,
      status,
      masteryTarget,
    };
  });
};

const deriveAiRecommendations = (
  mastery: SubjectMastery[],
  lessons: DashboardLesson[],
  studyMode?: 'catch_up' | 'keep_up' | 'get_ahead',
): string[] => {
  const recommendations: string[] = [];

  const lowest = mastery.slice().sort((a, b) => a.mastery - b.mastery)[0];
  if (lowest && studyMode !== 'get_ahead') {
    recommendations.push(
      `Focus on ${SUBJECT_LABELS[lowest.subject]} — mastery is at ${Math.round(lowest.mastery)}%.`,
    );
  }

  let pendingLesson: DashboardLesson | undefined = lessons.find((lesson) => lesson.status !== 'completed');
  if (studyMode === 'catch_up') {
    pendingLesson =
      lessons.find((lesson) => lesson.status !== 'completed' && lesson.difficulty !== 'hard') ?? pendingLesson;
  } else if (studyMode === 'get_ahead') {
    pendingLesson =
      lessons.find((lesson) => lesson.status !== 'completed' && lesson.difficulty === 'hard') ?? pendingLesson;
  }
  if (pendingLesson) {
    recommendations.push(
      `Resume "${pendingLesson.title}" to keep your ${SUBJECT_LABELS[pendingLesson.subject]} streak alive.`,
    );
  }

  if (studyMode === 'catch_up') {
    recommendations.unshift('Catch up mode: start with review or weaker skills before new challenges.');
  } else if (studyMode === 'get_ahead') {
    recommendations.unshift('Get ahead mode: try a stretch lesson or extension activity today.');
  }

  if (recommendations.length < 3) {
    recommendations.push('Take a 5-minute reflection break to jot down wins and challenges today.');
  }

  return recommendations;
};

const missionStatusFromTasks = (tasks: Mission['tasks']): Mission['status'] => {
  const completed = tasks.every((task) => task.progress >= task.target);
  if (completed) return 'completed';
  const started = tasks.some((task) => task.progress > 0);
  return started ? 'in_progress' : 'not_started';
};

const buildMissions = (
  student: Student,
  plan: DashboardLesson[],
  activity: StudentDailyActivity[],
): Mission[] => {
  const lessonsCompletedToday = plan.filter((lesson) => lesson.status === 'completed').length;
  const readingCompleted = plan.filter(
    (lesson) => lesson.subject === 'english' && lesson.status === 'completed',
  ).length;
  const practiceMinutesToday =
    activity.length && activity[activity.length - 1]?.practiceMinutes
      ? activity[activity.length - 1].practiceMinutes
      : 0;
  const streak = student.streakDays ?? 0;
  const todayExpiry = new Date();
  todayExpiry.setHours(23, 59, 59, 999);
  const weekExpiry = new Date();
  weekExpiry.setDate(weekExpiry.getDate() + (7 - weekExpiry.getDay()));
  weekExpiry.setHours(23, 59, 59, 999);

  const dailyMission: Mission = {
    id: 'mission-daily-1',
    title: 'Mission of the Day',
    description: 'Complete 2 lessons and a quick reading check-in to keep momentum.',
    cadence: 'daily',
    tasks: [
      { label: 'Lessons finished', target: 2, progress: lessonsCompletedToday, unit: 'lessons', subject: 'any' },
      { label: 'Reading check-in', target: 1, progress: Math.min(readingCompleted, 1), unit: 'lessons', subject: 'english' },
      { label: 'Focus time', target: 30, progress: practiceMinutesToday, unit: 'minutes', subject: 'any' },
    ],
    rewardXp: 80,
    rewardBadgeId: streak >= 6 ? 'streak-7' : null,
    expiresAt: todayExpiry.toISOString(),
    status: 'not_started',
    highlight: streak >= 6 ? '🔥 7-day streak bonus in reach' : 'Finish to keep your streak warm',
  };
  dailyMission.status = missionStatusFromTasks(dailyMission.tasks);

  const weeklyMission: Mission = {
    id: 'mission-weekly-1',
    title: 'Weekly Quest',
    description: 'Finish 5 lessons across two subjects and earn 250 XP.',
    cadence: 'weekly',
    tasks: [
      { label: 'Lessons across subjects', target: 5, progress: lessonsCompletedToday, unit: 'lessons', subject: 'any' },
      { label: 'Math focus', target: 2, progress: plan.filter((lesson) => lesson.subject === 'math' && lesson.status === 'completed').length, unit: 'lessons', subject: 'math' },
      { label: 'XP earned', target: 250, progress: plan.reduce((acc, lesson) => acc + (lesson.status === 'completed' ? lesson.xpReward : 0), 0), unit: 'xp', subject: 'any' },
    ],
    rewardXp: 250,
    rewardBadgeId: 'badge-weekly-quest',
    expiresAt: weekExpiry.toISOString(),
    status: 'not_started',
    highlight: 'Unlocks an avatar accent when completed twice.',
  };
  weeklyMission.status = missionStatusFromTasks(weeklyMission.tasks);

  return [dailyMission, weeklyMission];
};

const avatarLockMessage = (option: AvatarOption, xp: number, streak: number): string => {
  const needs: string[] = [];
  if (option.minXp && xp < option.minXp) {
    needs.push(`${Math.max(option.minXp - xp, 0)} XP to go`);
  }
  if (option.requiredStreak && streak < option.requiredStreak) {
    const remaining = option.requiredStreak - streak;
    needs.push(`${remaining} more day${remaining === 1 ? '' : 's'} on your streak`);
  }
  return needs.length ? `${option.description} (${needs.join(' • ')})` : option.description;
};

const buildAvatarOptions = (student: Student): AvatarOption[] => {
  const xp = student.xp ?? 0;
  const streak = student.streakDays ?? 0;

  return STUDENT_AVATARS.map((option) => {
    const unlocked = isStudentAvatarUnlocked(option, { xp, streakDays: streak });
    return {
      ...option,
      kind: 'student',
      requiredBadges: option.requiredBadges ?? [],
      minXp: option.minXp ?? 0,
      requiredStreak: option.requiredStreak ?? undefined,
      description: unlocked ? option.description : avatarLockMessage(option, xp, streak),
    };
  });
};

const mergeBadgePools = (base: Badge[], extras: Badge[]): Badge[] => {
  const seen = new Set(base.map((badge) => badge.id));
  const merged = [...base];
  extras.forEach((badge) => {
    if (!seen.has(badge.id)) {
      merged.push(badge);
      seen.add(badge.id);
    }
  });
  return merged;
};

const buildDynamicBadges = (params: {
  student: Student;
  quickStats: StudentDashboardData['quickStats'];
  progressLessons: DashboardLesson[];
  subjectMastery: SubjectMastery[];
  lessonMetadata: Map<number, LessonMetadataEntry>;
}): Badge[] => {
  const { quickStats, progressLessons, subjectMastery, lessonMetadata } = params;
  const badges: Badge[] = [];

  if (quickStats.streakDays >= 3) {
    badges.push({
      id: `consistency-${quickStats.streakDays}`,
      name: 'Consistency Champ',
      description: `Logged in ${quickStats.streakDays} days in a row.`,
      icon: '📅',
      earnedAt: new Date(),
      rarity: quickStats.streakDays >= 10 ? 'epic' : 'common',
      category: 'streak',
    });
  }

  const growingSubject = subjectMastery.find((entry) => entry.trend === 'up' && entry.mastery >= 45);
  if (growingSubject) {
    badges.push({
      id: `growth-${growingSubject.subject}`,
      name: `${SUBJECT_LABELS[growingSubject.subject]} Growth`,
      description: `Mastery trending up in ${SUBJECT_LABELS[growingSubject.subject]}.`,
      icon: '📈',
      earnedAt: new Date(),
      rarity: growingSubject.mastery >= 75 ? 'rare' : 'common',
      category: growingSubject.subject,
    });
  }

  const completedLesson = progressLessons.find((lesson) => lesson.status === 'completed');
  if (completedLesson) {
    const numericId = Number.parseInt(completedLesson.id, 10);
    const moduleTitle =
      (!Number.isNaN(numericId) ? lessonMetadata.get(numericId)?.moduleTitle : null) ??
      completedLesson.moduleSlug ??
      completedLesson.title;
    badges.push({
      id: `module-${completedLesson.moduleSlug ?? completedLesson.id}`,
      name: 'Module Finisher',
      description: `Closed out ${moduleTitle ?? 'a module'} with today’s effort.`,
      icon: '🏁',
      earnedAt: new Date(),
      rarity: 'rare',
      category: completedLesson.subject,
    });
  }

  return badges;
};

const buildCelebrationMoments = (
  student: Student,
  badges: Badge[],
  quickStats: StudentDashboardData['quickStats'],
  assessments: AssessmentSummary[],
  subjectMastery: SubjectMastery[] = [],
): CelebrationMoment[] => {
  const moments: CelebrationMoment[] = [];
  const latestBadge = badges[0];
  if (latestBadge) {
    moments.push({
      id: `badge-${latestBadge.id}`,
      title: `New badge: ${latestBadge.name}`,
      description: latestBadge.description,
      kind: 'badge',
      occurredAt: latestBadge.earnedAt.toISOString(),
      studentId: student.id,
      prompt: 'Ask your parent to celebrate this win together tonight.',
      notifyParent: true,
    });
  }

  if (
    quickStats.streakDays &&
    [3, 7, 14, 30].includes(quickStats.streakDays)
  ) {
    moments.push({
      id: `streak-${quickStats.streakDays}`,
      title: `${quickStats.streakDays}-day streak!`,
      description: 'Consistency unlocks your next avatar accent.',
      kind: 'streak',
      occurredAt: new Date().toISOString(),
      studentId: student.id,
      prompt: 'Share a high-five GIF with your family.',
      notifyParent: true,
    });
  }

  const completedAssessment = assessments.find((item) => item.status === 'completed');
  if (completedAssessment) {
    moments.push({
      id: `assessment-${completedAssessment.id}`,
      title: 'Assessment completed',
      description: `Finished ${completedAssessment.title}`,
      kind: 'assessment',
      occurredAt: completedAssessment.scheduledAt ?? new Date().toISOString(),
      studentId: student.id,
      prompt: 'Log how you felt about it in 2 sentences.',
      notifyParent: false,
    });
  }

  const masteryHighlight = subjectMastery.find((entry) => entry.mastery >= 80);
  if (masteryHighlight) {
    moments.push({
      id: `mastery-${masteryHighlight.subject}-${Math.round(masteryHighlight.mastery)}`,
      title: `${SUBJECT_LABELS[masteryHighlight.subject]} mastery unlocked`,
      description: `You reached ${Math.round(masteryHighlight.mastery)}% in ${SUBJECT_LABELS[masteryHighlight.subject]}.`,
      kind: 'mastery',
      occurredAt: new Date().toISOString(),
      studentId: student.id,
      prompt: 'Pick a stretch goal or quick recap to keep it steady.',
      notifyParent: true,
    });
  }

  const accuracyImprovement = subjectMastery.find((entry) => entry.trend === 'up' && entry.mastery >= 60);
  if (accuracyImprovement) {
    moments.push({
      id: `accuracy-${accuracyImprovement.subject}-${Math.round(accuracyImprovement.mastery)}`,
      title: 'Accuracy trending up',
      description: `${SUBJECT_LABELS[accuracyImprovement.subject]} is rising—keep the momentum.`,
      kind: 'milestone',
      occurredAt: new Date().toISOString(),
      studentId: student.id,
      prompt: 'Do a 3-question quick check to lock it in.',
      notifyParent: true,
    });
  }

  if (!moments.length) {
    moments.push({
      id: 'celebration-placeholder',
      title: 'Momentum rising',
      description: 'Complete today’s mission to unlock a celebration moment.',
      kind: 'milestone',
      occurredAt: new Date().toISOString(),
      studentId: student.id,
      prompt: 'Complete two lessons to trigger a celebration.',
      notifyParent: false,
    });
  }

  return moments;
};

const toStringArray = (input: unknown): string[] => {
  if (Array.isArray(input)) {
    return input
      .map((item) => (typeof item === 'string' ? item : typeof item === 'number' ? item.toString() : null))
      .filter((item): item is string => item !== null);
  }

  if (typeof input === 'string' && input.trim().length > 0) {
    return [input.trim()];
  }

  return [];
};

const aggregateParentActivity = (
  rows: StudentDailyActivityRow[],
  childIds: string[],
): ParentActivityPoint[] => {
  if (!rows.length) {
    return fallbackStudentActivity().map((entry) => ({
      date: entry.date,
      lessonsCompleted: entry.lessonsCompleted,
      practiceMinutes: entry.practiceMinutes,
    }));
  }

  const grouped = new Map<string, { lessons: number; minutes: number }>();

  rows.forEach((row) => {
    if (!childIds.includes(row.student_id)) return;
    const key = formatIsoDate(row.activity_date);
    const entry = grouped.get(key) ?? { lessons: 0, minutes: 0 };
    entry.lessons += row.lessons_completed ?? 0;
    entry.minutes += row.practice_minutes ?? 0;
    grouped.set(key, entry);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, value]) => ({
      date,
      lessonsCompleted: value.lessons,
      practiceMinutes: value.minutes,
    }));
};

const buildAdaptivePlanNotes = (child: ParentChildSnapshot): string[] => {
  const notes: string[] = [];

  const sortedByMastery = child.masteryBySubject.slice().sort((a, b) => a.mastery - b.mastery);
  const lowest = sortedByMastery[0];
  const highest = sortedByMastery[sortedByMastery.length - 1];

  if (lowest) {
    notes.push(
      `We dialed up ${SUBJECT_LABELS[lowest.subject]} because mastery is at ${Math.round(lowest.mastery)}%.`,
    );
  }

  if (child.focusAreas.length) {
    notes.push(
      `Extra practice on ${child.focusAreas.slice(0, 2).join(' & ')} from the latest diagnostic results.`,
    );
  }

  if (highest && highest !== lowest) {
    notes.push(
      `Keeping ${SUBJECT_LABELS[highest.subject]} lighter while we close gaps elsewhere.`,
    );
  }

  if (!notes.length) {
    notes.push('Adaptive explanations will appear after the first diagnostic and lesson picks.');
  }

  return notes;
};

const buildSkillGapInsights = (child: ParentChildSnapshot): SkillGapInsight[] => {
  if (!child.masteryBySubject.length) return [];
  const sorted = child.masteryBySubject.slice().sort((a, b) => a.mastery - b.mastery).slice(0, 2);
  const focusConcepts = Array.from(new Set(child.focusAreas)).filter(Boolean).slice(0, 4);

  return sorted.map((entry) => {
    const status: SkillGapInsight['status'] =
      entry.mastery < 55 || (entry.delta ?? 0) < -5
        ? 'needs_attention'
        : entry.trend === 'up'
        ? 'improving'
        : 'watch';

    const concepts = focusConcepts.length
      ? focusConcepts
      : [`Core ${SUBJECT_LABELS[entry.subject]} skills`];

    const actions = Array.from(
      new Set<string>([
        `Assign a ${SUBJECT_LABELS[entry.subject]} module that reinforces ${concepts[0]}.`,
        `Encourage a 10-minute practice set on ${concepts[0]} to lift accuracy.`,
        `Ask the AI tutor to review the last ${SUBJECT_LABELS[entry.subject]} session and flag mistakes together.`,
      ]),
    );

    return {
      subject: entry.subject,
      mastery: entry.mastery,
      status,
      summary: `${child.name}'s ${SUBJECT_LABELS[entry.subject]} mastery is ${Math.round(entry.mastery)}%.`,
      concepts,
      actions: actions.slice(0, 3),
    };
  });
};

const deriveParentAlerts = (children: ParentChildSnapshot[]): ParentAlert[] => {
  const alerts: ParentAlert[] = [];

  children.forEach((child) => {
    if (child.progressSummary && child.progressSummary.notStarted >= child.progressSummary.completed + 3) {
      alerts.push({
        id: `${child.id}-backlog`,
        type: 'info',
        message: `${child.name} has ${child.progressSummary.notStarted} lessons waiting to be started. Consider scheduling a focus block.`,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        studentId: child.id,
      });
    }

    if (child.focusAreas.length >= 2) {
      alerts.push({
        id: `${child.id}-focus`,
        type: 'warning',
        message: `${child.name} needs extra support in ${child.focusAreas.slice(0, 2).join(' & ')}.`,
        createdAt: new Date().toISOString(),
        studentId: child.id,
      });
    }

    if (child.lessonsCompletedWeek >= 8) {
      alerts.push({
        id: `${child.id}-celebrate`,
        type: 'success',
        message: `${child.name} completed ${child.lessonsCompletedWeek} lessons this week. Celebrate the momentum!`,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
        studentId: child.id,
      });
    }
  });

  if (!alerts.length) {
    return fallbackParentAlerts();
  }

  return alerts;
};

const calculateChildGoalProgress = (child: ParentChildSnapshot): number | undefined => {
  const segments: number[] = [];

  if (child.goals?.weeklyLessons && child.goals.weeklyLessons > 0) {
    segments.push(Math.min((child.lessonsCompletedWeek / child.goals.weeklyLessons) * 100, 200));
  }

  if (child.goals?.practiceMinutes && child.goals.practiceMinutes > 0) {
    segments.push(
      Math.min((child.practiceMinutesWeek / child.goals.practiceMinutes) * 100, 200),
    );
  }

  child.masteryBySubject.forEach((entry) => {
    const target = child.goals?.masteryTargets?.[entry.subject] ?? entry.goal;
    if (target && target > 0) {
      segments.push(Math.min((entry.mastery / target) * 100, 200));
    }
  });

  if (!segments.length) return undefined;

  const average = segments.reduce((acc, value) => acc + value, 0) / segments.length;
  return Math.round(average * 10) / 10;
};

export const deriveSubjectTrends = (
  mastery: SubjectMastery[],
  accuracyWindow: Map<Subject, { current: number[]; prior: number[] }> | undefined,
  lessonWindow: { current: Map<Subject, number>; prior: Map<Subject, number> } | undefined,
  weeklyMinutes: { current: number; prior: number },
): SubjectWeeklyTrend[] => {
  const average = (values: number[]) =>
    values.length ? values.reduce((acc, value) => acc + value, 0) / values.length : null;

  const currentLessons = lessonWindow?.current ?? new Map<Subject, number>();
  const priorLessons = lessonWindow?.prior ?? new Map<Subject, number>();
  const totalLessonsCurrent = Array.from(currentLessons.values()).reduce((acc, value) => acc + value, 0);
  const totalLessonsPrior = Array.from(priorLessons.values()).reduce((acc, value) => acc + value, 0);
  const minutesWindow = weeklyMinutes ?? { current: 0, prior: 0 };

  return mastery.map((entry) => {
    const accuracy = accuracyWindow?.get(entry.subject);
    const currentAccuracy = accuracy ? average(accuracy.current) : null;
    const priorAccuracy = accuracy ? average(accuracy.prior) : null;
    const accuracyDelta =
      currentAccuracy != null && priorAccuracy != null ? currentAccuracy - priorAccuracy : null;
    const subjectLessonsCurrent = currentLessons.get(entry.subject) ?? 0;
    const subjectLessonsPrior = priorLessons.get(entry.subject) ?? 0;
    const estimatedTimeCurrent =
      totalLessonsCurrent > 0
        ? (minutesWindow.current * subjectLessonsCurrent) / Math.max(totalLessonsCurrent, 1)
        : subjectLessonsCurrent * 12;
    const estimatedTimePrior =
      totalLessonsPrior > 0
        ? (minutesWindow.prior * subjectLessonsPrior) / Math.max(totalLessonsPrior, 1)
        : subjectLessonsPrior * 12;
    const timeDelta = estimatedTimeCurrent - estimatedTimePrior;

    const trendDirection: SubjectWeeklyTrend['direction'] =
      accuracyDelta != null
        ? accuracyDelta > 0.25
          ? 'up'
          : accuracyDelta < -0.25
            ? 'down'
            : 'steady'
        : entry.trend ?? 'steady';

    return {
      subject: entry.subject,
      mastery: entry.mastery,
      accuracyDelta: accuracyDelta != null ? Math.round(accuracyDelta * 10) / 10 : null,
      timeDelta: Math.round(timeDelta),
      timeMinutes: Math.round(estimatedTimeCurrent),
      direction: trendDirection,
    };
  });
};

export const summarizeWeeklyChanges = (
  children: ParentChildSnapshot[],
): { improvements: string[]; risks: string[] } => {
  const improvements: Array<{ text: string; score: number }> = [];
  const risks: Array<{ text: string; score: number }> = [];

  children.forEach((child) => {
    (child.subjectTrends ?? []).forEach((trend) => {
      if (trend.accuracyDelta != null && Math.abs(trend.accuracyDelta) >= 0.5) {
        const text = `${child.name}: ${formatSubjectLabel(trend.subject)} accuracy ${trend.accuracyDelta > 0 ? '+' : ''}${Math.round(trend.accuracyDelta * 10) / 10} pts vs last week.`;
        const bucket = trend.accuracyDelta > 0 ? improvements : risks;
        bucket.push({ text, score: Math.abs(trend.accuracyDelta) });
      }
      if (trend.timeDelta != null && Math.abs(trend.timeDelta) >= 8) {
        const text = `${child.name}: ${trend.timeDelta > 0 ? '+' : ''}${Math.round(trend.timeDelta)} min on ${formatSubjectLabel(trend.subject)} this week.`;
        const bucket = trend.timeDelta > 0 ? improvements : risks;
        bucket.push({ text, score: Math.abs(trend.timeDelta) / 10 });
      }
    });

    if (child.weeklyChange) {
      const { deltaLessons, deltaMinutes } = child.weeklyChange;
      if (Math.abs(deltaLessons) > 0) {
        const text = `${child.name}: ${deltaLessons >= 0 ? '+' : ''}${deltaLessons} lessons vs prior week.`;
        const bucket = deltaLessons >= 0 ? improvements : risks;
        bucket.push({ text, score: Math.max(1, Math.abs(deltaLessons)) * 0.8 });
      }
      if (Math.abs(deltaMinutes) >= 10) {
        const text = `${child.name}: ${deltaMinutes >= 0 ? '+' : ''}${Math.round(deltaMinutes)} min vs prior week.`;
        const bucket = deltaMinutes >= 0 ? improvements : risks;
        bucket.push({ text, score: Math.max(1, Math.abs(deltaMinutes)) / 10 });
      }
    }
  });

  const selectTop = (entries: Array<{ text: string; score: number }>) =>
    entries
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.text);

  const pickedImprovements = selectTop(improvements);
  const pickedRisks = selectTop(risks);

  return {
    improvements: pickedImprovements.length ? pickedImprovements : ['Steady week—no clear gains yet.'],
    risks: pickedRisks.length ? pickedRisks : ['No new risks flagged this week.'],
  };
};

export { calculateChildGoalProgress };

export const buildParentDownloadableReport = (
  parent: Parent,
  report: ParentWeeklyReport,
  children: ParentChildSnapshot[],
): string => {
  const weekLabel = new Date(report.weekStart).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const diagnosticCompletionRate =
    children.length > 0
      ? Math.round(
          (children.filter((child) => child.diagnosticStatus === 'completed').length / children.length) *
            100,
        )
      : null;

  const accuracyDeltas = children
    .map((child) => child.avgAccuracyDelta)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const familyAccuracyDelta =
    accuracyDeltas.length > 0
      ? Math.round((accuracyDeltas.reduce((sum, value) => sum + value, 0) / accuracyDeltas.length) * 10) /
        10
      : null;

  const familyWeeklyDelta = children.reduce(
    (acc, child) => ({
      deltaLessons: acc.deltaLessons + (child.weeklyChange?.deltaLessons ?? 0),
      deltaMinutes: acc.deltaMinutes + (child.weeklyChange?.deltaMinutes ?? 0),
    }),
    { deltaLessons: 0, deltaMinutes: 0 },
  );

  const impactParts: string[] = [];
  if (familyAccuracyDelta != null) {
    impactParts.push(
      `Avg accuracy ${familyAccuracyDelta > 0 ? '+' : ''}${familyAccuracyDelta} pts vs last week`,
    );
  }
  if (familyWeeklyDelta.deltaLessons !== 0 || familyWeeklyDelta.deltaMinutes !== 0) {
    impactParts.push(
      `${familyWeeklyDelta.deltaLessons >= 0 ? '+' : ''}${familyWeeklyDelta.deltaLessons} lessons, ${familyWeeklyDelta.deltaMinutes >= 0 ? '+' : ''}${familyWeeklyDelta.deltaMinutes} min vs last week`,
    );
  }
  if (diagnosticCompletionRate != null) {
    impactParts.push(`${diagnosticCompletionRate}% diagnostics complete`);
  }
  const impactText =
    impactParts.length > 0 ? impactParts.join(' • ') : 'No impact metrics yet—complete a few lessons to start tracking.';

  const childLines = children
    .map((child) => {
      const masterySummary = child.masteryBySubject
        .map((subject) => {
          const label = formatSubjectLabel(subject.subject);
          const masteryValue = Math.round(subject.mastery);
          const goalDetail = subject.goal ? ` (goal ${subject.goal}%)` : '';
          return `${label} ${masteryValue}%${goalDetail}`;
        })
        .join(', ');

      return `- ${child.name}: ${child.lessonsCompletedWeek} lessons, ${child.practiceMinutesWeek} minutes, ${child.xpEarnedWeek} XP | Mastery: ${masterySummary}`;
    })
    .join('\n');

  const highlights = (report.highlights ?? []).map((item) => `• ${item}`).join('\n') || '• No highlights yet.';
  const recommendations =
    (report.recommendations ?? []).map((item) => `• ${item}`).join('\n') ||
    '• Add one small goal per learner to guide next week.';
  const changes = report.changes ?? summarizeWeeklyChanges(children);
  const improvements =
    (changes.improvements ?? []).map((item) => `• ${item}`).join('\n') ||
    '• Steady week—no clear gains yet.';
  const risks =
    (changes.risks ?? []).map((item) => `• ${item}`).join('\n') ||
    '• No new risks flagged this week.';

  return `ElevatED Weekly Family Report\nParent: ${parent.name}\nWeek of ${weekLabel}\n\nImpact snapshot:\n${impactText}\n\nSummary:\n${report.summary}\n\nHighlights:\n${highlights}\n\nLearner Details:\n${childLines}\n\nRecommended Next Steps:\n${recommendations}\n\nWhat changed this week:\nTop improvements:\n${improvements}\n\nTop risks:\n${risks}`;
};

const buildParentCelebrations = (children: ParentChildSnapshot[]): CelebrationMoment[] => {
  const celebrations: CelebrationMoment[] = [];
  const streakMilestones = new Set([3, 7, 14, 30]);

  children.forEach((child) => {
    if (child.streakDays && (child.streakDays >= 7 || streakMilestones.has(child.streakDays))) {
      celebrations.push({
        id: `${child.id}-streak-${child.streakDays}`,
        title: `${child.name} hit a ${child.streakDays}-day streak`,
        description: 'Consistency like this deserves a shoutout.',
        kind: 'streak',
        occurredAt: new Date().toISOString(),
        studentId: child.id,
        prompt: 'Snap a photo of their study spot to celebrate the streak.',
        notifyParent: true,
      });
    }

    const accuracyGain = (child.subjectTrends ?? [])
      .filter((trend) => typeof trend.accuracyDelta === 'number' && trend.accuracyDelta >= 0.5)
      .sort((a, b) => (b.accuracyDelta ?? 0) - (a.accuracyDelta ?? 0))[0];
    if (accuracyGain?.accuracyDelta != null) {
      celebrations.push({
        id: `${child.id}-accuracy-${accuracyGain.subject}`,
        title: `${child.name} boosted ${formatSubjectLabel(accuracyGain.subject)} accuracy`,
        description: `${accuracyGain.accuracyDelta > 0 ? '+' : ''}${accuracyGain.accuracyDelta} pts vs last week.`,
        kind: 'milestone',
        occurredAt: new Date().toISOString(),
        studentId: child.id,
        prompt: 'Call out the win and encourage one more short session.',
        notifyParent: true,
      });
    }

    const masteryWin = (child.masteryBySubject ?? []).find(
      (entry) => (entry.goal ?? 0) > 0 && entry.mastery >= (entry.goal ?? 0),
    );
    if (masteryWin) {
      celebrations.push({
        id: `${child.id}-mastery-${masteryWin.subject}`,
        title: `${child.name} crossed a mastery goal`,
        description: `${formatSubjectLabel(masteryWin.subject)} goal met`,
        kind: 'mastery',
        occurredAt: new Date().toISOString(),
        studentId: child.id,
        prompt: 'Ask them how they cracked the hardest part.',
        notifyParent: true,
      });
    }

    const masteryUnlocked = (child.masteryBySubject ?? [])
      .filter((entry) => entry.mastery >= 80)
      .sort((a, b) => b.mastery - a.mastery)[0];
    if (masteryUnlocked && masteryUnlocked.subject !== masteryWin?.subject) {
      celebrations.push({
        id: `${child.id}-mastery-unlocked-${masteryUnlocked.subject}`,
        title: `${child.name} unlocked ${formatSubjectLabel(masteryUnlocked.subject)} mastery`,
        description: `Reached ${Math.round(masteryUnlocked.mastery)}% mastery.`,
        kind: 'mastery',
        occurredAt: new Date().toISOString(),
        studentId: child.id,
        prompt: 'Share a quick praise note and ask what felt easier.',
        notifyParent: true,
      });
    }

    if (child.goalProgress && child.goalProgress >= 100) {
      celebrations.push({
        id: `${child.id}-goals`,
        title: `${child.name} finished this week’s goals`,
        description: 'Lessons, practice minutes, or mastery targets are all on track.',
        kind: 'milestone',
        occurredAt: new Date().toISOString(),
        studentId: child.id,
        prompt: 'Offer a mini reward or shoutout at dinner.',
        notifyParent: true,
      });
    }
  });

  return celebrations.slice(0, 6);
};

const buildCelebrationPrompts = (celebrations: CelebrationMoment[]): string[] => {
  if (!celebrations.length) {
    return [
      'Ask: “What felt different about learning this week?”',
      'Record a 10-second voice note cheering on today’s effort.',
    ];
  }

  return celebrations
    .slice(0, 3)
    .map((moment) => moment.prompt ?? 'Share one sentence of praise today.');
};

const buildAdminAlerts = (
  metrics: AdminDashboardMetrics,
  subjectPerformance: AdminSubjectPerformance[],
  admin: Admin,
  lessonCompletionRate?: number | null,
): AdminAlert[] => {
  const alerts: AdminAlert[] = [];

  if (metrics.activeStudents7d / metrics.totalStudents < 0.6) {
    alerts.push({
      id: 'admin-engagement',
      severity: 'high',
      title: 'Engagement Dip',
      description:
        'Less than 60% of students were active in the last 7 days. Consider scheduling a re-engagement campaign.',
      createdAt: new Date().toISOString(),
    });
  }

  const lowestSubject = subjectPerformance.slice().sort((a, b) => a.mastery - b.mastery)[0];
  if (lowestSubject && lowestSubject.mastery < 55) {
    alerts.push({
      id: 'admin-subject',
      severity: 'medium',
      title: `${SUBJECT_LABELS[lowestSubject.subject]} Mastery Alert`,
      description: `Average mastery in ${SUBJECT_LABELS[lowestSubject.subject]} is ${Math.round(
        lowestSubject.mastery,
      )}%. Review lesson pacing and diagnostics for struggling cohorts.`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    });
  }

  if (lessonCompletionRate != null && lessonCompletionRate < 0.5) {
    alerts.push({
      id: 'admin-completion',
      severity: 'medium',
      title: 'Lesson Completion Lag',
      description: `Lesson completion is tracking at ${Math.round(
        lessonCompletionRate * 100,
      )}%. Consider reinforcing pacing expectations or additional supports.`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    });
  }

  return alerts.length ? alerts : fallbackAdminData(admin).alerts;
};

export const fetchStudentDashboardData = async (
  student: Student,
): Promise<StudentDashboardData> => {
  ensureLearningPreferences(student);
  try {
    const [
      { data: profileRow, error: profileError },
      { data: activityRows, error: activityError },
      { data: assessmentAttemptRow, error: assessmentAttemptError },
      { data: parentGoalRow, error: parentGoalError },
    ] =
      await Promise.all([
        supabase
          .from('student_profiles')
          .select('xp, level, streak_days, assessment_completed, learning_path, learning_style')
          .eq('id', student.id)
          .single(),
        supabase
          .from('student_daily_activity')
          .select('*')
          .eq('student_id', student.id)
          .gte('activity_date', new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()),
        supabase
          .from('student_assessment_attempts')
          .select('status, completed_at')
          .eq('student_id', student.id)
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc('get_student_parent_goals'),
      ]);

    if (profileError) {
      console.error('[Dashboard] Failed to refresh student profile', profileError);
    } else if (profileRow) {
      student.xp = profileRow.xp ?? student.xp;
      student.level = profileRow.level ?? student.level;
      student.streakDays = profileRow.streak_days ?? student.streakDays;
      student.assessmentCompleted = profileRow.assessment_completed ?? student.assessmentCompleted;
      if (profileRow.learning_path) {
        student.learningPath = profileRow.learning_path as Student['learningPath'];
      }
      if (profileRow.learning_style) {
        student.learningPreferences = castLearningPreferences(profileRow.learning_style);
      }
    }

    const assessmentAttempt = (assessmentAttemptRow as AssessmentAttemptRow | null) ?? null;
    if (assessmentAttemptError) {
      console.error('[Dashboard] Failed to check assessment attempt status', assessmentAttemptError);
    }
    if (assessmentAttempt) {
      student.assessmentCompleted = assessmentAttempt.status === 'completed';
    }

    const preferences = ensureLearningPreferences(student);
    const activity = activityError ? fallbackStudentActivity() : mapDailyActivity(activityRows ?? []);
    if (parentGoalError) {
      console.warn('[Dashboard] Failed to load parent goals', parentGoalError);
    }
    const parentGoals =
      (parentGoalRow as ParentGoalRow | null) && (parentGoalRow as ParentGoalRow)
        ? {
            weeklyLessons: parentGoalRow.weekly_lessons_target ?? null,
            practiceMinutes: parentGoalRow.practice_minutes_target ?? null,
          }
        : null;
    const planPreferences: LearningPreferences = {
      ...preferences,
      studyModeLocked: preferences.studyModeLocked || Boolean(parentGoals),
      studyMode:
        preferences.studyMode === 'get_ahead' && (preferences.studyModeLocked || Boolean(parentGoals))
          ? 'keep_up'
          : preferences.studyMode,
    };
    const weeklyTargets = computeWeeklyPlanTargets(parentGoals, planPreferences.weeklyPlanIntensity);
    const weeklyProgress = computeWeeklyProgress(activity);

    const [
      { data: masteryRows, error: masteryError },
      { data: xpRows, error: xpError },
      { data: assignmentsRows, error: assignmentsError },
      { data: progressRows, error: progressError },
      { data: suggestionRows, error: suggestionError },
    ] =
      await Promise.all([
        supabase
          .from('student_mastery_by_subject')
          .select('subject, mastery, cohort_average')
          .eq('student_id', student.id),
        supabase
          .from('xp_events')
          .select('id, source, xp_change, reason, created_at')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('student_assignments')
          .select('id, status, due_at, assignments( id, title, metadata )')
          .eq('student_id', student.id)
          .order('due_at', { ascending: true })
          .limit(4),
        supabase
          .from('student_progress')
          .select(
            `lesson_id, status, mastery_pct, attempts, last_activity_at,
             lessons (
               id,
               title,
               estimated_duration_minutes,
               open_track,
               module_id,
               modules ( id, title, subject, slug )
             )`,
          )
          .eq('student_id', student.id)
          .order('last_activity_at', { ascending: false })
          .limit(20),
        supabase.rpc('suggest_next_lessons', {
          p_student_id: student.id,
          limit_count: Math.max(2, maxLessonsForSession[planPreferences.sessionLength] ?? 3),
        }),
      ]);

    if (masteryError) {
      console.error('[Dashboard] Failed to load mastery metrics', masteryError);
    }
    if (xpError) {
      console.error('[Dashboard] Failed to load XP events', xpError);
    }
    if (assignmentsError) {
      console.error('[Dashboard] Failed to load assignments', assignmentsError);
    }
    if (progressError) {
      console.error('[Dashboard] Failed to load lesson progress', progressError);
    }
    if (suggestionError) {
      console.error('[Dashboard] Failed to load adaptive suggestions', suggestionError);
    }

    const subjectMastery = masteryRows
      ? mapSubjectMasteryFromRollup((masteryRows as SubjectMasteryAggregateRow[]) ?? [])
      : fallbackStudentMastery();

    const progressData = (progressRows as StudentProgressLessonRow[]) ?? [];
    const { lessons: progressLessons, metadata: lessonMetadata } = mapProgressLessons(progressData);

    const suggestionData = (suggestionRows as SuggestionRow[]) ?? [];

    const missingSuggestionIds = suggestionData
      .map((row) => (row.lesson_id ?? null))
      .filter((id): id is number => typeof id === 'number' && !lessonMetadata.has(id));

    if (missingSuggestionIds.length) {
      const { data: suggestionLessonRows, error: suggestionLessonsError } = await supabase
        .from('lessons')
        .select(
          'id, title, estimated_duration_minutes, open_track, module_id, modules ( id, title, subject, slug )',
        )
        .in('id', missingSuggestionIds);

      if (suggestionLessonsError) {
        console.error('[Dashboard] Failed to hydrate suggested lessons', suggestionLessonsError);
      } else {
        (suggestionLessonRows ?? []).forEach((lesson) => {
          const subject = normalizeSubject(lesson.modules?.subject ?? null);
          lessonMetadata.set(lesson.id as number, {
            lessonId: lesson.id as number,
            title: (lesson.title as string) ?? 'Lesson',
            subject: subject,
            moduleTitle: (lesson.modules?.title as string | null) ?? null,
            moduleSlug: (lesson.modules as { slug?: string } | null)?.slug ?? null,
            estimatedDuration: (lesson.estimated_duration_minutes as number | null) ?? null,
            status: 'not_started',
            masteryPct: null,
          });
        });
      }
    }

    const suggestionPlan = buildSuggestionPlan(suggestionData, lessonMetadata);

    if (suggestionPlan.learningPath.length) {
      const existingPath = JSON.stringify(student.learningPath ?? []);
      const nextPath = JSON.stringify(suggestionPlan.learningPath);
      if (existingPath !== nextPath) {
        student.learningPath = suggestionPlan.learningPath;
        try {
          await supabase.from('student_profiles').update({ learning_path: suggestionPlan.learningPath }).eq('id', student.id);
        } catch (pathError) {
          console.warn('[Dashboard] Failed to persist learning path suggestions', pathError);
        }
      }
    }

    let electiveSuggestion: DashboardLesson | null = null;
    const todaysPlan: DashboardLesson[] = await (async () => {
      const plan: DashboardLesson[] = [];
      const seen = new Set<string>();
      const desiredCount = maxLessonsForSession[planPreferences.sessionLength] ?? 4;
      const fillTarget = Math.max(4, desiredCount * 2);

      const pushLesson = (lesson: DashboardLesson) => {
        if (seen.has(lesson.id)) return;
        seen.add(lesson.id);
        plan.push(lesson);
      };

      suggestionPlan.lessons.forEach(pushLesson);
      progressLessons.forEach(pushLesson);

      if (plan.length < fillTarget) {
        const fallbackLessons = buildLessonsFromLearningPath(student);
        fallbackLessons.forEach((lesson) => {
          if (plan.length >= fillTarget) return;
          pushLesson(lesson);
        });
      }

      if (plan.length === 0) {
        return fallbackStudentLessons();
      }

      const weekStart = (() => {
        const base = new Date();
        const day = base.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const start = new Date(base);
        start.setDate(base.getDate() + diff);
        return start.toISOString().slice(0, 10);
      })();

      const optOuts = student?.id ? await listPlanOptOuts(student.id, weekStart) : { mixIns: new Set<string>(), electives: new Set<string>() };

      let normalized = normalizePlanBySubject(plan, planPreferences);
      const crossPool = Array.from(
        new Map(
          [...progressLessons, ...buildLessonsFromLearningPath(student)].map((lesson) => [lesson.id, lesson]),
        ).values(),
      );
      normalized = injectMixInsIntoPlan(
        normalized,
        planPreferences,
        weeklyTargets,
        weeklyProgress,
        optOuts.mixIns,
        crossPool,
      );
      const electiveResult = selectElectiveSuggestion(
        normalized,
        planPreferences,
        weeklyTargets,
        weeklyProgress,
        student,
        optOuts.electives,
      );
      normalized = electiveResult.plan;
      electiveSuggestion = electiveResult.elective
        ? electiveResult.plan.find((lesson) => lesson.id === electiveResult.elective?.id) ?? null
        : null;
      return normalized.length
        ? applyLearningPreferencesToPlan(normalized, planPreferences)
        : applyLearningPreferencesToPlan(plan, planPreferences);
    })();

    const activityLineup = buildActivityLineup(todaysPlan, lessonMetadata, student.grade);

    todaysPlan.forEach((lesson) => {
      const numericId = Number.parseInt(lesson.id, 10);
      if (!Number.isNaN(numericId)) {
        if (!lessonMetadata.has(numericId)) {
          lessonMetadata.set(numericId, {
            lessonId: numericId,
            title: lesson.title,
            subject: lesson.subject,
            moduleTitle: null,
            estimatedDuration: null,
            status: lesson.status,
            masteryPct: null,
          });
        }
      }
    });

    const activeLesson = todaysPlan.find((lesson) => lesson.status !== 'completed') ?? todaysPlan[0] ?? null;
    const xpTimeline = buildXpTimeline((xpRows as XpEventRow[]) ?? []);
    const assessments = buildAssessmentsSummary((assignmentsRows as StudentAssignmentRow[]) ?? []);
    const quickStats = ensureStudentQuickStats(student, activity);
    const dynamicBadges = buildDynamicBadges({
      student,
      quickStats,
      progressLessons,
      subjectMastery,
      lessonMetadata,
    });
    const badgePool = mergeBadgePools(student.badges ?? [], dynamicBadges);
    student.badges = badgePool;
    let aiRecommendations = suggestionPlan.messages;
    if (!aiRecommendations.length) {
      aiRecommendations = deriveAiRecommendations(
        subjectMastery,
        todaysPlan,
        planPreferences.studyMode as 'catch_up' | 'keep_up' | 'get_ahead' | undefined,
      );
    }
    const recentBadges = badgePool.slice(0, 3);
    const missions = buildMissions(student, todaysPlan, activity);
    const celebrationMoments = buildCelebrationMoments(student, badgePool, quickStats, assessments, subjectMastery);
    const avatarOptions = buildAvatarOptions(student);

    return {
      profile: student,
      parentGoals,
      quickStats,
      todaysPlan,
      subjectMastery,
      dailyActivity: activity,
      recentBadges,
      xpTimeline,
      aiRecommendations,
      upcomingAssessments: assessments,
      activeLessonId: activeLesson?.id ?? null,
      nextLessonUrl: activeLesson?.launchUrl ?? null,
      missions,
      celebrationMoments,
      avatarOptions,
      equippedAvatarId: student.avatar ?? null,
      todayActivities: activityLineup,
      electiveSuggestion,
    };
  } catch (error) {
    console.error('[Dashboard] Student dashboard fallback engaged', error);
    const fallbackActivity = fallbackStudentActivity();
    const fallbackQuickStats = ensureStudentQuickStats(student, fallbackActivity);
    const fallbackAssessments = buildAssessmentsSummary([]);
    const fallbackLessons = fallbackStudentLessons();
    const fallbackSubjectMastery = fallbackStudentMastery();
    const fallbackBadges = buildDynamicBadges({
      student,
      quickStats: fallbackQuickStats,
      progressLessons: fallbackLessons,
      subjectMastery: fallbackSubjectMastery,
      lessonMetadata: new Map(),
    });
    const badgePool = mergeBadgePools(student.badges ?? [], fallbackBadges);
    student.badges = badgePool;
    return {
      profile: student,
      quickStats: fallbackQuickStats,
      todaysPlan: fallbackLessons,
      subjectMastery: fallbackSubjectMastery,
      dailyActivity: fallbackActivity,
      recentBadges: badgePool.slice(0, 3),
      xpTimeline: buildXpTimeline([]),
      aiRecommendations: deriveAiRecommendations(
        fallbackSubjectMastery,
        fallbackLessons,
        planPreferences.studyMode as 'catch_up' | 'keep_up' | 'get_ahead' | undefined,
      ),
      upcomingAssessments: fallbackAssessments,
      activeLessonId: null,
      nextLessonUrl: null,
      missions: buildMissions(student, fallbackLessons, fallbackActivity),
      celebrationMoments: buildCelebrationMoments(
        student,
        badgePool,
        fallbackQuickStats,
        fallbackAssessments,
        fallbackSubjectMastery,
      ),
      avatarOptions: buildAvatarOptions(student),
      equippedAvatarId: student.avatar ?? null,
      todayActivities: buildActivityLineup(fallbackLessons, new Map(), student.grade),
      parentGoals: null,
      electiveSuggestion: null,
    };
  }
};

export const fetchParentDashboardData = async (
  parent: Parent,
): Promise<ParentDashboardData> => {
  try {
    const dashboardWeekSeed = new Date().toISOString().slice(0, 10);

    const { data: childRows, error: childrenError } = await supabase
      .from('parent_dashboard_children')
      .select('*')
      .eq('parent_id', parent.id);

    if (childrenError) {
      console.error('[Dashboard] Parent children fetch failed', childrenError);
    }

    const liveChildren = (childRows as ParentDashboardChildRow[])?.map(mapParentDashboardChildRow) ?? [];
    const baseChildren = liveChildren.length ? liveChildren : parent.children;
    const childIds = baseChildren.map((child) => child.id);

    const [
      { data: masteryRows, error: masteryError },
      { data: xpRows, error: xpError },
  { data: activityRows, error: activityError },
  { data: skillRows, error: skillError },
  { data: subjectRows, error: subjectError },
  { data: progressRows, error: progressError },
  { data: recentLessonRows, error: recentLessonsError },
  { data: assessmentsRows, error: assessmentsError },
  { data: feedbackRows, error: feedbackError },
  { data: weeklyReportRow, error: weeklyError },
  { data: learningPrefRows, error: learningPrefError },
] = await Promise.all([
      childIds.length
        ? supabase
            .from('student_mastery')
            .select('student_id, skill_id, mastery_pct, updated_at')
            .in('student_id', childIds)
        : Promise.resolve({ data: [] as StudentMasteryRow[], error: null }),
      childIds.length
        ? supabase
            .from('xp_events')
            .select('id, student_id, source, xp_change, reason, created_at')
            .in('student_id', childIds)
            .order('created_at', { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [] as XpEventRow[], error: null }),
      childIds.length
        ? supabase
            .from('student_daily_activity')
            .select('*')
            .in('student_id', childIds)
            .gte('activity_date', new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString())
        : Promise.resolve({ data: [] as StudentDailyActivityRow[], error: null }),
  supabase.from('skills').select('id, subject_id'),
  supabase.from('subjects').select('id, name'),
  childIds.length
    ? supabase
        .from('student_progress')
        .select('student_id, status')
        .in('student_id', childIds)
    : Promise.resolve({
        data: [] as Array<{ student_id: string; status: 'not_started' | 'in_progress' | 'completed' }>,
        error: null,
      }),
  childIds.length
    ? supabase
        .from('student_progress')
        .select(
          `student_id, status, last_activity_at,
           lessons!inner(modules(subject))`,
        )
        .in('student_id', childIds)
        .not('last_activity_at', 'is', null)
        .gte('last_activity_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 21).toISOString())
    : Promise.resolve({ data: [] as StudentProgressSubjectRow[], error: null }),
  childIds.length
    ? supabase
        .from('student_assessment_attempts')
        .select('student_id, completed_at, status')
        .in('student_id', childIds)
        .order('completed_at', { ascending: false })
    : Promise.resolve({
        data: [] as Array<{ student_id: string; completed_at: string | null; status: string | null }>,
        error: null,
      }),
  childIds.length
    ? supabase
        .from('parent_coaching_feedback')
        .select('student_id, suggestion_id, reason')
        .in('student_id', childIds)
        .eq('parent_id', parent.id)
    : Promise.resolve({ data: [] as Array<{ student_id: string; suggestion_id: string; reason: string }>, error: null }),
  supabase
    .from('parent_weekly_reports')
    .select('*')
    .eq('parent_id', parent.id)
    .order('week_start', { ascending: false })
    .limit(1)
        .maybeSingle(),
      childIds.length
        ? supabase
            .from('student_profiles')
            .select('id, learning_style')
            .in('id', childIds)
        : Promise.resolve({ data: [] as Array<{ id: string; learning_style: unknown }>, error: null }),
    ]);

    if (masteryError) console.error('[Dashboard] Parent mastery fetch failed', masteryError);
    if (xpError) console.error('[Dashboard] Parent XP feed fetch failed', xpError);
    if (activityError) console.error('[Dashboard] Parent activity fetch failed', activityError);
    if (skillError) console.error('[Dashboard] Skill reference fetch failed', skillError);
    if (subjectError) console.error('[Dashboard] Subject reference fetch failed', subjectError);
    if (progressError) console.error('[Dashboard] Parent progress fetch failed', progressError);
    if (recentLessonsError) console.error('[Dashboard] Parent recent lessons fetch failed', recentLessonsError);
    if (assessmentsError) console.error('[Dashboard] Parent assessment fetch failed', assessmentsError);
    if (feedbackError) console.error('[Dashboard] Parent coaching feedback fetch failed', feedbackError);
    if (weeklyError) console.error('[Dashboard] Parent weekly report fetch failed', weeklyError);
    if (learningPrefError) console.error('[Dashboard] Parent learning prefs fetch failed', learningPrefError);

    const skillMap = (skillRows as SkillRow[]) ?? [];
    const subjectMap = (subjectRows as SubjectRow[]) ?? [];
    const subjectIdToName = new Map<number, Subject>();
    subjectMap.forEach((subject) => {
      const normalized = normalizeSubject(subject.name);
      if (normalized) {
        subjectIdToName.set(subject.id, normalized);
      }
    });
    const skillSubjectLookup = new Map<number, Subject>();
    skillMap.forEach((skill) => {
      const normalized = subjectIdToName.get(skill.subject_id);
      if (normalized) {
        skillSubjectLookup.set(skill.id, normalized);
      }
    });

    const now = Date.now();
    const weekCutoff = now - ONE_DAY_MS * 7;
    const priorWeekCutoff = now - ONE_DAY_MS * 14;

    const masteryByStudent = new Map<string, StudentMasteryRow[]>();
    (masteryRows as (StudentMasteryRow & { student_id: string })[]).forEach((row) => {
      const list = masteryByStudent.get(row.student_id) ?? [];
      list.push({ skill_id: row.skill_id, mastery_pct: row.mastery_pct, updated_at: row.updated_at });
      masteryByStudent.set(row.student_id, list);
    });

    const subjectAccuracyWindow = new Map<string, Map<Subject, { current: number[]; prior: number[] }>>();
    (masteryRows as (StudentMasteryRow & { student_id: string })[]).forEach((row) => {
      const subject = skillSubjectLookup.get(row.skill_id);
      if (!subject) return;
      const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : null;
      if (!updatedAt || updatedAt < priorWeekCutoff) return;
      const bucket: 'current' | 'prior' = updatedAt >= weekCutoff ? 'current' : 'prior';
      const studentMap = subjectAccuracyWindow.get(row.student_id) ?? new Map<Subject, { current: number[]; prior: number[] }>();
      const entry = studentMap.get(subject) ?? { current: [], prior: [] };
      if (typeof row.mastery_pct === 'number') {
        entry[bucket].push(row.mastery_pct);
      }
      studentMap.set(subject, entry);
      subjectAccuracyWindow.set(row.student_id, studentMap);
    });

    const childMasteryById = new Map<string, SubjectMastery[]>();
    masteryByStudent.forEach((rows, studentId) => {
      childMasteryById.set(studentId, groupMasteryBySubject(rows, skillMap, subjectMap));
    });

    const progressSummaryByStudent = new Map<
      string,
      { completed: number; inProgress: number; notStarted: number }
    >();
    (progressRows as { student_id: string; status: 'not_started' | 'in_progress' | 'completed' }[]).forEach(
      (row) => {
        const entry =
          progressSummaryByStudent.get(row.student_id) ?? {
            completed: 0,
            inProgress: 0,
            notStarted: 0,
          };
        if (row.status === 'completed') entry.completed += 1;
        else if (row.status === 'in_progress') entry.inProgress += 1;
        else entry.notStarted += 1;
        progressSummaryByStudent.set(row.student_id, entry);
      },
    );

    const lessonWindowsByStudent = new Map<string, { current: Map<Subject, number>; prior: Map<Subject, number> }>();
    (recentLessonRows as StudentProgressSubjectRow[]).forEach((row) => {
      const subject = normalizeSubject(row.lessons?.modules?.subject ?? null);
      if (!subject) return;
      const lastActivity = row.last_activity_at ? new Date(row.last_activity_at).getTime() : null;
      if (!lastActivity || lastActivity < priorWeekCutoff) {
        return;
      }
      const bucket: 'current' | 'prior' = lastActivity >= weekCutoff ? 'current' : 'prior';
      const entry =
        lessonWindowsByStudent.get(row.student_id) ??
        { current: new Map<Subject, number>(), prior: new Map<Subject, number>() };
      const target = bucket === 'current' ? entry.current : entry.prior;
      target.set(subject, (target.get(subject) ?? 0) + 1);
      lessonWindowsByStudent.set(row.student_id, entry);
    });

    const diagnosticByStudent = new Map<string, { status: string | null; completedAt: string | null }>();
    (assessmentsRows as Array<{ student_id: string; completed_at: string | null; status: string | null }>).forEach(
      (row) => {
        const existing = diagnosticByStudent.get(row.student_id);
        const rowDate = row.completed_at ? new Date(row.completed_at) : null;
        const existingDate = existing?.completedAt ? new Date(existing.completedAt) : null;
        const isNewer = rowDate && existingDate ? rowDate > existingDate : Boolean(rowDate);
        const preferInProgress = row.status === 'in_progress' && existing?.status !== 'in_progress';
        if (!existing || isNewer || preferInProgress) {
          diagnosticByStudent.set(row.student_id, { status: row.status, completedAt: row.completed_at });
        }
      },
    );

    const feedbackByStudent = new Map<string, Set<string>>();
    (feedbackRows as Array<{ student_id: string; suggestion_id: string; reason: string }>).forEach((row) => {
      if (!row.suggestion_id) return;
      const set = feedbackByStudent.get(row.student_id) ?? new Set<string>();
      set.add(row.suggestion_id);
      feedbackByStudent.set(row.student_id, set);
    });

    const learningPreferencesByStudent = new Map<string, LearningPreferences>();
    (learningPrefRows as { id: string; learning_style: unknown }[]).forEach((row) => {
      learningPreferencesByStudent.set(row.id, castLearningPreferences(row.learning_style));
    });

    const xpByChild = new Map<string, XpEventRow[]>();
    (xpRows as (XpEventRow & { student_id: string })[]).forEach((row) => {
      const list = xpByChild.get(row.student_id) ?? [];
      list.push(row);
      xpByChild.set(row.student_id, list);
    });
    const weeklyChangeByChild = new Map<
      string,
      { current: { lessons: number; minutes: number; xp: number }; prior: { lessons: number; minutes: number; xp: number } }
    >();
    (activityRows as StudentDailyActivityRow[]).forEach((row) => {
      if (!childIds.includes(row.student_id)) return;
      const bucket: 'current' | 'prior' =
        new Date(row.activity_date).getTime() >= weekCutoff ? 'current' : 'prior';
      const entry =
        weeklyChangeByChild.get(row.student_id) ?? {
          current: { lessons: 0, minutes: 0, xp: 0 },
          prior: { lessons: 0, minutes: 0, xp: 0 },
        };
      entry[bucket].lessons += row.lessons_completed ?? 0;
      entry[bucket].minutes += row.practice_minutes ?? 0;
      entry[bucket].xp += row.xp_earned ?? 0;
      weeklyChangeByChild.set(row.student_id, entry);
    });

    const enrichedChildren: ParentChildSnapshot[] = baseChildren.map((child) => {
      const masteryFromLive = childMasteryById.get(child.id) ?? [];
      const viewMastery = child.masteryBySubject?.length ? child.masteryBySubject : fallbackStudentMastery();
      const mastery = viewMastery.map((entry) => {
        const live = masteryFromLive.find((item) => item.subject === entry.subject);
        return {
          ...entry,
          mastery: live?.mastery ?? entry.mastery,
          trend: live?.trend ?? entry.trend,
        } satisfies SubjectMastery;
      });

      const xpEvents = xpByChild.get(child.id) ?? [];
      const recentActivity = xpEvents.slice(0, 4).map((event) => ({
        id: event.id.toString(),
        description: event.reason ?? event.source,
        subject:
          mastery.sort((a, b) => b.mastery - a.mastery)[0]?.subject ?? ('math' as Subject),
        xp: event.xp_change,
        occurredAt: formatIsoDate(event.created_at),
      }));

      const cohortComparison =
        mastery.reduce((acc, item) => {
          if (item.cohortAverage !== undefined) {
            return acc + (item.mastery - item.cohortAverage);
          }
          return acc;
        }, 0) / (mastery.length || 1);

      const homeExtensions = buildHomeExtensions(child.grade, mastery);
      const learningPreferences =
        learningPreferencesByStudent.get(child.id) ??
        child.learningPreferences ??
        defaultLearningPreferences;
      const lessonWindow =
        lessonWindowsByStudent.get(child.id) ??
        { current: new Map<Subject, number>(), prior: new Map<Subject, number>() };
      const diagnosticMeta = diagnosticByStudent.get(child.id) ?? null;
      const diagnosticCompletedAt = diagnosticMeta?.completedAt ?? null;
      const diagnosticStatus =
        diagnosticMeta?.status === 'completed'
          ? 'completed'
          : diagnosticMeta?.status === 'in_progress'
          ? 'in_progress'
          : diagnosticMeta?.status === 'scheduled'
          ? 'scheduled'
          : undefined;
      const subjectStatuses =
        mastery.length && lessonWindow.current.size
          ? computeSubjectStatuses({
              masteryBySubject: mastery,
              lessonsBySubject: lessonWindow.current,
              diagnosticCompletedAt,
            })
          : [];
      const coachingSuggestions = buildCoachingSuggestions(child, {
        max: 4,
        seed: dashboardWeekSeed,
        excludeIds: feedbackByStudent.get(child.id),
      });
      const weeklyChange = weeklyChangeByChild.get(child.id) ?? {
        current: {
          lessons: child.lessonsCompletedWeek ?? 0,
          minutes: child.practiceMinutesWeek ?? 0,
          xp: child.xpEarnedWeek ?? 0,
        },
        prior: { lessons: 0, minutes: 0, xp: 0 },
      };
      const minuteWindow = {
        current: weeklyChange.current.minutes,
        prior: weeklyChange.prior.minutes,
      };
      const subjectTrends = deriveSubjectTrends(
        mastery,
        subjectAccuracyWindow.get(child.id),
        lessonWindow,
        minuteWindow,
      );
      const accuracyWindow = subjectAccuracyWindow.get(child.id);
      let avgAccuracyWeek: number | null = null;
      let avgAccuracyPriorWeek: number | null = null;
      let avgAccuracyDelta: number | null = null;
      if (accuracyWindow) {
        const currentValues: number[] = [];
        const priorValues: number[] = [];
        accuracyWindow.forEach((value) => {
          currentValues.push(...value.current);
          priorValues.push(...value.prior);
        });
        if (currentValues.length) {
          avgAccuracyWeek =
            currentValues.reduce((sum, value) => sum + value, 0) / currentValues.length;
        }
        if (priorValues.length) {
          avgAccuracyPriorWeek =
            priorValues.reduce((sum, value) => sum + value, 0) / priorValues.length;
        }
        if (avgAccuracyWeek != null) {
          avgAccuracyWeek = Math.round(avgAccuracyWeek * 10) / 10;
        }
        if (avgAccuracyPriorWeek != null) {
          avgAccuracyPriorWeek = Math.round(avgAccuracyPriorWeek * 10) / 10;
        }
        if (avgAccuracyWeek != null && avgAccuracyPriorWeek != null) {
          avgAccuracyDelta = Math.round((avgAccuracyWeek - avgAccuracyPriorWeek) * 10) / 10;
        }
      }
      const snapshot: ParentChildSnapshot = {
        ...child,
        masteryBySubject: mastery,
        subjectTrends,
        avgAccuracyWeek,
        avgAccuracyPriorWeek,
        avgAccuracyDelta,
        cohortComparison: Math.round(cohortComparison * 10) / 10,
        recentActivity: recentActivity.length ? recentActivity : child.recentActivity,
        progressSummary: progressSummaryByStudent.get(child.id) ?? {
          completed: 0,
          inProgress: 0,
          notStarted: 0,
        },
        homeExtensions,
        learningPreferences,
        subjectStatuses,
        coachingSuggestions,
        weeklyChange: {
          lessons: weeklyChange.current.lessons,
          minutes: weeklyChange.current.minutes,
          xp: weeklyChange.current.xp,
          deltaLessons: weeklyChange.current.lessons - weeklyChange.prior.lessons,
          deltaMinutes: weeklyChange.current.minutes - weeklyChange.prior.minutes,
          deltaXp: weeklyChange.current.xp - weeklyChange.prior.xp,
        },
        diagnosticStatus: diagnosticStatus ?? 'not_started',
        diagnosticCompletedAt,
      };

      snapshot.coachingSuggestions = buildCoachingSuggestions(snapshot, {
        max: 4,
        seed: dashboardWeekSeed,
      });

      const goalProgress = calculateChildGoalProgress(snapshot);
      if (goalProgress !== undefined) {
        snapshot.goalProgress = goalProgress;
      }

      snapshot.adaptivePlanNotes =
        snapshot.adaptivePlanNotes && snapshot.adaptivePlanNotes.length
          ? snapshot.adaptivePlanNotes
          : buildAdaptivePlanNotes(snapshot);

      snapshot.skillGaps = buildSkillGapInsights(snapshot);

      return snapshot;
    });

    const parentActivitySeries = aggregateParentActivity(
      (activityRows as StudentDailyActivityRow[]) ?? [],
      childIds,
    );

    const alerts = deriveParentAlerts(enrichedChildren.length ? enrichedChildren : baseChildren);
    const celebrations = buildParentCelebrations(
      enrichedChildren.length ? enrichedChildren : baseChildren,
    );
    const celebrationPrompts = buildCelebrationPrompts(celebrations);

    const weeklyReport: ParentWeeklyReport =
      weeklyReportRow
        ? {
            weekStart: weeklyReportRow.week_start,
            summary: weeklyReportRow.summary ?? '',
            highlights: toStringArray(weeklyReportRow.highlights),
            recommendations: toStringArray(weeklyReportRow.recommendations),
            aiGenerated: weeklyReportRow.ai_generated ?? undefined,
          }
        : parent.weeklyReport ?? fallbackParentWeeklyReport(parent.name);

    const reportChildren =
      enrichedChildren.length
        ? enrichedChildren
        : baseChildren.length
        ? baseChildren
        : fallbackParentChildren(parent.name);
    const weeklyChanges = summarizeWeeklyChanges(reportChildren);
    const weeklyReportWithChanges = { ...weeklyReport, changes: weeklyChanges };

    const downloadableReport = buildParentDownloadableReport(parent, weeklyReportWithChanges, reportChildren);

    return {
      parent,
      children: reportChildren,
      alerts,
      activitySeries: parentActivitySeries,
      weeklyReport: weeklyReportWithChanges,
      downloadableReport,
      celebrations,
      celebrationPrompts,
    };
  } catch (error) {
    console.error('[Dashboard] Parent dashboard fallback engaged', error);
    const fallbackChildren = fallbackParentChildren(parent.name);
    const fallbackReport = fallbackParentWeeklyReport(parent.name);
    const fallbackReportWithChanges = { ...fallbackReport, changes: summarizeWeeklyChanges(fallbackChildren) };
    return {
      parent,
      children: fallbackChildren,
      alerts: fallbackParentAlerts(),
      activitySeries: aggregateParentActivity([], []),
      weeklyReport: fallbackReportWithChanges,
      downloadableReport: buildParentDownloadableReport(parent, fallbackReportWithChanges, fallbackChildren),
      celebrations: buildParentCelebrations(fallbackChildren),
      celebrationPrompts: buildCelebrationPrompts(buildParentCelebrations(fallbackChildren)),
    };
  }
};

export const fetchAdminDashboardData = async (admin: Admin): Promise<AdminDashboardData> => {
  try {
    const lookbackDays = 7;
    const lookbackIso = new Date(Date.now() - ONE_DAY_MS * lookbackDays).toISOString();
    const [
      { data: metricsRow, error: metricsError },
      { data: growthRows, error: growthError },
      { data: masteryRows, error: masteryError },
      { data: skillRows, error: skillError },
      { data: subjectRows, error: subjectError },
      { data: topRows, error: topError },
      completedProgressResult,
      inProgressProgressResult,
      notStartedProgressResult,
      diagnosticsTotalResult,
      diagnosticsCompletedResult,
      assignmentsTotalResult,
      assignmentsCompletedResult,
      { data: successRollupRow, error: successRollupError },
    ] = await Promise.all([
      supabase.from('admin_dashboard_metrics').select('*').single(),
      supabase
        .from('student_daily_activity')
        .select('activity_date, lessons_completed')
        .gte('activity_date', new Date(Date.now() - 1000 * 60 * 60 * 24 * 56).toISOString()),
      supabase.from('student_mastery').select('skill_id, mastery_pct'),
      supabase.from('skills').select('id, subject_id'),
      supabase.from('subjects').select('id, name'),
      supabase
        .from('student_daily_activity')
        .select('student_id, activity_date, xp_earned, lessons_completed')
        .gte('activity_date', new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()),
      supabase
        .from('student_progress')
        .select('status', { count: 'exact', head: true })
        .eq('status', 'completed'),
      supabase
        .from('student_progress')
        .select('status', { count: 'exact', head: true })
        .eq('status', 'in_progress'),
      supabase
        .from('student_progress')
        .select('status', { count: 'exact', head: true })
        .eq('status', 'not_started'),
      supabase.from('student_profiles').select('id', { count: 'exact', head: true }),
      supabase
        .from('student_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('assessment_completed', true),
      supabase
        .from('student_assignments')
        .select('id', { count: 'exact', head: true })
        .gte('updated_at', lookbackIso),
      supabase
        .from('student_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', lookbackIso),
      supabase.from('admin_success_metrics_rollup').select('*').single(),
    ]);

    if (metricsError) {
      console.error('[Dashboard] Admin metrics fetch failed', metricsError);
      return fallbackAdminData(admin);
    }
    if (growthError) console.error('[Dashboard] Admin growth fetch failed', growthError);
    if (masteryError) console.error('[Dashboard] Admin mastery fetch failed', masteryError);
    if (skillError) console.error('[Dashboard] Admin skill fetch failed', skillError);
    if (subjectError) console.error('[Dashboard] Admin subject fetch failed', subjectError);
    if (topError) console.error('[Dashboard] Admin top students fetch failed', topError);
    if (completedProgressResult.error)
      console.error('[Dashboard] Admin completion count failed', completedProgressResult.error);
    if (inProgressProgressResult.error)
      console.error('[Dashboard] Admin in-progress count failed', inProgressProgressResult.error);
    if (notStartedProgressResult.error)
      console.error('[Dashboard] Admin not-started count failed', notStartedProgressResult.error);
    if (diagnosticsTotalResult.error)
      console.error('[Dashboard] Admin diagnostics total fetch failed', diagnosticsTotalResult.error);
    if (diagnosticsCompletedResult.error)
      console.error('[Dashboard] Admin diagnostics completion fetch failed', diagnosticsCompletedResult.error);
    if (assignmentsTotalResult.error)
      console.error('[Dashboard] Admin assignments total fetch failed', assignmentsTotalResult.error);
    if (assignmentsCompletedResult.error)
      console.error('[Dashboard] Admin assignments completion fetch failed', assignmentsCompletedResult.error);
    if (successRollupError)
      console.error('[Dashboard] Admin success metrics rollup fetch failed', successRollupError);

    const completedLessons = completedProgressResult.count ?? 0;
    const inProgressLessons = inProgressProgressResult.count ?? 0;
    const notStartedLessons = notStartedProgressResult.count ?? 0;
    const totalTrackedLessons = completedLessons + inProgressLessons + notStartedLessons;
    const lessonCompletionRate = totalTrackedLessons
      ? completedLessons / totalTrackedLessons
      : null;

    const metrics: AdminDashboardMetrics = {
      totalStudents: metricsRow.total_students ?? 0,
      totalParents: metricsRow.total_parents ?? 0,
      totalAdmins: metricsRow.total_admins ?? 0,
      activeStudents7d: metricsRow.active_students_7d ?? 0,
      practiceMinutes7d: metricsRow.practice_minutes_7d ?? 0,
      assessments30d: metricsRow.assessments_last_30d ?? 0,
      xpEarned30d: metricsRow.xp_earned_30d ?? 0,
      averageStudentXp: metricsRow.average_student_xp ?? 0,
      activeSubscriptions: metricsRow.active_subscriptions ?? 0,
      lessonCompletionRate: lessonCompletionRate ?? undefined,
    };

    const diagnosticsTotal =
      diagnosticsTotalResult.count ??
      (Number.isFinite(metrics.totalStudents) ? metrics.totalStudents : 0);
    const diagnosticsCompleted = diagnosticsCompletedResult.count ?? 0;
    const diagnosticCompletionRate =
      diagnosticsTotal > 0 ? Math.round((diagnosticsCompleted / diagnosticsTotal) * 100) : null;

    const assignmentsTotal = assignmentsTotalResult.count ?? 0;
    const assignmentsCompleted = assignmentsCompletedResult.count ?? 0;
    const assignmentFollowThroughRate =
      assignmentsTotal > 0 ? Math.round((assignmentsCompleted / assignmentsTotal) * 100) : null;

    const weeklyAccuracyDeltaAvg =
      successRollupRow?.weekly_accuracy_delta_avg != null
        ? Number(successRollupRow.weekly_accuracy_delta_avg)
        : null;
    const dailyPlanCompletionRateAvg =
      successRollupRow?.daily_plan_completion_rate_avg != null
        ? Number(successRollupRow.daily_plan_completion_rate_avg)
        : null;
    const alertResolutionHoursAvg =
      successRollupRow?.alert_resolution_hours_avg != null
        ? Number(successRollupRow.alert_resolution_hours_avg)
        : null;

    const successMetrics: AdminSuccessMetrics = {
      lookbackDays,
      diagnosticsCompleted,
      diagnosticsTotal,
      diagnosticCompletionRate,
      assignmentsCompleted,
      assignmentsTotal,
      assignmentFollowThroughRate,
      weeklyAccuracyDeltaAvg,
      dailyPlanCompletionRateAvg,
      alertResolutionHoursAvg,
    };

    const growthGrouped = new Map<string, { newStudents: number; activeStudents: number }>();
    (growthRows as { activity_date: string; lessons_completed: number | null }[]).forEach((row) => {
      const week = new Date(row.activity_date);
      const startOfWeek = new Date(week);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      const key = startOfWeek.toISOString();
      const entry = growthGrouped.get(key) ?? { newStudents: 0, activeStudents: 0 };
      entry.activeStudents += (row.lessons_completed ?? 0) > 0 ? 1 : 0;
      growthGrouped.set(key, entry);
    });

    const growthSeries: AdminGrowthPoint[] = Array.from(growthGrouped.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, value]) => ({
        date,
        newStudents: Math.max(40, Math.round(value.activeStudents * 0.4)),
        activeStudents: value.activeStudents,
      }));

    const subjectPerformance = groupMasteryBySubject(
      (masteryRows as StudentMasteryRow[]) ?? [],
      (skillRows as SkillRow[]) ?? [],
      (subjectRows as SubjectRow[]) ?? [],
    ).map<AdminSubjectPerformance>((entry) => ({
      subject: entry.subject,
      mastery: entry.mastery,
      trend: Math.round((Math.random() - 0.4) * 10),
    }));

    const totalsByStudent = new Map<
      string,
      { xp: number; lessons: number }
    >();
    (topRows as {
      student_id: string;
      activity_date: string;
      xp_earned: number | null;
      lessons_completed: number | null;
    }[]).forEach((row) => {
      const entry = totalsByStudent.get(row.student_id) ?? { xp: 0, lessons: 0 };
      entry.xp += row.xp_earned ?? 0;
      entry.lessons += row.lessons_completed ?? 0;
      totalsByStudent.set(row.student_id, entry);
    });

    const topStudents: AdminTopStudent[] = Array.from(totalsByStudent.entries())
      .sort((a, b) => b[1].xp - a[1].xp)
      .slice(0, 5)
      .map(([studentId, stats]) => ({
        id: studentId,
        name: `Student ${studentId.slice(0, 5)}`,
        grade: 0,
        xpEarnedWeek: stats.xp,
        lessonsCompletedWeek: stats.lessons,
      }));

    const alerts = buildAdminAlerts(metrics, subjectPerformance, admin, lessonCompletionRate);

    try {
      await supabase.rpc('log_admin_event', {
        p_event_type: 'dashboard.view',
        p_metadata: {
          activeStudents7d: metrics.activeStudents7d,
          practiceMinutes7d: metrics.practiceMinutes7d,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logError) {
      console.warn('[Dashboard] Failed to log admin event', logError);
    }

    return {
      admin,
      metrics,
      growthSeries: growthSeries.length
        ? growthSeries
        : fallbackAdminData(admin).growthSeries,
      subjectPerformance,
      alerts,
      topStudents: topStudents.length ? topStudents : fallbackAdminData(admin).topStudents,
      successMetrics,
    };
  } catch (error) {
    console.error('[Dashboard] Admin dashboard fallback engaged', error);
    return fallbackAdminData(admin);
  }
};
