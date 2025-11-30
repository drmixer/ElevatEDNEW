import crypto from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { captureServerException, captureServerMessage } from './monitoring.js';

type TutorMode = 'learning' | 'marketing';

export type TutorRequestBody = {
  prompt?: string;
  systemPrompt?: string;
  mode?: TutorMode;
  knowledge?: string;
};

type TutorContext = {
  prompt: string;
  systemPrompt: string;
  mode: TutorMode;
  knowledge?: string;
  studentContext?: StudentContext;
};

type StudentContext = {
  learnerRef: string;
  grade?: number | null;
  level?: number | null;
  strengths: string[];
  focusAreas: string[];
  activeLesson?: LessonSnapshot | null;
  nextLesson?: LessonSnapshot | null;
  masteryBySubject: Array<{ subject: string; mastery: number }>;
};

type LessonSnapshot = {
  title: string;
  moduleTitle?: string | null;
  subject?: string | null;
  status?: string | null;
  masteryPct?: number | null;
  lastActivityAt?: string | null;
};

type DailyLimit = number | 'unlimited' | null | undefined;

type TutorResponse = {
  message: string;
  model: string;
  remaining?: number | null;
  limit?: DailyLimit;
  plan?: string | null;
};

type TutorPlanContext = {
  slug?: string | null;
  tutorDailyLimit?: DailyLimit;
  aiAccess?: boolean;
};

type TutorRequestOptions = {
  userId?: string | null;
  role?: string | null;
  clientIp?: string | null;
  plan?: TutorPlanContext;
};

class AiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PRIMARY_MODEL = 'deepseek/deepseek-chat-v3-0324:free';
const FALLBACK_MODEL = 'z-ai/glm-4.5-air:free';

const MAX_PROMPT_CHARS = 1200;
const MAX_SYSTEM_PROMPT_CHARS = 1400;
const MAX_KNOWLEDGE_CHARS = 3200;
const MAX_RESPONSE_CHARS = 1600;

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g;
const LONG_NUMBER_REGEX = /\b\d{9,}\b/g;
const UNSAFE_KEYWORDS = [
  'violence',
  'harm',
  'weapon',
  'fight',
  'drugs',
  'self-harm',
  'suicide',
  'kill',
  'dating',
  'boyfriend',
  'girlfriend',
  'meet up',
  'address',
  'phone number',
];
const LOCATION_REGEX = /\b(address|where.*live|meet you|come over|phone number|snapchat|instagram)\b/i;
const SAFETY_REFUSAL_MESSAGE =
  "I can't help with that request. I'm here for school-safe learning help like math, reading, and science. Please ask a trusted adult if you need help with personal or safety issues.";

const learnerLimiter = createLimiter(12, 5 * 60 * 1000); // 12 requests per 5 minutes per learner
const ipLimiter = createLimiter(30, 5 * 60 * 1000); // 30 requests per 5 minutes per IP

function createLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  const record = (key: string) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
    recent.push(now);
    hits.set(key, recent);
    return recent;
  };

  return {
    check(key: string) {
      const recent = record(key);
      return {
        allowed: recent.length <= limit,
        remaining: Math.max(0, limit - recent.length),
      };
    },
  };
}

const anonymize = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
};

const sanitizeText = (input: string, maxLength: number): string => {
  const scrubbed = input
    .replace(EMAIL_REGEX, '[redacted]')
    .replace(PHONE_REGEX, '[redacted]')
    .replace(LONG_NUMBER_REGEX, '[redacted]');

  const normalized = scrubbed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  return normalized.slice(0, maxLength);
};

const sanitizeOutput = (text: string): string =>
  sanitizeText(text, MAX_RESPONSE_CHARS);

const detectUnsafePrompt = (prompt: string, context?: StudentContext): string | null => {
  const normalized = prompt.toLowerCase();

  if (UNSAFE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return 'unsafe_keyword';
  }

  if (LOCATION_REGEX.test(normalized)) {
    return 'personal_contact';
  }

  const grade = context?.grade ?? null;
  if (grade != null && grade < 13) {
    if (normalized.includes('social media') || normalized.includes('dating') || normalized.includes('meet up')) {
      return 'age_inappropriate';
    }
  }

  if (normalized.includes('ignore previous') || normalized.includes('jailbreak') || normalized.includes('prompt injection')) {
    return 'prompt_attack';
  }

  return null;
};

