import type { SupabaseClient } from '@supabase/supabase-js';

import { computeStudentInsights, type StudentInsightSnapshot } from './learningPaths.js';
import { recordOpsEvent } from './opsMetrics.js';
import { getRuntimeConfig } from './config.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_BASE_POINTS = 10;
const BASE_POINTS_BY_EVENT: Record<string, number> = {
  lesson_completed: 40,
  practice_answered: 12,
  quiz_submitted: 60,
  review_completed: 20,
  placement_completed: 30,
};

const PASSING_QUIZ_SCORE = 70;
const STREAK_BADGE_DAYS = 3;
const LESSON_COMPLETION_BADGE_COUNT = 10;

type LedgerSnapshot = {
  xp_total: number;
  streak_days: number;
  last_awarded_at: string | null;
  badge_ids: number[];
};

type PointsBreakdown = {
  base: number;
  difficultyBonus: number;
  accuracyBonus: number;
  streakBonus: number;
  firstTryBonus: number;
  noHintBonus: number;
};

type BadgeAward = { id: number; slug: string; name: string; metadata?: Record<string, unknown> };

type BadgeSeed = {
  slug: string;
  name: string;
  description: string;
  rarity: string;
  icon?: string | null;
  criteria: Record<string, unknown>;
};

const BADGE_SEEDS: BadgeSeed[] = [
  {
    slug: 'first-quiz-passed',
    name: 'Quiz Rookie',
    description: 'Pass your first quiz with a solid score.',
    rarity: 'common',
    icon: 'target',
    criteria: { type: 'quiz_pass', score: PASSING_QUIZ_SCORE },
  },
  {
    slug: 'streak-3-days',
    name: 'Consistency Spark',
    description: 'Complete work 3 days in a row.',
    rarity: 'common',
    icon: 'flame',
    criteria: { type: 'streak', days: STREAK_BADGE_DAYS },
  },
  {
    slug: 'lesson-marathon-10',
    name: 'Lesson Marathon',
    description: 'Finish 10 lessons to build momentum.',
    rarity: 'common',
    icon: 'books',
    criteria: { type: 'lessons_completed', count: LESSON_COMPLETION_BADGE_COUNT },
  },
  {
    slug: 'module-mastery',
    name: 'Module Mastery',
    description: 'Master a module with strong quiz performance.',
    rarity: 'rare',
    icon: 'trophy',
    criteria: { type: 'module_mastery', mastery_pct: 85 },
  },
];

export type AwardXPInput = {
  studentId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  basePoints?: number;
  accuracy?: number | null;
  difficulty?: number | null;
  pathEntryId?: number | null;
};

export type AwardXPResult = {
  pointsAwarded: number;
  xpTotal: number;
  streakDays: number;
  eventId: number | null;
  eventCreatedAt: string | null;
  awardedBadges: Array<{ id: number; slug: string; name: string }>;
};

const safeNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : null;
  if (parsed == null || Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
  return parsed;
};

const normalizeEventType = (value: string): string => value.trim().toLowerCase();

const nextStreak = (lastAwardedAt: string | null | undefined, previous: number, now: Date): number => {
  if (!lastAwardedAt) {
    return Math.max(previous, 1);
  }
  const last = new Date(lastAwardedAt);
  const diffDays = Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
  if (diffDays <= 0) {
    return Math.max(previous, 1);
  }
  if (diffDays === 1) {
    return Math.max(previous + 1, 1);
  }
  return 1;
};

const resolveBasePoints = (input: AwardXPInput): number => {
  if (Number.isFinite(input.basePoints)) {
    return Math.max(1, Number(input.basePoints));
  }
  const normalized = normalizeEventType(input.eventType);
  return BASE_POINTS_BY_EVENT[normalized] ?? DEFAULT_BASE_POINTS;
};

