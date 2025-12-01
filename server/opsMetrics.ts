type OpsEventType = 'tutor_success' | 'tutor_error' | 'tutor_safety_block' | 'tutor_plan_limit' | 'api_failure' | 'api_slow';

export type OpsEvent = {
  type: OpsEventType;
  reason?: string | null;
  route?: string;
  status?: number | null;
  durationMs?: number | null;
  plan?: string | null;
  timestamp: number;
};

const events: OpsEvent[] = [];
const MAX_EVENTS = 1000;
const RETAIN_MS = 24 * 60 * 60 * 1000;

const prune = (now: number) => {
  const cutoff = now - RETAIN_MS;
  while (events.length && (events[0]?.timestamp ?? 0) < cutoff) {
    events.shift();
  }
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
};

export const recordOpsEvent = (event: Omit<OpsEvent, 'timestamp'>): void => {
  const now = Date.now();
  prune(now);
  events.push({ ...event, timestamp: now });
};

export const getOpsSnapshot = (windowMs = 60 * 60 * 1000) => {
  const now = Date.now();
  prune(now);
  const cutoff = now - windowMs;
  const windowEvents = events.filter((event) => event.timestamp >= cutoff);

  const totals: Record<OpsEventType, number> = {
    tutor_success: 0,
    tutor_error: 0,
    tutor_safety_block: 0,
    tutor_plan_limit: 0,
    api_failure: 0,
    api_slow: 0,
  };

  const safetyReasons = new Map<string, number>();
  const planLimitReasons = new Map<string, number>();
  const apiRoutes = new Map<string, number>();

  windowEvents.forEach((event) => {
    totals[event.type] += 1;
    if (event.type === 'tutor_safety_block' && event.reason) {
      safetyReasons.set(event.reason, (safetyReasons.get(event.reason) ?? 0) + 1);
    }
    if (event.type === 'tutor_plan_limit' && event.reason) {
      planLimitReasons.set(event.reason, (planLimitReasons.get(event.reason) ?? 0) + 1);
    }
    if (event.type === 'api_failure' && event.route) {
      const routeKey = `${event.route}${event.status ? ` (${event.status})` : ''}`;
      apiRoutes.set(routeKey, (apiRoutes.get(routeKey) ?? 0) + 1);
    }
  });

  const topFromMap = (map: Map<string, number>) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

  return {
    windowMs,
    totals,
    topSafetyReasons: topFromMap(safetyReasons),
    topPlanLimitReasons: topFromMap(planLimitReasons),
    apiFailuresByRoute: topFromMap(apiRoutes),
    recent: events.slice(-30).reverse(),
  };
};
