import { createServer } from 'node:http';

import { createApiHandler } from '../../server/api.js';
import { initServerMonitoring, withRequestScope } from '../../server/monitoring.js';
import { createServiceRoleClient } from '../../scripts/utils/supabase.js';

type NetlifyEvent = {
  httpMethod: string;
  path: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  multiValueQueryStringParameters?: Record<string, string[] | undefined> | null;
  rawQueryString?: string;
  body?: string | null;
  isBase64Encoded?: boolean;
};

type NetlifyResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
};

initServerMonitoring();

let serverReady: Promise<{ port: number }> | null = null;

const ensureServer = async (): Promise<{ port: number }> => {
  if (serverReady) return serverReady;

  serverReady = new Promise((resolve, reject) => {
    let handler: ReturnType<typeof createApiHandler>;
    try {
      const serviceSupabase = createServiceRoleClient();
      handler = createApiHandler({ serviceSupabase });
    } catch (error) {
      reject(error);
      return;
    }

    const server = createServer(async (req, res) => {
      const handled = await withRequestScope(req, () => handler(req, res));
      if (!handled) {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    server.on('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to resolve internal API server port.'));
        return;
      }
      server.unref();
      resolve({ port: address.port });
    });
  });

  return serverReady;
};

const buildCorsHeaders = (event: NetlifyEvent): Record<string, string> => {
  const origin = event.headers?.origin ?? '*';
  const requestHeaders = event.headers?.['access-control-request-headers'];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': requestHeaders ?? '*',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

const resolveQueryString = (event: NetlifyEvent): string => {
  if (typeof event.rawQueryString === 'string' && event.rawQueryString.length) {
    return event.rawQueryString;
  }

  const params = new URLSearchParams();
  const multi = event.multiValueQueryStringParameters ?? null;
  if (multi) {
    for (const [key, values] of Object.entries(multi)) {
      if (!key || !values) continue;
      for (const value of values) {
        if (typeof value === 'string') {
          params.append(key, value);
        }
      }
    }
    return params.toString();
  }

  const single = event.queryStringParameters ?? null;
  if (single) {
    for (const [key, value] of Object.entries(single)) {
      if (!key || typeof value !== 'string') continue;
      params.append(key, value);
    }
  }

  return params.toString();
};

const resolveApiPath = (eventPath: string): string => {
  const functionPrefix = '/.netlify/functions/api';
  if (eventPath === functionPrefix) return '/api';
  if (eventPath.startsWith(`${functionPrefix}/`)) {
    return `/api/${eventPath.slice(functionPrefix.length + 1)}`;
  }
  return eventPath;
};

const isTextLikeContentType = (contentType: string): boolean => {
  const normalized = contentType.toLowerCase();
  return (
    normalized.startsWith('text/') ||
    normalized.includes('application/json') ||
    normalized.includes('application/javascript') ||
    normalized.includes('application/xml') ||
    normalized.includes('application/vnd.api+json')
  );
};

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: buildCorsHeaders(event), body: '' };
  }

  let port: number;
  try {
    ({ port } = await ensureServer());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start API backend.';
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json', ...buildCorsHeaders(event) },
      body: JSON.stringify({
        error: 'API backend is not configured for this deployment.',
        details: message,
      }),
    };
  }
  const targetPath = resolveApiPath(event.path);
  const query = resolveQueryString(event);
  const url = `http://127.0.0.1:${port}${targetPath}${query ? `?${query}` : ''}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (!key) continue;
    if (typeof value === 'string' && value.length) {
      headers.set(key, value);
    }
  }

  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const method = event.httpMethod?.toUpperCase() ?? 'GET';
  const shouldSendBody = !['GET', 'HEAD'].includes(method);
  const body = shouldSendBody
    ? event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : event.body
      : undefined
    : undefined;

  const upstreamResponse = await fetch(url, { method, headers, body });
  const responseHeaders: Record<string, string> = {};
  upstreamResponse.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  Object.assign(responseHeaders, buildCorsHeaders(event));

  const contentType = upstreamResponse.headers.get('content-type') ?? '';
  const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
  const isText = isTextLikeContentType(contentType);
  const responseBody = isText ? buffer.toString('utf8') : buffer.toString('base64');

  return {
    statusCode: upstreamResponse.status,
    headers: responseHeaders,
    body: responseBody,
    isBase64Encoded: !isText,
  };
};
