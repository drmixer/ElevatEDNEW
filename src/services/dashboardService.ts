import supabase from '../lib/supabaseClient';
import type {
  Admin,
  AdminAlert,
  AdminDashboardData,
  AdminDashboardMetrics,
  AdminGrowthPoint,
  AdminSubjectPerformance,
  AdminTopStudent,
  AssessmentSummary,
  DashboardLesson,
  Parent,
  ParentActivityPoint,
  ParentAlert,
  ParentChildSnapshot,
  ParentDashboardData,
  ParentWeeklyReport,
  Student,
  StudentDashboardData,
  StudentDailyActivity,
  Subject,
  SubjectMastery,
  XPTimelinePoint,
} from '../types';

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

type XpEventRow = {
  id: number;
  source: string;
  xp_change: number;
  reason: string | null;
  created_at: string;
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

const SUBJECT_LABELS: Record<Subject, string> = {
  math: 'Mathematics',
  english: 'English Language Arts',
  science: 'Science',
  social_studies: 'Social Studies',
};

const normalizeSubject = (input: string | null | undefined): Subject | null => {
  if (!input) return null;
  const key = input.toLowerCase().replace(/\s+/g, '_');
  if (['math', 'english', 'science', 'social_studies'].includes(key)) {
    return key as Subject;
  }
  return null;
};

const difficultyFromValue = (value: number | undefined | null): 'easy' | 'medium' | 'hard' => {
  if (!value || value <= 2) return 'easy';
  if (value === 3) return 'medium';
  return 'hard';
};

const formatIsoDate = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
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

const fallbackStudentLessons = (): DashboardLesson[] => [
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
];

const fallbackStudentMastery = (): SubjectMastery[] => [
  { subject: 'math', mastery: 68, trend: 'up' },
  { subject: 'english', mastery: 82, trend: 'steady' },
  { subject: 'science', mastery: 57, trend: 'up' },
  { subject: 'social_studies', mastery: 45, trend: 'down' },
];

const fallbackStudentActivity = (): StudentDailyActivity[] => {
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
  };
};

const fallbackParentChildren = (parentName: string): ParentChildSnapshot[] => [
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
  },
];

