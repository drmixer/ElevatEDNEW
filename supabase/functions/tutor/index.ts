/**
 * Supabase Edge Function: Multi-turn K–12 AI tutoring via OpenRouter Mixtral.
 * Maintains per-student conversation history in-memory for the lifetime of the function instance.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type ChatRole = 'system' | 'user' | 'assistant';

type ConversationMessage = {
  role: ChatRole;
  content: string;
};

type TutoringRequestBody = {
  studentId?: string;
  studentQuestion?: string;
  skillTag?: string | null;
  difficultyLevel?: string | null;
};

type TutoringResponse = {
  studentQuestion: string;
  modelAnswer: string;
  skillTag: string | null;
  difficultyLevel: string | null;
  timestamp: string;
  error?: string;
};

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// OpenRouter model: Mistral 7B Instruct (free tier)
const MODEL = 'mistralai/mistral-7b-instruct:free';
const REQUEST_TIMEOUT_MS = 20000;

const SYSTEM_PROMPT = [
  'You are a patient, friendly AI tutor for K–12 students.',
  'Explain concepts step by step.',
  'Use age-appropriate examples.',
  'Keep answers clear and concise.',
  'Suggest hints if the student struggles.',
  'Use short sentences for younger students, longer for older students.',
].join('\n');

// In-memory conversation cache (per function instance).
const historyByStudent = new Map<string, ConversationMessage[]>();

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const getApiKey = (): string => {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) {
    throw new Error('Missing OPENROUTER_API_KEY environment variable.');
  }
  return key;
};

const getHistory = (studentId: string): ConversationMessage[] => historyByStudent.get(studentId) ?? [];

const saveExchange = (studentId: string, question: string, answer: string) => {
  const prior = getHistory(studentId);
  historyByStudent.set(studentId, [
    ...prior,
    { role: 'user', content: question },
    { role: 'assistant', content: answer },
  ]);
};

const buildMessages = (history: ConversationMessage[], latestQuestion: string): ConversationMessage[] => [
  { role: 'system', content: SYSTEM_PROMPT },
  ...history,
  { role: 'user', content: latestQuestion },
];

const callOpenRouter = async (messages: ConversationMessage[]): Promise<string> => {
  const apiKey = getApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('APP_BASE_URL') ?? 'https://elevated.chat',
        'X-Title': 'ElevatED Tutor',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${body}`);
    }

    const json = await response.json();
    const modelAnswer = json?.choices?.[0]?.message?.content?.trim();
    if (!modelAnswer) {
      throw new Error('OpenRouter response was empty.');
    }
    return modelAnswer;
  } finally {
    clearTimeout(timeout);
  }
};

const getTutoringResponse = async (payload: TutoringRequestBody): Promise<TutoringResponse> => {
  const timestamp = new Date().toISOString();
  const base: TutoringResponse = {
    studentQuestion: payload.studentQuestion?.trim() ?? '',
    modelAnswer: '',
    skillTag: payload.skillTag ?? null,
    difficultyLevel: payload.difficultyLevel ?? null,
    timestamp,
  };

  if (!payload.studentId) {
    return { ...base, modelAnswer: 'A student identifier is required to continue this tutoring session.', error: 'missing_student_id' };
  }

  const question = (payload.studentQuestion ?? '').trim();
  if (!question) {
    return { ...base, modelAnswer: 'Please share a question so I can help.', error: 'empty_question' };
  }

  const history = getHistory(payload.studentId);
  const messages = buildMessages(history, question);

  try {
    const answer = await callOpenRouter(messages);
    saveExchange(payload.studentId, question, answer);
    return { ...base, studentQuestion: question, modelAnswer: answer };
  } catch (error) {
    console.error('[tutor] failed', error);
    return {
      ...base,
      modelAnswer: 'Sorry, I had trouble reaching the tutor. Please try again in a moment.',
      error: error instanceof Error ? error.message : 'unknown_error',
    };
  }
};

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405);
  }

  try {
    const payload = (await req.json()) as TutoringRequestBody;
    const result = await getTutoringResponse(payload);
    return respond(result, result.error ? 400 : 200);
  } catch (error) {
    console.error('[tutor] unhandled error', error);
    return respond({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Example for local testing: curl -i -X POST http://localhost:54321/functions/v1/tutor -d '{"studentId":"student123","studentQuestion":"Explain fractions to a 5th grader"}'