const buildSafetyRefusal = (reason: string, context?: StudentContext): string => {
  const grade = context?.grade ?? null;
  if (reason === 'personal_contact') {
    return `${SAFETY_REFUSAL_MESSAGE} I cannot share or collect personal contact info. Keep conversations focused on your lessons.`;
  }
  if (reason === 'age_inappropriate' && grade != null && grade < 13) {
    return `${SAFETY_REFUSAL_MESSAGE} Because this account is for a child under 13, I avoid personal or social topics.`;
  }
  if (reason === 'prompt_attack') {
    return `${SAFETY_REFUSAL_MESSAGE} I stay within my safety rules and will keep answers on-topic for learning.`;
  }
  return SAFETY_REFUSAL_MESSAGE;
};

const gradeBandGuidance = (grade?: number | null): string | null => {
  if (grade == null || Number.isNaN(grade)) return null;
  if (grade <= 3) {
    return 'Grade band K-3: use very short sentences, simple words, and concrete real-life examples. Offer one hint at a time and invite the learner to try the next step.';
  }
  if (grade <= 8) {
    return 'Grade band 4-8: give 2-3 step hints, define any new vocabulary, and keep paragraphs short. Encourage the learner to explain their thinking back to you.';
  }
  return 'Grade band 9-12: expect deeper reasoning and study strategies. Encourage evidence, error-spotting, and concise explanations before sharing full solutions.';
};

const subjectGuidance = (subject?: string | null): string | null => {
  if (!subject) return null;
  const normalized = subject.toLowerCase();
  if (normalized.includes('math')) {
    return 'When helping with math, foreground the process: write out the steps, keep numbers small when illustrating, and only share the final answer after the learner tries.';
  }
  if (normalized.includes('english') || normalized.includes('ela')) {
    return 'For reading and writing, model structure and examples rather than rewriting student work. Offer sentence starters and quick checks for understanding.';
  }
  if (normalized.includes('science')) {
    return 'For science, connect ideas to observable phenomena and experiments. Emphasise cause-and-effect and simple definitions before deeper theory.';
  }
  if (normalized.includes('social')) {
    return 'For social studies, ground explanations in timelines, causes, and perspectives. Encourage sourcing evidence and concise summaries.';
  }
  return null;
};

const buildLearningGuardrails = (context?: StudentContext): string | null => {
  const snippets = [
    gradeBandGuidance(context?.grade),
    subjectGuidance(context?.activeLesson?.subject ?? context?.nextLesson?.subject ?? null),
    'Always offer a hint or step-by-step nudge before giving the full solution. If the learner insists on the full answer, keep it concise and still explain why it works.',
  ].filter(Boolean);
  if (!snippets.length) {
    return null;
  }
  return snippets.join('\n');
};

const baseTutorSystemPrompt = [
  'You are ElevatED, a patient K-12 tutor.',
  'Start with a short hint or next step before revealing a full solution; only provide the complete answer if the learner directly asks or is still stuck.',
  'Give step-by-step explanations, check for understanding, and keep responses concise.',
  'Keep answers age-appropriate and decline unsafe or off-topic requests. Avoid sharing any personal data, emails, or phone numbers. Do not request PII.',
  'Politely refuse violence, self-harm, bullying, pranks, politics, or requests for contact/location info. Redirect the learner to a trusted adult when something sounds unsafe or personal.',
].join(' ');

const marketingSystemPrompt = [
  'You are ElevatED, the official marketing assistant for ElevatED - an adaptive K-12 learning platform.',
  'Keep replies concise (2-3 sentences), warm, encouraging, and confident.',
  'Use only the provided product facts. If unsure, say so and offer to connect them with support.',
].join(' ');

const tutorUsage = new Map<string, { date: string; count: number }>();

const todayKey = (): string => new Date().toISOString().slice(0, 10);

