type OpsEventType =
  | 'tutor_success'
  | 'tutor_error'
  | 'tutor_safety_block'
  | 'tutor_plan_limit'
  | 'tutor_latency'
  | 'path_progress'
  | 'adaptive_replan'
  | 'xp_rate'
  | 'api_failure'
  | 'api_slow'
  | 'placement_selected'
  | 'placement_content_invalid'
  | 'cat_content_gap_detected'
  | 'cat_low_confidence';

export type OpsEvent = {
  type: OpsEventType;
  reason?: string | null;
  route?: string;
  status?: number | null;
  durationMs?: number | null;
  plan?: string | null;
  value?: number | null;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
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
    tutor_latency: 0,
    path_progress: 0,
    adaptive_replan: 0,
    xp_rate: 0,
    api_failure: 0,
    api_slow: 0,
    placement_selected: 0,
    placement_content_invalid: 0,
    cat_content_gap_detected: 0,
    cat_low_confidence: 0,
  };

  const safetyReasons = new Map<string, number>();
  const planLimitReasons = new Map<string, number>();
  const apiRoutes = new Map<string, number>();
  const pathLabels = new Map<string, number>();
  const adaptiveReplanTriggers = new Map<string, number>();
  const adaptiveReplanSubjects = new Map<string, number>();
  const adaptiveReplanMixShifts = new Map<string, number>();
  const adaptiveOscillationRisks = new Map<string, number>();
  const xpSources = new Map<string, number>();
  const placementAssessments = new Map<string, number>();
  const placementInvalidReasons = new Map<string, number>();
  const catGapSubjects = new Map<string, number>();
  const catLowConfidenceSubjects = new Map<string, number>();

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
    if (event.type === 'path_progress' && event.label) {
      pathLabels.set(event.label, (pathLabels.get(event.label) ?? 0) + 1);
    }
    if (event.type === 'adaptive_replan') {
      const triggerLabel =
        typeof event.metadata?.triggerLabel === 'string' && event.metadata.triggerLabel.trim().length > 0
          ? event.metadata.triggerLabel
          : event.label ?? 'unknown';
      adaptiveReplanTriggers.set(triggerLabel, (adaptiveReplanTriggers.get(triggerLabel) ?? 0) + 1);

      const supportSubject =
        typeof event.metadata?.primarySupportSubject === 'string' && event.metadata.primarySupportSubject.trim().length > 0
          ? event.metadata.primarySupportSubject
          : null;
      if (supportSubject) {
        adaptiveReplanSubjects.set(supportSubject, (adaptiveReplanSubjects.get(supportSubject) ?? 0) + 1);
      }

      const mixShift =
        typeof event.metadata?.mixShiftLabel === 'string' && event.metadata.mixShiftLabel.trim().length > 0
          ? event.metadata.mixShiftLabel
          : null;
      if (mixShift) {
        adaptiveReplanMixShifts.set(mixShift, (adaptiveReplanMixShifts.get(mixShift) ?? 0) + 1);
      }

      if (event.metadata?.oscillationRisk === true) {
        const oscillationLabel =
          typeof event.metadata?.oscillationLabel === 'string' && event.metadata.oscillationLabel.trim().length > 0
            ? event.metadata.oscillationLabel
            : supportSubject ?? triggerLabel;
        adaptiveOscillationRisks.set(
          oscillationLabel,
          (adaptiveOscillationRisks.get(oscillationLabel) ?? 0) + 1,
        );
      }
    }
    if (event.type === 'xp_rate' && event.label) {
      xpSources.set(event.label, (xpSources.get(event.label) ?? 0) + 1);
    }
    if (event.type === 'placement_selected' && event.label) {
      placementAssessments.set(event.label, (placementAssessments.get(event.label) ?? 0) + 1);
    }
    if (event.type === 'placement_content_invalid') {
      const reason = event.reason ?? 'unknown';
      placementInvalidReasons.set(reason, (placementInvalidReasons.get(reason) ?? 0) + 1);
    }
    if (event.type === 'cat_content_gap_detected') {
      const label = event.label ?? 'unknown';
      catGapSubjects.set(label, (catGapSubjects.get(label) ?? 0) + 1);
    }
    if (event.type === 'cat_low_confidence') {
      const label = event.label ?? 'unknown';
      catLowConfidenceSubjects.set(label, (catLowConfidenceSubjects.get(label) ?? 0) + 1);
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
    pathEventsByLabel: topFromMap(pathLabels),
    adaptiveReplansByTrigger: topFromMap(adaptiveReplanTriggers),
    adaptiveReplansBySupportSubject: topFromMap(adaptiveReplanSubjects),
    adaptiveReplanMixShifts: topFromMap(adaptiveReplanMixShifts),
    adaptiveOscillationRisks: topFromMap(adaptiveOscillationRisks),
    xpEventsBySource: topFromMap(xpSources),
    placementSelectionsByAssessment: topFromMap(placementAssessments),
    placementInvalidByReason: topFromMap(placementInvalidReasons),
    catContentGapsBySubject: topFromMap(catGapSubjects),
    catLowConfidenceBySubject: topFromMap(catLowConfidenceSubjects),
    recent: events.slice(-30).reverse(),
  };
};

export const clearOpsEventsForTests = (): void => {
  events.length = 0;
};
