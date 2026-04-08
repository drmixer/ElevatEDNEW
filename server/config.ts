import type { SupabaseClient } from '@supabase/supabase-js';

type AdaptiveConfig = {
  targetAccuracyMin: number;
  targetAccuracyMax: number;
  maxRemediationPending: number;
  maxPracticePending: number;
  struggleConsecutiveMisses: number;
};

type XpConfig = {
  multiplier: number;
  difficultyBonusMultiplier: number;
  accuracyBonusMultiplier: number;
  streakBonusMultiplier: number;
};

type TutorConfig = {
  timeoutMs: number;
};

type PlacementConfig = {
  activeEngine: string;
  catV2NewStudentsEnabled: boolean;
  catV2RestartEnabled: boolean;
};

export type RuntimeConfig = {
  adaptive: AdaptiveConfig;
  xp: XpConfig;
  tutor: TutorConfig;
  placement: PlacementConfig;
};

const DEFAULT_CONFIG: RuntimeConfig = {
  adaptive: {
    targetAccuracyMin: 0.65,
    targetAccuracyMax: 0.8,
    maxRemediationPending: 2,
    maxPracticePending: 3,
    struggleConsecutiveMisses: 3,
  },
  xp: {
    multiplier: 1,
    difficultyBonusMultiplier: 1,
    accuracyBonusMultiplier: 1,
    streakBonusMultiplier: 1,
  },
  tutor: {
    timeoutMs: 12000,
  },
  placement: {
    activeEngine: 'legacy_v1',
    catV2NewStudentsEnabled: false,
    catV2RestartEnabled: false,
  },
};

type RawConfigRow = { key?: string | null; value?: unknown };

let cachedConfig: { expires: number; config: RuntimeConfig } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export const clearRuntimeConfigCacheForTests = (): void => {
  cachedConfig = null;
};

const coerceNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : null;
  return Number.isFinite(parsed) ? (parsed as number) : fallback;
};

const coerceBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return fallback;
};

const hydrateConfig = (rows: RawConfigRow[]): RuntimeConfig => {
  const map = new Map<string, unknown>();
  rows.forEach((row) => {
    if (row.key) {
      map.set(row.key, row.value);
    }
  });
  return {
    adaptive: {
      targetAccuracyMin: coerceNumber(map.get('adaptive.target_accuracy_min'), DEFAULT_CONFIG.adaptive.targetAccuracyMin),
      targetAccuracyMax: coerceNumber(map.get('adaptive.target_accuracy_max'), DEFAULT_CONFIG.adaptive.targetAccuracyMax),
      maxRemediationPending: Math.max(
        1,
        Math.round(coerceNumber(map.get('adaptive.max_remediation_pending'), DEFAULT_CONFIG.adaptive.maxRemediationPending)),
      ),
      maxPracticePending: Math.max(
        1,
        Math.round(coerceNumber(map.get('adaptive.max_practice_pending'), DEFAULT_CONFIG.adaptive.maxPracticePending)),
      ),
      struggleConsecutiveMisses: Math.max(
        2,
        Math.round(coerceNumber(map.get('adaptive.struggle_consecutive_misses'), DEFAULT_CONFIG.adaptive.struggleConsecutiveMisses)),
      ),
    },
    xp: {
      multiplier: coerceNumber(map.get('xp.multiplier'), DEFAULT_CONFIG.xp.multiplier),
      difficultyBonusMultiplier: coerceNumber(
        map.get('xp.difficulty_bonus_multiplier'),
        DEFAULT_CONFIG.xp.difficultyBonusMultiplier,
      ),
      accuracyBonusMultiplier: coerceNumber(map.get('xp.accuracy_bonus_multiplier'), DEFAULT_CONFIG.xp.accuracyBonusMultiplier),
      streakBonusMultiplier: coerceNumber(map.get('xp.streak_bonus_multiplier'), DEFAULT_CONFIG.xp.streakBonusMultiplier),
    },
    tutor: {
      timeoutMs: Math.max(3000, Math.round(coerceNumber(map.get('tutor.timeout_ms'), DEFAULT_CONFIG.tutor.timeoutMs))),
    },
    placement: {
      activeEngine:
        typeof map.get('placement.engine_active') === 'string' && String(map.get('placement.engine_active')).trim().length
          ? String(map.get('placement.engine_active')).trim()
          : DEFAULT_CONFIG.placement.activeEngine,
      catV2NewStudentsEnabled: coerceBoolean(
        map.get('placement.cat_v2_new_students_enabled'),
        DEFAULT_CONFIG.placement.catV2NewStudentsEnabled,
      ),
      catV2RestartEnabled: coerceBoolean(
        map.get('placement.cat_v2_restart_enabled'),
        DEFAULT_CONFIG.placement.catV2RestartEnabled,
      ),
    },
  };
};

export const getRuntimeConfig = async (supabase: SupabaseClient | null): Promise<RuntimeConfig> => {
  const now = Date.now();
  if (cachedConfig && cachedConfig.expires > now) {
    return cachedConfig.config;
  }

  if (!supabase) {
    return DEFAULT_CONFIG;
  }

  try {
    const { data, error } = await supabase.from('platform_config').select('key, value');
    if (error || !data) {
      return DEFAULT_CONFIG;
    }
    const config = hydrateConfig(data as RawConfigRow[]);
    cachedConfig = { config, expires: now + CACHE_TTL_MS };
    return config;
  } catch (error) {
    console.warn('[config] falling back to defaults', error);
    return DEFAULT_CONFIG;
  }
};