const readUsageCount = (key: string): number => {
  const today = todayKey();
  const entry = tutorUsage.get(key);
  if (!entry || entry.date !== today) {
    tutorUsage.set(key, { date: today, count: 0 });
    return 0;
  }
  return entry.count;
};

const bumpUsageCount = (key: string): number => {
  const today = todayKey();
  const entry = tutorUsage.get(key);
  if (!entry || entry.date !== today) {
    tutorUsage.set(key, { date: today, count: 1 });
    return 1;
  }
  const next = entry.count + 1;
  tutorUsage.set(key, { date: today, count: next });
  return next;
};

const enforceDailyTutorLimit = (
  limit: DailyLimit,
  usageKey: string,
  planSlug?: string | null,
): number | null => {
  if (!limit || limit === 'unlimited') {
    return null;
  }

  const used = readUsageCount(usageKey);
  if (used >= limit) {
    const planLabel = planSlug ? ` on your ${planSlug.replace(/[-_]/g, ' ')} plan` : '';
    captureServerMessage('[ai] tutor daily limit reached', { usageKey, plan: planSlug, limit }, 'warning');
    throw new AiRequestError(
      402,
      `You've reached today's AI tutor limit${planLabel}. Upgrade to get more help or try again tomorrow.`,
    );
  }

  return Math.max(0, limit - used);
};

const recordTutorUsage = (limit: DailyLimit, usageKey: string): number | null => {
  if (!limit || limit === 'unlimited') {
    return null;
  }

  const next = bumpUsageCount(usageKey);
  return Math.max(0, limit - next);
};

const resolveSystemPrompt = (mode: TutorMode, requestedPrompt?: string): string => {
  const fallback = mode === 'marketing' ? marketingSystemPrompt : baseTutorSystemPrompt;
  if (!requestedPrompt) return fallback;
  const sanitized = sanitizeText(requestedPrompt, MAX_SYSTEM_PROMPT_CHARS);
  return sanitized.length ? `${fallback}\n${sanitized}` : fallback;
};

const formatStudentContext = (context: StudentContext | undefined): string => {
  if (!context) return '';
  const lines: string[] = [];
  lines.push(
    `Learner ref ${context.learnerRef} | grade ${context.grade ?? 'n/a'} | level ${context.level ?? 'n/a'}`,
  );

  if (context.strengths.length) {
    lines.push(`Strength areas: ${context.strengths.slice(0, 3).join(', ')}`);
  }
  if (context.focusAreas.length) {
    lines.push(`Focus areas: ${context.focusAreas.slice(0, 3).join(', ')}`);
  }
  if (context.masteryBySubject.length) {
    const masteryLines = context.masteryBySubject
      .slice(0, 4)
      .map((entry) => `${entry.subject}: ${Math.round(entry.mastery)}%`)
      .join(' | ');
    lines.push(`Recent mastery: ${masteryLines}`);
  }
  if (context.activeLesson) {
    const lesson = context.activeLesson;
    const lessonBits = [
      `Active lesson: ${lesson.title}`,
      lesson.moduleTitle ? `Module: ${lesson.moduleTitle}` : null,
      lesson.subject ? `Subject: ${lesson.subject}` : null,
      lesson.status ? `Status: ${lesson.status}` : null,
      typeof lesson.masteryPct === 'number' ? `Mastery: ${Math.round(lesson.masteryPct)}%` : null,
    ].filter(Boolean);
    lines.push(lessonBits.join(' | '));
  }
  if (context.nextLesson) {
    const { title, moduleTitle, subject } = context.nextLesson;
    const nextSummary = [`Next lesson: ${title}`, moduleTitle ? `Module: ${moduleTitle}` : null, subject ? `Subject: ${subject}` : null]
      .filter(Boolean)
      .join(' | ');
    lines.push(nextSummary);
  }

  return lines.join('\n');
};

