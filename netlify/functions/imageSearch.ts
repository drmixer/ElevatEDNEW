type NetlifyEvent = {
  httpMethod: string;
  path: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  rawQueryString?: string;
};

type NetlifyResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

const buildCorsHeaders = (event: NetlifyEvent): Record<string, string> => {
  const origin = event.headers?.origin ?? '*';
  const requestHeaders = event.headers?.['access-control-request-headers'];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': requestHeaders ?? '*',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

type CommonsImageResult = {
  query: string;
  title: string;
  pageUrl: string;
  url: string;
  thumbnailUrl: string;
  mime: string | null;
  width: number | null;
  height: number | null;
  license: string | null;
  licenseUrl: string | null;
  author: string | null;
  attributionHtml: string | null;
  source: 'wikimedia_commons';
};

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const normalizeLicense = (value: string): string => (value ?? '').toString().trim().toLowerCase();

const isAllowedLicense = (licenseShortName: string | null, licenseUrl: string | null): boolean => {
  const lic = normalizeLicense(licenseShortName ?? '');
  const url = normalizeLicense(licenseUrl ?? '');

  // Allow CC BY / CC BY-SA, plus public domain equivalents.
  if (lic.includes('cc by-sa')) return true;
  if (lic.includes('cc by')) return true;
  if (lic.includes('cc0')) return true;
  if (lic.includes('public domain')) return true;

  if (url.includes('creativecommons.org/licenses/by-sa')) return true;
  if (url.includes('creativecommons.org/licenses/by')) return true;
  if (url.includes('creativecommons.org/publicdomain/zero')) return true;
  if (url.includes('creativecommons.org/publicdomain/mark')) return true;

  return false;
};

const makeAttributionHtml = (input: {
  title: string;
  pageUrl: string;
  authorHtml: string | null;
  licenseShortName: string | null;
  licenseUrl: string | null;
}): string | null => {
  const authorText = input.authorHtml ? stripHtml(input.authorHtml) : null;
  const licenseText = input.licenseShortName ? stripHtml(input.licenseShortName) : null;

  if (!licenseText && !authorText) return null;

  const parts: string[] = [];
  parts.push(`<a href="${input.pageUrl}" target="_blank" rel="noreferrer">“${input.title}”</a>`);
  if (authorText) parts.push(`by ${authorText}`);
  if (licenseText) {
    parts.push(
      input.licenseUrl
        ? `<a href="${input.licenseUrl}" target="_blank" rel="noreferrer">${licenseText}</a>`
        : licenseText,
    );
  }
  return parts.join(' · ');
};

const cache = new Map<string, { expiresAt: number; value: CommonsImageResult | null }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

const getCached = (key: string): CommonsImageResult | null | undefined => {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
};

const setCached = (key: string, value: CommonsImageResult | null) => {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
};

const json = (event: NetlifyEvent, statusCode: number, body: unknown): NetlifyResponse => ({
  statusCode,
  headers: { 'content-type': 'application/json', ...buildCorsHeaders(event), 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: buildCorsHeaders(event), body: '' };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return json(event, 405, { error: 'Method Not Allowed' });
  }

  const q = (event.queryStringParameters?.q ?? '').toString().trim();
  const limitRaw = (event.queryStringParameters?.limit ?? '').toString().trim();
  const limit = Math.max(1, Math.min(8, Number.parseInt(limitRaw || '6', 10) || 6));

  if (!q) {
    return json(event, 400, { error: 'Missing required query parameter "q".' });
  }

  const cacheKey = `q:${q.toLowerCase()}:limit:${limit}`;
  const cached = getCached(cacheKey);
  if (cached !== undefined) {
    return json(event, 200, { ok: true, result: cached });
  }

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: q,
    gsrnamespace: '6', // File:
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '1000',
  });

  const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;

  try {
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) {
      setCached(cacheKey, null);
      return json(event, 200, { ok: true, result: null });
    }
    const data = (await resp.json()) as any;
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];

    for (const page of pages) {
      const title: string | null = typeof page?.title === 'string' ? page.title : null;
      const pageId: number | null = typeof page?.pageid === 'number' ? page.pageid : null;
      const info = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
      const imageUrl: string | null = typeof info?.url === 'string' ? info.url : null;
      const thumbUrl: string | null = typeof info?.thumburl === 'string' ? info.thumburl : null;
      const mime: string | null = typeof info?.mime === 'string' ? info.mime : null;
      const width: number | null = typeof info?.width === 'number' ? info.width : null;
      const height: number | null = typeof info?.height === 'number' ? info.height : null;

      const ext = info?.extmetadata ?? {};
      const licenseShortName: string | null = typeof ext?.LicenseShortName?.value === 'string' ? ext.LicenseShortName.value : null;
      const licenseUrl: string | null = typeof ext?.LicenseUrl?.value === 'string' ? ext.LicenseUrl.value : null;
      const artistHtml: string | null = typeof ext?.Artist?.value === 'string' ? ext.Artist.value : null;

      if (!title || !pageId || !imageUrl || !thumbUrl) continue;
      if (!mime || !mime.startsWith('image/')) continue;
      if (!isAllowedLicense(licenseShortName, licenseUrl)) continue;

      const pageUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      const result: CommonsImageResult = {
        query: q,
        title: title.replace(/^File:/, ''),
        pageUrl,
        url: imageUrl,
        thumbnailUrl: thumbUrl,
        mime,
        width,
        height,
        license: licenseShortName ? stripHtml(licenseShortName) : null,
        licenseUrl: licenseUrl ? stripHtml(licenseUrl) : null,
        author: artistHtml ? stripHtml(artistHtml) : null,
        attributionHtml: makeAttributionHtml({
          title: title.replace(/^File:/, ''),
          pageUrl,
          authorHtml: artistHtml,
          licenseShortName,
          licenseUrl,
        }),
        source: 'wikimedia_commons',
      };

      setCached(cacheKey, result);
      return json(event, 200, { ok: true, result });
    }

    setCached(cacheKey, null);
    return json(event, 200, { ok: true, result: null });
  } catch (error) {
    setCached(cacheKey, null);
    const message = error instanceof Error ? error.message : 'Image search failed.';
    return json(event, 200, { ok: false, result: null, error: message });
  }
};

