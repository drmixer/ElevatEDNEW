import { performance } from 'node:perf_hooks';

import { captureServerMessage } from './monitoring.js';

const parseNumberEnv = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const METRIC_SAMPLE_RATE = parseNumberEnv(process.env.API_METRIC_SAMPLE_RATE, 0.05);
const SLOW_THRESHOLD_MS = parseNumberEnv(process.env.API_SLOW_THRESHOLD_MS, 750);

const normalizeRouteLabel = (method: string, path: string): string => {
  let normalized = path;
  if (normalized.startsWith('/modules/') && normalized.endsWith('/assessment')) {
    normalized = '/modules/:id/assessment';
  } else if (normalized.startsWith('/modules/')) {
    normalized = '/modules/:id';
  } else if (normalized.startsWith('/import/')) {
    normalized = '/import/:provider';
  }

  normalized = normalized
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid')
    .replace(/\d+/g, ':id');

  return `${method.toUpperCase()} ${normalized}`;
};

export const startTimer = (): number => performance.now();

export const elapsedMs = (start: number): number => Math.max(0, performance.now() - start);

export const recordApiTiming = (
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
): void => {
  const route = normalizeRouteLabel(method, path);
  const roundedDuration = Math.round(durationMs * 100) / 100;
  const shouldSample = roundedDuration >= SLOW_THRESHOLD_MS || Math.random() < METRIC_SAMPLE_RATE;

  if (!shouldSample) {
    return;
  }

  const context = {
    route,
    statusCode,
    durationMs: roundedDuration,
  };

  console.log(
    `[metrics] ${route} -> ${statusCode} in ${Math.round(roundedDuration)}ms`,
  );

  captureServerMessage('api_timing', context, roundedDuration >= SLOW_THRESHOLD_MS ? 'warning' : 'info');
};