const fetchStudentContext = async (supabase: SupabaseClient, studentId: string): Promise<StudentContext> => {
  const learnerRef = anonymize(studentId) ?? 'learner';

  const [
    { data: profile, error: profileError },
    { data: progressRows, error: progressError },
    { data: masteryRows, error: masteryError },
    { data: skills, error: skillsError },
    { data: subjects, error: subjectsError },
  ] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('grade, level, strengths, weaknesses, learning_path')
      .eq('id', studentId)
      .maybeSingle(),
    supabase
      .from('student_progress')
      .select(
        `status, mastery_pct, last_activity_at,
         lessons (
           title,
           module_id,
           modules ( title, subject )
         )`,
      )
      .eq('student_id', studentId)
      .order('last_activity_at', { ascending: false })
      .limit(5),
    supabase.from('student_mastery').select('skill_id, mastery_pct').eq('student_id', studentId),
    supabase.from('skills').select('id, subject_id, name'),
    supabase.from('subjects').select('id, name'),
  ]);

  if (profileError) {
    throw new AiRequestError(500, `Unable to load learner context: ${profileError.message}`);
  }
  if (progressError) {
    console.warn('[ai] Failed to load learner progress', progressError);
  }
  if (masteryError) {
    console.warn('[ai] Failed to load learner mastery', masteryError);
  }
  if (skillsError) {
    console.warn('[ai] Failed to load skill metadata', skillsError);
  }
  if (subjectsError) {
    console.warn('[ai] Failed to load subject metadata', subjectsError);
  }

  const strengths = Array.isArray(profile?.strengths)
    ? profile?.strengths.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const weaknesses = Array.isArray(profile?.weaknesses)
    ? profile?.weaknesses.filter((entry): entry is string => typeof entry === 'string')
    : [];

  const activeProgress = (progressRows ?? []).find((row) => row?.lessons?.title) ?? null;
  const activeLesson: LessonSnapshot | null = activeProgress
    ? {
        title: (activeProgress.lessons?.title as string | null) ?? 'Lesson',
        moduleTitle: (activeProgress.lessons?.modules?.title as string | null) ?? null,
        subject: (activeProgress.lessons?.modules?.subject as string | null) ?? null,
        status: (activeProgress.status as string | null) ?? null,
        masteryPct: (activeProgress.mastery_pct as number | null) ?? null,
        lastActivityAt: (activeProgress.last_activity_at as string | null) ?? null,
      }
    : null;

  const learningPath = Array.isArray(profile?.learning_path) ? (profile?.learning_path as unknown[]) : [];
  const nextLessonRaw = learningPath.find((item) => (item as Record<string, unknown>)?.status !== 'completed') as Record<string, unknown> | undefined;
  const nextLesson: LessonSnapshot | null = nextLessonRaw
    ? {
        title: (nextLessonRaw?.title as string | null) ?? 'Upcoming lesson',
        moduleTitle: (nextLessonRaw?.moduleTitle as string | null) ?? (nextLessonRaw?.module as string | null) ?? null,
        subject: (nextLessonRaw?.subject as string | null) ?? null,
        status: (nextLessonRaw?.status as string | null) ?? null,
        masteryPct: (nextLessonRaw?.mastery as number | null) ?? null,
      }
    : null;

  const masteryBySubject = (() => {
    if (!masteryRows || !skills || !subjects) return [];
    const skillSubject = new Map<number, number>();
    (skills as Array<{ id: number; subject_id: number | null }>).forEach((row) => {
      if (row.id != null && row.subject_id != null) {
        skillSubject.set(row.id, row.subject_id);
      }
    });
    const subjectLabels = new Map<number, string>();
    (subjects as Array<{ id: number; name: string }>).forEach((row) => {
      if (row.id != null && typeof row.name === 'string') {
        subjectLabels.set(row.id, row.name);
      }
    });
    const totals = new Map<number, { total: number; count: number }>();
    (masteryRows as Array<{ skill_id: number; mastery_pct: number | null }>).forEach((row) => {
      const subjectId = skillSubject.get(row.skill_id);
      if (!subjectId) return;
      const entry = totals.get(subjectId) ?? { total: 0, count: 0 };
      const masteryPct = typeof row.mastery_pct === 'number' ? row.mastery_pct : null;
      if (masteryPct != null) {
        entry.total += masteryPct;
        entry.count += 1;
      }
      totals.set(subjectId, entry);
    });
    const result: Array<{ subject: string; mastery: number }> = [];
    totals.forEach((value, subjectId) => {
      if (value.count === 0) return;
      const subjectName = subjectLabels.get(subjectId) ?? `Subject ${subjectId}`;
      result.push({ subject: subjectName, mastery: Math.round((value.total / value.count) * 100) / 100 });
    });
    result.sort((a, b) => a.mastery - b.mastery);
    return result;
  })();

  const focusAreas = weaknesses.length
    ? weaknesses
    : masteryBySubject
        .slice(0, 2)
        .map((entry) => entry.subject);

  return {
    learnerRef,
    grade: (profile?.grade as number | null) ?? null,
    level: (profile?.level as number | null) ?? null,
    strengths: strengths.slice(0, 4),
    focusAreas: focusAreas.slice(0, 4),
    activeLesson,
    nextLesson,
    masteryBySubject,
  };
};

