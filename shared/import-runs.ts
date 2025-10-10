export type ImportRunStatus = 'pending' | 'running' | 'success' | 'error';

export type ImportRunLogEntry = {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
};

export type ImportRunApiModel = {
  id: number;
  source: string;
  status: ImportRunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  totals: Record<string, unknown> | null;
  errors: string[];
  logs: ImportRunLogEntry[];
};
