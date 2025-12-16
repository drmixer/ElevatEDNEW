import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ImportRunApiModel,
  ImportRunLogEntry,
  ImportRunStatus,
} from '../shared/import-runs.js';

// Re-export for use in other server modules
export type { ImportRunLogEntry };


export type ImportRunRow = {
  id: number;
  source: string;
  status: ImportRunStatus;
  started_at: string;
  finished_at: string | null;
  totals: Record<string, unknown> | null;
  errors: string[] | null;
  logs: ImportRunLogEntry[] | null;
  input: Record<string, unknown> | null;
  triggered_by: string | null;
};

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
    .filter((item) => item.length > 0);
};

const parseLogEntries = (value: unknown): ImportRunLogEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item): ImportRunLogEntry => {
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const message = typeof record.message === 'string' ? record.message : JSON.stringify(record);
        const level: ImportRunLogEntry['level'] = record.level === 'warn' || record.level === 'error' ? record.level : 'info';
        const timestamp =
          typeof record.timestamp === 'string' ? record.timestamp : new Date().toISOString();
        const context = record.context && typeof record.context === 'object' ? (record.context as Record<string, unknown>) : undefined;
        return { message, level, timestamp, context };
      }
      return {
        message: typeof item === 'string' ? item : JSON.stringify(item),
        level: 'info' as const,
        timestamp: new Date().toISOString(),
      };
    })
    .filter((entry) => entry.message.length > 0);
};


export const coerceImportRunRow = (value: Record<string, unknown>): ImportRunRow => {
  const id = Number.parseInt(String(value.id ?? ''), 10);
  if (!Number.isFinite(id)) {
    throw new Error('Invalid import run id received from Supabase.');
  }

  const statusRaw = typeof value.status === 'string' ? value.status : 'pending';
  const status = ['pending', 'running', 'success', 'error'].includes(statusRaw)
    ? (statusRaw as ImportRunStatus)
    : 'pending';

  const totals = value.totals && typeof value.totals === 'object' ? (value.totals as Record<string, unknown>) : null;
  const input =
    value.input && typeof value.input === 'object' && !Array.isArray(value.input)
      ? (value.input as Record<string, unknown>)
      : null;

  return {
    id,
    source: typeof value.source === 'string' ? value.source : 'Unknown',
    status,
    started_at: typeof value.started_at === 'string' ? value.started_at : new Date().toISOString(),
    finished_at: typeof value.finished_at === 'string' ? value.finished_at : null,
    totals,
    errors: parseStringArray(value.errors),
    logs: parseLogEntries(value.logs),
    input,
    triggered_by: typeof value.triggered_by === 'string' ? value.triggered_by : null,
  };
};

export const appendLogEntry = (
  run: ImportRunRow,
  entry: ImportRunLogEntry,
): ImportRunLogEntry[] => {
  const existing = run.logs ?? [];
  return [...existing, entry];
};

export const nowIso = (): string => new Date().toISOString();

export const buildLogEntry = (
  level: ImportRunLogEntry['level'],
  message: string,
  context?: Record<string, unknown>,
): ImportRunLogEntry => ({
  timestamp: nowIso(),
  level,
  message,
  context,
});

export const toApiModel = (row: ImportRunRow): ImportRunApiModel => {
  const started = Date.parse(row.started_at);
  const finished = row.finished_at ? Date.parse(row.finished_at) : null;
  const durationMs =
    Number.isFinite(started) && Number.isFinite(finished ?? NaN) && finished
      ? Math.max(0, finished - started)
      : null;

  return {
    id: row.id,
    source: row.source,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs,
    totals: row.totals,
    errors: row.errors ?? [],
    logs: row.logs ?? [],
  };
};

export const updateRunStatus = async (
  client: SupabaseClient,
  runId: number,
  patch: Partial<Omit<ImportRunRow, 'id'>>,
): Promise<ImportRunRow> => {
  const payload: Record<string, unknown> = { ...patch };
  const { data, error } = await client
    .from('import_runs')
    .update(payload)
    .eq('id', runId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update import run #${runId}: ${error.message}`);
  }

  return coerceImportRunRow(data as Record<string, unknown>);
};

export type CreateImportRunPayload = {
  source: string;
  status?: ImportRunStatus;
  input?: Record<string, unknown> | null;
  totals?: Record<string, unknown> | null;
  errors?: string[];
  logs?: ImportRunLogEntry[];
  triggered_by?: string | null;
};

export const createImportRun = async (
  client: SupabaseClient,
  payload: CreateImportRunPayload,
): Promise<ImportRunRow> => {
  const body: Record<string, unknown> = {
    source: payload.source,
    status: payload.status ?? 'pending',
    input: payload.input ?? null,
    totals: payload.totals ?? null,
    errors: payload.errors ?? [],
    logs: payload.logs ?? [],
    triggered_by: payload.triggered_by ?? null,
  };

  const { data, error } = await client.from('import_runs').insert(body).select().single();

  if (error) {
    throw new Error(`Failed to create import run: ${error.message}`);
  }

  return coerceImportRunRow(data as Record<string, unknown>);
};

export const fetchImportRuns = async (
  client: SupabaseClient,
  limit = 20,
): Promise<ImportRunRow[]> => {
  const { data, error } = await client
    .from('import_runs')
    .select()
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch import runs: ${error.message}`);
  }

  return (data ?? []).map((record) => coerceImportRunRow(record as Record<string, unknown>));
};

export const fetchImportRunById = async (
  client: SupabaseClient,
  runId: number,
): Promise<ImportRunRow | null> => {
  const { data, error } = await client.from('import_runs').select().eq('id', runId).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch import run ${runId}: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return coerceImportRunRow(data as Record<string, unknown>);
};
