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
import { captureServerException, captureServerMessage, withRequestScope } from './monitoring.js';
import { normalizeImportLimits } from './importSafety.js';

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
    .select('id, title')
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
    },
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
        throw new Error(`Unable to verify guardian status for learner ${studentId}: ${error.message}`);
      }
      return data === true;
    }),
  );

  const unauthorized = studentIds.filter((_id, index) => results[index] !== true);
  if (unauthorized.length > 0) {
    throw new Error('You can only assign modules to learners you manage.');
  }
};

const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
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

const parseNumber = (value: string | undefined | string[]): number | null => {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
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

const createFilters = (query: Record<string, string | string[] | undefined>): ModuleFilters => {
  const toStringValue = (key: string) => {
    const value = query[key];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  };

  const toNumber = (key: string) => {
    const value = query[key];
    if (!value) return undefined;
    const parsed = parseNumber(value);
    return parsed != null ? Math.max(1, Math.floor(parsed)) : undefined;
  };

  const toBoolean = (key: string) => {
    const value = toStringValue(key);
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
    return undefined;
  };

  const toStringArray = (key: string) => {
    const value = query[key];
    if (!value) return undefined;
    const raw = Array.isArray(value) ? value.join(',') : value;
    const items = raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return items.length > 0 ? items : undefined;
  };

  return {
    subject: toStringValue('subject'),
    grade: toStringValue('grade'),
    strand: toStringValue('strand'),
    topic: toStringValue('topic'),
    standards: toStringArray('standards'),
    openTrack: toBoolean('openTrack'),
    sort: toStringValue('sort'),
    search: toStringValue('search'),
    page: toNumber('page'),
    pageSize: toNumber('pageSize'),
  };
};

const requireUser = async (
  supabase: SupabaseClient,
  token: string | null,
  res: ServerResponse,
  allowedRoles?: Array<AuthenticatedUser['role']>,
): Promise<AuthenticatedUser | null> => {
  if (!token) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return null;
  }

  const user = await resolveUserFromToken(supabase, token);
  if (!user) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    sendJson(res, 403, { error: 'You do not have permission to perform this action.' });
    return null;
  }

  return user;
};

const requireAdmin = async (
  supabase: SupabaseClient,
  token: string | null,
  res: ServerResponse,
): Promise<AuthenticatedAdmin | null> => {
  if (!token) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return null;
  }

  const admin = await resolveAdminFromToken(supabase, token);
  if (!admin) {
    sendJson(res, 403, { error: 'Admin access required.' });
    return null;
  }

  return admin;
};

