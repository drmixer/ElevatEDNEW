import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import process from 'node:process';

import * as Sentry from '@sentry/node';

let monitoringEnabled = false;

const scrubContext = (context?: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (!context) {
    return undefined;
  }
  const sanitized: Record<string, unknown> = {};
  Object.entries(context).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (['email', 'name', 'full_name', 'content', 'body'].includes(lowerKey)) {
      sanitized[key] = '[redacted]';
      return;
    }
    if (typeof value === 'string' && value.includes('@')) {
      sanitized[key] = '[redacted]';
      return;
    }
    sanitized[key] = value;
  });
  return sanitized;
};

const sanitizeHeaders = (headers: IncomingHttpHeaders): Record<string, string> => {
  const safeHeaders: Record<string, string> = {};
  (['user-agent', 'x-request-id'] as const).forEach((header) => {
    const value = headers[header];
    if (typeof value === 'string' && value.length) {
      safeHeaders[header] = value;
    }
  });
  return safeHeaders;
};

const scrubServerEvent = (event: Sentry.Event): Sentry.Event | null => {
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
    sanitized.extra = scrubContext(sanitized.extra);
  }

  if (sanitized.breadcrumbs) {
    sanitized.breadcrumbs = sanitized.breadcrumbs.slice(-50).map((crumb) => ({
      ...crumb,
      data: scrubContext(crumb.data as Record<string, unknown> | undefined),
    }));
  }

  return sanitized;
};

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
    sendDefaultPii: false,
    beforeSend: (event) => scrubServerEvent(event),
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
    extra: scrubContext(context),
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
    extra: scrubContext(context),
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
      headers: sanitizeHeaders(req.headers ?? {}),
    });

    try {
      return await handler();
    } catch (error) {
      captureServerException(error, { route: req.url, method: req.method });
      throw error;
    }
  });
};