const buildTutorContext = (payload: TutorRequestBody, studentContext?: StudentContext): TutorContext => {
  const mode: TutorMode = payload.mode === 'marketing' ? 'marketing' : 'learning';
  const prompt = sanitizeText(payload.prompt ?? '', MAX_PROMPT_CHARS);
  if (!prompt) {
    throw new AiRequestError(400, 'Prompt is required.');
  }

  const systemPrompt = resolveSystemPrompt(mode, payload.systemPrompt);
  const knowledge = payload.knowledge ? sanitizeText(payload.knowledge, MAX_KNOWLEDGE_CHARS) : undefined;

  return { prompt, systemPrompt, mode, knowledge, studentContext };
};

const buildMessages = (context: TutorContext) => {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: context.systemPrompt },
  ];

  if (context.mode === 'marketing' && context.knowledge) {
    messages.push({
      role: 'system',
      content: `Product facts to ground your answer:\n${context.knowledge}`,
    });
  }

  if (context.mode === 'learning' && context.studentContext) {
    const learnerContext = formatStudentContext(context.studentContext);
    if (learnerContext.trim().length) {
      messages.push({
        role: 'system',
        content: `Learner context (use for tailoring, never repeat sensitive data):\n${learnerContext}`,
      });
    }
  }

  if (context.mode === 'learning') {
    const guardrails = buildLearningGuardrails(context.studentContext);
    if (guardrails) {
      messages.push({
        role: 'system',
        content: guardrails,
      });
    }
  }

  messages.push({
    role: 'user',
    content: context.prompt,
  });

  return messages;
};

const callOpenRouter = async (context: TutorContext, model: string, apiKey: string): Promise<TutorResponse> => {
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_BASE_URL ?? 'https://elevated.chat',
      'X-Title': 'ElevatED',
    },
    body: JSON.stringify({
      model,
      messages: buildMessages(context),
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter request failed (${response.status} ${response.statusText}) ${errorText}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenRouter response missing content');
  }

  return {
    message: sanitizeOutput(content),
    model,
  };
};

const enforceRateLimit = (
  key: string | null,
  limiter: ReturnType<typeof createLimiter>,
  context?: Record<string, unknown>,
) => {
  if (!key) return;
  const { allowed, remaining } = limiter.check(key);
  if (!allowed) {
    captureServerMessage('[ai] rate limit hit', { ...context, remaining }, 'warning');
    throw new AiRequestError(429, 'Too many AI requests. Please wait a moment and try again.');
  }
};

