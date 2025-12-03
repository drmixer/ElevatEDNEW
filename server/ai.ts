import crypto from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { captureServerException, captureServerMessage } from './monitoring.js';
import { recordOpsEvent } from './opsMetrics.js';
import { getRuntimeConfig } from './config.js';
import { getAdaptiveContext } from './learningPaths.js';
import { MARKETING_KNOWLEDGE, MARKETING_SYSTEM_PROMPT } from '../shared/marketingContent.js';

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
  aiOptIn?: boolean | null;
  persona?: {
    name: string;
    tone?: string | null;
    constraints?: string | null;
    promptSnippet?: string | null;
    sampleReplies?: string[] | null;
  };
  targetDifficulty?: number | null;
  misconceptions?: string[];
  recentAttempts?: Array<{ standard: string; correct: boolean; difficulty: number | null; source: string }>;
  chatMode?: 'guided_only' | 'guided_preferred' | 'free';
  chatModeLocked?: boolean;
  studyMode?: 'catch_up' | 'keep_up' | 'get_ahead';
  studyModeLocked?: boolean;
  allowTutor?: boolean;
  tutorLessonOnly?: boolean;
  tutorDailyLimit?: number | null;
  weeklyIntent?: 'precision' | 'speed' | 'stretch' | 'balanced';
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

const CONTEXT_CACHE_TTL_MS = 30 * 1000;
const contextCache = new Map<string, { expires: number; context: StudentContext }>();

const cacheStudentContext = (studentId: string, context: StudentContext) => {
  contextCache.set(studentId, { context, expires: Date.now() + CONTEXT_CACHE_TTL_MS });
};

const getCachedStudentContext = (studentId: string): StudentContext | null => {
  const entry = contextCache.get(studentId);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    contextCache.delete(studentId);
    return null;
  }
  return entry.context;
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
// Keep the marketing assistant aligned with the tutor: OpenRouter + Mistral 7B Instruct (free).
const PRIMARY_MODEL = 'mistralai/mistral-7b-instruct:free';
const FALLBACK_MODEL = 'mistralai/mistral-7b-instruct:free';
const DEFAULT_MODEL_TIMEOUT_MS = 12000;

const MAX_PROMPT_CHARS = 1200;
const MAX_SYSTEM_PROMPT_CHARS = 1400;
const MAX_KNOWLEDGE_CHARS = 3200;
const MAX_RESPONSE_CHARS = 1600;

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g;
const LONG_NUMBER_REGEX = /\b\d{9,}\b/g;
const recentPromptCache = new Map<string, { hash: string; at: number }>();

const normalizePrompt = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const detectHallucinatedStandard = (message: string): string | null => {
  const lower = message.toLowerCase();
  if (lower.includes('placeholder') || lower.includes('lorem ipsum')) {
    return 'placeholder_text';
  }
  if (/\bstandard[_-]?code\b/.test(lower) || /\bngss[_-]?xxx\b/i.test(message)) {
    return 'placeholder_standard';
  }
  if (/\bstd[-_ ]?(?:xxx|000|999)\b/i.test(message)) {
    return 'fake_standard';
  }
  return null;
};
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
    context?.tutorLessonOnly
      ? 'Lesson-only mode is enabled. Stay on the active lesson/module and decline unrelated requests, asking the learner to return to their current lesson.'
      : null,
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

const marketingSystemPrompt = MARKETING_SYSTEM_PROMPT;

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
  if (limit === null || limit === undefined || limit === 'unlimited') {
    return null;
  }

  if (typeof limit === 'number' && limit <= 0) {
    captureServerMessage('[ai] tutor disabled by limit', { usageKey, plan: planSlug, limit }, 'warning');
    recordOpsEvent({
      type: 'tutor_plan_limit',
      reason: 'disabled',
      plan: planSlug ?? null,
    });
    throw new AiRequestError(403, 'Your grown-up turned off tutor chats for now. Ask them if you need it back on.');
  }

  const used = readUsageCount(usageKey);
  if (used >= limit) {
    const planLabel = planSlug ? ` on your ${planSlug.replace(/[-_]/g, ' ')} plan` : '';
    captureServerMessage('[ai] tutor daily limit reached', { usageKey, plan: planSlug, limit }, 'warning');
    recordOpsEvent({
      type: 'tutor_plan_limit',
      reason: 'daily_limit',
      plan: planSlug ?? null,
    });
    throw new AiRequestError(
      402,
      `You've reached today's AI tutor limit${planLabel}. Upgrade to get more help or try again tomorrow.`,
    );
  }

  return Math.max(0, limit - used);
};

