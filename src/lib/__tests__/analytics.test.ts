import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authenticatedFetchMock = vi.fn();
const handleApiResponseMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('../apiClient', () => ({
  authenticatedFetch: authenticatedFetchMock,
  handleApiResponse: handleApiResponseMock,
}));

vi.mock('../supabaseClient', () => ({
  default: {
    auth: {
      getSession: getSessionMock,
    },
  },
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    authenticatedFetchMock.mockReset();
    handleApiResponseMock.mockReset();
    getSessionMock.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries and preserves events when the analytics endpoint returns a non-ok response', async () => {
    const errorResponse = new Response('nope', { status: 500 });
    const okResponse = new Response(JSON.stringify({ ok: true, inserted: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    authenticatedFetchMock
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(okResponse);
    handleApiResponseMock.mockRejectedValueOnce(new Error('server error')).mockResolvedValueOnce({
      ok: true,
      inserted: 1,
    });

    const { trackEvent } = await import('../analytics');

    trackEvent('success_checkpoint_tested', { lessonId: 42 });

    await vi.advanceTimersByTimeAsync(2000);
    expect(authenticatedFetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(authenticatedFetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(authenticatedFetchMock.mock.calls[0]?.[1]?.body));
    const secondBody = JSON.parse(String(authenticatedFetchMock.mock.calls[1]?.[1]?.body));

    expect(firstBody).toEqual(secondBody);
    expect(firstBody.events).toHaveLength(1);
    expect(authenticatedFetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      keepalive: true,
    });
  });

  it('ignores non-success events for Supabase delivery', async () => {
    const { trackEvent } = await import('../analytics');

    trackEvent('lesson_opened', { lessonId: 7 });
    await vi.advanceTimersByTimeAsync(2500);

    expect(authenticatedFetchMock).not.toHaveBeenCalled();
  });
});
