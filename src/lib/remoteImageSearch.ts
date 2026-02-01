export type RemoteImageResult = {
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

type ApiResponse =
  | { ok: true; result: RemoteImageResult | null }
  | { ok: false; result: null; error?: string };

const cacheKeyForQuery = (q: string) => `remote_image_v1:${q.toLowerCase()}`;

export const fetchRemoteImage = async (query: string): Promise<RemoteImageResult | null> => {
  const q = (query ?? '').toString().trim();
  if (!q) return null;

  if (typeof window !== 'undefined') {
    const cached = window.sessionStorage.getItem(cacheKeyForQuery(q));
    if (cached) {
      try {
        return JSON.parse(cached) as RemoteImageResult | null;
      } catch {
        // ignore
      }
    }
  }

  const params = new URLSearchParams({ q });
  const resp = await fetch(`/.netlify/functions/imageSearch?${params.toString()}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as ApiResponse;
  const result = data.ok ? data.result : null;

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(cacheKeyForQuery(q), JSON.stringify(result));
    } catch {
      // ignore quota errors
    }
  }

  return result ?? null;
};