const recordTutorUsage = (limit: DailyLimit, usageKey: string): number | null => {
  if (limit === null || limit === undefined || limit === 'unlimited') {
    return null;
  }
  if (typeof limit === 'number' && limit <= 0) {
    return 0;
  }

  const next = bumpUsageCount(usageKey);
  return Math.max(0, limit - next);
};

const mergeTutorLimits = (planLimit: DailyLimit, learnerLimit?: number | null): DailyLimit => {
  if (learnerLimit == null || Number.isNaN(learnerLimit)) {
    return planLimit ?? null;
  }
  const normalizedLearnerLimit = Math.max(0, learnerLimit);
  if (!planLimit || planLimit === 'unlimited') {
    return normalizedLearnerLimit;
  }
  if (typeof planLimit === 'number') {
    return Math.min(planLimit, normalizedLearnerLimit);
  }
  return normalizedLearnerLimit;
};

export { mergeTutorLimits };

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
  if (context.persona) {
    const personaTone = context.persona.tone ? ` (${context.persona.tone})` : '';
    lines.push(`Tutor persona: ${context.persona.name}${personaTone}`);
  }
  if (context.aiOptIn === false) {
    lines.push('AI opt-in: false; keep answers brief and privacy-safe.');
  }
  if (context.targetDifficulty != null) {
    lines.push(`Adaptive target difficulty: ~${context.targetDifficulty} with accuracy 65-80%.`);
  }
  if (context.misconceptions && context.misconceptions.length) {
    lines.push(`Current struggles: ${context.misconceptions.slice(0, 4).join(', ')}`);
  }
  if (context.recentAttempts && context.recentAttempts.length) {
    const attempts = context.recentAttempts.slice(0, 3).map((attempt) => {
      const standard = attempt.standard ?? 'general';
      const difficulty = attempt.difficulty != null ? `@${attempt.difficulty}` : '';
      return `${attempt.source}:${attempt.correct ? '✅' : '❌'}${difficulty} ${standard}`;
    });
    lines.push(`Recent attempts: ${attempts.join(' | ')}`);
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
  if (context.chatMode) {
    lines.push(`Chat mode: ${context.chatMode}${context.chatModeLocked ? ' (parent locked)' : ''}`);
  }
  if (context.studyMode) {
    lines.push(`Study mode: ${context.studyMode}`);
  }
  if (context.weeklyIntent) {
    lines.push(`Weekly intent: ${context.weeklyIntent}`);
  }
  if (context.allowTutor === false) {
    lines.push('Tutor access: disabled by parent/guardian.');
  }
  if (context.tutorLessonOnly) {
    lines.push('Tutor scope: lesson-only; decline unrelated prompts.');
  }
  if (typeof context.tutorDailyLimit === 'number') {
    lines.push(`Tutor cap: ${context.tutorDailyLimit} chats/day.`);
  }

  return lines.join('\n');
};

