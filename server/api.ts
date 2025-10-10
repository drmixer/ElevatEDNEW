import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { parse as parseUrl } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceRoleClient } from '../scripts/utils/supabase.js';
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
import { getRecommendations } from './recommendations.js';
import { getModuleAssessment, getModuleDetail, listModules, type ModuleFilters } from './modules.js';
import { ImportQueue } from './importQueue.js';
import {
  createImportRun,
  fetchImportRunById,
  fetchImportRuns,
  toApiModel,
} from './importRuns.js';

type ApiContext = {
  supabase: SupabaseClient;
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

  return {
    subject: toStringValue('subject'),
    grade: toStringValue('grade'),
    strand: toStringValue('strand'),
    topic: toStringValue('topic'),
    search: toStringValue('search'),
    page: toNumber('page'),
    pageSize: toNumber('pageSize'),
  };
};

export const createApiHandler = (context: ApiContext) => {
  const { supabase } = context;

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = parseUrl(req.url ?? '', true);
    if (!url.pathname?.startsWith('/api/')) {
      return false;
    }

    try {
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

      if (req.method === 'GET' && url.pathname === '/api/modules') {
        const filters = createFilters(url.query);
        const result = await listModules(supabase, filters);
        sendJson(res, 200, result);
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
          triggeredBy?: string;
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

        const inputPayload: Record<string, unknown> = {
          provider,
          fileName: typeof body.fileName === 'string' ? body.fileName : null,
          mapping: body.mapping && typeof body.mapping === 'object' ? body.mapping : null,
          dataset: body.dataset && typeof body.dataset === 'object' ? body.dataset : null,
          extraInput: body.input && typeof body.input === 'object' ? body.input : null,
          notes: typeof body.notes === 'string' ? body.notes : null,
        };

        const run = await createImportRun(supabase, {
          source: provider,
          status: 'pending',
          input: inputPayload,
          triggered_by: typeof body.triggeredBy === 'string' ? body.triggeredBy : null,
          logs: [
            {
              timestamp: new Date().toISOString(),
              level: 'info',
              message: `Queued ${providerDefinition.label} import.`,
            },
          ],
        });

        sendJson(res, 201, { run: toApiModel(run) });
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

      if (req.method === 'POST' && url.pathname === '/api/import/openstax') {
        const body = await readJsonBody<{ mapping: OpenStaxMapping }>(req);
        if (!body.mapping || typeof body.mapping !== 'object') {
          sendJson(res, 400, { error: 'mapping payload is required' });
          return true;
        }
        const inserted = await importOpenStaxMapping(supabase, body.mapping);
        sendJson(res, 200, { inserted });
        return true;
      }

      if (req.method === 'POST' && url.pathname === '/api/import/gutenberg') {
        const body = await readJsonBody<{ mapping: GutenbergMapping }>(req);
        if (!body.mapping || typeof body.mapping !== 'object') {
          sendJson(res, 400, { error: 'mapping payload is required' });
          return true;
        }
        const inserted = await importGutenbergMapping(supabase, body.mapping);
        sendJson(res, 200, { inserted });
        return true;
      }

      if (req.method === 'POST' && url.pathname === '/api/import/federal') {
        const body = await readJsonBody<{ mapping: FederalMapping }>(req);
        if (!body.mapping || typeof body.mapping !== 'object') {
          sendJson(res, 400, { error: 'mapping payload is required' });
          return true;
        }
        const inserted = await importFederalMapping(supabase, body.mapping);
        sendJson(res, 200, { inserted });
        return true;
      }

      sendJson(res, 404, { error: 'Not found' });
      return true;
    } catch (error) {
      console.error('[api] error', error);
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Internal server error',
      });
      return true;
    }
  };
};

export const startApiServer = (port = Number.parseInt(process.env.PORT ?? '8787', 10)) => {
  const supabase = createServiceRoleClient();
  const handler = createApiHandler({ supabase });
  const queue = new ImportQueue(supabase, {
    logger: (entry) => {
      const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      console.log(`[import-queue] ${entry.level}: ${entry.message}${context}`);
    },
  });

  const server = createServer(async (req, res) => {
    const handled = await handler(req, res);
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
