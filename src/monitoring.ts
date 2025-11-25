import * as Sentry from '@sentry/react';

let monitoringInitialized = false;

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
  return true;
};

export { Sentry };