const fetchStudentContext = async (supabase: SupabaseClient, studentId: string): Promise<StudentContext> => {
  const cached = getCachedStudentContext(studentId);
  if (cached) {
    return cached;
  }
  const learnerRef = anonymize(studentId) ?? 'learner';

  const [
    { data: profile, error: profileError },
    { data: progressRows, error: progressError },
    { data: masteryRows, error: masteryError },
    { data: skills, error: skillsError },
    { data: subjects, error: subjectsError },
    { data: preferencesRow, error: preferencesError },
    adaptiveContext,
  ] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('grade, level, strengths, weaknesses, learning_path, learning_style')
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
    supabase.from('student_preferences').select('opt_in_ai, tutor_persona_id').eq('student_id', studentId).maybeSingle(),
    getAdaptiveContext(supabase, studentId).catch((error) => {
      console.warn('[ai] Failed to load adaptive context', error);
      return { targetDifficulty: 1, misconceptions: [], recentAttempts: [] };
    }),
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
  if (preferencesError) {
    console.warn('[ai] Failed to load student preferences', preferencesError);
  }

  const strengths = Array.isArray(profile?.strengths)
    ? profile?.strengths.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const weaknesses = Array.isArray(profile?.weaknesses)
    ? profile?.weaknesses.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const learningStyle = profile?.learning_style as Record<string, unknown> | null | undefined;
  const resolveChatMode = (): 'guided_only' | 'guided_preferred' | 'free' => {
    const raw = learningStyle?.chatMode ?? learningStyle?.chat_mode ?? learningStyle?.mode;
    if (raw === 'guided_only' || raw === 'guided_preferred' || raw === 'free') return raw;
    if ((profile?.grade as number | null) != null) {
      const g = (profile?.grade as number) ?? 0;
      if (g <= 3) return 'guided_only';
      if (g <= 5) return 'guided_preferred';
    }
    return 'free';
  };
  const chatMode = resolveChatMode();
  const chatModeLocked =
    typeof learningStyle?.chatModeLocked === 'boolean'
      ? (learningStyle?.chatModeLocked as boolean)
      : typeof learningStyle?.chat_mode_locked === 'boolean'
        ? (learningStyle?.chat_mode_locked as boolean)
        : false;
  const studyModeRaw = learningStyle?.studyMode ?? learningStyle?.study_mode;
  const studyMode =
    studyModeRaw === 'catch_up' || studyModeRaw === 'keep_up' || studyModeRaw === 'get_ahead'
      ? studyModeRaw
      : undefined;
  const studyModeLocked =
    typeof learningStyle?.studyModeLocked === 'boolean'
      ? (learningStyle?.studyModeLocked as boolean)
      : typeof learningStyle?.study_mode_locked === 'boolean'
        ? (learningStyle?.study_mode_locked as boolean)
        : false;
  const weeklyIntentRaw = learningStyle?.weeklyIntent ?? learningStyle?.weekly_intent ?? learningStyle?.intent;
  const weeklyIntent: 'precision' | 'speed' | 'stretch' | 'balanced' | undefined =
    weeklyIntentRaw === 'precision' || weeklyIntentRaw === 'speed' || weeklyIntentRaw === 'stretch' || weeklyIntentRaw === 'balanced'
      ? weeklyIntentRaw
      : undefined;
  const allowTutorRaw =
    learningStyle?.allowTutor ??
    learningStyle?.allow_tutor ??
    learningStyle?.ai_enabled ??
    learningStyle?.aiEnabled;
  const allowTutor = typeof allowTutorRaw === 'boolean' ? (allowTutorRaw as boolean) : true;
  const lessonOnlyRaw =
    learningStyle?.tutorLessonOnly ??
    learningStyle?.tutor_lesson_only ??
    learningStyle?.lessonOnly ??
    learningStyle?.lesson_only ??
    learningStyle?.limitTutorToLessonContext ??
    learningStyle?.ai_lesson_only;
  const tutorLessonOnly =
    typeof lessonOnlyRaw === 'boolean'
      ? (lessonOnlyRaw as boolean)
      : (profile?.grade as number | null) != null && (profile?.grade as number) < 13;
  const tutorDailyLimitRaw =
    learningStyle?.tutorDailyLimit ??
    learningStyle?.tutor_daily_limit ??
    learningStyle?.maxTutorChatsPerDay ??
    learningStyle?.max_tutor_chats_per_day ??
    learningStyle?.dailyTutorLimit ??
    learningStyle?.daily_tutor_limit;
  const tutorDailyLimit =
    typeof tutorDailyLimitRaw === 'number' && Number.isFinite(tutorDailyLimitRaw)
      ? (tutorDailyLimitRaw as number)
      : typeof tutorDailyLimitRaw === 'string' && Number.isFinite(Number.parseInt(tutorDailyLimitRaw, 10))
        ? Number.parseInt(tutorDailyLimitRaw, 10)
        : null;
  const optInAi = (preferencesRow?.opt_in_ai as boolean | null | undefined) ?? true;

  let persona: StudentContext['persona'] = undefined;
  const personaId = (preferencesRow?.tutor_persona_id as string | null | undefined) ?? null;
  if (personaId) {
    try {
      const { data: personaRow, error: personaError } = await supabase
        .from('tutor_personas')
        .select('id, name, tone, constraints, prompt_snippet, sample_replies')
        .eq('id', personaId)
        .maybeSingle();
      if (personaError) {
        console.warn('[ai] Failed to load tutor persona', personaError);
      } else if (personaRow) {
        persona = {
          name: (personaRow.name as string | null | undefined) ?? 'Tutor',
          tone: (personaRow.tone as string | null | undefined) ?? null,
          constraints: (personaRow.constraints as string | null | undefined) ?? null,
          promptSnippet: (personaRow.prompt_snippet as string | null | undefined) ?? null,
          sampleReplies: Array.isArray(personaRow.sample_replies)
            ? (personaRow.sample_replies as string[])
                .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
                .slice(0, 4)
            : null,
        };
      }
    } catch (personaError) {
      console.warn('[ai] Unexpected error while loading tutor persona', personaError);
    }
  }

  const adaptive = (adaptiveContext as {
    targetDifficulty?: number | null;
    misconceptions?: string[];
    recentAttempts?: Array<{ standards?: string[]; correct: boolean; difficulty: number | null; source: string }>;
  }) ?? { targetDifficulty: 1, misconceptions: [], recentAttempts: [] };

  const recentAttempts =
    Array.isArray(adaptive.recentAttempts)
      ? adaptive.recentAttempts.map((attempt) => ({
          standard: Array.isArray(attempt.standards) && attempt.standards.length ? attempt.standards[0] ?? 'general' : 'general',
          correct: attempt.correct,
          difficulty: attempt.difficulty ?? null,
          source: attempt.source ?? 'event',
        }))
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
  const misconceptions = Array.isArray(adaptive.misconceptions) ? adaptive.misconceptions : [];

  const context: StudentContext = {
    learnerRef,
    grade: (profile?.grade as number | null) ?? null,
    level: (profile?.level as number | null) ?? null,
    strengths: strengths.slice(0, 4),
    focusAreas: focusAreas.slice(0, 4),
    activeLesson,
    nextLesson,
    masteryBySubject,
    aiOptIn: optInAi,
    persona,
    targetDifficulty: adaptive.targetDifficulty ?? null,
    misconceptions,
    recentAttempts,
    chatMode,
    chatModeLocked,
    studyMode,
    studyModeLocked,
    allowTutor,
    tutorLessonOnly,
    tutorDailyLimit,
    weeklyIntent,
  };

  cacheStudentContext(studentId, context);
  return context;
};

