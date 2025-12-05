import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { parse as parseUrl } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createRlsClient, createServiceRoleClient } from '../scripts/utils/supabase.js';
import {
  IMPORT_PROVIDERS,
  IMPORT_PROVIDER_MAP,
  isImportProviderId,
  type ImportProviderId,
} from '../shared/import-providers.js';
import { findStudentAvatar, findTutorAvatar, isStudentAvatarUnlocked } from '../shared/avatarManifests.js';
import { tutorNameErrorMessage, validateTutorName } from '../shared/nameSafety.js';
import {
  importFederalMapping,
  type FederalMapping,
} from '../scripts/import_federal_pd.js';
import {
  importGutenbergMapping,
  type GutenbergMapping,
} from '../scripts/import_gutenberg.js';
import {
  importOpenStaxMapping,
  type OpenStaxMapping,
} from '../scripts/import_openstax.js';
import { handleTutorRequest, type TutorRequestBody } from './ai.js';
import { getRecommendations } from './recommendations.js';
import { getLessonDetail, getModuleAssessment, getModuleDetail, listModules, type ModuleFilters } from './modules.js';
import { ImportQueue } from './importQueue.js';
import {
  createImportRun,
  fetchImportRunById,
  fetchImportRuns,
  toApiModel,
} from './importRuns.js';
import { demoteAdmin, listAdmins, promoteUserToAdmin } from './admins.js';
import {
  extractBearerToken,
  resolveAdminFromToken,
  resolveUserFromToken,
  type AuthenticatedAdmin,
  type AuthenticatedUser,
} from './auth.js';
import { captureServerException, captureServerMessage, raiseAlert, withRequestScope } from './monitoring.js';
import { elapsedMs, recordApiTiming, startTimer } from './instrumentation.js';
import { normalizeImportLimits } from './importSafety.js';
import {
  createCheckoutSessionForPlan,
  createPortalSession,
  fetchBillingSummary,
  getPlanLimits,
  getStripeClient,
  getStripeWebhookSecret,
  handleStripeEvent,
  isBillingBypassed,
  isBillingRequired,
  isBillingSandboxMode,
  grantBypassSubscription,
  cancelParentSubscriptionForDeletion,
} from './billing.js';
import { processPendingAccountDeletionRequests } from './accountDeletion.js';
import { NotificationScheduler, notifyAssignmentCreated } from './notifications.js';
import { HttpError } from './httpError.js';
import { listTutorReports, parseReportStatus, updateTutorReportStatus } from './tutorReports.js';
import { getOpsSnapshot } from './opsMetrics.js';
import {
  getParentOverview,
  getStudentPath,
  getStudentStats,
  ensureStudentProfileProvisioned,
  savePlacementResponse,
  selectNextEntry,
  startPlacementAssessment,
  submitPlacementAssessment,
  applyAdaptiveEvent,
} from './learningPaths.js';
import {
  buildTutorContext,
  getStudentPreferences as fetchStudentPreferences,
  listAvatars,
  listTutorPersonas,
  updateStudentPreferences as saveStudentPreferences,
} from './personalization.js';
import { recordLearningEvent } from './xpService.js';

type ApiServerOptions = {
  startImportQueue?: boolean;
};

const API_VERSION = 'v1';
const API_PREFIX = '/api';
const VERSIONED_PREFIX = `${API_PREFIX}/${API_VERSION}`;
const DEFAULT_PREMIUM_PLAN_SLUG = process.env.DEFAULT_PREMIUM_PLAN_SLUG ?? 'individual-pro';
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:5173';

type ApiContext = {
  serviceSupabase: SupabaseClient;
};

type AssignModulePayload = {
  moduleId: number;
  studentIds: string[];
  creatorId: string;
  creatorRole?: 'parent' | 'admin';
  dueAt?: string | null;
  title?: string;
};

const ensureParentProfile = async (
  supabase: SupabaseClient,
  creatorId: string,
  serviceSupabase?: SupabaseClient,
) => {
  const { data, error } = await supabase
    .from('parent_profiles')
    .select('id')
    .eq('id', creatorId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify parent profile: ${error.message}`);
  }

  if (!data) {
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', creatorId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Unable to resolve creator profile: ${profileError.message}`);
    }

    const fullName = (profileRow?.full_name as string | null) ?? (profileRow?.email as string | null) ?? 'Family Admin';

    const { error: insertError } = await supabase
      .from('parent_profiles')
      .insert({ id: creatorId, full_name: fullName });

    if (insertError) {
      if (!serviceSupabase) {
        throw new Error(`Failed to provision parent profile: ${insertError.message}`);
      }

      const { error: elevatedError } = await serviceSupabase
        .from('parent_profiles')
        .insert({ id: creatorId, full_name: fullName });

      if (elevatedError) {
        throw new Error(`Failed to provision parent profile: ${elevatedError.message}`);
      }
    }
  }
};

const createModuleAssignment = async (
  supabase: SupabaseClient,
  payload: AssignModulePayload,
  serviceSupabase?: SupabaseClient,
) => {
  const studentIds = Array.from(new Set(payload.studentIds.filter((id) => typeof id === 'string' && id.trim().length)));
  if (!studentIds.length) {
    throw new Error('At least one student must be provided.');
  }

  const { data: moduleRow, error: moduleError } = await supabase
    .from('modules')
    .select('id, title, slug, metadata')
    .eq('id', payload.moduleId)
    .maybeSingle();

  if (moduleError) {
    throw new Error(`Unable to load module: ${moduleError.message}`);
  }
  if (!moduleRow) {
    throw new Error('Module not found.');
  }

  const { data: lessonRows, error: lessonError } = await supabase
    .from('lessons')
    .select('id')
    .eq('module_id', payload.moduleId)
    .eq('visibility', 'public');

  if (lessonError) {
    throw new Error(`Unable to load module lessons: ${lessonError.message}`);
  }

  await ensureParentProfile(supabase, payload.creatorId, serviceSupabase);

  const assignmentTitle = payload.title && payload.title.trim().length
    ? payload.title.trim()
    : `${moduleRow.title} module focus`;

  // Guardrail: block assigning modules more than one unit ahead of the adaptive path when data is available.
  const learningPaths = await Promise.all(
    studentIds.map(async (studentId) => {
      const { data, error } = await supabase
        .from('student_profiles')
        .select('learning_path')
        .eq('id', studentId)
        .maybeSingle();
      if (error) {
        console.warn('[assignments] unable to read learning_path for guardrail', { studentId, error });
        return null;
      }
      return (data?.learning_path as unknown) ?? null;
    }),
  );

  const moduleSlug = moduleRow.slug as string;
  const guardrailBreaches = learningPaths.some((path) => {
    if (!Array.isArray(path)) return false;
    const normalized = path as Array<{ moduleSlug?: string | null; status?: string | null }>;
    const currentIndex = normalized.findIndex((item) => item.status === 'in_progress' || item.status === 'not_started');
    const targetIndex = normalized.findIndex((item) => item.moduleSlug === moduleSlug);
    if (targetIndex === -1 || currentIndex === -1) return false;
    return targetIndex - currentIndex > 1;
  });

  if (guardrailBreaches) {
    throw new HttpError(400, 'Assignment is too far ahead of the adaptive path.', 'too_far_ahead');
  }

  const { data: assignmentRow, error: assignmentError } = await supabase
    .from('assignments')
    .insert({
      title: assignmentTitle,
      description: `Module assignment for ${moduleRow.title}`,
      creator_id: payload.creatorId,
      status: 'published',
      due_at: payload.dueAt ?? null,
      metadata: {
        module_id: payload.moduleId,
        module_title: moduleRow.title,
        assigned_by_role: payload.creatorRole ?? 'parent',
        updated_by: payload.creatorId,
        updated_at: new Date().toISOString(),
        source: payload.creatorRole ?? 'parent',
      },
    })
    .select('id')
    .single();

  if (assignmentError || !assignmentRow) {
    throw new Error(
      assignmentError ? `Failed to create assignment: ${assignmentError.message}` : 'Assignment could not be created.',
    );
  }

  if ((lessonRows ?? []).length) {
    const lessonPayload = (lessonRows ?? []).map((lesson) => ({
      assignment_id: assignmentRow.id as number,
      lesson_id: lesson.id as number,
    }));

    const { error: attachError } = await supabase
      .from('assignment_lessons')
      .upsert(lessonPayload, { onConflict: 'assignment_id,lesson_id' });

    if (attachError) {
      throw new Error(`Failed to attach lessons: ${attachError.message}`);
    }
  }

  const studentPayload = studentIds.map((studentId) => ({
    assignment_id: assignmentRow.id as number,
    student_id: studentId,
    status: 'not_started',
    due_at: payload.dueAt ?? null,
    metadata: {
      module_id: payload.moduleId,
      module_title: moduleRow.title,
      updated_by: payload.creatorId,
      updated_at: new Date().toISOString(),
      source: payload.creatorRole ?? 'parent',
    },
    updated_by: payload.creatorId,
    audit_source: payload.creatorRole ?? 'parent',
  }));

  const { data: assignedRows, error: assignError } = await supabase
    .from('student_assignments')
    .upsert(studentPayload, { onConflict: 'assignment_id,student_id' })
    .select('id');

  if (assignError) {
    throw new Error(`Failed to assign module to learners: ${assignError.message}`);
  }

  try {
    await supabase.rpc('refresh_dashboard_rollups');
  } catch (rollupError) {
    console.warn('[api] Unable to refresh rollups after assignment', rollupError);
  }

  try {
    await notifyAssignmentCreated(serviceSupabase ?? supabase, {
      assignmentId: assignmentRow.id as number,
      assignmentTitle,
      moduleTitle: moduleRow.title as string,
      dueAt: payload.dueAt ?? null,
      studentIds,
      senderId: payload.creatorId,
    });
  } catch (notificationError) {
    console.warn('[api] Failed to enqueue assignment notifications', notificationError);
  }

  captureServerMessage('[assignments] module assigned', {
    assignmentId: assignmentRow.id,
    moduleId: payload.moduleId,
    studentCount: studentIds.length,
    creatorId: payload.creatorId,
    role: payload.creatorRole ?? 'parent',
  });

  return {
    assignmentId: assignmentRow.id as number,
    lessonsAttached: (lessonRows ?? []).length,
    assignedStudents: assignedRows?.length ?? studentIds.length,
  } satisfies { assignmentId: number; lessonsAttached: number; assignedStudents: number };
};

