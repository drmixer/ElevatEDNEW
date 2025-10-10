import supabase from '../lib/supabaseClient';
import type {
  Admin,
  Badge,
  Parent,
  ParentChildSnapshot,
  ParentWeeklyReport,
  Student,
  Subject,
  SubjectMastery,
  User,
} from '../types';

type StudentProfileRow = {
  grade: number | null;
  xp: number | null;
  level: number | null;
  badges: unknown;
  streak_days: number | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  learning_path: unknown;
  assessment_completed: boolean | null;
};

type ParentProfileRow = {
  subscription_tier: 'free' | 'premium' | null;
  notifications: Record<string, boolean> | null;
};

type AdminProfileRow = {
  title: string | null;
  permissions: string[] | null;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'parent' | 'admin';
  avatar_url: string | null;
  student_profiles?: StudentProfileRow | StudentProfileRow[] | null;
  parent_profiles?: ParentProfileRow | ParentProfileRow[] | null;
  admin_profiles?: AdminProfileRow | AdminProfileRow[] | null;
};

type ParentDashboardChildRow = {
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
};

const normalizeStudentProfile = (
  input: ProfileRow['student_profiles'],
): StudentProfileRow | null => {
  if (Array.isArray(input)) {
    return input[0] ?? null;
  }

  return input ?? null;
};

const normalizeParentProfile = (
  input: ProfileRow['parent_profiles'],
): ParentProfileRow | null => {
  if (Array.isArray(input)) {
    return input[0] ?? null;
  }

  return input ?? null;
};

const normalizeAdminProfile = (
  input: ProfileRow['admin_profiles'],
): AdminProfileRow | null => {
  if (Array.isArray(input)) {
    return input[0] ?? null;
  }

  return input ?? null;
};

