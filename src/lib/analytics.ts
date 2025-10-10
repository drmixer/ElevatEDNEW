type AnalyticsPayload = Record<string, unknown> | undefined;

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
    if (import.meta.env.DEV) {
      console.debug(`[analytics] ${eventName}`, payload);
    }
  } catch (error) {
    console.warn('[analytics] failed to emit event', error);
  }
};

export default trackEvent;
