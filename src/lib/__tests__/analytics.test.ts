import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const getAccessTokenIfPresentMock = vi.fn();
const handleApiResponseMock = vi.fn();

vi.mock('../apiClient', () => ({
  getAccessTokenIfPresent: getAccessTokenIfPresentMock,
  handleApiResponse: handleApiResponseMock,
}));

describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    getAccessTokenIfPresentMock.mockReset();
    handleApiResponseMock.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries and preserves events when the analytics endpoint returns a non-ok response', async () => {
    const errorResponse = new Response('nope', { status: 500 });
    const okResponse = new Response(JSON.stringify({ ok: true, inserted: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    getAccessTokenIfPresentMock.mockResolvedValue('token-123');
    fetchMock
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(okResponse);
    handleApiResponseMock.mockRejectedValueOnce(new Error('server error')).mockResolvedValueOnce({
      ok: true,
      inserted: 1,
    });

    const { trackEvent } = await import('../analytics');

    trackEvent('success_checkpoint_tested', { lessonId: 42 });

    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

    expect(firstBody).toEqual(secondBody);
    expect(firstBody.events).toHaveLength(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/analytics/event');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      keepalive: true,
      headers: {
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
      },
    });
  });

  it('ignores non-success events for Supabase delivery', async () => {
    const { trackEvent } = await import('../analytics');

    trackEvent('lesson_opened', { lessonId: 7 });
    await vi.advanceTimersByTimeAsync(2500);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAccessTokenIfPresentMock).not.toHaveBeenCalled();
  });
});