const castBadges = (badges: unknown): Badge[] => {
  if (!badges) return [];
  let parsed: unknown = badges;

  if (typeof badges === 'string') {
    try {
      parsed = JSON.parse(badges);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map((badge) => {
    const earnedAt = (badge as Badge)?.earnedAt;
    return {
      ...(badge as Badge),
      earnedAt: earnedAt ? new Date(earnedAt) : new Date(),
    };
  });
};

const castStringArray = (input: unknown): string[] => {
  if (Array.isArray(input)) {
    return input.filter((item): item is string => typeof item === 'string');
  }

  if (typeof input === 'string' && input.trim().length > 0) {
    return [input.trim()];
  }

  return [];
};

const averageFromBreakdown = (input: unknown, property: 'goal' | 'cohortAverage'): number | undefined => {
  if (!Array.isArray(input)) return undefined;
  const values = input
    .map((entry) => (entry as Record<string, unknown>)?.[property])
    .filter((value): value is number => typeof value === 'number');
  if (!values.length) return undefined;
  const total = values.reduce((acc, value) => acc + value, 0);
  return Math.round((total / values.length) * 100) / 100;
};

const toSubjectKey = (value: unknown): Subject | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().replace(/\s+/g, '_');
  if (['math', 'english', 'science', 'social_studies'].includes(normalized)) {
    return normalized as Subject;
  }
  return null;
};

export const fetchUserProfile = async (userId: string): Promise<User> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
      id,
      email,
      full_name,
      role,
      avatar_url,
      student_profiles(
        grade,
        xp,
        level,
        badges,
        streak_days,
        strengths,
        weaknesses,
        learning_path,
        assessment_completed
      ),
      parent_profiles(
        subscription_tier,
        notifications
      ),
      admin_profiles(
        title,
        permissions
      )
    `,
    )
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Supabase] Failed to load profile', error);
    throw error;
  }

  const profile = data as ProfileRow;
  const displayName = profile.full_name ?? profile.email;

  if (profile.role === 'student') {
    const studentDetails = normalizeStudentProfile(profile.student_profiles);

    const student: Student = {
      id: profile.id,
      email: profile.email,
      name: displayName,
      role: 'student',
      grade: studentDetails?.grade ?? 1,
      xp: studentDetails?.xp ?? 0,
      level: studentDetails?.level ?? 1,
      badges: castBadges(studentDetails?.badges),
      streakDays: studentDetails?.streak_days ?? 0,
      strengths: studentDetails?.strengths ?? [],
      weaknesses: studentDetails?.weaknesses ?? [],
      learningPath: (studentDetails?.learning_path as Student['learningPath']) ?? [],
      assessmentCompleted: studentDetails?.assessment_completed ?? false,
      avatar: profile.avatar_url ?? undefined,
    };

    return student;
  }

  const adminDetails = normalizeAdminProfile(profile.admin_profiles);

  if (profile.role === 'admin') {
    const admin: Admin = {
      id: profile.id,
      email: profile.email,
      name: displayName,
      role: 'admin',
      avatar: profile.avatar_url ?? undefined,
      title: adminDetails?.title ?? 'Platform Admin',
      permissions: adminDetails?.permissions ?? [],
    };

    return admin;
  }

  const parentDetails = normalizeParentProfile(profile.parent_profiles);

  let children: ParentChildSnapshot[] = [];
  let weeklyReport: ParentWeeklyReport | null = null;

  if (profile.role === 'parent') {
    const [
      { data: childRows, error: childrenError },
      { data: weeklyReportRow, error: weeklyError },
    ] = await Promise.all([
      supabase
        .from('parent_dashboard_children')
        .select('*')
        .eq('parent_id', profile.id),
      supabase
        .from('parent_weekly_reports')
        .select('*')
        .eq('parent_id', profile.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (childrenError) {
      console.error('[Supabase] Failed to load parent children', childrenError);
    }

    if (weeklyError) {
      console.error('[Supabase] Failed to load parent weekly report', weeklyError);
    }

    children =
      childRows?.map((child: ParentDashboardChildRow) => {
        const masteryBreakdown = Array.isArray(child.mastery_breakdown)
          ? (child.mastery_breakdown as SubjectMastery[])
          : [];

        const masteryBySubject = masteryBreakdown
          .map((entry) => {
            const subject = toSubjectKey((entry as SubjectMastery).subject);
            if (!subject) {
              return null;
            }
            const mastery = (entry as SubjectMastery).mastery ?? 0;
            const cohortAverage = (entry as SubjectMastery).cohortAverage;
            const goal = (entry as SubjectMastery).goal;
            const delta =
              cohortAverage !== undefined
                ? Math.round((mastery - cohortAverage) * 100) / 100
                : undefined;
            const trend: SubjectMastery['trend'] = delta === undefined
              ? 'steady'
              : delta > 0.5
                ? 'up'
                : delta < -0.5
                  ? 'down'
                  : 'steady';

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
          id: child.student_id,
          name: [child.first_name, child.last_name].filter(Boolean).join(' ') || 'Student',
          grade: child.grade ?? 1,
          level: child.level ?? 1,
          xp: child.xp ?? 0,
          streakDays: child.streak_days ?? 0,
          strengths: child.strengths ?? [],
          focusAreas: child.weaknesses ?? [],
          lessonsCompletedWeek: child.lessons_completed_week ?? 0,
          practiceMinutesWeek: child.practice_minutes_week ?? 0,
          xpEarnedWeek: child.xp_earned_week ?? 0,
          masteryBySubject,
          recentActivity: [],
          goalProgress: averageFromBreakdown(child.mastery_breakdown, 'goal'),
          cohortComparison: averageFromBreakdown(child.mastery_breakdown, 'cohortAverage'),
        } satisfies ParentChildSnapshot;
      }) ?? [];

    weeklyReport = weeklyReportRow
      ? {
          weekStart: weeklyReportRow.week_start,
          summary: weeklyReportRow.summary ?? '',
          highlights: castStringArray(weeklyReportRow.highlights),
          recommendations: castStringArray(weeklyReportRow.recommendations),
          aiGenerated: weeklyReportRow.ai_generated ?? undefined,
        }
      : null;
  }

  const parent: Parent = {
    id: profile.id,
    email: profile.email,
    name: displayName,
    role: 'parent',
    avatar: profile.avatar_url ?? undefined,
    children,
    subscriptionTier: parentDetails?.subscription_tier ?? 'free',
    notifications: {
      weeklyReports: parentDetails?.notifications?.weeklyReports ?? true,
      missedSessions: parentDetails?.notifications?.missedSessions ?? true,
      lowScores: parentDetails?.notifications?.lowScores ?? true,
      majorProgress: parentDetails?.notifications?.majorProgress ?? true,
    },
    weeklyReport,
  };

  return parent;
};