export const handleTutorRequest = async (
  payload: TutorRequestBody,
  supabase: SupabaseClient,
  opts: TutorRequestOptions,
): Promise<TutorResponse> => {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AiRequestError(500, 'AI is not configured. Missing OPENROUTER_API_KEY.');
  }

  const hashedUser = anonymize(opts.userId ?? null);
  const hashedIp = anonymize(opts.clientIp ?? null);
  const usageKey = hashedUser ?? hashedIp ?? 'anonymous';

  enforceRateLimit(hashedIp ? `ip:${hashedIp}` : null, ipLimiter, { hashedIp, mode: payload.mode ?? 'learning' });
  enforceRateLimit(
    hashedUser ? `user:${hashedUser}` : null,
    learnerLimiter,
    { hashedUser, mode: payload.mode ?? 'learning' },
  );

  if (payload.mode === 'learning' && opts.role && opts.role !== 'student') {
    throw new AiRequestError(403, 'Learning assistant is only available for student accounts.');
  }

  const tutorLimit = payload.mode === 'learning' ? opts.plan?.tutorDailyLimit ?? null : null;
  if (payload.mode === 'learning' && opts.plan && opts.plan.aiAccess === false) {
    captureServerMessage('[ai] plan gated', { plan: opts.plan.slug, hashedUser }, 'warning');
    throw new AiRequestError(402, 'Upgrade required to access the AI assistant.', 'payment_required');
  }

  const remainingAllowance =
    payload.mode === 'learning'
      ? enforceDailyTutorLimit(tutorLimit, usageKey, opts.plan?.slug ?? null)
      : null;

  const studentContext =
    payload.mode === 'marketing'
      ? undefined
      : opts.userId
        ? await fetchStudentContext(supabase, opts.userId)
        : undefined;

  const tutorContext = buildTutorContext(payload, studentContext);

  const safetyIssue = detectUnsafePrompt(tutorContext.prompt, studentContext);
  if (safetyIssue) {
    captureServerMessage('[ai] tutor safety_refusal', {
      mode: tutorContext.mode,
      reason: safetyIssue,
      hashedUser,
      hashedIp,
      plan: opts.plan?.slug,
      grade: studentContext?.grade,
    });
    return {
      message: buildSafetyRefusal(safetyIssue, studentContext),
      model: 'guardrail',
      remaining: remainingAllowance,
      limit: payload.mode === 'learning' ? tutorLimit ?? null : null,
      plan: payload.mode === 'learning' ? opts.plan?.slug ?? null : null,
    };
  }

  captureServerMessage('[ai] tutor request', {
    mode: tutorContext.mode,
    promptChars: tutorContext.prompt.length,
    hasContext: Boolean(studentContext),
    hashedUser,
    hashedIp,
    plan: opts.plan?.slug,
    tutorLimit,
    remaining: remainingAllowance,
  });

  let aiResult: TutorResponse | null = null;

  try {
    try {
      const result = await callOpenRouter(tutorContext, PRIMARY_MODEL, apiKey);
      aiResult = result;
      captureServerMessage('[ai] tutor success', {
        mode: tutorContext.mode,
        model: result.model,
        hashedUser,
        hashedIp,
        responseChars: result.message.length,
        plan: opts.plan?.slug,
      });
    } catch (primaryError) {
      captureServerException(primaryError, { model: PRIMARY_MODEL, mode: tutorContext.mode });
      const fallback = await callOpenRouter(tutorContext, FALLBACK_MODEL, apiKey);
      aiResult = fallback;
      captureServerMessage('[ai] tutor fallback success', {
        mode: tutorContext.mode,
        model: fallback.model,
        hashedUser,
        hashedIp,
        responseChars: fallback.message.length,
        plan: opts.plan?.slug,
      });
    }

    if (!aiResult) {
      throw new AiRequestError(502, 'The tutor is unavailable right now. Please try again shortly.');
    }

    return {
      ...aiResult,
      remaining: payload.mode === 'learning' ? recordTutorUsage(tutorLimit, usageKey) : null,
      limit: payload.mode === 'learning' ? tutorLimit ?? null : null,
      plan: payload.mode === 'learning' ? opts.plan?.slug ?? null : null,
    };
  } catch (error) {
    const status = error instanceof AiRequestError ? error.status : 500;
    const context = {
      mode: tutorContext.mode,
      hashedUser,
      hashedIp,
      plan: opts.plan?.slug,
      status,
    };
    if (status >= 500) {
      captureServerException(error, context);
    } else {
      captureServerMessage('[ai] tutor request blocked', context, status >= 500 ? 'error' : 'warning');
    }
    if (error instanceof AiRequestError) {
      throw error;
    }
    throw new AiRequestError(502, 'The tutor is unavailable right now. Please try again shortly.');
  }
};