export const createApiHandler = (context: ApiContext) => {
  const { serviceSupabase } = context;

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = parseUrl(req.url ?? '', true);
    if (!url.pathname?.startsWith('/api/')) {
      return false;
    }

    try {
      const token = extractBearerToken(req);
      const supabase = createRlsClient(token ?? undefined);

      if (req.method === 'POST' && url.pathname === '/api/ai/tutor') {
        const body = await readJsonBody<TutorRequestBody>(req);
        const actor = token ? await resolveUserFromToken(supabase, token) : null;

        try {
          const result = await handleTutorRequest(body, supabase, {
            userId: actor?.id ?? null,
            role: actor?.role ?? null,
            clientIp: resolveClientIp(req),
          });
          sendJson(res, 200, { message: result.message, model: result.model });
        } catch (error) {
          const status = (error as { status?: number }).status ?? 500;
          const message = error instanceof Error ? error.message : 'Assistant unavailable.';
          const level: Parameters<typeof captureServerMessage>[2] = status >= 500 ? 'error' : 'warning';
          captureServerMessage('[api] tutor request failed', { status, reason: message }, level);
          sendJson(res, status, { error: message });
        }

        return true;
      }

      if (req.method === 'GET' && url.pathname === '/api/recommendations') {
        const moduleId = parseNumber(url.query.moduleId);
        const lastScore = parseNumber(url.query.lastScore);

        if (!moduleId) {
          sendJson(res, 400, { error: 'moduleId query parameter is required' });
          return true;
        }

        const { recommendations } = await getRecommendations(supabase, moduleId, lastScore);
        sendJson(res, 200, { recommendations });
        return true;
      }

      if (req.method === 'POST' && url.pathname === '/api/assignments/assign') {
        const actor = await requireUser(supabase, token, res, ['parent', 'admin']);
        if (!actor) {
          return true;
        }

        const body = await readJsonBody<AssignModulePayload>(req);
        if (
          !body ||
          typeof body.moduleId !== 'number' ||
          !Array.isArray(body.studentIds) ||
          body.studentIds.length === 0
        ) {
          sendJson(res, 400, {
            error: 'moduleId and studentIds are required to assign a module.',
          });
          return true;
        }

        const studentIds = Array.from(
          new Set(
            body.studentIds
              .filter((id): id is string => typeof id === 'string')
              .map((id) => id.trim())
              .filter((id) => id.length > 0),
          ),
        );

        if (!studentIds.length) {
          sendJson(res, 400, { error: 'At least one valid student id is required.' });
          return true;
        }

        try {
          await ensureGuardianAccess(supabase, actor, studentIds);

          const result = await createModuleAssignment(
            supabase,
            {
              ...body,
              studentIds,
              creatorId: actor.id,
              creatorRole: actor.role === 'admin' ? 'admin' : 'parent',
            },
            serviceSupabase,
          );
          sendJson(res, 200, result);
        } catch (error) {
          captureServerException(error, {
            route: url.pathname,
            moduleId: body.moduleId,
            creatorId: actor.id,
          });
          console.error('[api] assign module failed', error);
          const status =
            error instanceof Error && error.message.toLowerCase().includes('assign modules to learners you manage')
              ? 403
              : 500;
          sendJson(res, status, {
            error: error instanceof Error ? error.message : 'Unable to assign module.',
          });
        }
        return true;
      }

      if (req.method === 'GET' && url.pathname === '/api/modules') {
        const filters = createFilters(url.query);
        const result = await listModules(supabase, filters);
        sendJson(res, 200, result);
        return true;
      }

      if (req.method === 'GET' && url.pathname?.startsWith('/api/lessons/')) {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length === 3) {
          const lessonId = Number.parseInt(parts[2] ?? '', 10);
          if (Number.isNaN(lessonId)) {
            sendJson(res, 400, { error: 'Lesson id must be numeric.' });
            return true;
          }

          const detail = await getLessonDetail(supabase, lessonId);
          if (!detail) {
            sendJson(res, 404, { error: 'Lesson not found.' });
            return true;
          }

          sendJson(res, 200, { lesson: detail });
          return true;
        }
      }

      if (url.pathname?.startsWith('/api/admins')) {
        const admin = await requireAdmin(supabase, token, res);
        if (!admin) {
          return true;
        }

        if (req.method === 'GET' && url.pathname === '/api/admins') {
          const admins = await listAdmins(serviceSupabase);
          sendJson(res, 200, { admins });
          return true;
        }

        if (req.method === 'POST' && url.pathname === '/api/admins/promote') {
          const body = await readJsonBody<{
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
            sendJson(res, 200, { admin: promoted });
          } catch (error) {
            sendJson(res, 400, {
              error: error instanceof Error ? error.message : 'Unable to promote admin user.',
            });
          }
          return true;
        }

        if (req.method === 'POST' && url.pathname === '/api/admins/demote') {
          const body = await readJsonBody<{ userId?: string; targetRole?: string }>(req);
          if (!body.userId || typeof body.userId !== 'string') {
            sendJson(res, 400, { error: 'userId is required to demote an admin.' });
            return true;
          }
          const targetRole = body.targetRole === 'student' ? 'student' : 'parent';

          try {
            const result = await demoteAdmin(serviceSupabase, body.userId, targetRole);
            sendJson(res, 200, {
              demoted: result.id,
              role: result.role,
              remainingAdmins: result.remainingAdmins,
            });
          } catch (error) {
            sendJson(res, 400, {
              error: error instanceof Error ? error.message : 'Unable to demote admin user.',
            });
          }
          return true;
        }

        sendJson(res, 404, { error: 'Not found' });
        return true;
      }

      if (url.pathname?.startsWith('/api/import/')) {
        const admin = await requireAdmin(supabase, token, res);
        if (!admin) {
          return true;
        }

        if (req.method === 'GET' && url.pathname === '/api/import/providers') {
          const providers = IMPORT_PROVIDERS.map((provider) => ({
            id: provider.id,
            label: provider.label,
            description: provider.description,
            samplePath: provider.samplePath ?? null,
            importKind: provider.importKind,
            defaultLicense: provider.defaultLicense,
            notes: provider.notes ?? null,
          }));
          sendJson(res, 200, { providers });
          return true;
        }

        if (req.method === 'GET' && url.pathname === '/api/import/runs') {
          const runs = await fetchImportRuns(supabase, 25);
          sendJson(res, 200, { runs: runs.map(toApiModel) });
          return true;
        }

        if (req.method === 'GET' && url.pathname?.startsWith('/api/import/runs/')) {
          const parts = url.pathname.split('/').filter(Boolean);
          if (parts.length === 4) {
            const idPart = parts[3];
            const runId = Number.parseInt(idPart ?? '', 10);
            if (Number.isNaN(runId)) {
              sendJson(res, 400, { error: 'Import run id must be numeric.' });
              return true;
            }
            const run = await fetchImportRunById(supabase, runId);
            if (!run) {
              sendJson(res, 404, { error: 'Import run not found.' });
              return true;
            }
            sendJson(res, 200, { run: toApiModel(run) });
            return true;
          }
        }

        if (req.method === 'POST' && url.pathname === '/api/import/runs') {
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

          const body = await readJsonBody<CreateRunBody>(req);
          if (!body.provider || !isImportProviderId(body.provider)) {
            sendJson(res, 400, { error: 'Valid provider is required.' });
            return true;
          }

          const provider = body.provider as ImportProviderId;
          const providerDefinition = IMPORT_PROVIDER_MAP.get(provider);
          if (!providerDefinition) {
            sendJson(res, 400, { error: `Provider "${provider}" is not supported.` });
            return true;
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

          sendJson(res, 201, { run: toApiModel(run) });
          return true;
        }

        if (req.method === 'POST' && url.pathname === '/api/import/openstax') {
          const body = await readJsonBody<{ mapping: OpenStaxMapping }>(req);
          if (!body.mapping || typeof body.mapping !== 'object') {
            sendJson(res, 400, { error: 'mapping payload is required' });
            return true;
          }
          const inserted = await importOpenStaxMapping(serviceSupabase, body.mapping);
          sendJson(res, 200, { inserted });
          return true;
        }

        if (req.method === 'POST' && url.pathname === '/api/import/gutenberg') {
          const body = await readJsonBody<{ mapping: GutenbergMapping }>(req);
          if (!body.mapping || typeof body.mapping !== 'object') {
            sendJson(res, 400, { error: 'mapping payload is required' });
            return true;
          }
          const inserted = await importGutenbergMapping(serviceSupabase, body.mapping);
          sendJson(res, 200, { inserted });
          return true;
        }

        if (req.method === 'POST' && url.pathname === '/api/import/federal') {
          const body = await readJsonBody<{ mapping: FederalMapping }>(req);
          if (!body.mapping || typeof body.mapping !== 'object') {
            sendJson(res, 400, { error: 'mapping payload is required' });
            return true;
          }
          const inserted = await importFederalMapping(serviceSupabase, body.mapping);
          sendJson(res, 200, { inserted });
          return true;
        }

        sendJson(res, 404, { error: 'Not found' });
        return true;
      }

      if (
        req.method === 'GET' &&
        url.pathname?.startsWith('/api/modules/') &&
        url.pathname?.endsWith('/assessment')
      ) {
        const parts = url.pathname.split('/');
        const idPart = parts[3];
        const moduleId = Number.parseInt(idPart ?? '', 10);
        if (!Number.isFinite(moduleId)) {
          sendJson(res, 400, { error: 'Module id must be numeric' });
          return true;
        }
        const detail = await getModuleAssessment(supabase, moduleId);
        if (!detail) {
          sendJson(res, 404, { error: 'Module assessment not found' });
          return true;
        }
        sendJson(res, 200, detail);
        return true;
      }

      if (req.method === 'GET' && url.pathname.startsWith('/api/modules/')) {
        const parts = url.pathname.split('/');
        const idPart = parts[3];
        const moduleId = Number.parseInt(idPart ?? '', 10);
        if (!Number.isFinite(moduleId)) {
          sendJson(res, 400, { error: 'Module id must be numeric' });
          return true;
        }
        const detail = await getModuleDetail(supabase, moduleId);
        if (!detail) {
          sendJson(res, 404, { error: 'Module not found' });
          return true;
        }
        sendJson(res, 200, detail);
        return true;
      }

      sendJson(res, 404, { error: 'Not found' });
      return true;
    } catch (error) {
      captureServerException(error, {
        route: url.pathname,
        method: req.method,
      });
      console.error('[api] error', error);
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Internal server error',
      });
      return true;
    }
  };
};

export const startApiServer = (port = Number.parseInt(process.env.PORT ?? '8787', 10)) => {
  const serviceSupabase = createServiceRoleClient();
  const handler = createApiHandler({ serviceSupabase });
  const queue = new ImportQueue(serviceSupabase, {
    logger: (entry) => {
      const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      console.log(`[import-queue] ${entry.level}: ${entry.message}${context}`);
      if (entry.level === 'error') {
        captureServerMessage(entry.message, { source: 'importQueue', context: entry.context }, 'error');
      }
    },
  });

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

  queue.start();

  return {
    server,
    queue,
    close: () => {
      queue.stop();
      server.close();
    },
  };
};