const ensureGuardianAccess = async (
  supabase: SupabaseClient,
  actor: AuthenticatedUser,
  studentIds: string[],
): Promise<void> => {
  if (actor.role !== 'parent') {
    return;
  }

  const results = await Promise.all(
    studentIds.map(async (studentId) => {
      const { data, error } = await supabase.rpc('is_guardian', { target_student: studentId });
      if (error) {
        throw new HttpError(
          500,
          `Unable to verify guardian status for learner ${studentId}: ${error.message}`,
          'guardian_lookup_failed',
        );
      }
      return data === true;
    }),
  );

  const unauthorized = studentIds.filter((_id, index) => results[index] !== true);
  if (unauthorized.length > 0) {
    captureServerMessage('[assignments] guardian check failed', {
      actorId: actor.id,
      unauthorized,
    }, 'warning');
    throw new HttpError(403, 'You can only assign modules to learners you manage.', 'forbidden');
  }
};

const sendJson = (res: ServerResponse, status: number, payload: unknown, version?: string) => {
  res.statusCode = status;
  if (version) {
    res.setHeader('X-API-Version', version);
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const sendError = (
  res: ServerResponse,
  status: number,
  message: string,
  code: string,
  version?: string,
  details?: unknown,
) => {
  sendJson(
    res,
    status,
    {
      error: {
        message,
        code,
        ...(details !== undefined ? { details } : {}),
      },
    },
    version,
  );
};

const parseApiPath = (
  pathname: string | undefined | null,
): { path: string; version: string } | null => {
  if (!pathname?.startsWith(API_PREFIX)) {
    return null;
  }

  if (pathname.startsWith(VERSIONED_PREFIX)) {
    const remainder = pathname.slice(VERSIONED_PREFIX.length) || '/';
    const path = remainder.startsWith('/') ? remainder : `/${remainder}`;
    return { path, version: API_VERSION };
  }

  const remainder = pathname.slice(API_PREFIX.length) || '/';
  const path = remainder.startsWith('/') ? remainder : `/${remainder}`;
  return { path, version: 'unversioned' };
};

const readJsonBody = async <T>(req: IncomingMessage): Promise<T> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    if (chunks.reduce((sum, part) => sum + part.length, 0) > 5 * 1024 * 1024) {
      throw new Error('Payload too large');
    }
  }
  if (chunks.length === 0) {
    return {} as T;
  }
  const body = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(body) as T;
};

const readValidatedJson = async <T>(req: IncomingMessage): Promise<T> => {
  try {
    return await readJsonBody<T>(req);
  } catch {
    throw new HttpError(400, 'Invalid JSON payload.', 'invalid_json');
  }
};

const readRawBody = async (req: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
};

const firstQueryValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const parseOptionalPositiveInt = (
  value: string | string[] | undefined,
  field: string,
  options?: { min?: number; max?: number; defaultValue?: number },
): number | undefined => {
  const raw = firstQueryValue(value);
  if (!raw?.trim()) {
    return options?.defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer.`, 'invalid_parameter');
  }
  const min = options?.min ?? 1;
  const max = options?.max;
  if (parsed < min) {
    throw new HttpError(400, `${field} must be at least ${min}.`, 'invalid_parameter');
  }
  if (max && parsed > max) {
    throw new HttpError(400, `${field} must be at most ${max}.`, 'invalid_parameter');
  }
  return parsed;
};

const parseOptionalNumber = (value: string | string[] | undefined, field: string): number | undefined => {
  const raw = firstQueryValue(value);
  if (raw === undefined) return undefined;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `${field} must be numeric.`, 'invalid_parameter');
  }
  return parsed;
};

const parseOptionalBoolean = (
  value: string | string[] | undefined,
  field: string,
): boolean | undefined => {
  const raw = firstQueryValue(value);
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  throw new HttpError(400, `${field} must be true or false.`, 'invalid_parameter');
};

const parseCsvList = (value: string | string[] | undefined, field: string): string[] | undefined => {
  const raw = firstQueryValue(value);
  if (!raw) return undefined;
  const items = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (items.length === 0) {
    throw new HttpError(400, `${field} cannot be empty.`, 'invalid_parameter');
  }
  return items;
};

const resolveClientIp = (req: IncomingMessage): string | null => {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'];
  if (typeof forwarded === 'string' && forwarded.length) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const remote = req.socket?.remoteAddress;
  if (typeof remote === 'string' && remote.length) {
    return remote;
  }
  return null;
};

const parseModuleFilters = (query: Record<string, string | string[] | undefined>): ModuleFilters => {
  const toOptionalString = (key: string) => {
    const value = firstQueryValue(query[key]);
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const allowedSorts = new Set([
    'featured',
    'title-asc',
    'title-desc',
    'grade-asc',
    'grade-desc',
  ]);

  const sortRaw = toOptionalString('sort');
  let sort: ModuleFilters['sort'] | undefined;
  if (sortRaw) {
    if (!allowedSorts.has(sortRaw as ModuleFilters['sort'])) {
      throw new HttpError(
        400,
        'sort must be one of featured, title-asc, title-desc, grade-asc, or grade-desc.',
        'invalid_parameter',
      );
    }
    sort = sortRaw as ModuleFilters['sort'];
  }

  const page = parseOptionalPositiveInt(query.page, 'page', { min: 1 }) ?? 1;
  const pageSize = parseOptionalPositiveInt(query.pageSize, 'pageSize', { min: 1, max: 50 }) ?? 12;

  return {
    subject: toOptionalString('subject'),
    grade: toOptionalString('grade'),
    strand: toOptionalString('strand'),
    topic: toOptionalString('topic'),
    standards: parseCsvList(query.standards, 'standards'),
    openTrack: parseOptionalBoolean(query.openTrack, 'openTrack'),
    sort: sort ?? 'featured',
    search: toOptionalString('search'),
    page,
    pageSize,
  };
};

const parsePositiveIntParam = (value: string | undefined, field: string): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer.`, 'invalid_parameter');
  }
  return parsed;
};

const resolveParentPlanSlug = async (supabase: SupabaseClient, parentId: string): Promise<string | null> => {
  if (await isBillingBypassed(supabase, parentId)) {
    return DEFAULT_PREMIUM_PLAN_SLUG;
  }
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plans ( slug )')
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) {
    console.warn('[billing] Failed to resolve parent plan', error);
    return null;
  }
  const plan = data?.plans as { slug?: string } | undefined;
  return plan?.slug ?? null;
};

