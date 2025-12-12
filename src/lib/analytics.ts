import { authenticatedFetch } from './apiClient';

type AnalyticsPayload = Record<string, unknown> | undefined;

type PendingEvent = {
  eventName: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
};

const ANALYTICS_ENDPOINT = '/api/v1/analytics/event';
const MAX_BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 2000;
const pending: PendingEvent[] = [];
let flushTimer: number | null = null;
let flushing = false;

const shouldSendToSupabase = (eventName: string) => eventName.startsWith('success_');

const scrubPayload = (payload?: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (!payload) return undefined;
  const bannedKeys = new Set(['email', 'name', 'full_name', 'message', 'prompt', 'content', 'body', 'text', 'hint']);
  const MAX_STRING = 200;
  const MAX_ARRAY = 50;
  const MAX_DEPTH = 3;

  const scrubValue = (value: unknown, depth: number): unknown => {
    if (depth <= 0) return null;
    if (value == null) return null;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim().slice(0, MAX_STRING);
      return trimmed.includes('@') ? '[redacted]' : trimmed;
    }
    if (Array.isArray(value)) {
      return value.slice(0, MAX_ARRAY).map((entry) => scrubValue(entry, depth - 1));
    }
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
        if (bannedKeys.has(key.toLowerCase())) return;
        result[key] = scrubValue(entry, depth - 1);
      });
      return result;
    }
    return null;
  };

  return scrubValue(payload, MAX_DEPTH) as Record<string, unknown>;
};

const scheduleFlush = () => {
  if (typeof window === 'undefined') return;
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushAnalytics();
  }, FLUSH_INTERVAL_MS);
};

const flushAnalytics = async () => {
  if (flushing || pending.length === 0) return;
  flushing = true;

  const batch = pending.splice(0, MAX_BATCH_SIZE);
  try {
    await authenticatedFetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    });
  } catch (error) {
    pending.unshift(...batch);
    if (import.meta.env.DEV) {
      console.warn('[analytics] failed to persist events', error);
    }
  } finally {
    flushing = false;
    if (pending.length > 0) {
      scheduleFlush();
    }
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushAnalytics();
    }
  });
  window.addEventListener('pagehide', () => {
    void flushAnalytics();
  });
}

const enqueueSupabaseEvent = (eventName: string, payload?: AnalyticsPayload) => {
  if (!shouldSendToSupabase(eventName)) return;
  pending.push({
    eventName,
    payload: scrubPayload(payload),
    occurredAt: new Date().toISOString(),
  });

  if (pending.length >= MAX_BATCH_SIZE) {
    void flushAnalytics();
    return;
  }
  scheduleFlush();
};

export const trackEvent = (eventName: string, payload?: AnalyticsPayload) => {
  if (!eventName) return;
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('analytics-event', {
          detail: { eventName, payload, timestamp: new Date().toISOString() },
        }),
      );
    }
    enqueueSupabaseEvent(eventName, payload);
    if (import.meta.env.DEV) {
      console.debug(`[analytics] ${eventName}`, payload);
    }
  } catch (error) {
    console.warn('[analytics] failed to emit event', error);
  }
};

export default trackEvent;