const loadXpLedger = async (supabase: SupabaseClient, studentId: string): Promise<LedgerSnapshot> => {
  const { data, error } = await supabase
    .from('xp_ledger')
    .select('xp_total, streak_days, last_awarded_at, badge_ids')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read XP ledger: ${error.message}`);
  }

  return {
    xp_total: (data?.xp_total as number | null | undefined) ?? 0,
    streak_days: (data?.streak_days as number | null | undefined) ?? 0,
    last_awarded_at: (data?.last_awarded_at as string | null | undefined) ?? null,
    badge_ids: Array.isArray(data?.badge_ids) ? (data?.badge_ids as number[]) : [],
  };
};

const calculatePoints = (
  input: AwardXPInput,
  ledger: LedgerSnapshot,
  now: Date,
  xpConfig: { multiplier: number; difficultyBonusMultiplier: number; accuracyBonusMultiplier: number; streakBonusMultiplier: number },
): { points: number; breakdown: PointsBreakdown; streakDays: number; accuracy: number | null; difficulty: number | null } => {
  const payload = (input.payload ?? {}) as Record<string, unknown>;
  const base = resolveBasePoints(input);
  const difficulty = typeof input.difficulty === 'number' && Number.isFinite(input.difficulty)
    ? input.difficulty
    : safeNumber(payload.difficulty);
  const accuracy = typeof input.accuracy === 'number' && Number.isFinite(input.accuracy)
    ? input.accuracy
    : (() => {
        const score = safeNumber(payload.score ?? payload.percentage ?? payload.accuracy);
        if (score != null) return score > 1 ? score / 100 : score;
        if (typeof payload.correct === 'boolean') return payload.correct ? 1 : 0;
        return null;
      })();

  const breakdown: PointsBreakdown = {
    base: Math.round(base * xpConfig.multiplier),
    difficultyBonus: 0,
    accuracyBonus: 0,
    streakBonus: 0,
    firstTryBonus: 0,
    noHintBonus: 0,
  };

  let points = breakdown.base;

  if (difficulty != null) {
    breakdown.difficultyBonus = Math.max(0, Math.round(difficulty * 2 * xpConfig.difficultyBonusMultiplier));
    points += breakdown.difficultyBonus;
  }

  if (accuracy != null) {
    breakdown.accuracyBonus = Math.max(-5, Math.round((accuracy - 0.65) * 25 * xpConfig.accuracyBonusMultiplier));
    points += breakdown.accuracyBonus;
  }

  const streakDays = nextStreak(ledger.last_awarded_at, ledger.streak_days, now);
  if (streakDays > ledger.streak_days) {
    breakdown.streakBonus = Math.min(12, Math.round((3 + Math.floor(streakDays / 2)) * xpConfig.streakBonusMultiplier));
    points += breakdown.streakBonus;
  }

  const attempts = safeNumber(
    payload.attempts ?? payload.attempt ?? payload.attempt_number ?? payload.attempts_count,
  );
  const isCorrect = typeof payload.correct === 'boolean' ? payload.correct : accuracy != null ? accuracy >= 0.7 : false;
  if (isCorrect && (attempts == null || attempts <= 1)) {
    breakdown.firstTryBonus = Math.round(5 * xpConfig.multiplier);
    points += breakdown.firstTryBonus;
  }

  const hintsUsed = safeNumber(
    payload.hints_used ?? payload.hints ?? payload.hints_count ?? payload.hintsRequested ?? payload.hint_requests,
  );
  if (isCorrect && hintsUsed === 0) {
    breakdown.noHintBonus = Math.round(4 * xpConfig.multiplier);
    points += breakdown.noHintBonus;
  }

  return {
    points: Math.max(1, points),
    breakdown,
    streakDays,
    accuracy,
    difficulty: difficulty ?? null,
  };
};

let badgeCatalogCache: Map<string, { id: number; slug: string; name: string; rarity: string | null; icon: string | null }> | null = null;

const ensureBadgeCatalog = async (supabase: SupabaseClient) => {
  if (badgeCatalogCache) {
    return badgeCatalogCache;
  }

  const { data, error } = await supabase
    .from('badge_definitions')
    .select('id, slug, name, description, rarity, icon');

  if (error) {
    throw new Error(`Unable to read badge catalog: ${error.message}`);
  }

  const existing = new Map<string, { id: number; slug: string; name: string; rarity: string | null; icon: string | null }>();
  (data ?? []).forEach((row) => {
    const slug = row.slug as string;
    if (!slug) return;
    existing.set(slug, {
      id: row.id as number,
      slug,
      name: (row.name as string | null | undefined) ?? slug,
      rarity: (row.rarity as string | null | undefined) ?? null,
      icon: (row.icon as string | null | undefined) ?? null,
    });
  });

  const missing = BADGE_SEEDS.filter((seed) => !existing.has(seed.slug));
  if (missing.length) {
    const { error: upsertError } = await supabase.from('badge_definitions').upsert(
      missing.map((seed) => ({
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        rarity: seed.rarity,
        icon: seed.icon ?? null,
        criteria: seed.criteria,
      })),
      { onConflict: 'slug' },
    );
    if (upsertError) {
      throw new Error(`Unable to seed badge catalog: ${upsertError.message}`);
    }
    return ensureBadgeCatalog(supabase);
  }

  badgeCatalogCache = existing;
  return badgeCatalogCache;
};

const selectBadgeAwards = async (
  supabase: SupabaseClient,
  studentId: string,
  ledger: LedgerSnapshot,
  insights: StudentInsightSnapshot,
  streakDays: number,
): Promise<{ badgeIds: number[]; awarded: BadgeAward[] }> => {
  const catalog = await ensureBadgeCatalog(supabase);
  const awarded: BadgeAward[] = [];
  const existing = new Set(ledger.badge_ids ?? []);

  const addAward = (slug: string, metadata?: Record<string, unknown>) => {
    const def = catalog.get(slug);
    if (!def || existing.has(def.id)) return;
    awarded.push({ id: def.id, slug: def.slug, name: def.name, metadata });
  };

  if (insights.latestQuizScore != null && insights.latestQuizScore >= PASSING_QUIZ_SCORE) {
    addAward('first-quiz-passed', { score: insights.latestQuizScore });
  }
  if (streakDays >= STREAK_BADGE_DAYS) {
    addAward('streak-3-days', { streak_days: streakDays });
  }
  if (insights.lessonsCompleted >= LESSON_COMPLETION_BADGE_COUNT) {
    addAward('lesson-marathon-10', { lessons_completed: insights.lessonsCompleted });
  }
  if (insights.modulesMastered.length > 0) {
    const mastered = [...insights.modulesMastered].sort((a, b) => b.mastery - a.mastery)[0];
    addAward('module-mastery', {
      module_id: mastered.moduleId,
      module_title: mastered.title,
      mastery: mastered.mastery,
    });
  }

  if (!awarded.length) {
    return { badgeIds: ledger.badge_ids ?? [], awarded };
  }

  const { error: badgeError } = await supabase
    .from('student_badges')
    .upsert(
      awarded.map((award) => ({
        student_id: studentId,
        badge_id: award.id,
        metadata: award.metadata ?? {},
      })),
      { onConflict: 'student_id,badge_id' },
    );
  if (badgeError) {
    throw new Error(`Unable to persist badge awards: ${badgeError.message}`);
  }

  const { error: eventError } = await supabase.from('student_events').insert(
    awarded.map((award) => ({
      student_id: studentId,
      event_type: 'badge_awarded',
      payload: { badge_slug: award.slug, badge_id: award.id, ...award.metadata },
      points_awarded: 0,
    })),
  );
  if (eventError) {
    throw new Error(`Unable to log badge awards: ${eventError.message}`);
  }

  const badgeIds = Array.from(new Set([...(ledger.badge_ids ?? []), ...awarded.map((award) => award.id)]));
  return { badgeIds, awarded };
};

const upsertXpLedger = async (
  supabase: SupabaseClient,
  studentId: string,
  ledger: LedgerSnapshot,
  delta: number,
  now: Date,
  options?: { badgeIds?: number[]; streakDays?: number },
): Promise<{ xpTotal: number; streakDays: number; badgeIds: number[] }> => {
  const xpTotal = Math.max(0, ledger.xp_total + delta);
  const streakDays = typeof options?.streakDays === 'number'
    ? options.streakDays
    : nextStreak(ledger.last_awarded_at, ledger.streak_days, now);
  const badgeIds = options?.badgeIds ?? ledger.badge_ids ?? [];

  const upsertPayload = {
    student_id: studentId,
    xp_total: xpTotal,
    streak_days: streakDays,
    last_awarded_at: now.toISOString(),
    badge_ids: badgeIds,
  };

  const { error: upsertError } = await supabase
    .from('xp_ledger')
    .upsert(upsertPayload, { onConflict: 'student_id' });

  if (upsertError) {
    throw new Error(`Unable to update XP ledger: ${upsertError.message}`);
  }

  const { error: profileError } = await supabase
    .from('student_profiles')
    .update({ xp: xpTotal, streak_days: streakDays })
    .eq('id', studentId);

  if (profileError) {
    throw new Error(`Unable to sync XP to student profile: ${profileError.message}`);
  }

  return { xpTotal, streakDays, badgeIds };
};

export const recordLearningEvent = async (
  supabase: SupabaseClient,
  input: AwardXPInput,
): Promise<AwardXPResult> => {
  const now = new Date();
  const runtimeConfig = await getRuntimeConfig(supabase);
  const ledger = await loadXpLedger(supabase, input.studentId);
  const { points, breakdown, streakDays, accuracy, difficulty } = calculatePoints(
    input,
    ledger,
    now,
    runtimeConfig.xp,
  );

  const { data: eventRow, error: eventError } = await supabase
    .from('student_events')
    .insert({
      student_id: input.studentId,
      event_type: input.eventType,
      payload: input.payload ?? {},
      points_awarded: points,
      path_entry_id: input.pathEntryId ?? null,
    })
    .select('id, created_at')
    .maybeSingle();

  if (eventError) {
    throw new Error(`Unable to log student event: ${eventError.message}`);
  }

  let badgeResult: { badgeIds: number[]; awarded: BadgeAward[] } = { badgeIds: ledger.badge_ids ?? [], awarded: [] };
  let insights: StudentInsightSnapshot | null = null;
  try {
    insights = await computeStudentInsights(supabase, input.studentId);
    badgeResult = await selectBadgeAwards(supabase, input.studentId, ledger, insights, streakDays);
  } catch (insightError) {
    console.warn('[xp] Unable to compute badge awards', insightError);
  }
  const ledgerResult = await upsertXpLedger(supabase, input.studentId, ledger, points, now, {
    badgeIds: badgeResult.badgeIds,
    streakDays,
  });

  const { error: xpEventError } = await supabase
    .from('xp_events')
    .insert({
      student_id: input.studentId,
      source: input.eventType,
      xp_change: points,
      metadata: {
        ...(input.payload ?? {}),
        breakdown,
        accuracy,
        difficulty,
      },
    });

  if (xpEventError) {
    throw new Error(`Unable to log XP event: ${xpEventError.message}`);
  }
  recordOpsEvent({
    type: 'xp_rate',
    value: points,
    label: input.eventType,
  });

  return {
    pointsAwarded: points,
    xpTotal: ledgerResult.xpTotal,
    streakDays: ledgerResult.streakDays,
    eventId: (eventRow?.id as number | null | undefined) ?? null,
    eventCreatedAt: (eventRow?.created_at as string | null | undefined) ?? null,
    awardedBadges: badgeResult.awarded.map((award) => ({
      id: award.id,
      slug: award.slug,
      name: award.name,
    })),
  };
};