const validateAssignmentPayload = (body: unknown): Omit<AssignModulePayload, 'creatorId' | 'creatorRole'> => {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'A JSON payload is required.', 'invalid_payload');
  }

  const payload = body as Record<string, unknown>;
  const moduleId = parsePositiveIntParam(String(payload.moduleId ?? ''), 'moduleId');

  if (!Array.isArray(payload.studentIds) || payload.studentIds.length === 0) {
    throw new HttpError(400, 'At least one studentId is required.', 'invalid_payload');
  }

  const studentIds = Array.from(
    new Set(
      payload.studentIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  );

  if (studentIds.length === 0) {
    throw new HttpError(400, 'At least one valid studentId is required.', 'invalid_payload');
  }

  let dueAt: string | null | undefined = undefined;
  if ('dueAt' in payload) {
    if (payload.dueAt === null) {
      dueAt = null;
    } else if (typeof payload.dueAt === 'string') {
      const trimmed = payload.dueAt.trim();
      if (trimmed.length > 0) {
        if (Number.isNaN(Date.parse(trimmed))) {
          throw new HttpError(400, 'dueAt must be a valid ISO-8601 date string.', 'invalid_payload');
        }
        dueAt = trimmed;
      } else {
        dueAt = null;
      }
    } else {
      throw new HttpError(400, 'dueAt must be a string value.', 'invalid_payload');
    }
  }

  const title =
    typeof payload.title === 'string' && payload.title.trim().length > 0
      ? payload.title.trim()
      : undefined;

  return {
    moduleId,
    studentIds,
    dueAt: dueAt ?? null,
    title,
  };
};

const requireUser = async (
  supabase: SupabaseClient,
  token: string | null,
  res: ServerResponse,
  sendErrorResponse: (status: number, message: string, code: string) => void,
  allowedRoles?: Array<AuthenticatedUser['role']>,
): Promise<AuthenticatedUser | null> => {
  if (!token) {
    sendErrorResponse(401, 'Authentication required.', 'unauthorized');
    return null;
  }

  const user = await resolveUserFromToken(supabase, token);
  if (!user) {
    sendErrorResponse(401, 'Authentication required.', 'unauthorized');
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    sendErrorResponse(403, 'You do not have permission to perform this action.', 'forbidden');
    return null;
  }

  return user;
};

const requireAdmin = async (
  supabase: SupabaseClient,
  token: string | null,
  res: ServerResponse,
  sendErrorResponse: (status: number, message: string, code: string) => void,
): Promise<AuthenticatedAdmin | null> => {
  if (!token) {
    sendErrorResponse(401, 'Authentication required.', 'unauthorized');
    return null;
  }

  const admin = await resolveAdminFromToken(supabase, token);
  if (!admin) {
    sendErrorResponse(403, 'Admin access required.', 'forbidden');
    return null;
  }

  return admin;
};

