import supabase from '../lib/supabaseClient';

type TutorMode = 'learning' | 'marketing';

type TutorResponseOptions =
  | string
  | {
      systemPrompt?: string;
      mode?: TutorMode;
      knowledge?: string;
    };

type TutorResponsePayload = {
  message?: string;
  error?: string;
};

const MAX_PROMPT_CHARS = 1200;

const toOptions = (input?: TutorResponseOptions) => {
  if (!input) return {};
  if (typeof input === 'string') {
    return { systemPrompt: input } as { systemPrompt: string };
  }
  return input;
};

const maybeGetAccessToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch (error) {
    console.warn('[getTutorResponse] Failed to resolve session', error);
    return null;
  }
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  const fallback = `Assistant unavailable (${response.status})`;
  try {
    const payload = (await response.json()) as TutorResponsePayload;
    if (payload.error && payload.error.trim().length) {
      return payload.error.trim();
    }
  } catch {
    // no-op
  }
  return fallback;
};

export async function getTutorResponse(
  prompt: string,
  options?: TutorResponseOptions,
): Promise<string> {
  const resolvedOptions = toOptions(options);
  const trimmedPrompt = prompt?.trim();

  if (!trimmedPrompt) {
    throw new Error('Prompt must be a non-empty string.');
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  const token = await maybeGetAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const payload = {
    prompt: trimmedPrompt.slice(0, MAX_PROMPT_CHARS),
    systemPrompt: resolvedOptions.systemPrompt,
    knowledge: resolvedOptions.knowledge,
    mode: resolvedOptions.mode ?? 'learning',
  };

  const response = await fetch('/api/ai/tutor', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const body = (await response.json()) as TutorResponsePayload;
  if (!body.message) {
    throw new Error('Assistant unavailable. Please try again in a moment.');
  }

  return body.message;
}

export default getTutorResponse;
