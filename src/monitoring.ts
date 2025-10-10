import * as Sentry from '@sentry/react';

let monitoringInitialized = false;

type NumericEnv = string | number | undefined | null;

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
    tracesSampleRate,
    replaysSessionSampleRate: replaySessionRate,
    replaysOnErrorSampleRate: replayErrorRate,
  });

  monitoringInitialized = true;
  return true;
};

export { Sentry };
