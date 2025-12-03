import { authenticatedFetch, handleApiResponse } from '../lib/apiClient';

export type StudentStats = {
  xpTotal: number;
  streakDays: number;
  badges: number;
  badgeDetails?: Array<{ id: number; slug: string | null; name: string | null; earnedAt: string | null; icon: string | null; rarity: string | null }>;
  recentEvents: Array<{ event_type: string; points_awarded: number; created_at: string }>;
  masteryAvg: number | null;
  pathProgress: { completed: number; remaining: number; percent: number | null };
  avgAccuracy: number | null;
  weeklyTimeMinutes: number;
  modulesMastered: { count: number; items: Array<{ moduleId: number; title: string | null; mastery: number }> };
  focusStandards: Array<{ code: string; accuracy: number; samples: number }>;
  latestQuizScore: number | null;
  struggle: boolean;
};

export type ParentOverview = {
  children: Array<{
    id: string;
    name: string;
    grade_band: string | null;
    xp_total: number;
    streak_days: number;
    recent_events: Array<{ event_type: string; created_at: string }>;
    progress_pct: number | null;
    latest_quiz_score: number | null;
    weekly_time_minutes: number;
    alerts: string[];
    struggle: boolean;
  }>;
};

export const fetchStudentStats = async (): Promise<StudentStats> => {
  const response = await authenticatedFetch('/api/v1/student/stats');
  const { stats } = await handleApiResponse<{ stats: StudentStats }>(response);
  return stats;
};

export const fetchParentOverview = async (): Promise<ParentOverview> => {
  const response = await authenticatedFetch('/api/v1/parent/overview');
  return handleApiResponse<ParentOverview>(response);
};
