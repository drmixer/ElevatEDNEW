/**
 * Supabase Edge Function: Homepage marketing assistant using OpenRouter Mistral 7B Instruct.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type ChatRole = 'system' | 'user' | 'assistant';

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type MarketingRequest = {
  question?: string;
};

type MarketingResponse = {
  message: string;
  model: string;
  error?: string;
};

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'mistralai/mistral-7b-instruct:free';
const REQUEST_TIMEOUT_MS = 20000;
const MAX_QUESTION_CHARS = 1200;

const SYSTEM_PROMPT = `
You are ElevatED, the official marketing assistant for ElevatED - an adaptive K-12 home-learning platform.
Keep replies concise (2-3 sentences, under ~90 words), warm, encouraging, and confident.
Reinforce the brand line "Home Learning. Elevated Together." when helpful.
Use only the provided product facts; do not invent features or discuss internal tools, code, or routing.
If the facts do not cover something, say you are unsure and offer to connect them with ElevatED support instead of guessing.
If someone asks for study help or homework answers, remind them this chat is for product info only and direct them to the in-product AI tutor.
`.trim();

const PRODUCT_KNOWLEDGE = `
Product: ElevatED is a K-12 home-learning platform that pairs every student with a private AI tutor and adaptive lesson pathways.
Tagline: Home Learning. Elevated Together.
Audience: Families, students, and parents learning outside school; not a school/teacher LMS.
How it works: Quick sign-up and an adaptive diagnostic (~15-20 minutes) set the starting point, then lessons adjust difficulty, hints, and feedback after every session and quiz.
Student experience: K-12 Math, English, Science, and Social Studies with daily lesson plans, mixed quizzes and instant feedback, review refreshers, and weekend boosts. Motivation tools include XP, streaks, badges, avatar customization, and quests/challenges.
AI Learning Assistant: Context-aware tutor with hints-first guardrails, step-by-step guidance, and motivational check-ins; provides full solutions on request. The marketing chat never answers homework/quiz questions and directs learners to the student tutor.
Parent experience: Family dashboard with real-time progress, mastery by subject, advanced analytics (Plus/Premium), weekly AI summaries/digests, alerts for missed sessions or flagged concepts, goals/rewards controls, and easy family linking via codes. Parents can request data export or deletion from the Family Dashboard.
Curriculum & assessments: Guided diagnostics, adaptive lessons across core K-12 subjects, concept-level insights, and suggested review activities when learners struggle.
Pricing/Plans:
- Family Free: $0/month for 1 learner, guided diagnostic, core subjects, up to 10 lessons/month, mixed quizzes, basic parent dashboard (recent activity & quiz score), basic gamification, AI tutor access limited to 3 chats per day.
- Family Plus: $29.99/month per student ($299/year, save 17%) for up to 3 learners; unlimited adaptive lessons; always-on AI learning assistant with follow-up questions; concept-level insights and step-by-step solutions; deep-dive parent dashboard with weekly AI progress summaries; full gamification with avatar customization; smart study tips and review boosts; parent alerts for missed lessons or flagged concepts; priority support and early access to new features.
- Family Premium: $49.99/month for the family ($499/year, save 17%) including up to 5 learners; everything in Plus plus a unified family dashboard with side-by-side progress, shared challenges/quests, multi-student AI summaries each week, parent controls for goals/rewards/screen time, and flexible billing with discounted add-on seats.
AI stack: OpenRouter + Mistral 7B Instruct (free tier) power both the marketing assistant and the in-product tutor.
Support: Encourage visitors to reach out through the site contact options for onboarding, billing, or family setup specifics.
`.trim();

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const getApiKey = (): string => {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) {
    throw new Error('Missing OPENROUTER_API_KEY environment variable.');
  }
  return key;
};

const buildMessages = (question: string): ChatMessage[] => [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'system', content: `Product facts to ground your answer:\n${PRODUCT_KNOWLEDGE}` },
  { role: 'user', content: question },
];

const callOpenRouter = async (messages: ChatMessage[]): Promise<MarketingResponse> => {
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
        'X-Title': 'ElevatED Marketing Assistant',
      },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.4 }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${body}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('OpenRouter response was empty.');
    }

    return { message: content, model: MODEL };
  } finally {
    clearTimeout(timeout);
  }
};

const respond = (body: MarketingResponse | { error: string }, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405);
  }

  try {
    const payload = (await req.json()) as MarketingRequest;
    const question = (payload.question ?? '').trim().slice(0, MAX_QUESTION_CHARS);
    if (!question) {
      return respond({ error: 'Question is required' }, 400);
    }

    const result = await callOpenRouter(buildMessages(question));
    return respond(result, 200);
  } catch (error) {
    console.error('[marketing-assistant] error', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return respond({ error: message, message: 'Assistant unavailable.', model: 'error' }, 500);
  }
});
