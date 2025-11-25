import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { createServiceRoleClient } from '../scripts/utils/supabase.js';
import { ImportQueue } from './importQueue.js';
import { captureServerMessage, initServerMonitoring } from './monitoring.js';

const resolvePollInterval = (): number => {
  const parsed = Number.parseInt(process.env.IMPORT_WORKER_POLL_MS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_000;
};

export const startImportWorker = () => {
  initServerMonitoring();
  const serviceSupabase = createServiceRoleClient();
  const pollIntervalMs = resolvePollInterval();

  const queue = new ImportQueue(serviceSupabase, {
    pollIntervalMs,
    logger: (entry) => {
      const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      console.log(`[import-queue] ${entry.level}: ${entry.message}${context}`);
      if (entry.level === 'error') {
        captureServerMessage(entry.message, { source: 'importQueue', context: entry.context }, 'error');
      }
    },
  });

  queue.start();
  console.log(`[import-queue] Dedicated worker running (poll: ${pollIntervalMs}ms).`);

  const shutdown = () => {
    queue.stop();
    console.log('[import-queue] Worker stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return queue;
};

const isDirectExecution = (): boolean => {
  if (!process.argv[1]) {
    return false;
  }
  const modulePath = fileURLToPath(import.meta.url);
  return path.resolve(process.argv[1]) === path.resolve(modulePath);
};

if (isDirectExecution()) {
  startImportWorker();
}