export const createApiHandler = (context: ApiContext) => {
  const { serviceSupabase } = context;

  const handleApiError = (
    res: ServerResponse,
    error: unknown,
    version: string,
    context?: Record<string, unknown>,
  ) => {
    if (error instanceof HttpError) {
      if (error.status >= 500) {
        captureServerException(error, context);
        console.error('[api] error', error);
      }
      sendError(res, error.status, error.message, error.code, version, error.details);
      return;
    }

    captureServerException(error, context);
    console.error('[api] error', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    sendError(res, 500, message, 'internal_error', version);
  };

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = parseUrl(req.url ?? '', true);
    const parsedPath = parseApiPath(url.pathname);
    if (!parsedPath) {
      return false;
    }

    res.setHeader('X-API-Version', API_VERSION);
    if (parsedPath.version === 'unversioned') {
      res.setHeader('X-API-Warning', 'Deprecated: migrate to /api/v1');
    }

    const method = (req.method ?? 'GET').toUpperCase();
    const path = parsedPath.path;
    const startTime = startTimer();
    let metricsRecorded = false;
    const recordMetrics = () => {
      if (metricsRecorded) {
        return;
      }
      metricsRecorded = true;
      recordApiTiming(method, path, res.statusCode ?? 0, elapsedMs(startTime));
    };
    const token = extractBearerToken(req);
    const supabase = createRlsClient(token ?? undefined);

    const sendErrorResponse = (status: number, message: string, code: string, details?: unknown) => {
      sendError(res, status, message, code, API_VERSION, details);
      recordMetrics();
    };

  const handleRoute = async (
    handler: () => Promise<void>,
    errorContext?: Record<string, unknown>,
  ): Promise<boolean> => {
    try {
        await handler();
      } catch (error) {
        handleApiError(res, error, API_VERSION, { route: path, method, ...errorContext });
      }
      recordMetrics();
      return true;
    };

    const resolveTutorPlanContext = async (
      actor: AuthenticatedUser | null,
    ): Promise<{ slug: string; limits: ReturnType<typeof getPlanLimits> }> => {
      const defaultPlan = 'individual-free';
      if (!actor) {
        return { slug: defaultPlan, limits: getPlanLimits(defaultPlan) };
      }

      const client = serviceSupabase ?? supabase;
      let parentId: string | null = null;

      if (actor.role === 'parent') {
        parentId = actor.id;
      } else if (actor.role === 'student') {
        const { data, error } = await client
          .from('student_profiles')
          .select('parent_id')
          .eq('id', actor.id)
          .maybeSingle();
        if (error) {
          console.warn('[api] unable to resolve parent for student', error);
        }
        parentId = (data?.parent_id as string | null) ?? null;
      }

      if (!parentId) {
        return { slug: defaultPlan, limits: getPlanLimits(defaultPlan) };
      }

      const planSlug = (await resolveParentPlanSlug(client, parentId)) ?? defaultPlan;
      return { slug: planSlug, limits: getPlanLimits(planSlug) };
    };

    if (method === 'POST' && path === '/ai/tutor') {
      return handleRoute(async () => {
        const body = await readValidatedJson<TutorRequestBody>(req);
        const actor = token ? await resolveUserFromToken(supabase, token) : null;

        const { slug: planSlug, limits } = await resolveTutorPlanContext(actor);

        if (process.env.ENFORCE_PLAN_LIMITS === 'true' && body.mode !== 'marketing' && !limits.aiAccess) {
          throw new HttpError(402, 'Upgrade required to access the AI assistant.', 'payment_required');
        }

        try {
          const result = await handleTutorRequest(body, supabase, {
            userId: actor?.id ?? null,
            role: actor?.role ?? null,
            clientIp: resolveClientIp(req),
            plan: { slug: planSlug, tutorDailyLimit: limits.tutorDailyLimit, aiAccess: limits.aiAccess },
          });
          sendJson(
            res,
            200,
            {
              message: result.message,
              model: result.model,
              remaining: result.remaining ?? null,
              limit: result.limit ?? null,
              plan: result.plan ?? planSlug,
            },
            API_VERSION,
          );
        } catch (error) {
          const status = (error as { status?: number }).status ?? 500;
          const message = error instanceof Error ? error.message : 'Assistant unavailable.';
          const level: Parameters<typeof captureServerMessage>[2] = status >= 500 ? 'error' : 'warning';
          captureServerMessage('[api] tutor request failed', { status, reason: message }, level);
          throw new HttpError(status, message, status >= 500 ? 'assistant_failure' : 'bad_request');
        }
      });
    }

    if (method === 'POST' && path === '/profile/tutor') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['student']);
      if (!actor) return true;

      return handleRoute(async () => {
        const body = await readValidatedJson<{ name?: string | null; avatarId?: string | null }>(req);
        const updates: Record<string, string | null> = {};

        if ('name' in body) {
          const rawName = typeof body.name === 'string' ? body.name.trim() : '';
          if (!rawName) {
            updates.tutor_name = null;
          } else {
            const result = validateTutorName(rawName);
            if (!result.ok) {
              throw new HttpError(400, tutorNameErrorMessage(result), 'invalid_tutor_name');
            }
            updates.tutor_name = result.value;
          }
        }

        if ('avatarId' in body) {
          const avatarId = typeof body.avatarId === 'string' ? body.avatarId : null;
          if (avatarId) {
            const avatar = findTutorAvatar(avatarId);
            if (!avatar) {
              throw new HttpError(400, 'Unknown tutor avatar option.', 'invalid_tutor_avatar');
            }
            updates.tutor_avatar_id = avatar.id;
          } else {
            updates.tutor_avatar_id = null;
          }
        }

        if (!Object.keys(updates).length) {
          throw new HttpError(400, 'Nothing to update.', 'invalid_payload');
        }

        const { error } = await supabase.from('student_profiles').update(updates).eq('id', actor.id);
        if (error) {
          throw new HttpError(500, 'Failed to update tutor preferences.', 'tutor_update_failed', error);
        }

        sendJson(
          res,
          200,
          {
            tutorName: 'tutor_name' in updates ? updates.tutor_name : undefined,
            tutorAvatarId: 'tutor_avatar_id' in updates ? updates.tutor_avatar_id : undefined,
          },
          API_VERSION,
        );
      });
    }

    if (method === 'POST' && path === '/profile/student-avatar') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['student']);
      if (!actor) return true;

      return handleRoute(async () => {
        const body = await readValidatedJson<{ avatarId?: string | null }>(req);
        const avatarId = typeof body.avatarId === 'string' ? body.avatarId.trim() : '';
        if (!avatarId) {
          throw new HttpError(400, 'avatarId is required.', 'invalid_avatar');
        }

        const avatar = findStudentAvatar(avatarId);
        if (!avatar) {
          throw new HttpError(400, 'Unknown avatar option.', 'invalid_avatar');
        }

        const { data: studentRow, error: studentError } = await supabase
          .from('student_profiles')
          .select('xp, streak_days')
          .eq('id', actor.id)
          .maybeSingle();

        if (studentError) {
          throw new HttpError(500, 'Failed to load student profile.', 'profile_load_failed', studentError);
        }

        if (!studentRow) {
          throw new HttpError(404, 'Student profile not found.', 'not_found');
        }

        const progress = {
          xp: (studentRow.xp as number | null) ?? 0,
          streakDays: (studentRow.streak_days as number | null) ?? 0,
        };

        if (!isStudentAvatarUnlocked(avatar, progress)) {
          throw new HttpError(
            403,
            'That avatar is locked. Keep up your streak or XP to unlock it.',
            'avatar_locked',
          );
        }

        const { error } = await supabase
          .from('student_profiles')
          .update({ student_avatar_id: avatar.id })
          .eq('id', actor.id);

        if (error) {
          throw new HttpError(500, 'Failed to update avatar.', 'avatar_update_failed', error);
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update({ avatar_url: avatar.id })
          .eq('id', actor.id);

        if (profileError) {
          console.warn('[api] profile avatar update failed', profileError);
        }

        sendJson(res, 200, { avatarId: avatar.id }, API_VERSION);
      });
    }

    if (method === 'GET' && path === '/avatars') {
      return handleRoute(async () => {
        const category =
          typeof url.query.category === 'string' && url.query.category.trim().length
            ? url.query.category.trim()
            : undefined;
        const avatars = await listAvatars(serviceSupabase ?? supabase, category ? { category } : undefined);
        sendJson(res, 200, { avatars }, API_VERSION);
      });
    }

    if (method === 'GET' && path === '/tutor_personas') {
      return handleRoute(async () => {
        const tutorPersonas = await listTutorPersonas(serviceSupabase ?? supabase);
        sendJson(res, 200, { tutorPersonas }, API_VERSION);
      });
    }

    if (path === '/student/preferences') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['student']);
      if (!actor) return true;

      if (method === 'GET') {
        return handleRoute(async () => {
          await ensureStudentProfileProvisioned(supabase, serviceSupabase ?? null, actor.id);
          const preferences = await fetchStudentPreferences(supabase, actor.id);
          sendJson(res, 200, { preferences }, API_VERSION);
        }, { actorId: actor.id });
      }

      if (method === 'PUT') {
        return handleRoute(async () => {
          await ensureStudentProfileProvisioned(supabase, serviceSupabase ?? null, actor.id);
          const body = await readValidatedJson<{
            avatarId?: string | null;
            tutorPersonaId?: string | null;
            optInAi?: boolean;
            goalFocus?: string | null;
            theme?: string | null;
          }>(req);

          const updates: Record<string, unknown> = {};

          if (typeof body.avatarId === 'string' && body.avatarId.trim().length > 0) {
            updates.avatar_id = body.avatarId.trim();
          }
          if (typeof body.tutorPersonaId === 'string' && body.tutorPersonaId.trim().length > 0) {
            updates.tutor_persona_id = body.tutorPersonaId.trim();
          }
          if (typeof body.optInAi === 'boolean') {
            updates.opt_in_ai = body.optInAi;
          }
          if (typeof body.goalFocus === 'string') {
            updates.goal_focus = body.goalFocus.trim();
          }
          if (typeof body.theme === 'string') {
            updates.theme = body.theme.trim();
          }

          if (!Object.keys(updates).length) {
            throw new HttpError(400, 'No preference fields provided.', 'invalid_payload');
          }

          const preferences = await saveStudentPreferences(supabase, actor.id, updates);
          sendJson(res, 200, { preferences }, API_VERSION);
        }, { actorId: actor.id });
      }
    }

    if (method === 'POST' && path === '/student/assessment/start') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['student']);
      if (!actor) return true;

      return handleRoute(async () => {
        const body = await readValidatedJson<{
          gradeBand?: string | null;
          fullName?: string | null;
          optInAi?: boolean;
          avatarId?: string | null;
          tutorPersonaId?: string | null;
        }>(req);
        const gradeBand = typeof body.gradeBand === 'string' ? body.gradeBand.trim() : null;
        const result = await startPlacementAssessment(supabase, actor.id, {
          gradeBand,
          fullName: typeof body.fullName === 'string' ? body.fullName.trim() : null,
          optInAi: typeof body.optInAi === 'boolean' ? body.optInAi : undefined,
          avatarId: typeof body.avatarId === 'string' ? body.avatarId.trim() : null,
          tutorPersonaId: typeof body.tutorPersonaId === 'string' ? body.tutorPersonaId.trim() : null,
          serviceSupabase,
        });
        sendJson(res, 200, result, API_VERSION);
      }, { actorId: actor.id });
    }

    if (method === 'POST' && path === '/student/assessment/submit') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['student']);
      if (!actor) return true;

      return handleRoute(async () => {
        const body = await readValidatedJson<{
          assessmentId?: number;
          attemptId?: number | null;
          responses?: Array<{ bankQuestionId?: number; optionId?: number | null; timeSpentSeconds?: number | null }>;
          goalFocus?: string | null;
          gradeBand?: string | null;
          fullName?: string | null;
          optInAi?: boolean;
          avatarId?: string | null;
          tutorPersonaId?: string | null;
        }>(req);

        if (!body.assessmentId || typeof body.assessmentId !== 'number' || !Number.isFinite(body.assessmentId)) {
          throw new HttpError(400, 'assessmentId is required.', 'invalid_payload');
        }

        const responses =
          Array.isArray(body.responses)
            ? body.responses
                .map((resp) => {
                  const bankQuestionId =
                    typeof resp.bankQuestionId === 'number' && Number.isFinite(resp.bankQuestionId)
                      ? resp.bankQuestionId
                      : null;
                  if (!bankQuestionId) return null;
                  return {
                    bankQuestionId,
                    optionId:
                      typeof resp.optionId === 'number' && Number.isFinite(resp.optionId) ? resp.optionId : null,
                    timeSpentSeconds:
                      typeof resp.timeSpentSeconds === 'number' && Number.isFinite(resp.timeSpentSeconds)
                        ? resp.timeSpentSeconds
                        : null,
                  };
                })
                .filter(Boolean)
            : [];

        const pathResult = await submitPlacementAssessment(
          supabase,
          actor.id,
          {
            assessmentId: body.assessmentId,
            attemptId: typeof body.attemptId === 'number' ? body.attemptId : null,
            responses,
            goalFocus: typeof body.goalFocus === 'string' ? body.goalFocus : null,
            gradeBand: typeof body.gradeBand === 'string' ? body.gradeBand : null,
            fullName: typeof body.fullName === 'string' ? body.fullName : null,
            optInAi: typeof body.optInAi === 'boolean' ? body.optInAi : undefined,
            avatarId: typeof body.avatarId === 'string' ? body.avatarId : null,
            tutorPersonaId: typeof body.tutorPersonaId === 'string' ? body.tutorPersonaId : null,
          },
          serviceSupabase,
        );

        sendJson(res, 200, pathResult, API_VERSION);
      }, { actorId: actor.id });
    }

    if (method === 'POST' && path === '/student/assessment/save') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['student']);
      if (!actor) return true;

      return handleRoute(async () => {
        const body = await readValidatedJson<{
          assessmentId?: number;
          attemptId?: number;
          bankQuestionId?: number;
          optionId?: number | null;
          timeSpentSeconds?: number | null;
        }>(req);

        if (!body.assessmentId || typeof body.assessmentId !== 'number' || !Number.isFinite(body.assessmentId)) {
          throw new HttpError(400, 'assessmentId is required.', 'invalid_payload');
        }
        if (!body.attemptId || typeof body.attemptId !== 'number' || !Number.isFinite(body.attemptId)) {
          throw new HttpError(400, 'attemptId is required.', 'invalid_payload');
        }
        if (!body.bankQuestionId || typeof body.bankQuestionId !== 'number' || !Number.isFinite(body.bankQuestionId)) {
          throw new HttpError(400, 'bankQuestionId is required.', 'invalid_payload');
        }

        const result = await savePlacementResponse(
          supabase,
          actor.id,
          {
            assessmentId: body.assessmentId,
            attemptId: body.attemptId,
            bankQuestionId: body.bankQuestionId,
            optionId: typeof body.optionId === 'number' ? body.optionId : null,
            timeSpentSeconds:
              typeof body.timeSpentSeconds === 'number' && Number.isFinite(body.timeSpentSeconds)
                ? body.timeSpentSeconds
                : null,
          },
          serviceSupabase,
        );

        sendJson(res, 200, result, API_VERSION);
      }, { actorId: actor.id });
    }

    if (method === 'GET' && path === '/student/path') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['student']);
      if (!actor) return true;

      return handleRoute(async () => {
        const pathResult = await getStudentPath(supabase, actor.id);
        const next = await selectNextEntry(supabase, actor.id);
        sendJson(res, 200, { path: pathResult, next }, API_VERSION);
      }, { actorId: actor.id });
    }

    if (method === 'POST' && path === '/student/event') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['student']);
      if (!actor) return true;

      return handleRoute(async () => {
        const body = await readValidatedJson<{
          eventType?: string;
          pathEntryId?: number | null;
          status?: string | null;
          score?: number | null;
          timeSpentSeconds?: number | null;
          accuracy?: number | null;
          difficulty?: number | null;
          basePoints?: number | null;
          payload?: Record<string, unknown> | null;
        }>(req);

        const eventType = typeof body.eventType === 'string' ? body.eventType.trim() : '';
        if (!eventType) {
          throw new HttpError(400, 'eventType is required.', 'invalid_payload');
        }

        const pathEntryId =
          typeof body.pathEntryId === 'number' && Number.isFinite(body.pathEntryId) && body.pathEntryId > 0
            ? body.pathEntryId
            : null;

        const normalizedStatus =
          body.status === 'completed' || body.status === 'in_progress' || body.status === 'not_started'
            ? body.status
            : eventType.toLowerCase().includes('complete')
              ? 'completed'
              : undefined;

        const score = typeof body.score === 'number' && Number.isFinite(body.score) ? body.score : null;
        const timeSpentSeconds =
          typeof body.timeSpentSeconds === 'number' && Number.isFinite(body.timeSpentSeconds) && body.timeSpentSeconds > 0
            ? Math.round(body.timeSpentSeconds)
            : null;

        const eventPayload =
          body.payload && typeof body.payload === 'object'
            ? body.payload
            : {};
        const enrichedPayload = {
          ...eventPayload,
          score,
          time_spent_s: timeSpentSeconds,
        };

        const eventResult = await recordLearningEvent(serviceSupabase ?? supabase, {
          studentId: actor.id,
          eventType,
          payload: enrichedPayload,
          basePoints:
            typeof body.basePoints === 'number' && Number.isFinite(body.basePoints) ? body.basePoints : undefined,
          accuracy: typeof body.accuracy === 'number' ? body.accuracy : undefined,
          difficulty: typeof body.difficulty === 'number' ? body.difficulty : undefined,
          pathEntryId,
        });

        const adaptive = await applyAdaptiveEvent(supabase, actor.id, {
          eventType,
          pathEntryId,
          status: normalizedStatus ?? null,
          score,
          timeSpentSeconds,
          payload: enrichedPayload,
        });

        const stats = await getStudentStats(supabase, actor.id);
        sendJson(res, 200, { event: eventResult, stats, path: adaptive.path, next: adaptive.next, adaptive: adaptive.adaptive }, API_VERSION);
      }, { actorId: actor.id });
    }

    if (method === 'GET' && path === '/student/stats') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['student']);
      if (!actor) return true;

      return handleRoute(async () => {
        const stats = await getStudentStats(supabase, actor.id);
        sendJson(res, 200, { stats }, API_VERSION);
      }, { actorId: actor.id });
    }

    if (method === 'GET' && path === '/student/tutor-context') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['student']);
      if (!actor) return true;

      return handleRoute(async () => {
        const context = await buildTutorContext(supabase, actor.id);
        sendJson(res, 200, { context }, API_VERSION);
      }, { actorId: actor.id });
    }

    if (method === 'GET' && path === '/parent/overview') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['parent']);
      if (!actor) return true;

      return handleRoute(async () => {
        const overview = await getParentOverview(supabase, actor.id);
        sendJson(res, 200, overview, API_VERSION);
      }, { actorId: actor.id });
    }

    if (method === 'GET' && path === '/recommendations') {
      return handleRoute(async () => {
        const moduleId = parseOptionalPositiveInt(url.query.moduleId, 'moduleId');
        if (!moduleId) {
          throw new HttpError(400, 'moduleId query parameter is required.', 'invalid_parameter');
        }

        const lastScore = parseOptionalNumber(url.query.lastScore, 'lastScore');
        const { recommendations } = await getRecommendations(supabase, moduleId, lastScore);
        sendJson(res, 200, { recommendations }, API_VERSION);
      });
    }

    if (method === 'GET' && path === '/billing/context') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['parent', 'student']);
      if (!actor) return true;

      return handleRoute(async () => {
        const { slug: planSlug, limits } = await resolveTutorPlanContext(actor);
        const { data: planRow } = await serviceSupabase
          .from('plans')
          .select('slug, name, price_cents, metadata, status')
          .eq('slug', planSlug)
          .maybeSingle();

        let subscriptionOwner = actor.role === 'parent' ? actor.id : null;
        if (!subscriptionOwner && actor.role === 'student') {
          const { data: parentRow, error: parentError } = await serviceSupabase
            .from('student_profiles')
            .select('parent_id')
            .eq('id', actor.id)
            .maybeSingle();
          if (parentError) {
            console.warn('[billing] unable to resolve parent for student context', parentError);
          }
          subscriptionOwner = (parentRow?.parent_id as string | null) ?? null;
        }

        let subscription: {
          id: number;
          status: string;
          plan: { slug: string; name: string; priceCents: number; metadata: Record<string, unknown> } | null;
          trialEndsAt: string | null;
          currentPeriodEnd: string | null;
          cancelAt: string | null;
          metadata: Record<string, unknown>;
        } | null = null;

        if (subscriptionOwner) {
          const { data: subscriptionRow, error: subscriptionError } = await serviceSupabase
            .from('subscriptions')
            .select('id, status, trial_ends_at, current_period_end, cancel_at, metadata, plans ( slug, name, price_cents, metadata )')
            .eq('parent_id', subscriptionOwner)
            .maybeSingle();

          if (subscriptionError) {
            console.warn('[billing] unable to load subscription for context', subscriptionError);
          }

          if (subscriptionRow) {
            subscription = {
              id: subscriptionRow.id as number,
              status: subscriptionRow.status as string,
              plan: subscriptionRow.plans
                ? {
                    slug: (subscriptionRow.plans as { slug: string }).slug,
                    name: (subscriptionRow.plans as { name: string }).name,
                    priceCents: (subscriptionRow.plans as { price_cents: number }).price_cents,
                    metadata: (subscriptionRow.plans as { metadata: Record<string, unknown> }).metadata ?? {},
                  }
                : null,
              trialEndsAt: (subscriptionRow.trial_ends_at as string | null) ?? null,
              currentPeriodEnd: (subscriptionRow.current_period_end as string | null) ?? null,
              cancelAt: (subscriptionRow.cancel_at as string | null) ?? null,
              metadata: (subscriptionRow.metadata as Record<string, unknown>) ?? {},
            };
          }
        }

        sendJson(
          res,
          200,
          {
            plan: planRow
              ? {
                  slug: planRow.slug,
                  name: planRow.name,
                  priceCents: planRow.price_cents,
                  metadata: planRow.metadata ?? {},
                  status: planRow.status,
                }
              : {
                  slug: planSlug,
                  name: planSlug === 'individual-free' ? 'Free' : planSlug,
                  priceCents: 0,
                  metadata: {},
                  status: 'active',
                },
            limits,
            subscription,
            billingRequired: await isBillingRequired(supabase, subscriptionOwner),
          },
          API_VERSION,
        );
      });
    }

    if (method === 'GET' && path === '/billing/plans') {
      return handleRoute(async () => {
        const { data, error } = await serviceSupabase
          .from('plans')
          .select('slug, name, price_cents, metadata, status')
          .eq('status', 'active');

        if (error) {
          throw new HttpError(500, `Unable to load plans: ${error.message}`, 'plan_load_failed');
        }

        const allPlans =
          (data ?? []).map((plan) => ({
            slug: plan.slug,
            name: plan.name,
            priceCents: plan.price_cents,
            metadata: plan.metadata ?? {},
            status: plan.status,
          })) ?? [];

        const individualPlans = allPlans.filter((plan) => plan.slug.startsWith('individual-'));
        const plans = individualPlans.length > 0 ? individualPlans : allPlans;

        sendJson(
          res,
          200,
          { plans },
          API_VERSION,
        );
      });
    }

    if (method === 'GET' && path === '/billing/summary') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['parent']);
      if (!actor) return true;

      return handleRoute(async () => {
        const summary = await fetchBillingSummary(supabase, actor.id, serviceSupabase);
        const billingRequired = await isBillingRequired(supabase, actor.id);
        sendJson(res, 200, { ...summary, billingRequired }, API_VERSION);
      });
    }

    if (method === 'POST' && path === '/billing/checkout') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['parent']);
      if (!actor) return true;

      return handleRoute(async () => {
        const stripe = getStripeClient();
        if (!stripe) {
          throw new HttpError(501, 'Billing is not configured.', 'billing_disabled');
        }

        const body = await readValidatedJson<{ planSlug?: string; successUrl?: string; cancelUrl?: string }>(req);
        if (!body.planSlug) {
          throw new HttpError(400, 'planSlug is required.', 'invalid_payload');
        }

        const bypassed = await isBillingBypassed(supabase, actor.id);
        if (bypassed || isBillingSandboxMode()) {
          await grantBypassSubscription(
            serviceSupabase,
            actor.id,
            body.planSlug,
            isBillingSandboxMode() ? 'sandbox' : 'bypass',
          );
          sendJson(res, 200, { checkoutUrl: body.successUrl ?? `${APP_BASE_URL}/parent` }, API_VERSION);
          return;
        }

        const url = await createCheckoutSessionForPlan(serviceSupabase, stripe, actor.id, body.planSlug, {
          successUrl: body.successUrl,
          cancelUrl: body.cancelUrl,
        });

        sendJson(res, 200, { checkoutUrl: url }, API_VERSION);
      });
    }

    if (method === 'POST' && path === '/billing/portal') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['parent']);
      if (!actor) return true;

      return handleRoute(async () => {
        const bypassed = await isBillingBypassed(supabase, actor.id);
        if (bypassed || isBillingSandboxMode()) {
          const body = await readValidatedJson<{ returnUrl?: string }>(req);
          const portalUrl = body.returnUrl ?? `${APP_BASE_URL}/parent`;
          sendJson(res, 200, { portalUrl }, API_VERSION);
          return;
        }

        const stripe = getStripeClient();
        if (!stripe) {
          throw new HttpError(501, 'Billing is not configured.', 'billing_disabled');
        }

        const { data: subscription } = await serviceSupabase
          .from('subscriptions')
          .select('metadata')
          .eq('parent_id', actor.id)
          .maybeSingle();

        const customerId =
          (subscription?.metadata as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null;
        if (!customerId) {
          throw new HttpError(400, 'No billing customer found. Start a checkout first.', 'missing_customer');
        }

        const body = await readValidatedJson<{ returnUrl?: string }>(req);
        const portalUrl = await createPortalSession(stripe, customerId, body.returnUrl);
        sendJson(res, 200, { portalUrl }, API_VERSION);
      });
    }

    if (method === 'POST' && path === '/billing/webhook') {
      return handleRoute(async () => {
        if (isBillingSandboxMode()) {
          sendJson(res, 200, { received: true, sandbox: true }, API_VERSION);
          return;
        }
        const stripe = getStripeClient();
        const webhookSecret = getStripeWebhookSecret();
        if (!stripe || !webhookSecret) {
          throw new HttpError(501, 'Billing is not configured.', 'billing_disabled');
        }

        const rawBody = await readRawBody(req);
        const signature = req.headers['stripe-signature'];
        if (!signature || typeof signature !== 'string') {
          throw new HttpError(400, 'Missing Stripe signature header.', 'invalid_signature');
        }

        let event;
        try {
          event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        } catch (error) {
          throw new HttpError(400, error instanceof Error ? error.message : 'Invalid signature.', 'invalid_signature');
        }

        try {
          await handleStripeEvent(serviceSupabase, stripe, event);
          captureServerMessage('[billing] webhook processed', { eventType: event?.type, eventId: event?.id });
        } catch (error) {
          captureServerException(error, {
            source: 'billing_webhook',
            eventType: event?.type,
            eventId: event?.id,
          });
          raiseAlert('billing_webhook_failed', { eventType: event?.type, eventId: event?.id });
          const message = error instanceof Error ? error.message : 'Billing webhook failed.';
          throw new HttpError(500, message, 'billing_webhook_failed');
        }
        sendJson(res, 200, { received: true }, API_VERSION);
      });
    }

    if (method === 'POST' && path === '/assignments/assign') {
      const actor = await requireUser(supabase, token, res, sendErrorResponse, ['parent', 'admin']);
      if (!actor) {
        return true;
      }

      return handleRoute(
        async () => {
          const body = await readValidatedJson<AssignModulePayload>(req);
          const validated = validateAssignmentPayload(body);
          await ensureGuardianAccess(supabase, actor, validated.studentIds);

          const result = await createModuleAssignment(
            supabase,
            {
              ...validated,
              creatorId: actor.id,
              creatorRole: actor.role === 'admin' ? 'admin' : 'parent',
            },
            serviceSupabase,
          );
          sendJson(res, 200, result, API_VERSION);
        },
        { actorId: actor.id },
      );
    }

    if (method === 'GET' && path === '/modules') {
      return handleRoute(async () => {
        const filters = parseModuleFilters(url.query);
        // Use service role client so public catalog reads aren’t blocked by RLS.
        const result = await listModules(serviceSupabase, filters);
        sendJson(res, 200, result, API_VERSION);
      });
    }

    if (method === 'GET' && path.startsWith('/lessons/')) {
      return handleRoute(async () => {
        const parts = path.split('/').filter(Boolean);
        if (parts.length !== 2) {
          throw new HttpError(404, 'Not found.', 'not_found');
        }
        const lessonId = parsePositiveIntParam(parts[1], 'lessonId');
        const detail = await getLessonDetail(serviceSupabase, lessonId);
        if (!detail) {
          throw new HttpError(404, 'Lesson not found.', 'not_found');
        }
        sendJson(res, 200, { lesson: detail }, API_VERSION);
      });
    }

    if (path.startsWith('/admins')) {
      const admin = await requireAdmin(supabase, token, res, sendErrorResponse);
      if (!admin) {
        return true;
      }

      if (method === 'GET' && path === '/admins') {
        return handleRoute(async () => {
          const admins = await listAdmins(serviceSupabase);
          sendJson(res, 200, { admins }, API_VERSION);
        });
      }

      if (method === 'POST' && path === '/admins/promote') {
        return handleRoute(async () => {
          const body = await readValidatedJson<{
            email?: string;
            userId?: string;
            title?: string;
            permissions?: unknown;
          }>(req);

          const permissions = Array.isArray(body.permissions)
            ? body.permissions.filter((item): item is string => typeof item === 'string')
            : undefined;

          try {
            const promoted = await promoteUserToAdmin(
              serviceSupabase,
              { email: body.email, userId: body.userId },
              { title: body.title, permissions },
            );
            sendJson(res, 200, { admin: promoted }, API_VERSION);
          } catch (error) {
            throw new HttpError(
              400,
              error instanceof Error ? error.message : 'Unable to promote admin user.',
              'invalid_payload',
            );
          }
        });
      }

      if (method === 'POST' && path === '/admins/demote') {
        return handleRoute(async () => {
          const body = await readValidatedJson<{ userId?: string; targetRole?: string }>(req);
          if (!body.userId || typeof body.userId !== 'string') {
            throw new HttpError(400, 'userId is required to demote an admin.', 'invalid_payload');
          }
          const targetRole = body.targetRole === 'student' ? 'student' : 'parent';

          try {
            const result = await demoteAdmin(serviceSupabase, body.userId, targetRole);
            sendJson(
              res,
              200,
              {
                demoted: result.id,
                role: result.role,
                remainingAdmins: result.remainingAdmins,
              },
              API_VERSION,
            );
          } catch (error) {
            throw new HttpError(
              400,
              error instanceof Error ? error.message : 'Unable to demote admin user.',
              'invalid_payload',
            );
          }
        });
      }

      if (method === 'GET' && path === '/admins/tutor-reports') {
        return handleRoute(async () => {
          const status = parseReportStatus(typeof url.query.status === 'string' ? url.query.status : undefined);
          const limit =
            typeof url.query.limit === 'string' && !Number.isNaN(Number(url.query.limit))
              ? Number(url.query.limit)
              : 50;
          const reports = await listTutorReports(serviceSupabase, { status, limit });
          sendJson(res, 200, { reports }, API_VERSION);
        });
      }

      if (method === 'POST' && path === '/admins/tutor-reports/update') {
        return handleRoute(async () => {
          const body = await readValidatedJson<{ id?: number; status?: string }>(req);
          if (typeof body.id !== 'number' || body.id <= 0) {
            throw new HttpError(400, 'id is required to update a tutor report.', 'invalid_payload');
          }
          const status = parseReportStatus(body.status);
          if (!status) {
            throw new HttpError(400, 'status is required.', 'invalid_payload');
          }
          const updated = await updateTutorReportStatus(serviceSupabase, body.id, status, admin.id);
          sendJson(res, 200, { report: updated }, API_VERSION);
        });
      }

      if (method === 'GET' && path === '/admins/ops-metrics') {
        return handleRoute(async () => {
          const windowMs =
            typeof url.query.windowMs === 'string' && !Number.isNaN(Number(url.query.windowMs))
              ? Number(url.query.windowMs)
              : undefined;
          const snapshot = getOpsSnapshot(windowMs);
          sendJson(res, 200, snapshot, API_VERSION);
        });
      }

      if (method === 'POST' && path === '/admins/platform-config') {
        return handleRoute(async () => {
          const body = await readValidatedJson<{ key?: string; value?: unknown }>(req);
          const key = typeof body.key === 'string' && body.key.trim().length ? body.key.trim() : null;
          if (!key) {
            throw new HttpError(400, 'key is required', 'invalid_payload');
          }
          try {
            await serviceSupabase
              .from('platform_config')
              .upsert({ key, value: body.value ?? null, updated_at: new Date().toISOString() }, { onConflict: 'key' });
          } catch (error) {
            console.warn('[admin] unable to persist platform_config', error);
            throw new HttpError(500, 'Unable to save config', 'config_error');
          }
          sendJson(res, 200, { ok: true }, API_VERSION);
        });
      }

      if (method === 'GET' && path === '/admins/platform-config') {
        return handleRoute(async () => {
          const rawKeys = typeof url.query.keys === 'string' ? url.query.keys : null;
          if (!rawKeys) {
            throw new HttpError(400, 'keys is required (comma-separated)', 'invalid_payload');
          }
          const keys = rawKeys.split(',').map((entry) => entry.trim()).filter(Boolean);
          if (!keys.length) {
            throw new HttpError(400, 'keys is required (comma-separated)', 'invalid_payload');
          }
          const { data, error } = await serviceSupabase
            .from('platform_config')
            .select('key, value')
            .in('key', keys);
          if (error) {
            throw new HttpError(500, 'Unable to load config', 'config_error');
          }
          const map: Record<string, unknown> = {};
          (data ?? []).forEach((row) => {
            map[(row.key as string) ?? ''] = row.value;
          });
          sendJson(res, 200, { config: map }, API_VERSION);
        });
      }

      if (method === 'GET' && path === '/admins/account-deletion/requests') {
        return handleRoute(async () => {
          const { data, error } = await serviceSupabase
            .from('account_deletion_requests')
            .select('id, requester_id, scope, include_student_ids, reason, contact_email, status, metadata, created_at')
            .order('created_at', { ascending: false })
            .limit(50);

          if (error) {
            throw new HttpError(500, 'Unable to load deletion requests', 'account_deletion_load_failed');
          }

          const requests = (data ?? []).map((row) => ({
            id: (row as { id: number }).id,
            requesterId: (row as { requester_id: string }).requester_id,
            scope: (row as { scope: string }).scope,
            includeStudentIds: (row as { include_student_ids: string[] }).include_student_ids ?? [],
            reason: (row as { reason?: string | null }).reason ?? null,
            contactEmail: (row as { contact_email?: string | null }).contact_email ?? null,
            status: (row as { status: string }).status,
            metadata: (row as { metadata?: Record<string, unknown> | null }).metadata ?? {},
            createdAt: (row as { created_at: string }).created_at,
          }));

          sendJson(res, 200, { requests }, API_VERSION);
        });
      }

      if (method === 'POST' && path === '/admins/account-deletion/requests/resolve') {
        return handleRoute(async () => {
          const body = await readValidatedJson<{ id?: number; status?: string }>(req);
          if (!body.id || typeof body.id !== 'number') {
            throw new HttpError(400, 'id is required.', 'invalid_payload');
          }

          const nextStatus = body.status === 'completed' ? 'completed' : body.status === 'canceled' ? 'canceled' : null;
          if (!nextStatus) {
            throw new HttpError(400, 'status must be completed or canceled.', 'invalid_payload');
          }

          const { data: requestRow, error: loadError } = await serviceSupabase
            .from('account_deletion_requests')
            .select('id, requester_id, scope, include_student_ids, reason, contact_email, status, metadata, created_at')
            .eq('id', body.id)
            .maybeSingle();

          if (loadError) {
            throw new HttpError(500, 'Unable to load deletion request', 'account_deletion_load_failed');
          }
          if (!requestRow) {
            throw new HttpError(404, 'Deletion request not found.', 'not_found');
          }
          if ((requestRow as { status: string }).status === nextStatus) {
            sendJson(res, 200, { request: requestRow }, API_VERSION);
            return;
          }

          let stripeCanceled = false;
          if (nextStatus === 'completed') {
            const { data: requesterProfile, error: profileError } = await serviceSupabase
              .from('profiles')
              .select('role')
              .eq('id', (requestRow as { requester_id: string }).requester_id)
              .maybeSingle();

            if (profileError) {
              console.warn('[admin] failed to load profile for deletion', profileError);
            }

            if ((requesterProfile as { role?: string } | null)?.role === 'parent') {
              const result = await cancelParentSubscriptionForDeletion(
                serviceSupabase,
                (requestRow as { requester_id: string }).requester_id,
              );
              stripeCanceled = result.stripeCanceled;
            }
          }

          const { data: updated, error: updateError } = await serviceSupabase
            .from('account_deletion_requests')
            .update({
              status: nextStatus,
              metadata: {
                ...(requestRow as { metadata?: Record<string, unknown> }).metadata ?? {},
                resolved_by: admin.id,
                resolved_at: new Date().toISOString(),
                stripeCanceled,
              },
            })
            .eq('id', body.id)
            .select('id, requester_id, scope, include_student_ids, reason, contact_email, status, metadata, created_at')
            .maybeSingle();

          if (updateError || !updated) {
            throw new HttpError(500, 'Unable to update deletion request', 'account_deletion_update_failed');
          }

          try {
            await serviceSupabase.from('admin_audit_logs').insert({
              admin_id: admin.id,
              event_type: 'account_deletion_request_resolved',
              metadata: {
                requestId: body.id,
                status: nextStatus,
                stripeCanceled,
              },
            });
          } catch (auditError) {
            console.warn('[admin] failed to write audit log for deletion resolve', auditError);
          }

          sendJson(res, 200, { request: updated }, API_VERSION);
        });
      }

      if (method === 'POST' && path === '/admins/account-deletion/process') {
        return handleRoute(async () => {
          const result = await processPendingAccountDeletionRequests(serviceSupabase);
          sendJson(res, 200, { result }, API_VERSION);
        });
      }

      sendErrorResponse(404, 'Not found.', 'not_found');
      return true;
    }

    if (path.startsWith('/import/')) {
      const admin = await requireAdmin(supabase, token, res, sendErrorResponse);
      if (!admin) {
        return true;
      }

      if (method === 'GET' && path === '/import/providers') {
        return handleRoute(async () => {
          const providers = IMPORT_PROVIDERS.map((provider) => ({
            id: provider.id,
            label: provider.label,
            description: provider.description,
            samplePath: provider.samplePath ?? null,
            importKind: provider.importKind,
            defaultLicense: provider.defaultLicense,
            notes: provider.notes ?? null,
          }));
          sendJson(res, 200, { providers }, API_VERSION);
        });
      }

      if (method === 'GET' && path === '/import/runs') {
        return handleRoute(async () => {
          const runs = await fetchImportRuns(supabase, 25);
          sendJson(res, 200, { runs: runs.map(toApiModel) }, API_VERSION);
        });
      }

      if (method === 'GET' && path.startsWith('/import/runs/')) {
        return handleRoute(async () => {
          const parts = path.split('/').filter(Boolean);
          if (parts.length !== 3) {
            throw new HttpError(404, 'Not found.', 'not_found');
          }
          const runId = parsePositiveIntParam(parts[2], 'Import run id');
          const run = await fetchImportRunById(supabase, runId);
          if (!run) {
            throw new HttpError(404, 'Import run not found.', 'not_found');
          }
          sendJson(res, 200, { run: toApiModel(run) }, API_VERSION);
        });
      }

      if (method === 'POST' && path === '/import/runs') {
        type CreateRunBody = {
          provider?: string;
          mapping?: Record<string, unknown>;
          dataset?: Record<string, unknown>;
          input?: Record<string, unknown>;
          fileName?: string;
          notes?: string;
          dryRun?: boolean;
          limits?: Record<string, unknown>;
        };

        return handleRoute(async () => {
          const body = await readValidatedJson<CreateRunBody>(req);
          if (!body.provider || !isImportProviderId(body.provider)) {
            throw new HttpError(400, 'Valid provider is required.', 'invalid_payload');
          }

          const provider = body.provider as ImportProviderId;
          const providerDefinition = IMPORT_PROVIDER_MAP.get(provider);
          if (!providerDefinition) {
            throw new HttpError(400, `Provider "${provider}" is not supported.`, 'invalid_payload');
          }

          const limits = normalizeImportLimits(body.limits);
          const hasLimits = Boolean(limits.maxAssets || limits.maxModules);

          const inputPayload: Record<string, unknown> = {
            provider,
            fileName: typeof body.fileName === 'string' ? body.fileName : null,
            mapping: body.mapping && typeof body.mapping === 'object' ? body.mapping : null,
            dataset: body.dataset && typeof body.dataset === 'object' ? body.dataset : null,
            extraInput: body.input && typeof body.input === 'object' ? body.input : null,
            notes: typeof body.notes === 'string' ? body.notes : null,
            dryRun: body.dryRun === true,
            limits: hasLimits ? limits : undefined,
          };

          const limitSummary: string[] = [];
          if (limits.maxModules) {
            limitSummary.push(`modules<=${limits.maxModules}`);
          }
          if (limits.maxAssets) {
            limitSummary.push(`assets<=${limits.maxAssets}`);
          }

          const run = await createImportRun(serviceSupabase, {
            source: provider,
            status: 'pending',
            input: inputPayload,
            triggered_by: admin.id,
            logs: [
              {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: `Queued ${providerDefinition.label} import${body.dryRun ? ' (dry run)' : ''}${limitSummary.length ? ` with limits: ${limitSummary.join(', ')}` : ''}.`,
              },
            ],
          });

          sendJson(res, 201, { run: toApiModel(run) }, API_VERSION);
        });
      }

      if (method === 'POST' && path === '/import/openstax') {
        return handleRoute(async () => {
          const body = await readValidatedJson<{ mapping: OpenStaxMapping }>(req);
          if (!body.mapping || typeof body.mapping !== 'object') {
            throw new HttpError(400, 'mapping payload is required.', 'invalid_payload');
          }
          const inserted = await importOpenStaxMapping(serviceSupabase, body.mapping);
          sendJson(res, 200, { inserted }, API_VERSION);
        });
      }

      if (method === 'POST' && path === '/import/gutenberg') {
        return handleRoute(async () => {
          const body = await readValidatedJson<{ mapping: GutenbergMapping }>(req);
          if (!body.mapping || typeof body.mapping !== 'object') {
            throw new HttpError(400, 'mapping payload is required.', 'invalid_payload');
          }
          const inserted = await importGutenbergMapping(serviceSupabase, body.mapping);
          sendJson(res, 200, { inserted }, API_VERSION);
        });
      }

      if (method === 'POST' && path === '/import/federal') {
        return handleRoute(async () => {
          const body = await readValidatedJson<{ mapping: FederalMapping }>(req);
          if (!body.mapping || typeof body.mapping !== 'object') {
            throw new HttpError(400, 'mapping payload is required.', 'invalid_payload');
          }
          const inserted = await importFederalMapping(serviceSupabase, body.mapping);
          sendJson(res, 200, { inserted }, API_VERSION);
        });
      }

      sendErrorResponse(404, 'Not found.', 'not_found');
      return true;
    }

    if (method === 'GET' && path.startsWith('/modules/') && path.endsWith('/assessment')) {
      return handleRoute(async () => {
        const parts = path.split('/').filter(Boolean);
        if (parts.length !== 3) {
          throw new HttpError(404, 'Not found.', 'not_found');
        }
        const moduleId = parsePositiveIntParam(parts[1], 'Module id');
        const detail = await getModuleAssessment(serviceSupabase, moduleId);
        if (!detail) {
          throw new HttpError(404, 'Module assessment not found.', 'not_found');
        }
        sendJson(res, 200, detail, API_VERSION);
      });
    }

    if (method === 'GET' && path.startsWith('/modules/')) {
      return handleRoute(async () => {
        const parts = path.split('/').filter(Boolean);
        if (parts.length !== 2) {
          throw new HttpError(404, 'Not found.', 'not_found');
        }
        const moduleId = parsePositiveIntParam(parts[1], 'Module id');
        // Use service role client so public catalog reads aren’t blocked by RLS.
        const detail = await getModuleDetail(serviceSupabase, moduleId);
        if (!detail) {
          throw new HttpError(404, 'Module not found.', 'not_found');
        }
        sendJson(res, 200, detail, API_VERSION);
      });
    }

    sendErrorResponse(404, 'Not found.', 'not_found');
    return true;
  };
};

