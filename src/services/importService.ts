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
import { authenticatedFetch, handleApiResponse } from '../lib/apiClient';

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
    const response = await authenticatedFetch('/api/v1/import/providers');
    const payload = await handleApiResponse<ProvidersResponse>(response);
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
    if (error instanceof Error && error.message.toLowerCase().includes('admin')) {
      throw error;
    }
    console.warn(
      '[importService] falling back to static provider definitions:',
      error instanceof Error ? error.message : error,
    );
    return IMPORT_PROVIDERS;
  }
};

export const fetchImportRuns = async (): Promise<ImportRun[]> => {
  const response = await authenticatedFetch('/api/v1/import/runs');
  const payload = await handleApiResponse<ImportRunsResponse>(response);
  return Array.isArray(payload.runs) ? payload.runs.map(mapRun) : [];
};

export const queueImportRun = async (
  provider: ImportProviderId,
  payload: {
    mapping?: Record<string, unknown>;
    dataset?: Record<string, unknown>;
    fileName?: string;
    notes?: string;
    dryRun?: boolean;
    limits?: { maxModules?: number; maxAssets?: number };
  },
): Promise<ImportRun> => {
  const response = await authenticatedFetch('/api/v1/import/runs', {
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
      dryRun: payload.dryRun,
      limits: payload.limits,
    }),
  });
  const data = await handleApiResponse<ImportRunResponse>(response);
  return mapRun(data.run);
};
