import supabase from './supabaseClient';
import withTimeout from './withTimeout';

export const getAccessToken = async (): Promise<string> => {
  try {
    const sessionResult = await withTimeout(supabase.auth.getSession(), 3500);
    if (sessionResult.timedOut) {
      throw new Error('Timed out confirming your session. Please refresh or sign in again.');
    }

    const { data, error } = sessionResult.value;

    if (error) {
      throw new Error(error.message);
    }

    const token = data.session?.access_token;
    if (!token) {
      throw new Error('Authentication required. Please sign in again.');
    }

    return token;
  } catch (error) {
    console.error('[apiClient] Failed to read session token', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to verify your session right now.');
  }
};

export const authenticatedFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, { ...init, headers });
};

export const handleApiResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  let message = text;

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (typeof parsed.error === 'string' && parsed.error.trim().length) {
      message = parsed.error;
    }
  } catch {
    // response is not JSON; fall back to raw text
  }

  if (!message || !message.trim().length) {
    message = `API request failed (${response.status})`;
  }

  if (response.status === 401) {
    message = 'Authentication required. Please sign in as an admin.';
  } else if (response.status === 403) {
    message = 'Admin access is required for this action.';
  }

  throw new Error(message);
};
