import type { SupabaseClient } from '@supabase/supabase-js';

import { IMPORT_PROVIDER_MAP, type ImportProviderId } from '../shared/import-providers.js';
import {
  appendLogEntry,
  buildLogEntry,
  coerceImportRunRow,
  fetchImportRunById,
  nowIso,
  type ImportRunLogEntry,
  type ImportRunRow,
} from './importRuns.js';
import { processImportRun } from './providerPipeline.js';

const POLL_INTERVAL_MS = 5_000;

const claimPendingRun = async (client: SupabaseClient): Promise<ImportRunRow | null> => {
  const { data, error } = await client
    .from('import_runs')
    .select()
    .eq('status', 'pending')
    .order('started_at', { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to scan for pending import runs: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  const run = coerceImportRunRow(data[0] as Record<string, unknown>);
  const claimedLogs = appendLogEntry(run, buildLogEntry('info', 'Worker claimed import run.'));

  const { data: updated, error: updateError } = await client
    .from('import_runs')
    .update({ status: 'running', logs: claimedLogs, started_at: nowIso() })
    .eq('id', run.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to mark import run ${run.id} as running: ${updateError.message}`);
  }

  if (!updated) {
    return null;
  }

  return coerceImportRunRow(updated as Record<string, unknown>);
};

export type ImportQueueOptions = {
  pollIntervalMs?: number;
  logger?: (entry: ImportRunLogEntry) => void;
};

export class ImportQueue {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly client: SupabaseClient,
    private readonly options: ImportQueueOptions = {},
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    const interval = this.options.pollIntervalMs ?? POLL_INTERVAL_MS;
    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const run = await claimPendingRun(this.client);
      if (!run) {
        return;
      }
      await this.executeRun(run);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.logger?.(
        buildLogEntry('error', `[import-queue] tick failed: ${message}`),
      );
    } finally {
      this.running = false;
    }
  }

  private async appendLog(runId: number, entry: ImportRunLogEntry): Promise<ImportRunRow> {
    const current = await fetchImportRunById(this.client, runId);
    if (!current) {
      throw new Error(`Import run ${runId} missing while appending logs.`);
    }
    const logs = appendLogEntry(current, entry);
    const { data, error } = await this.client
      .from('import_runs')
      .update({ logs })
      .eq('id', runId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to append log entry: ${error.message}`);
    }

    return coerceImportRunRow(data as Record<string, unknown>);
  }

  private async executeRun(run: ImportRunRow): Promise<void> {
    const providerId = run.input?.provider ?? run.source;
    if (typeof providerId !== 'string' || !IMPORT_PROVIDER_MAP.has(providerId as ImportProviderId)) {
      await this.appendLog(
        run.id,
        buildLogEntry('error', `Unknown import provider "${providerId}".`),
      );
      await this.client
        .from('import_runs')
        .update({
          status: 'error',
          finished_at: nowIso(),
          errors: [`Unknown import provider "${providerId}".`],
        })
        .eq('id', run.id);
      return;
    }

    let current = run;
    const log = async (
      level: ImportRunLogEntry['level'],
      message: string,
      context?: Record<string, unknown>,
    ) => {
      const entry = buildLogEntry(level, message, context);
      current = await this.appendLog(run.id, entry);
      this.options.logger?.(entry);
    };

    await log('info', `Starting import for provider ${providerId}.`, {
      importRunId: run.id,
    });

    try {
      const outcome = await processImportRun(this.client, providerId as ImportProviderId, current);
      const totals = outcome?.totals ?? current.totals ?? null;
      const errors = outcome?.errors ?? [];
      const warnings = outcome?.warnings ?? [];
      const status = errors.length > 0 ? 'error' : 'success';
      await this.client
        .from('import_runs')
        .update({
          status,
          finished_at: nowIso(),
          totals,
          errors,
        })
        .eq('id', run.id);

      for (const warning of warnings) {
        await log('warn', warning);
      }

      await log(
        status === 'success' ? 'info' : 'error',
        status === 'success'
          ? 'Import run completed successfully.'
          : 'Import run completed with errors.',
        {
          totals,
          errors,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.client
        .from('import_runs')
        .update({
          status: 'error',
          finished_at: nowIso(),
          errors: [...(current.errors ?? []), message],
        })
        .eq('id', run.id);

      await log('error', 'Import run failed unexpectedly.', {
        error: message,
      });
    }
  }
}
