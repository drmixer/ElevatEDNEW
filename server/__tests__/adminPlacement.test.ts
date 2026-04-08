import { describe, expect, it } from 'vitest';

import { listRecentCatPlacementAttempts } from '../adminPlacement.js';

type TestRow = Record<string, unknown>;

const cloneRow = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const createSupabaseStub = (seed: Record<string, TestRow[]>) => {
  const tables = Object.fromEntries(
    Object.entries(seed).map(([table, rows]) => [table, rows.map((row) => cloneRow(row))]),
  ) as Record<string, TestRow[]>;

  const applyFilters = (rows: TestRow[], filters: Array<(row: TestRow) => boolean>) =>
    rows.filter((row) => filters.every((filter) => filter(row)));

  const sortRows = (
    rows: TestRow[],
    orderBy: Array<{ key: string; ascending: boolean }>,
  ) =>
    rows.slice().sort((left, right) => {
      for (const { key, ascending } of orderBy) {
        const a = left[key];
        const b = right[key];
        if (a === b) continue;
        if (a == null) return ascending ? -1 : 1;
        if (b == null) return ascending ? 1 : -1;
        if (a < b) return ascending ? -1 : 1;
        if (a > b) return ascending ? 1 : -1;
      }
      return 0;
    });

  const projectRow = (row: TestRow, columns?: string | null): TestRow => {
    if (!columns || columns === '*') return cloneRow(row);
    const keys = columns
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && !entry.includes('(') && entry !== '*');
    if (!keys.length) return cloneRow(row);
    return keys.reduce<TestRow>((acc, key) => {
      acc[key] = row[key];
      return acc;
    }, {});
  };

  const from = (table: string) => {
    const filters: Array<(row: TestRow) => boolean> = [];
    const orderBy: Array<{ key: string; ascending: boolean }> = [];
    let limitCount: number | null = null;
    let selectedColumns: string | null = null;

    const execute = async () => {
      const rows = applyFilters(tables[table] ?? [], filters);
      const ordered = orderBy.length ? sortRows(rows, orderBy) : rows.slice();
      const limited = limitCount != null ? ordered.slice(0, limitCount) : ordered;
      return { data: limited.map((row) => projectRow(row, selectedColumns)), error: null };
    };

    const builder = {
      select: (columns?: string) => {
        selectedColumns = columns ?? null;
        return builder;
      },
      in: (key: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[key]));
        return builder;
      },
      order: (key: string, options?: { ascending?: boolean }) => {
        orderBy.push({ key, ascending: options?.ascending !== false });
        return builder;
      },
      limit: (value: number) => {
        limitCount = value;
        return builder;
      },
      then: (resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
        execute().then(resolve, reject),
    };

    return builder;
  };

  return { from };
};

describe('adminPlacement', () => {
  it('returns recent CAT attempts with remediation anchor adjacency', async () => {
    const supabase = createSupabaseStub({
      student_assessment_attempts: [
        {
          id: 501,
          student_id: 'student-1',
          assessment_id: 9001,
          attempt_number: 2,
          status: 'completed',
          updated_at: '2026-04-07T20:00:00.000Z',
          completed_at: '2026-04-07T20:00:00.000Z',
          metadata: {
            diagnostic_version: 'cat_v2',
            subject: 'math',
            grade_band: '6-8',
            expected_level: 6,
            working_level: 6,
            level_confidence: 0.72,
            confidence_low: 5.6,
            confidence_high: 6.4,
            prerequisite_gaps: [{ standardCode: '6.RP.A.3', observedLevel: 6, confidence: 0.55 }],
            tested_levels: [{ level: 6, correct: 4, total: 5, accuracyPct: 80 }],
            termination_reason: 'submitted',
          },
        },
        {
          id: 502,
          student_id: 'student-2',
          assessment_id: 9002,
          attempt_number: 1,
          status: 'completed',
          updated_at: '2026-04-07T19:00:00.000Z',
          completed_at: '2026-04-07T19:00:00.000Z',
          metadata: {
            diagnostic_version: 'legacy_v1',
          },
        },
      ],
      student_profiles: [
        { id: 'student-1', first_name: 'Ada', last_name: 'Lovelace', grade_level: 6 },
      ],
      student_paths: [
        {
          id: 701,
          student_id: 'student-1',
          created_at: '2026-04-07T20:01:00.000Z',
          metadata: { attempt_id: 501 },
        },
      ],
      student_path_entries: [
        {
          path_id: 701,
          position: 1,
          type: 'lesson',
          target_standard_codes: ['6.RP.A.3'],
          metadata: { module_slug: 'previous-module' },
        },
        {
          path_id: 701,
          position: 2,
          type: 'review',
          target_standard_codes: ['6.RP.A.3'],
          metadata: {
            module_slug: 'review-module',
            module_title: 'Review Ratios',
            reason: 'remediation',
            gap_standard_code: '6.RP.A.3',
          },
        },
        {
          path_id: 701,
          position: 3,
          type: 'lesson',
          target_standard_codes: ['6.RP.A.3'],
          metadata: { module_slug: 'anchor-module' },
        },
      ],
    });

    const attempts = await listRecentCatPlacementAttempts(supabase as never, { limit: 5 });

    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      attemptId: 501,
      studentName: 'Ada Lovelace',
      workingLevel: 6,
      prerequisiteGaps: [{ standardCode: '6.RP.A.3', observedLevel: 6, confidence: 0.55 }],
      reviewAnchors: [
        {
          reviewModuleSlug: 'review-module',
          previousModuleSlug: 'previous-module',
          nextModuleSlug: 'anchor-module',
          gapStandardCode: '6.RP.A.3',
        },
      ],
    });
  });
});
