import {
  IMPORT_PROVIDERS,
  type ImportProviderDefinition,
  type ImportProviderId,
} from '../../shared/import-providers.js';
import type {
  ImportRunApiModel,
  ImportRunLogEntry,
  ImportRunStatus,
} from '../../shared/import-runs.js';

type ProvidersResponse = {
  providers: Array<{
    id: ImportProviderId;
    label: string;
    description: string;
    samplePath: string | null;
    importKind: 'mapping' | 'dataset';
    defaultLicense: string;
    notes: string | null;
  }>;
};

type ImportRunsResponse = {
  runs: ImportRunApiModel[];
};

type ImportRunResponse = {
  run: ImportRunApiModel;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Import API request failed (${response.status})`);
  }
  return (await response.json()) as T;
};

export type ImportRun = {
  id: number;
  provider: string;
  status: ImportRunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  totals: Record<string, unknown> | null;
  errors: string[];
  logs: ImportRunLogEntry[];
};

const mapRun = (apiRun: ImportRunApiModel): ImportRun => ({
  id: apiRun.id,
  provider: apiRun.source,
  status: apiRun.status,
  startedAt: apiRun.startedAt,
  finishedAt: apiRun.finishedAt,
  durationMs: apiRun.durationMs ?? null,
  totals: apiRun.totals ?? null,
  errors: apiRun.errors ?? [],
  logs: apiRun.logs ?? [],
});

export const fetchImportProviders = async (): Promise<ImportProviderDefinition[]> => {
  try {
    const response = await fetch('/api/import/providers');
    const payload = await handleResponse<ProvidersResponse>(response);
    return payload.providers.map((provider) => ({
      id: provider.id,
      label: provider.label,
      description: provider.description,
      samplePath: provider.samplePath ?? undefined,
      contentSource: IMPORT_PROVIDERS.find((item) => item.id === provider.id)?.contentSource ?? '',
      defaultLicense: provider.defaultLicense,
      importKind: provider.importKind,
      notes: provider.notes ?? undefined,
    }));
  } catch (error) {
    console.warn(
      '[importService] falling back to static provider definitions:',
      error instanceof Error ? error.message : error,
    );
    return IMPORT_PROVIDERS;
  }
};

export const fetchImportRuns = async (): Promise<ImportRun[]> => {
  const response = await fetch('/api/import/runs');
  const payload = await handleResponse<ImportRunsResponse>(response);
  return Array.isArray(payload.runs) ? payload.runs.map(mapRun) : [];
};

export const queueImportRun = async (
  provider: ImportProviderId,
  payload: {
    mapping?: Record<string, unknown>;
    dataset?: Record<string, unknown>;
    fileName?: string;
    notes?: string;
  },
): Promise<ImportRun> => {
  const response = await fetch('/api/import/runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider,
      mapping: payload.mapping,
      dataset: payload.dataset,
      fileName: payload.fileName,
      notes: payload.notes,
    }),
  });
  const data = await handleResponse<ImportRunResponse>(response);
  return mapRun(data.run);
};