export const startApiServer = (
  port = Number.parseInt(process.env.PORT ?? '8787', 10),
  options: ApiServerOptions = {},
) => {
  const serviceSupabase = createServiceRoleClient();
  const handler = createApiHandler({ serviceSupabase });
  const shouldStartQueue =
    options.startImportQueue ??
    (process.env.ENABLE_INLINE_IMPORT_QUEUE === 'true' || process.env.NODE_ENV !== 'production');
  const queue = shouldStartQueue
    ? new ImportQueue(serviceSupabase, {
        logger: (entry) => {
          const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
          console.log(`[import-queue] ${entry.level}: ${entry.message}${context}`);
          if (entry.level === 'error' || entry.level === 'warn') {
            captureServerMessage(entry.message, { source: 'importQueue', context: entry.context }, entry.level === 'error' ? 'error' : 'warning');
          }
        },
      })
    : null;
  const notifier = new NotificationScheduler(serviceSupabase, { pollIntervalMs: 2 * 60 * 1000 });

  const server = createServer(async (req, res) => {
    const handled = await withRequestScope(req, () => handler(req, res));
    if (!handled) {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    console.log(`ElevatED API listening on http://localhost:${port}`);
  });

  if (queue) {
    queue.start();
  } else {
    console.log('[import-queue] Inline import worker disabled. Run server/importWorker.ts separately for ingestion.');
  }
  notifier.start();

  return {
    server,
    queue,
    notifier,
    close: () => {
      queue?.stop();
      notifier.stop();
      server.close();
    },
  };
};
