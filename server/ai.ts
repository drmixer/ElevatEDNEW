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

type TutorResponse = {
  message: string;
  model: string;
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

const baseTutorSystemPrompt = [
  'You are ElevatED, a patient K-12 tutor.',
  'Give step-by-step explanations, check for understanding, and keep responses concise.',
  'Avoid sharing any personal data, emails, or phone numbers. Do not request PII.',
].join(' ');

const marketingSystemPrompt = [
  'You are ElevatED, the official marketing assistant for ElevatED - an adaptive K-12 learning platform.',
  'Keep replies concise (2-3 sentences), warm, encouraging, and confident.',
  'Use only the provided product facts. If unsure, say so and offer to connect them with support.',
].join(' ');

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

const enforceRateLimit = (key: string | null, limiter: ReturnType<typeof createLimiter>) => {
  if (!key) return;
  const { allowed } = limiter.check(key);
  if (!allowed) {
    throw new AiRequestError(429, 'Too many AI requests. Please wait a moment and try again.');
  }
};

export const handleTutorRequest = async (
  payload: TutorRequestBody,
  supabase: SupabaseClient,
  opts: { userId?: string | null; role?: string | null; clientIp?: string | null },
): Promise<TutorResponse> => {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AiRequestError(500, 'AI is not configured. Missing OPENROUTER_API_KEY.');
  }

  const hashedUser = anonymize(opts.userId ?? null);
  const hashedIp = anonymize(opts.clientIp ?? null);

  enforceRateLimit(hashedIp ? `ip:${hashedIp}` : null, ipLimiter);
  enforceRateLimit(hashedUser ? `user:${hashedUser}` : null, learnerLimiter);

  if (payload.mode === 'learning' && opts.role && opts.role !== 'student') {
    throw new AiRequestError(403, 'Learning assistant is only available for student accounts.');
  }

  const studentContext =
    payload.mode === 'marketing'
      ? undefined
      : opts.userId
        ? await fetchStudentContext(supabase, opts.userId)
        : undefined;

  const tutorContext = buildTutorContext(payload, studentContext);

  captureServerMessage('[ai] tutor request', {
    mode: tutorContext.mode,
    promptChars: tutorContext.prompt.length,
    hasContext: Boolean(studentContext),
    hashedUser,
    hashedIp,
  });

  try {
    try {
      const result = await callOpenRouter(tutorContext, PRIMARY_MODEL, apiKey);
      captureServerMessage('[ai] tutor success', {
        mode: tutorContext.mode,
        model: result.model,
        hashedUser,
        hashedIp,
        responseChars: result.message.length,
      });
      return result;
    } catch (primaryError) {
      captureServerException(primaryError, { model: PRIMARY_MODEL, mode: tutorContext.mode });
    }

    const fallback = await callOpenRouter(tutorContext, FALLBACK_MODEL, apiKey);
    captureServerMessage('[ai] tutor fallback success', {
      mode: tutorContext.mode,
      model: fallback.model,
      hashedUser,
      hashedIp,
      responseChars: fallback.message.length,
    });
    return fallback;
  } catch (error) {
    captureServerException(error, {
      mode: tutorContext.mode,
      hashedUser,
      hashedIp,
    });
    if (error instanceof AiRequestError) {
      throw error;
    }
    throw new AiRequestError(502, 'The tutor is unavailable right now. Please try again shortly.');
  }
};