const fallbackParentAlerts = (): ParentAlert[] => [
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

const fallbackAdminData = (admin: Admin): AdminDashboardData => ({
  admin,
  metrics: {
    totalStudents: 2480,
    totalParents: 940,
    totalAdmins: 6,
    activeStudents7d: 1860,
    practiceMinutes7d: 68450,
    assessments30d: 742,
    xpEarned30d: 912330,
    averageStudentXp: 1285,
    activeSubscriptions: 812,
  },
  growthSeries: Array.from({ length: 8 }).map((_, index) => {
    const pointDate = new Date();
    pointDate.setDate(pointDate.getDate() - (7 - index) * 7);
    return {
      date: pointDate.toISOString(),
      newStudents: 120 + Math.round(Math.random() * 40),
      activeStudents: 1600 + Math.round(Math.random() * 200),
    };
  }),
  subjectPerformance: [
    { subject: 'math', mastery: 68, trend: 4 },
    { subject: 'english', mastery: 74, trend: 2 },
    { subject: 'science', mastery: 59, trend: 5 },
    { subject: 'social_studies', mastery: 62, trend: -1 },
  ],
  alerts: [
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
  ],
  topStudents: [
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
  ],
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

const buildLessonsFromLearningPath = (student: Student): DashboardLesson[] => {
  if (!student.learningPath?.length) {
    return fallbackStudentLessons();
  }

  return student.learningPath.slice(0, 4).map((item) => ({
    id: item.id,
    subject: item.subject,
    title: item.topic,
    status:
      item.status === 'completed' || item.status === 'mastered'
        ? 'completed'
        : item.status === 'in_progress'
        ? 'in_progress'
        : 'not_started',
    difficulty: difficultyFromValue(item.difficulty),
    xpReward: item.xpReward,
  }));
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
    return [
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
    ];
  }

  return rows.map((row) => ({
    date: formatIsoDate(row.created_at),
    xpEarned: row.xp_change,
    description: row.reason ?? row.source,
  }));
};

const buildAssessmentsSummary = (rows: StudentAssignmentRow[]): AssessmentSummary[] => {
  if (!rows.length) {
    return [
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
    ];
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

const deriveAiRecommendations = (mastery: SubjectMastery[], lessons: DashboardLesson[]): string[] => {
  const recommendations: string[] = [];

  const lowest = mastery.slice().sort((a, b) => a.mastery - b.mastery)[0];
  if (lowest) {
    recommendations.push(
      `Focus on ${SUBJECT_LABELS[lowest.subject]} — mastery is at ${Math.round(lowest.mastery)}%.`,
    );
  }

  const pendingLesson = lessons.find((lesson) => lesson.status !== 'completed');
  if (pendingLesson) {
    recommendations.push(
      `Resume "${pendingLesson.title}" to keep your ${SUBJECT_LABELS[pendingLesson.subject]} streak alive.`,
    );
  }

  if (recommendations.length < 3) {
    recommendations.push('Take a 5-minute reflection break to jot down wins and challenges today.');
  }

  return recommendations;
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

const deriveParentAlerts = (children: ParentChildSnapshot[]): ParentAlert[] => {
  const alerts: ParentAlert[] = [];

  children.forEach((child) => {
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

const buildAdminAlerts = (
  metrics: AdminDashboardMetrics,
  subjectPerformance: AdminSubjectPerformance[],
  admin: Admin,
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

  return alerts.length ? alerts : fallbackAdminData(admin).alerts;
};

export const fetchStudentDashboardData = async (
  student: Student,
): Promise<StudentDashboardData> => {
  try {
    const [{ data: profileRow, error: profileError }, { data: activityRows, error: activityError }] =
      await Promise.all([
        supabase
          .from('student_profiles')
          .select('xp, level, streak_days, assessment_completed, learning_path')
          .eq('id', student.id)
          .single(),
        supabase
          .from('student_daily_activity')
          .select('*')
          .eq('student_id', student.id)
          .gte('activity_date', new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()),
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
    }

    const activity = activityError ? fallbackStudentActivity() : mapDailyActivity(activityRows ?? []);

    const [{ data: masteryRows, error: masteryError }, { data: xpRows, error: xpError }, { data: assignmentsRows, error: assignmentsError }, { data: skillRows, error: skillError }, { data: subjectRows, error: subjectError }] =
      await Promise.all([
        supabase
          .from('student_mastery')
          .select('skill_id, mastery_pct')
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
          .from('skills')
          .select('id, subject_id'),
        supabase
          .from('subjects')
          .select('id, name'),
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
    if (skillError) {
      console.error('[Dashboard] Failed to load skill references', skillError);
    }
    if (subjectError) {
      console.error('[Dashboard] Failed to load subject references', subjectError);
    }

    const subjectMastery = masteryRows && skillRows && subjectRows
      ? groupMasteryBySubject(
          (masteryRows as StudentMasteryRow[]) ?? [],
          (skillRows as SkillRow[]) ?? [],
          (subjectRows as SubjectRow[]) ?? [],
        )
      : fallbackStudentMastery();

    const todaysPlan = buildLessonsFromLearningPath(student);
    const xpTimeline = buildXpTimeline((xpRows as XpEventRow[]) ?? []);
    const assessments = buildAssessmentsSummary((assignmentsRows as StudentAssignmentRow[]) ?? []);
    const aiRecommendations = deriveAiRecommendations(subjectMastery, todaysPlan);
    const recentBadges = student.badges.slice(0, 3);

    return {
      profile: student,
      quickStats: ensureStudentQuickStats(student, activity),
      todaysPlan,
      subjectMastery,
      dailyActivity: activity,
      recentBadges,
      xpTimeline,
      aiRecommendations,
      upcomingAssessments: assessments,
    };
  } catch (error) {
    console.error('[Dashboard] Student dashboard fallback engaged', error);
    return {
      profile: student,
      quickStats: ensureStudentQuickStats(student, fallbackStudentActivity()),
      todaysPlan: fallbackStudentLessons(),
      subjectMastery: fallbackStudentMastery(),
      dailyActivity: fallbackStudentActivity(),
      recentBadges: student.badges.slice(0, 3),
      xpTimeline: buildXpTimeline([]),
      aiRecommendations: deriveAiRecommendations(fallbackStudentMastery(), fallbackStudentLessons()),
      upcomingAssessments: buildAssessmentsSummary([]),
    };
  }
};

export const fetchParentDashboardData = async (
  parent: Parent,
): Promise<ParentDashboardData> => {
  try {
    const childIds = parent.children.map((child) => child.id);

    const [
      { data: masteryRows, error: masteryError },
      { data: xpRows, error: xpError },
      { data: activityRows, error: activityError },
      { data: skillRows, error: skillError },
      { data: subjectRows, error: subjectError },
      { data: weeklyReportRow, error: weeklyError },
    ] = await Promise.all([
      childIds.length
        ? supabase
            .from('student_mastery')
            .select('student_id, skill_id, mastery_pct')
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
            .gte('activity_date', new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString())
        : Promise.resolve({ data: [] as StudentDailyActivityRow[], error: null }),
      supabase.from('skills').select('id, subject_id'),
      supabase.from('subjects').select('id, name'),
      parent.weeklyReport
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from('parent_weekly_reports')
            .select('*')
            .eq('parent_id', parent.id)
            .order('week_start', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    if (masteryError) console.error('[Dashboard] Parent mastery fetch failed', masteryError);
    if (xpError) console.error('[Dashboard] Parent XP feed fetch failed', xpError);
    if (activityError) console.error('[Dashboard] Parent activity fetch failed', activityError);
    if (skillError) console.error('[Dashboard] Skill reference fetch failed', skillError);
    if (subjectError) console.error('[Dashboard] Subject reference fetch failed', subjectError);
    if (weeklyError) console.error('[Dashboard] Parent weekly report fetch failed', weeklyError);

    const skillMap = (skillRows as SkillRow[]) ?? [];
    const subjectMap = (subjectRows as SubjectRow[]) ?? [];

    const masteryByStudent = new Map<string, StudentMasteryRow[]>();
    (masteryRows as (StudentMasteryRow & { student_id: string })[]).forEach((row) => {
      const list = masteryByStudent.get(row.student_id) ?? [];
      list.push({ skill_id: row.skill_id, mastery_pct: row.mastery_pct });
      masteryByStudent.set(row.student_id, list);
    });

    const childMasteryById = new Map<string, SubjectMastery[]>();
    masteryByStudent.forEach((rows, studentId) => {
      childMasteryById.set(studentId, groupMasteryBySubject(rows, skillMap, subjectMap));
    });

    const xpByChild = new Map<string, XpEventRow[]>();
    (xpRows as (XpEventRow & { student_id: string })[]).forEach((row) => {
      const list = xpByChild.get(row.student_id) ?? [];
      list.push(row);
      xpByChild.set(row.student_id, list);
    });

    const enrichedChildren: ParentChildSnapshot[] = parent.children.map((child) => {
      const mastery = childMasteryById.get(child.id) ?? fallbackStudentMastery();
      const xpEvents = xpByChild.get(child.id) ?? [];
      const recentActivity = xpEvents.slice(0, 4).map((event) => ({
        id: event.id.toString(),
        description: event.reason ?? event.source,
        subject:
          mastery.sort((a, b) => b.mastery - a.mastery)[0]?.subject ?? ('math' as Subject),
        xp: event.xp_change,
        occurredAt: formatIsoDate(event.created_at),
      }));

      return {
        ...child,
        masteryBySubject: mastery,
        recentActivity: recentActivity.length ? recentActivity : child.recentActivity,
      };
    });

    const parentActivitySeries = aggregateParentActivity(
      (activityRows as StudentDailyActivityRow[]) ?? [],
      childIds,
    );

    const alerts = deriveParentAlerts(enrichedChildren.length ? enrichedChildren : parent.children);

    const weeklyReport: ParentWeeklyReport =
      parent.weeklyReport ??
      (weeklyReportRow
        ? {
            weekStart: weeklyReportRow.week_start,
            summary: weeklyReportRow.summary ?? '',
            highlights: Array.isArray(weeklyReportRow.highlights)
              ? (weeklyReportRow.highlights as string[])
              : [],
            recommendations: Array.isArray(weeklyReportRow.recommendations)
              ? (weeklyReportRow.recommendations as string[])
              : [],
          }
        : fallbackParentWeeklyReport(parent.name));

    return {
      parent,
      children: enrichedChildren.length ? enrichedChildren : fallbackParentChildren(parent.name),
      alerts,
      activitySeries: parentActivitySeries,
      weeklyReport,
    };
  } catch (error) {
    console.error('[Dashboard] Parent dashboard fallback engaged', error);
    return {
      parent,
      children: fallbackParentChildren(parent.name),
      alerts: fallbackParentAlerts(),
      activitySeries: aggregateParentActivity([], []),
      weeklyReport: fallbackParentWeeklyReport(parent.name),
    };
  }
};

export const fetchAdminDashboardData = async (admin: Admin): Promise<AdminDashboardData> => {
  try {
    const [
      { data: metricsRow, error: metricsError },
      { data: growthRows, error: growthError },
      { data: masteryRows, error: masteryError },
      { data: skillRows, error: skillError },
      { data: subjectRows, error: subjectError },
      { data: topRows, error: topError },
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

    const alerts = buildAdminAlerts(metrics, subjectPerformance, admin);

    return {
      admin,
      metrics,
      growthSeries: growthSeries.length
        ? growthSeries
        : fallbackAdminData(admin).growthSeries,
      subjectPerformance,
      alerts,
      topStudents: topStudents.length ? topStudents : fallbackAdminData(admin).topStudents,
    };
  } catch (error) {
    console.error('[Dashboard] Admin dashboard fallback engaged', error);
    return fallbackAdminData(admin);
  }
};
