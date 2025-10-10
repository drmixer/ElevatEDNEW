import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UploadCloud, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

import {
  fetchImportProviders,
  fetchImportRuns,
  queueImportRun,
  type ImportRun,
} from '../services/importService';
import type { ImportProviderDefinition, ImportProviderId } from '../../shared/import-providers';
import { IMPORT_PROVIDERS } from '../../shared/import-providers';

type StatusMessage = { message: string; type: 'success' | 'error' };

type UploadState =
  | {
    kind: 'mapping' | 'dataset';
    data: Record<string, unknown>;
    fileName: string;
    summary: string;
  }
  | null;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  running: 'bg-blue-100 text-blue-700 border-blue-200',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  error: 'bg-rose-100 text-rose-700 border-rose-200',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asPositiveInteger = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.trunc(num) : null;
};

const formatDuration = (milliseconds: number | null): string => {
  if (milliseconds == null || milliseconds <= 0) {
    return '—';
  }
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const countWarnings = (run: ImportRun): number =>
  run.logs.filter((log) => log.level === 'warn').length;

const latestLogMessage = (run: ImportRun): string | null => {
  if (!run.logs.length) {
    return null;
  }
  return run.logs[run.logs.length - 1]?.message ?? null;
};

const extractTotals = (run: ImportRun) => {
  const totals = run.totals ?? {};
  const assetsInserted =
    asPositiveInteger(totals.assetsInserted) ??
    asPositiveInteger(totals.assetsPrepared) ??
    asPositiveInteger(totals.inserted);
  const urlChecks = asPositiveInteger(totals.urlChecks);
  const urlFailures = asPositiveInteger(totals.urlFailures);
  const lessonsUpdated = asPositiveInteger(totals.lessonsUpdated);
  return { assetsInserted, urlChecks, urlFailures, lessonsUpdated };
};

const AdminImportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [providerId, setProviderId] = useState<ImportProviderId>('openstax');
  const [uploadState, setUploadState] = useState<UploadState>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const providersQuery = useQuery({
    queryKey: ['importProviders'],
    queryFn: fetchImportProviders,
    initialData: IMPORT_PROVIDERS,
  });

  const runsQuery = useQuery({
    queryKey: ['importRuns'],
    queryFn: fetchImportRuns,
    refetchInterval: 5000,
  });

  const selectedProvider: ImportProviderDefinition | undefined = useMemo(
    () => providersQuery.data?.find((item) => item.id === providerId),
    [providerId, providersQuery.data],
  );

  const queueMutation = useMutation({
    mutationFn: (payload: { mapping?: Record<string, unknown>; dataset?: Record<string, unknown> }) =>
      queueImportRun(providerId, {
        ...payload,
        fileName: uploadState?.fileName,
      }),
    onSuccess: (run) => {
      setStatus({
        type: 'success',
        message: `Queued import run #${run.id} for ${run.provider}.`,
      });
      setUploadState(null);
      queryClient.invalidateQueries({ queryKey: ['importRuns'] }).catch(() => {
        /* ignore */
      });
    },
    onError: (error: unknown) => {
      setStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to queue import run. Please verify the file and try again.',
      });
    },
  });

  const handleFile = async (file: File | null) => {
    if (!file) {
      setUploadState(null);
      return;
    }
    if (!selectedProvider) {
      setStatus({
        type: 'error',
        message: 'Select a provider before uploading files.',
      });
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isRecord(parsed)) {
        throw new Error('File must contain a JSON object.');
      }

      if (selectedProvider.importKind === 'mapping') {
        const moduleKeys = Object.keys(parsed);
        if (moduleKeys.length === 0) {
          throw new Error('Mapping file must contain at least one module key.');
        }
        setUploadState({
          kind: 'mapping',
          data: parsed,
          fileName: file.name,
          summary: `${moduleKeys.length} module${moduleKeys.length === 1 ? '' : 's'} detected.`,
        });
        setStatus({
          type: 'success',
          message: `Loaded mapping "${file.name}". ${moduleKeys.length} module entries found.`,
        });
        return;
      }

      const modules = Array.isArray((parsed as Record<string, unknown>).modules)
        ? ((parsed as Record<string, unknown>).modules as unknown[]).length
        : 0;

      setUploadState({
        kind: 'dataset',
        data: parsed,
        fileName: file.name,
        summary: `${modules} module${modules === 1 ? '' : 's'} detected.`,
      });
      setStatus({
        type: 'success',
        message: `Loaded dataset "${file.name}". ${modules} module${modules === 1 ? '' : 's'} in payload.`,
      });
    } catch (error) {
      console.error('[import] failed to parse uploaded file', error);
      setUploadState(null);
      setStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to parse file. Ensure it is valid JSON.',
      });
    }
  };

  const executeImport = () => {
    if (!selectedProvider) {
      setStatus({
        type: 'error',
        message: 'Select a provider before running the import.',
      });
      return;
    }
    if (!uploadState) {
      setStatus({
        type: 'error',
        message: 'Upload a data file before queueing the import.',
      });
      return;
    }

    if (queueMutation.isPending) {
      return;
    }

    if (uploadState.kind === 'mapping') {
      queueMutation.mutate({ mapping: uploadState.data });
    } else {
      queueMutation.mutate({ dataset: uploadState.data });
    }
  };

  const providers = providersQuery.data ?? [];
  const runs = runsQuery.data ?? [];

  return (
    <div className="bg-slate-50 min-h-screen py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Content ingestion console</h1>
          <p className="text-sm text-slate-500 mb-8">
            Upload normalized provider payloads to queue asynchronous import jobs. Mapping providers
            expect the legacy <code>moduleSlug → assets[]</code> structure, while dataset providers
            accept normalized <code>modules[]</code> bundles.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {providers.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setProviderId(item.id);
                  setStatus(null);
                  setUploadState(null);
                }}
                className={`border rounded-2xl p-4 text-left transition-all ${
                  providerId === item.id
                    ? 'border-brand-blue bg-brand-blue/5 shadow-md'
                    : 'border-slate-200 hover:border-brand-blue/50'
                }`}
              >
                <div className="font-semibold text-slate-900">{item.label}</div>
                <div className="text-xs text-slate-500 mt-2 leading-snug">{item.description}</div>
                <div className="text-[11px] text-brand-blue mt-4">
                  {item.importKind === 'mapping' ? 'Mapping' : 'Dataset'} • Sample:{' '}
                  {item.samplePath ?? 'n/a'}
                </div>
              </button>
            ))}
          </div>

          <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50">
            <label className="flex flex-col items-center justify-center cursor-pointer">
              <UploadCloud className="h-9 w-9 text-brand-blue mb-3" />
              <span className="font-medium text-slate-700">
                Click to upload {selectedProvider?.label ?? 'provider'} JSON
              </span>
              <span className="text-xs text-slate-400 mt-1">
                We validate licenses and links as part of the queued import run.
              </span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {uploadState && (
            <div className="mt-4 px-4 py-3 border border-emerald-200 bg-emerald-50 rounded-xl text-sm text-emerald-700 flex flex-wrap gap-2 items-center justify-between">
              <div>
                Ready to import <span className="font-semibold">{uploadState.fileName}</span>.{' '}
                {uploadState.summary}
              </div>
              <button
                type="button"
                onClick={() => setUploadState(null)}
                className="text-xs text-emerald-700 underline decoration-dotted"
              >
                Clear
              </button>
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              onClick={executeImport}
              disabled={queueMutation.isPending}
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-brand-blue text-white font-semibold text-sm hover:bg-brand-blue/90 transition-colors disabled:opacity-60"
            >
              {queueMutation.isPending ? 'Queueing import…' : 'Queue import run'}
            </button>
            <div className="text-xs text-slate-500">
              Jobs run asynchronously. Refresh the history below to monitor progress.
            </div>
          </div>

          {status && (
            <div
              className={`mt-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                status.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 mt-0.5" />
              )}
              <div>{status.message}</div>
            </div>
          )}
        </div>

        <div className="mt-10 bg-white border border-slate-200 rounded-3xl shadow-lg p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Recent import runs</h2>
              <p className="text-sm text-slate-500">
                Jobs poll every few seconds; manual refresh is available if needed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => runsQuery.refetch()}
              disabled={runsQuery.isFetching}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${runsQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {runsQuery.isLoading ? (
            <div className="text-sm text-slate-500">Loading import history…</div>
          ) : runs.length === 0 ? (
            <div className="text-sm text-slate-500">No import runs have been queued yet.</div>
          ) : (
            <div className="space-y-4">
              {runs.map((run) => {
                const { assetsInserted, urlChecks, urlFailures, lessonsUpdated } = extractTotals(run);
                const warnings = countWarnings(run);
                const latestMessage = latestLogMessage(run);
                return (
                  <div
                    key={run.id}
                    className="border border-slate-200 rounded-2xl p-5 bg-slate-25 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          #{run.id} • {run.provider}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 space-x-2">
                          <span>Started {formatTimestamp(run.startedAt)}</span>
                          {run.finishedAt && (
                            <span> • Finished {formatTimestamp(run.finishedAt)}</span>
                          )}
                          <span> • Duration {formatDuration(run.durationMs)}</span>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 text-xs font-semibold border rounded-full ${STATUS_COLORS[run.status] ?? STATUS_COLORS.pending}`}
                      >
                        {run.status.toUpperCase()}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-slate-600">
                      <div className="bg-slate-100 rounded-xl px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          Assets inserted
                        </div>
                        <div className="text-base font-semibold text-slate-900">
                          {assetsInserted ?? '—'}
                        </div>
                      </div>
                      <div className="bg-slate-100 rounded-xl px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          Link checks
                        </div>
                        <div className="text-base font-semibold text-slate-900">
                          {urlChecks ?? 0}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            {urlFailures ? `(${urlFailures} flagged)` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-100 rounded-xl px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          Lessons updated
                        </div>
                        <div className="text-base font-semibold text-slate-900">
                          {lessonsUpdated ?? 0}
                        </div>
                      </div>
                      <div className="bg-slate-100 rounded-xl px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          Warnings • Errors
                        </div>
                        <div className="text-base font-semibold text-slate-900">
                          {warnings} • {run.errors.length}
                        </div>
                      </div>
                    </div>

                    {(latestMessage || run.errors.length > 0) && (
                      <div className="mt-3 text-sm text-slate-600">
                        {run.errors.length > 0 ? (
                          <div className="text-rose-600">
                            <strong>Error:</strong> {run.errors[run.errors.length - 1]}
                          </div>
                        ) : null}
                        {latestMessage && (
                          <div className="text-slate-600">
                            <strong>Last log:</strong> {latestMessage}
                          </div>
                        )}
                      </div>
                    )}

                    {run.logs.length > 0 && (
                      <details className="mt-4">
                        <summary className="text-xs text-brand-blue cursor-pointer">
                          View detailed logs ({run.logs.length})
                        </summary>
                        <ul className="mt-2 space-y-1 text-xs text-slate-600">
                          {run.logs.map((log, index) => (
                            <li key={`${run.id}-${log.timestamp}-${index}`}>
                              <span className="font-semibold uppercase tracking-wide text-slate-400">
                                [{log.level}]
                              </span>{' '}
                              <span className="text-slate-500">{formatTimestamp(log.timestamp)}</span>{' '}
                              {log.message}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminImportPage;
