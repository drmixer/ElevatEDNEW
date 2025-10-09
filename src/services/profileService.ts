import supabase from '../lib/supabaseClient';
import type { Badge, Parent, Student, User } from '../types';

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

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'parent';
  avatar_url: string | null;
  student_profiles?: StudentProfileRow | StudentProfileRow[] | null;
  parent_profiles?: ParentProfileRow | ParentProfileRow[] | null;
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

  const parentDetails = normalizeParentProfile(profile.parent_profiles);

  const parent: Parent = {
    id: profile.id,
    email: profile.email,
    name: displayName,
    role: 'parent',
    avatar: profile.avatar_url ?? undefined,
    children: [],
    subscriptionTier: parentDetails?.subscription_tier ?? 'free',
    notifications: {
      weeklyReports: parentDetails?.notifications?.weeklyReports ?? true,
      missedSessions: parentDetails?.notifications?.missedSessions ?? true,
      lowScores: parentDetails?.notifications?.lowScores ?? true,
      majorProgress: parentDetails?.notifications?.majorProgress ?? true,
    },
  };

  return parent;
};
