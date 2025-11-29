import { vi } from 'vitest';

type SupabaseResult<T = unknown> = { data: T; error: unknown; count?: number | null };

type TableConfig = {
  query?: () => Promise<SupabaseResult>;
  range?: () => Promise<SupabaseResult>;
  maybeSingle?: () => Promise<SupabaseResult>;
  single?: () => Promise<SupabaseResult>;
  insert?: (payload: unknown) => unknown;
  upsert?: (payload: unknown) => Promise<SupabaseResult>;
  update?: (payload: unknown) => Promise<SupabaseResult>;
};

type TableConfigMap = Record<string, TableConfig>;

const defaultQueryResult = (): Promise<SupabaseResult> =>
  Promise.resolve({ data: [], error: null, count: 0 });

const defaultSingleResult = (): Promise<SupabaseResult> =>
  Promise.resolve({ data: null, error: null, count: null });

/**
 * Lightweight Supabase client stub that mimics the fluent query interface and
 * lets tests provide table-specific responses.
 */
export const createSupabaseClientMock = (initial: TableConfigMap = {}) => {
  let responses: TableConfigMap = { ...initial };

  const getTableConfig = (table: string): TableConfig => responses[table] ?? {};

  const buildThenable = (table: string) => {
    const tableConfig = getTableConfig(table);

    const executeQuery = () => (tableConfig.query ? tableConfig.query() : defaultQueryResult());

    const builder: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      range: vi.fn().mockImplementation(() =>
        tableConfig.range ? tableConfig.range() : defaultQueryResult(),
      ),
      maybeSingle: vi.fn().mockImplementation(() =>
        tableConfig.maybeSingle ? tableConfig.maybeSingle() : defaultSingleResult(),
      ),
      single: vi.fn().mockImplementation(() =>
        tableConfig.single ? tableConfig.single() : defaultSingleResult(),
      ),
      insert: vi.fn((payload) => (tableConfig.insert ? tableConfig.insert(payload) : builder)),
      upsert: vi.fn((payload) =>
        tableConfig.upsert ? tableConfig.upsert(payload) : defaultSingleResult(),
      ),
      update: vi.fn((payload) =>
        tableConfig.update ? tableConfig.update(payload) : defaultSingleResult(),
      ),
      then: (resolve: (value: SupabaseResult) => unknown, reject?: (reason: unknown) => unknown) =>
        executeQuery().then(resolve, reject),
      catch: (reject: (reason: unknown) => unknown) => executeQuery().catch(reject),
    };

    return builder;
  };

  const from = vi.fn((table: string) => buildThenable(table));

  const rpc = vi.fn((fnName: string) => {
    const tableConfig = getTableConfig(`rpc:${fnName}`);
    if (tableConfig.maybeSingle) {
      return tableConfig.maybeSingle();
    }
    return defaultQueryResult();
  });

  const setResponses = (next: TableConfigMap) => {
    responses = { ...next };
  };

  return { from, rpc, setResponses };
};