const buildTutorContext = (payload: TutorRequestBody, studentContext?: StudentContext): TutorContext => {
  const mode: TutorMode = payload.mode === 'marketing' ? 'marketing' : 'learning';
  const prompt = sanitizeText(payload.prompt ?? '', MAX_PROMPT_CHARS);
  if (!prompt) {
    throw new AiRequestError(400, 'Prompt is required.');
  }

  const systemPrompt = resolveSystemPrompt(mode, payload.systemPrompt);
  const marketingKnowledge =
    mode === 'marketing'
      ? [MARKETING_KNOWLEDGE, payload.knowledge].filter(Boolean).join('\n\n')
      : payload.knowledge;
  const knowledge = marketingKnowledge ? sanitizeText(marketingKnowledge, MAX_KNOWLEDGE_CHARS) : undefined;

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
    if (context.studentContext.persona) {
      const persona = context.studentContext.persona;
      const personaLines = [
        `Tutor persona: ${persona.name}`,
        persona.tone ? `Tone: ${persona.tone}` : null,
        persona.constraints ? `Constraints: ${persona.constraints}` : null,
        persona.promptSnippet ? `Style: ${persona.promptSnippet}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      if (personaLines.length) {
        messages.push({ role: 'system', content: personaLines });
      }
      if (persona.sampleReplies?.length) {
        const examples = persona.sampleReplies.slice(0, 3).map((reply) => `- ${reply}`).join('\n');
        messages.push({
          role: 'system',
          content: `Persona example replies (match this voice):\n${examples}`,
        });
      }
    }
    if (context.studentContext.aiOptIn === false) {
      messages.push({
        role: 'system',
        content:
          'Learner opt-in: false. Keep responses concise, avoid collecting personal details, and do not infer beyond the provided context.',
      });
    }
    if (context.studentContext.targetDifficulty != null) {
      messages.push({
        role: 'system',
        content: `Adaptive target: aim for difficulty level ${context.studentContext.targetDifficulty} with accuracy around 65-80%; adjust hints to stay near that band.`,
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
    const chatMode = context.studentContext?.chatMode;
    if (chatMode === 'guided_only') {
      messages.push({
        role: 'system',
        content:
          'Chat mode: guided_only. Ask 1-2 clarifying questions before longer answers. Keep answers short (2-3 steps). If the prompt is off-topic or personal, politely decline and ask the learner to pick a different guided prompt; remind them to ask a trusted adult for safety issues.',
      });
    } else if (chatMode === 'guided_preferred') {
      messages.push({
        role: 'system',
        content:
          'Chat mode: guided_preferred. Lead with a concise answer and one clarifying question. If the request is off-topic/personal, decline and suggest choosing a guided prompt. Keep responses brief (2-3 steps).',
      });
    }
    const studyMode = context.studentContext?.studyMode;
    if (studyMode === 'catch_up') {
      messages.push({
        role: 'system',
        content:
          'Study mode: catch_up. Prioritize remediation, weaker skills, and gentle reassurance. Keep responses short and suggest one review action.',
      });
    } else if (studyMode === 'get_ahead') {
      messages.push({
        role: 'system',
        content:
          'Study mode: get_ahead. Offer extension or stretch practice within safe bounds. Keep tone upbeat but concise; do not unlock unsafe or off-grade content.',
      });
    } else if (studyMode === 'keep_up') {
      messages.push({
        role: 'system',
        content:
          'Study mode: keep_up. Stay balanced; keep answers concise and on-grade.',
      });
    }
    if (context.studentContext?.studyModeLocked) {
      messages.push({
        role: 'system',
        content: 'Study mode is locked by a parent/teacher—do not switch tone beyond the assigned mode.',
      });
    }
  }

  messages.push({
    role: 'user',
    content: context.prompt,
  });

  return messages;
};

const callOpenRouter = async (
  context: TutorContext,
  model: string,
  apiKey: string,
  timeoutMs: number,
): Promise<TutorResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(OPENROUTER_ENDPOINT, {
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
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Tutor request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

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
    recordOpsEvent({
      type: 'tutor_plan_limit',
      reason: 'rate_limit',
      plan: (context?.plan as string | null) ?? null,
    });
    throw new AiRequestError(429, 'Too many AI requests. Please wait a moment and try again.');
  }
};

export const handleTutorRequest = async (
  payload: TutorRequestBody,
  supabase: SupabaseClient,
  opts: TutorRequestOptions,
): Promise<TutorResponse> => {
  const runtimeConfig = await getRuntimeConfig(supabase);
  const timeoutMs = runtimeConfig.tutor.timeoutMs || DEFAULT_MODEL_TIMEOUT_MS;
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
    { hashedUser, mode: payload.mode ?? 'learning', plan: opts.plan?.slug },
  );

  if (payload.mode === 'learning' && opts.role && opts.role !== 'student') {
    throw new AiRequestError(403, 'Learning assistant is only available for student accounts.');
  }

  let tutorLimit: DailyLimit = payload.mode === 'learning' ? opts.plan?.tutorDailyLimit ?? null : null;
  if (payload.mode === 'learning' && opts.plan && opts.plan.aiAccess === false) {
    captureServerMessage('[ai] plan gated', { plan: opts.plan.slug, hashedUser }, 'warning');
    recordOpsEvent({
      type: 'tutor_plan_limit',
      reason: 'plan_gated',
      plan: opts.plan.slug ?? null,
    });
    throw new AiRequestError(402, 'Upgrade required to access the AI assistant.', 'payment_required');
  }

  const studentContext =
    payload.mode === 'marketing'
      ? undefined
      : opts.userId
        ? await fetchStudentContext(supabase, opts.userId)
        : undefined;

  if (payload.mode === 'learning') {
    tutorLimit = mergeTutorLimits(tutorLimit, studentContext?.tutorDailyLimit ?? null);
  }

  if (payload.mode === 'learning' && studentContext?.allowTutor === false) {
    captureServerMessage('tutor_disabled_by_parent', {
      hashedUser,
      hashedIp,
      plan: opts.plan?.slug,
      tutorLimit,
    });
    throw new AiRequestError(403, 'Your grown-up turned off tutor chats for now. Ask them if you need it back on.');
  }

  const remainingAllowance =
    payload.mode === 'learning'
      ? enforceDailyTutorLimit(tutorLimit, usageKey, opts.plan?.slug ?? null)
      : null;

  const tutorContext = buildTutorContext(payload, studentContext);
  const normalizedPrompt = normalizePrompt(tutorContext.prompt);
  const cachedPrompt = recentPromptCache.get(usageKey);
  if (cachedPrompt && cachedPrompt.hash === normalizedPrompt && Date.now() - cachedPrompt.at < 30_000) {
    throw new AiRequestError(429, 'You just asked this—try a different question or wait a moment.');
  }
  recentPromptCache.set(usageKey, { hash: normalizedPrompt, at: Date.now() });

  const safetyIssue = detectUnsafePrompt(tutorContext.prompt, studentContext);
  if (safetyIssue) {
    if (studentContext?.chatMode === 'guided_only' || studentContext?.chatMode === 'guided_preferred') {
      captureServerMessage('chat_guided_guardrail_triggered', {
        reason: safetyIssue,
        chatMode: studentContext.chatMode,
        grade: studentContext.grade,
        hashedUser,
        hashedIp,
        plan: opts.plan?.slug,
      });
    }
      captureServerMessage('[ai] tutor safety_refusal', {
        mode: tutorContext.mode,
        reason: safetyIssue,
        hashedUser,
        hashedIp,
        plan: opts.plan?.slug,
        grade: studentContext?.grade,
      });
      recordOpsEvent({
        type: 'tutor_safety_block',
        reason: safetyIssue,
        plan: opts.plan?.slug ?? null,
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
  const startedAt = Date.now();

  try {
    try {
      const result = await callOpenRouter(tutorContext, PRIMARY_MODEL, apiKey, timeoutMs);
      aiResult = result;
      captureServerMessage('[ai] tutor success', {
        mode: tutorContext.mode,
        model: result.model,
        hashedUser,
        hashedIp,
        responseChars: result.message.length,
        plan: opts.plan?.slug,
      });
      recordOpsEvent({
        type: 'tutor_success',
        plan: opts.plan?.slug ?? null,
      });
    } catch (primaryError) {
      captureServerException(primaryError, { model: PRIMARY_MODEL, mode: tutorContext.mode });
      const fallback = await callOpenRouter(tutorContext, FALLBACK_MODEL, apiKey, timeoutMs);
      aiResult = fallback;
      captureServerMessage('[ai] tutor fallback success', {
        mode: tutorContext.mode,
        model: fallback.model,
        hashedUser,
        hashedIp,
        responseChars: fallback.message.length,
        plan: opts.plan?.slug,
      });
      recordOpsEvent({
        type: 'tutor_success',
        plan: opts.plan?.slug ?? null,
      });
    }

    if (!aiResult) {
      throw new AiRequestError(502, 'The tutor is unavailable right now. Please try again shortly.');
    }

    const hallucination = detectHallucinatedStandard(aiResult.message);
    if (hallucination) {
      captureServerMessage('[ai] tutor hallucination_filter', { hallucination, hashedUser, hashedIp }, 'warning');
      throw new AiRequestError(422, 'Let me try a different way—ask again with a bit more detail.');
    }
    if (Math.random() < 0.02) {
      captureServerMessage('[ai] tutor_qa_sample', {
        hashedUser,
        hashedIp,
        mode: tutorContext.mode,
        promptPreview: tutorContext.prompt.slice(0, 120),
        responsePreview: aiResult.message.slice(0, 200),
        model: aiResult.model,
      });
    }

    recordOpsEvent({
      type: 'tutor_latency',
      durationMs: Date.now() - startedAt,
      label: aiResult.model,
      plan: opts.plan?.slug ?? null,
    });

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
    recordOpsEvent({
      type: 'tutor_error',
      plan: opts.plan?.slug ?? null,
      reason:
        status === 402
          ? 'payment_required'
          : status === 403
            ? 'forbidden'
            : status === 429
              ? 'rate_limit'
              : 'error',
    });
    if (error instanceof AiRequestError) {
      throw error;
    }
    throw new AiRequestError(502, 'The tutor is unavailable right now. Please try again shortly.');
  }
};
