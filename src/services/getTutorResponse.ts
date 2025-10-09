const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PRIMARY_MODEL = 'deepseek/deepseek-chat-v3-0324:free';
const FALLBACK_MODEL = 'z-ai/glm-4.5-air:free';

const DEFAULT_SYSTEM_PROMPT =
  'You are ElevatED, a patient K-12 tutor. ' +
  'Give clear, step-by-step explanations and stay friendly and encouraging.';

type ChatCompletionChoice = {
  message?: {
    content?: string | null;
  };
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
};

type ProcessEnv = Record<string, string | undefined>;

const getProcessEnv = (): ProcessEnv =>
  ((globalThis as typeof globalThis & { process?: { env?: ProcessEnv } }).process?.env) ?? {};

const getBrowserEnv = (): ProcessEnv => {
  try {
    const meta = (typeof import.meta !== 'undefined' ? import.meta : undefined) as {
      env?: ProcessEnv;
    } | undefined;

    return meta?.env ?? {};
  } catch {
    return {};
  }
};

const resolveApiKey = (): string | undefined => {
  const browserEnv = getBrowserEnv();
  const processEnv = getProcessEnv();

  return (
    browserEnv?.VITE_OPENROUTER_API_KEY ??
    browserEnv?.OPENROUTER_API_KEY ??
    processEnv?.VITE_OPENROUTER_API_KEY ??
    processEnv?.OPENROUTER_API_KEY
  );
};

const buildMessages = (prompt: string, systemPrompt?: string) => {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

  if (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  return messages;
};

const requestModel = async (
  model: string,
  prompt: string,
  apiKey: string,
  systemPrompt?: string,
): Promise<string> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'ElevatED';
  }

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: buildMessages(prompt, systemPrompt),
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(
      `OpenRouter request failed (${response.status} ${response.statusText}) for ${model}: ${errorPayload}`,
    );
  }

  const json = (await response.json()) as ChatCompletionResponse;
  const content = json.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error(`OpenRouter response missing content for ${model}`);
  }

  return content;
};

export async function getTutorResponse(
  prompt: string,
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
): Promise<string> {
  const trimmedPrompt = prompt?.trim();

  if (!trimmedPrompt) {
    throw new Error('Prompt must be a non-empty string.');
  }

  const apiKey = resolveApiKey();

  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not set. Add VITE_OPENROUTER_API_KEY to your environment to enable AI responses.',
    );
  }

  try {
    console.log(`[ElevatED AI] Using model: ${PRIMARY_MODEL}`);
    return await requestModel(PRIMARY_MODEL, trimmedPrompt, apiKey, systemPrompt);
  } catch (primaryError) {
    console.warn(
      `[ElevatED AI] Primary model failed, falling back to ${FALLBACK_MODEL}.`,
      primaryError,
    );
  }

  console.log(`[ElevatED AI] Using model: ${FALLBACK_MODEL}`);

  try {
    return await requestModel(FALLBACK_MODEL, trimmedPrompt, apiKey, systemPrompt);
  } catch (fallbackError) {
    console.error('[ElevatED AI] Fallback model failed.', fallbackError);
    throw fallbackError instanceof Error
      ? fallbackError
      : new Error('Failed to retrieve a tutor response from OpenRouter.');
  }
}

export default getTutorResponse;
