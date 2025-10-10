import type { IncomingMessage } from 'node:http';
import process from 'node:process';

import * as Sentry from '@sentry/node';

let monitoringEnabled = false;

const parseSampleRate = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const initServerMonitoring = (): boolean => {
  if (monitoringEnabled) {
    return true;
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0),
  });

  process.on('unhandledRejection', (reason) => {
    captureServerException(reason, { mechanism: 'unhandledRejection' });
  });

  process.on('uncaughtException', (error) => {
    captureServerException(error, { mechanism: 'uncaughtException' });
  });

  monitoringEnabled = true;
  return true;
};

export const captureServerException = (error: unknown, context?: Record<string, unknown>): void => {
  if (!monitoringEnabled) {
    return;
  }
  Sentry.captureException(error, {
    extra: context,
  });
};

export const captureServerMessage = (
  message: string,
  context?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info',
): void => {
  if (!monitoringEnabled) {
    return;
  }
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
};

export const withRequestScope = async <T>(
  req: IncomingMessage,
  handler: () => Promise<T>,
): Promise<T> => {
  if (!monitoringEnabled) {
    return handler();
  }

  return Sentry.withScope(async (scope) => {
    scope.setContext('request', {
      method: req.method,
      url: req.url,
      headers: req.headers,
    });

    try {
      return await handler();
    } catch (error) {
      captureServerException(error, { route: req.url, method: req.method });
      throw error;
    }
  });
};
