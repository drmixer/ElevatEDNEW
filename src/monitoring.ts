import * as Sentry from '@sentry/react';

let monitoringInitialized = false;
let lastInitSucceeded = false;

type NumericEnv = string | number | undefined | null;

const scrubRecord = (input?: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (!input) return undefined;
  const cleaned: Record<string, unknown> = {};
  Object.entries(input).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (['email', 'name', 'full_name', 'content', 'body'].includes(lowerKey)) {
      cleaned[key] = '[redacted]';
      return;
    }
    if (typeof value === 'string' && value.includes('@')) {
      cleaned[key] = '[redacted]';
      return;
    }
    cleaned[key] = value;
  });
  return cleaned;
};

const scrubClientEvent = (event: Sentry.Event): Sentry.Event | null => {
  const sanitized: Sentry.Event = { ...event };

  if (sanitized.user) {
    sanitized.user = sanitized.user.id ? { id: sanitized.user.id } : undefined;
  }

  if (sanitized.request) {
    sanitized.request = {
      url: sanitized.request.url,
      method: sanitized.request.method,
    };
  }

  if (sanitized.extra) {
    sanitized.extra = scrubRecord(sanitized.extra);
  }

  if (sanitized.breadcrumbs) {
    sanitized.breadcrumbs = sanitized.breadcrumbs.slice(-30).map((crumb) => ({
      ...crumb,
      data: scrubRecord(crumb.data as Record<string, unknown> | undefined),
    }));
  }

  return sanitized;
};

const parseRate = (value: NumericEnv, fallback: number): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return fallback;
};

export const initClientMonitoring = (): boolean => {
  if (monitoringInitialized) {
    return true;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || import.meta.env.MODE === 'test') {
    return false;
  }

  const tracesSampleRate = parseRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0);
  const replaySessionRate = parseRate(import.meta.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE, 0);
  const replayErrorRate = parseRate(import.meta.env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE, 1);

  Sentry.init({
    dsn,
    enabled: import.meta.env.MODE !== 'development' ? true : Boolean(import.meta.env.VITE_SENTRY_ENABLE_DEV),
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE ?? 'development',
    integrations: [
      Sentry.browserTracingIntegration({
        tracePropagationTargets: [/^https?:\/\/localhost/, /^\//],
      }),
      Sentry.replayIntegration(),
    ],
    sendDefaultPii: false,
    beforeSend: (event) => scrubClientEvent(event),
    beforeBreadcrumb: (breadcrumb) =>
      breadcrumb
        ? {
          ...breadcrumb,
          data: scrubRecord(breadcrumb.data as Record<string, unknown> | undefined),
        }
        : breadcrumb,
    tracesSampleRate,
    replaysSessionSampleRate: replaySessionRate,
    replaysOnErrorSampleRate: replayErrorRate,
  });

  monitoringInitialized = true;
  lastInitSucceeded = true;
  return true;
};

export { Sentry };

export const isMonitoringEnabled = (): boolean => lastInitSucceeded;

export const captureClientException = (error: unknown, context?: Record<string, unknown>): void => {
  if (!lastInitSucceeded) return;
  Sentry.captureException(error, { extra: scrubRecord(context) });
};

export const captureClientMessage = (
  message: string,
  context?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info',
): void => {
  if (!lastInitSucceeded) return;
  Sentry.captureMessage(message, { level, extra: scrubRecord(context) });
};

// ─────────────────────────────────────────────────────────────
// Phase 8: Key Failure Tracking
// ─────────────────────────────────────────────────────────────

export type KeyFailureType =
  | 'auth_failed'
  | 'profile_load_failed'
  | 'lesson_load_failed'
  | 'assessment_failed'
  | 'tutor_unavailable'
  | 'path_generation_failed'
  | 'save_failed'
  | 'network_error';

/**
 * Track key failures that impact user experience
 */
export const trackKeyFailure = (
  type: KeyFailureType,
  error: unknown,
  context?: Record<string, unknown>,
): void => {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Always log to console for debugging
  console.error(`[KeyFailure:${type}]`, errorMessage, context);

  // Send to Sentry if enabled
  if (lastInitSucceeded) {
    Sentry.captureException(error, {
      tags: { failure_type: type },
      extra: scrubRecord({
        ...context,
        failure_type: type,
        timestamp: new Date().toISOString(),
      }),
    });
  }
};

/**
 * Track recoverable errors (user can retry)
 */
export const trackRecoverableError = (
  message: string,
  context?: Record<string, unknown>,
): void => {
  console.warn(`[RecoverableError]`, message, context);

  if (lastInitSucceeded) {
    Sentry.captureMessage(message, {
      level: 'warning',
      tags: { error_type: 'recoverable' },
      extra: scrubRecord(context),
    });
  }
};

// ─────────────────────────────────────────────────────────────
// Phase 8.1: Performance Measurement
// ─────────────────────────────────────────────────────────────

const performanceMarks = new Map<string, number>();

/**
 * Start a performance measurement
 */
export const startMeasure = (name: string): void => {
  performanceMarks.set(name, performance.now());
};

/**
 * End a performance measurement and optionally report if slow
 */
export const endMeasure = (
  name: string,
  thresholdMs = 2000,
): number | null => {
  const start = performanceMarks.get(name);
  if (start === undefined) return null;

  const duration = performance.now() - start;
  performanceMarks.delete(name);

  // Report slow operations
  if (duration > thresholdMs && lastInitSucceeded) {
    Sentry.captureMessage(`Slow operation: ${name}`, {
      level: 'warning',
      tags: { performance: 'slow' },
      extra: {
        operation: name,
        duration_ms: Math.round(duration),
        threshold_ms: thresholdMs,
      },
    });
  }

  return duration;
};

/**
 * Measure an async operation
 */
export const measureAsync = async <T>(
  name: string,
  operation: () => Promise<T>,
  thresholdMs = 2000,
): Promise<T> => {
  startMeasure(name);
  try {
    return await operation();
  } finally {
    endMeasure(name, thresholdMs);
  }
};

// ─────────────────────────────────────────────────────────────
// Phase 8.2: Offline Detection
// ─────────────────────────────────────────────────────────────

let isOffline = !navigator.onLine;
const offlineListeners: Set<(offline: boolean) => void> = new Set();

// Set up online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOffline = false;
    offlineListeners.forEach(listener => listener(false));
  });

  window.addEventListener('offline', () => {
    isOffline = true;
    offlineListeners.forEach(listener => listener(true));
  });
}

/**
 * Check if the app is offline
 */
export const checkIsOffline = (): boolean => isOffline;

/**
 * Subscribe to offline status changes
 */
export const onOfflineChange = (listener: (offline: boolean) => void): (() => void) => {
  offlineListeners.add(listener);
  return () => offlineListeners.delete(listener);
};

/**
 * Set user context for error tracking
 */
export const setUserContext = (userId: string | null, role?: string): void => {
  if (!lastInitSucceeded) return;

  if (userId) {
    Sentry.setUser({ id: userId, role });
  } else {
    Sentry.setUser(null);
  }
};
