import { beforeEach, describe, expect, it, vi } from 'vitest';

const createApiHandlerMock = vi.fn();
const createServiceRoleClientMock = vi.fn(() => ({ mocked: true }));
const withRequestScopeMock = vi.fn(async (_req: unknown, callback: () => unknown) => callback());

vi.mock('../api.js', () => ({
  createApiHandler: createApiHandlerMock,
}));

vi.mock('../monitoring.js', () => ({
  initServerMonitoring: vi.fn(),
  withRequestScope: withRequestScopeMock,
}));

vi.mock('../../scripts/utils/supabase.js', () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}));

describe('Netlify API function', () => {
  beforeEach(() => {
    vi.resetModules();
    createApiHandlerMock.mockReset();
    createServiceRoleClientMock.mockClear();
    withRequestScopeMock.mockClear();
  });

  it('rewrites Netlify function paths back to /api/v1 and preserves JSON bodies', async () => {
    createApiHandlerMock.mockImplementation(() => async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          method: req.method,
          url: req.url,
          body: Buffer.concat(chunks).toString('utf8'),
        }),
      );
      return true;
    });

    const { handler } = await import('../../netlify/functions/api.ts');

    const response = await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/v1/analytics/event',
      headers: { 'content-type': 'application/json' },
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      rawQueryString: '',
      body: JSON.stringify({ eventName: 'success_test_event', payload: { lessonId: 42 } }),
      isBase64Encoded: false,
    });

    expect(response.statusCode).toBe(200);
    expect(createServiceRoleClientMock).toHaveBeenCalledTimes(1);
    expect(createApiHandlerMock).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(response.body));
    expect(payload).toMatchObject({
      method: 'POST',
      url: '/api/v1/analytics/event',
      body: JSON.stringify({ eventName: 'success_test_event', payload: { lessonId: 42 } }),
    });
  });
});
