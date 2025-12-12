import { authenticatedFetch, handleApiResponse } from '../lib/apiClient';
import type { StudentPathEntry } from './onboardingService';

export type StudentEventInput = {
  eventType: string;
  pathEntryId?: number | null;
  status?: 'not_started' | 'in_progress' | 'completed' | null;
  score?: number | null;
  timeSpentSeconds?: number | null;
  accuracy?: number | null;
  difficulty?: number | null;
  basePoints?: number | null;
  payload?: Record<string, unknown> | null;
};

export type StudentEventResponse = {
  event: {
    pointsAwarded: number;
    xpTotal: number;
    streakDays: number;
    eventId: number | null;
    eventCreatedAt: string | null;
    awardedBadges?: Array<{ id: number; slug: string; name: string }>;
  };
  stats?: {
    xpTotal: number;
    streakDays: number;
    badges: number;
    badgeDetails?: Array<{ id: number; slug: string | null; name: string | null; earnedAt: string | null; icon: string | null; rarity: string | null }>;
    recentEvents: Array<{ event_type: string; points_awarded: number; created_at: string }>;
    masteryAvg: number | null;
    pathProgress: { completed: number; remaining: number; percent: number | null };
    avgAccuracy?: number | null;
    avgAccuracyPriorWeek?: number | null;
    avgAccuracyDelta?: number | null;
    weeklyTimeMinutes?: number;
    weeklyTimeMinutesPriorWeek?: number;
    weeklyTimeMinutesDelta?: number | null;
    modulesMastered?: { count: number; items: Array<{ moduleId: number; title: string | null; mastery: number }> };
    focusStandards?: Array<{ code: string; accuracy: number; samples: number }>;
    latestQuizScore?: number | null;
    struggle?: boolean;
  };
  path?: { path: { id: number; status: string; started_at: string; updated_at: string; metadata: Record<string, unknown> | null }; entries: StudentPathEntry[] } | null;
  next?: StudentPathEntry | null;
  adaptive?: { targetDifficulty: number; misconceptions: string[]; recentAttempts: Array<Record<string, unknown>> };
};

export const sendStudentEvent = async (input: StudentEventInput): Promise<StudentEventResponse> => {
  const response = await authenticatedFetch('/api/v1/student/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return handleApiResponse<StudentEventResponse>(response);
};

export default sendStudentEvent;
