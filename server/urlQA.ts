export type UrlCheckResult = {
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
};

const resolveEnvFlag = (name: string): boolean => {
  try {
    if (typeof process !== 'undefined' && process.env && name in process.env) {
      const value = process.env[name];
      return typeof value === 'string' && value.toLowerCase() === 'true';
    }
  } catch {
    // ignore
  }
  try {
    // @ts-expect-error Deno global is only available in edge runtime.
    if (typeof Deno !== 'undefined' && typeof Deno.env?.get === 'function') {
      // @ts-expect-error same as above
      const value = Deno.env.get(name);
      return typeof value === 'string' && value.toLowerCase() === 'true';
    }
  } catch {
    // ignore
  }
  return false;
};

const SKIP_URL_CHECKS = resolveEnvFlag('SKIP_IMPORT_URL_CHECKS');

const timeoutFetch = async (
  url: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<Response> => {
  const { timeoutMs = 6_000, ...rest } = init;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  if (controller) {
    if (rest.signal) {
      rest.signal.addEventListener('abort', () => controller.abort());
    }
    rest.signal = controller.signal;
  }

  if (controller) {
    timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  try {
    const response = await fetch(url, { ...rest });
    return response;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

export const checkUrlHealth = async (url: string): Promise<UrlCheckResult> => {
  if (SKIP_URL_CHECKS) {
    return { url, ok: true, status: 0 };
  }

  try {
    const head = await timeoutFetch(url, { method: 'HEAD', redirect: 'follow' });
    if (head.ok) {
      return { url, ok: true, status: head.status };
    }
    if ([405, 403, 401].includes(head.status)) {
      const getResponse = await timeoutFetch(url, { method: 'GET', redirect: 'follow' });
      return { url, ok: getResponse.ok, status: getResponse.status };
    }
    return { url, ok: false, status: head.status };
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const checkUrlsHealth = async (urls: string[]): Promise<UrlCheckResult[]> => {
  const uniqueUrls = Array.from(new Set(urls.filter((url) => typeof url === 'string' && url.trim().length > 0)));
  const results: UrlCheckResult[] = [];

  for (const url of uniqueUrls) {
    const result = await checkUrlHealth(url);
    results.push(result);
  }

  return results;
};
