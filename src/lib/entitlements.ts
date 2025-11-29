import type { BillingContext, BillingPlan, BillingSummary } from '../services/billingService';

type LimitValue = number | 'unlimited' | null;

type EntitlementLimits = {
  seatLimit: number | null;
  lessonLimit: LimitValue;
  aiTutorDailyLimit: LimitValue;
  aiAccess: boolean;
};

export type Entitlements = EntitlementLimits & {
  planSlug: string;
  planName: string;
  planStatus: string;
  priceCents: number | null;
  tier: 'free' | 'plus' | 'premium' | 'custom';
  advancedAnalytics: boolean;
  weeklyAiSummaries: boolean;
  weeklyDigest: boolean;
  seatsUsed: number;
  isTrialing: boolean;
  trialEndsAt: string | null;
  renewsAt: string | null;
  cancelAt: string | null;
  source: 'billing' | 'context' | 'fallback';
};

type EntitlementInput = {
  plan?: BillingPlan | null;
  subscription?: BillingSummary['subscription'] | BillingContext['subscription'] | null;
  limits?: Partial<EntitlementLimits>;
  childCount?: number;
  source?: 'billing' | 'context';
};

const DEFAULT_PLAN_CONFIG: Record<string, Partial<EntitlementLimits & { advancedAnalytics: boolean; weeklyAiSummaries: boolean; weeklyDigest: boolean; tier: Entitlements['tier']; priceCents?: number | null }>> = {
  'family-free': {
    seatLimit: 1,
    lessonLimit: 10,
    aiTutorDailyLimit: 3,
    aiAccess: true,
    advancedAnalytics: false,
    weeklyAiSummaries: false,
    weeklyDigest: false,
    tier: 'free',
    priceCents: 0,
  },
  'family-plus': {
    seatLimit: 3,
    lessonLimit: 100,
    aiTutorDailyLimit: 'unlimited',
    aiAccess: true,
    advancedAnalytics: true,
    weeklyAiSummaries: true,
    weeklyDigest: true,
    tier: 'plus',
  },
  'family-premium': {
    seatLimit: 5,
    lessonLimit: 'unlimited',
    aiTutorDailyLimit: 'unlimited',
    aiAccess: true,
    advancedAnalytics: true,
    weeklyAiSummaries: true,
    weeklyDigest: true,
    tier: 'premium',
  },
};

const parseLimit = (input: unknown): LimitValue => {
  if (input === null || input === undefined) return null;
  if (typeof input === 'string' && input.toLowerCase() === 'unlimited') return 'unlimited';
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const parsed = Number.parseFloat(input);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const normalizeTier = (slug: string): Entitlements['tier'] => {
  if (slug.includes('premium')) return 'premium';
  if (slug.includes('plus')) return 'plus';
  if (slug.includes('free')) return 'free';
  return 'custom';
};

const extractSeatLimit = (metadata: Record<string, unknown>, fallback: number | null) => {
  const candidates = [
    metadata['seat_limit'],
    metadata['max_learners'],
    metadata['learner_limit'],
    metadata['seatLimit'],
  ];
  const parsed = candidates
    .map((value) => (typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)))
    .find((value) => Number.isFinite(value) && value > 0);
  return parsed ?? fallback ?? null;
};

export const buildEntitlements = ({
  plan,
  subscription,
  limits,
  childCount,
  source,
}: EntitlementInput): Entitlements => {
  const slug = plan?.slug ?? subscription?.plan?.slug ?? 'family-free';
  const metadata = plan?.metadata ?? subscription?.plan?.metadata ?? {};
  const defaults = DEFAULT_PLAN_CONFIG[slug] ?? DEFAULT_PLAN_CONFIG['family-free'];

  const seatLimit = limits?.seatLimit ?? extractSeatLimit(metadata, defaults.seatLimit ?? null);
  const lessonLimit =
    limits?.lessonLimit ??
    parseLimit(
      metadata['lesson_limit'] ?? metadata['lessonLimit'] ?? defaults.lessonLimit ?? null,
    );
  const aiTutorDailyLimit =
    limits?.aiTutorDailyLimit ??
    parseLimit(
      metadata['ai_tutor_daily_limit'] ??
        metadata['tutorDailyLimit'] ??
        defaults.aiTutorDailyLimit ??
        null,
    );
  const aiAccess = typeof limits?.aiAccess === 'boolean' ? limits.aiAccess : defaults.aiAccess ?? true;

  const advancedAnalytics =
    typeof metadata['advanced_analytics'] === 'boolean'
      ? (metadata['advanced_analytics'] as boolean)
      : defaults.advancedAnalytics ?? false;
  const weeklyAiSummaries =
    typeof metadata['weekly_ai_summaries'] === 'boolean'
      ? (metadata['weekly_ai_summaries'] as boolean)
      : defaults.weeklyAiSummaries ?? false;
  const weeklyDigest =
    typeof metadata['weekly_digest'] === 'boolean'
      ? (metadata['weekly_digest'] as boolean)
      : defaults.weeklyDigest ?? false;

  const planStatus = subscription?.status ?? plan?.status ?? 'active';
  const tier = (defaults.tier as Entitlements['tier']) ?? normalizeTier(slug);
  const priceCents = plan?.priceCents ?? defaults.priceCents ?? null;

  return {
    planSlug: slug,
    planName: plan?.name ?? subscription?.plan?.name ?? 'Family Free',
    planStatus,
    priceCents,
    tier,
    seatLimit,
    lessonLimit,
    aiTutorDailyLimit,
    aiAccess,
    advancedAnalytics,
    weeklyAiSummaries,
    weeklyDigest,
    seatsUsed: childCount ?? 0,
    isTrialing: planStatus === 'trialing',
    trialEndsAt: subscription?.trialEndsAt ?? null,
    renewsAt: subscription?.currentPeriodEnd ?? null,
    cancelAt: subscription?.cancelAt ?? null,
    source: source ?? 'fallback',
  };
};

export const limitLabel = (limit: LimitValue, noun: string) => {
  if (limit === 'unlimited') return 'Unlimited';
  if (!limit) return `Limited ${noun}`;
  return `${limit} ${noun}`;
};
