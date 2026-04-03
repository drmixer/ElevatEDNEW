import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyAdaptiveEvent,
  buildSubjectSignalSnapshot,
  deriveExpectedLevel,
  deriveWorkingLevelEstimate,
  hasStableSignalCluster,
} from '../learningPaths.js';

type TestRow = Record<string, unknown>;

const cloneRow = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const createLearningPathsSupabaseStub = (seed: Record<string, TestRow[]>) => {
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
    let mode: 'select' | 'update' | 'insert' = 'select';
    let payload: TestRow | TestRow[] | null = null;

    const runSelect = () => {
      const rows = applyFilters(tables[table] ?? [], filters);
      const ordered = orderBy.length ? sortRows(rows, orderBy) : rows.slice();
      const limited = limitCount != null ? ordered.slice(0, limitCount) : ordered;
      return limited.map((row) => projectRow(row, selectedColumns));
    };

    const runUpdate = () => {
      const rows = applyFilters(tables[table] ?? [], filters);
      rows.forEach((row) => {
        Object.assign(row, cloneRow(payload));
      });
      return { data: rows.map((row) => projectRow(row, selectedColumns)), error: null };
    };

    const runInsert = () => {
      const inserts = (Array.isArray(payload) ? payload : [payload]).filter(Boolean) as TestRow[];
      const cloned = inserts.map((row) => cloneRow(row));
      tables[table] = [...(tables[table] ?? []), ...cloned];
      return { data: cloned.map((row) => projectRow(row, selectedColumns)), error: null };
    };

    const execute = async () => {
      if (mode === 'update') return runUpdate();
      if (mode === 'insert') return runInsert();
      return { data: runSelect(), error: null };
    };

    const builder = {
      select: (columns?: string) => {
        selectedColumns = columns ?? null;
        return builder;
      },
      eq: (key: string, value: unknown) => {
        filters.push((row) => row[key] === value);
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
      update: (value: TestRow) => {
        mode = 'update';
        payload = value;
        return builder;
      },
      insert: (value: TestRow | TestRow[]) => {
        mode = 'insert';
        payload = value;
        return builder;
      },
      maybeSingle: async () => {
        const result = await execute();
        const rows = Array.isArray(result.data) ? result.data : [];
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        const result = await execute();
        const rows = Array.isArray(result.data) ? result.data : [];
        return { data: rows[0] ?? null, error: null };
      },
      then: (resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
        execute().then(resolve, reject),
    };

    return builder;
  };

  return { from, tables };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('learningPaths placement helpers', () => {
  it('derives expected level from age and grade with clamping', () => {
    expect(deriveExpectedLevel({ ageYears: 13, gradeLevel: 6 })).toBe(7);
    expect(deriveExpectedLevel({ ageYears: 8, gradeLevel: null })).toBe(3);
    expect(deriveExpectedLevel({ ageYears: null, gradeLevel: 10 })).toBe(8);
  });

  it('derives working level from tested question levels and strand evidence', () => {
    const estimate = deriveWorkingLevelEstimate({
      expectedLevel: 6,
      responsesForScoring: [
        {
          isCorrect: true,
          question: {
            id: 'q1',
            bankQuestionId: 1,
            prompt: 'Question 1',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'ratios',
            targetStandards: ['6.RP.A.1'],
            metadata: { placement_level: 6 },
          },
        },
        {
          isCorrect: true,
          question: {
            id: 'q2',
            bankQuestionId: 2,
            prompt: 'Question 2',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'ratios',
            targetStandards: ['6.RP.A.2'],
            metadata: { placement_level: 6 },
          },
        },
        {
          isCorrect: true,
          question: {
            id: 'q3',
            bankQuestionId: 3,
            prompt: 'Question 3',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'expressions',
            targetStandards: ['7.EE.A.1'],
            metadata: { placement_level: 7 },
          },
        },
        {
          isCorrect: false,
          question: {
            id: 'q4',
            bankQuestionId: 4,
            prompt: 'Question 4',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'expressions',
            targetStandards: ['7.EE.A.1'],
            metadata: { placement_level: 7 },
          },
        },
        {
          isCorrect: false,
          question: {
            id: 'q5',
            bankQuestionId: 5,
            prompt: 'Question 5',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'geometry',
            targetStandards: ['7.G.A.1'],
            metadata: { placement_level: 8 },
          },
        },
        {
          isCorrect: false,
          question: {
            id: 'q6',
            bankQuestionId: 6,
            prompt: 'Question 6',
            type: 'multiple_choice',
            options: [],
            weight: 1,
            difficulty: 3,
            strand: 'geometry',
            targetStandards: ['7.G.A.1'],
            metadata: { placement_level: 8 },
          },
        },
      ],
    });

    expect(estimate.workingLevel).toBe(6);
    expect(estimate.levelConfidence).toBe(0.65);
    expect(estimate.weakStandardCodes).toContain('7.G.A.1');
    expect(estimate.strandEstimates.find((entry) => entry.strand === 'ratios')?.accuracyPct).toBe(100);
  });

  it('marks a core subject for support when live accuracy and mastery stay low', () => {
    const signal = buildSubjectSignalSnapshot({
      subject: 'math',
      state: {
        id: 1,
        student_id: 'student-1',
        subject: 'math',
        expected_level: 6,
        working_level: 4,
        level_confidence: 0.7,
        placement_status: 'completed',
        diagnostic_assessment_id: 10,
        diagnostic_attempt_id: 20,
        diagnostic_completed_at: '2026-04-01T00:00:00.000Z',
        strand_scores: {},
        weak_standard_codes: ['6.NS.A.1'],
        recommended_module_slugs: [],
        last_path_id: 3,
        metadata: {},
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-01T00:00:00.000Z',
      },
      masteryPct: 59,
      events: [
        {
          subject: 'math',
          eventType: 'practice_answered',
          createdAt: '2026-04-03T09:00:00.000Z',
          accuracy: 0,
          standards: ['6.NS.A.1'],
          completionSignal: false,
          signalDirection: 'support',
        },
        {
          subject: 'math',
          eventType: 'quiz_submitted',
          createdAt: '2026-04-03T08:30:00.000Z',
          accuracy: 0.58,
          standards: ['6.NS.A.1'],
          completionSignal: false,
          signalDirection: 'support',
        },
      ],
    });

    expect(signal.masteryTrend).toBe('support');
    expect(signal.supportPressure).toBeGreaterThanOrEqual(0.65);
    expect(signal.stretchReadiness).toBeLessThan(0.4);
  });

  it('requires three aligned signals before practice-only replanning', () => {
    expect(
      hasStableSignalCluster([
        {
          subject: 'english',
          eventType: 'practice_answered',
          createdAt: '2026-04-03T11:00:00.000Z',
          accuracy: 1,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'stretch',
        },
        {
          subject: 'english',
          eventType: 'practice_answered',
          createdAt: '2026-04-03T10:55:00.000Z',
          accuracy: 1,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'stretch',
        },
        {
          subject: 'english',
          eventType: 'quiz_submitted',
          createdAt: '2026-04-03T10:50:00.000Z',
          accuracy: 0.92,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'stretch',
        },
      ]),
    ).toBe('stretch');

    expect(
      hasStableSignalCluster([
        {
          subject: 'english',
          eventType: 'practice_answered',
          createdAt: '2026-04-03T11:00:00.000Z',
          accuracy: 1,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'stretch',
        },
        {
          subject: 'english',
          eventType: 'practice_answered',
          createdAt: '2026-04-03T10:55:00.000Z',
          accuracy: 0,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'support',
        },
        {
          subject: 'english',
          eventType: 'quiz_submitted',
          createdAt: '2026-04-03T10:50:00.000Z',
          accuracy: 0.92,
          standards: ['RI.5.1'],
          completionSignal: false,
          signalDirection: 'stretch',
        },
      ]),
    ).toBeNull();
  });

  it('rebuilds the blended profile path from live lesson signals', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T12:00:00.000Z'));

    const supabase = createLearningPathsSupabaseStub({
      platform_config: [],
      student_profiles: [
        {
          id: 'student-1',
          grade_level: 6,
          grade_band: '6-8',
          age_years: 11,
          learning_path: [],
        },
      ],
      student_paths: [
        {
          id: 201,
          student_id: 'student-1',
          subject: 'math',
          status: 'active',
          started_at: '2026-04-03T09:00:00.000Z',
          updated_at: '2026-04-03T09:00:00.000Z',
          metadata: {},
        },
        {
          id: 202,
          student_id: 'student-1',
          subject: 'english',
          status: 'active',
          started_at: '2026-04-02T09:00:00.000Z',
          updated_at: '2026-04-02T09:00:00.000Z',
          metadata: {},
        },
      ],
      student_path_entries: [
        {
          id: 301,
          path_id: 201,
          position: 1,
          type: 'review',
          module_id: 44,
          lesson_id: null,
          assessment_id: null,
          status: 'not_started',
          score: null,
          time_spent_s: null,
          target_standard_codes: ['6.NS.A.1'],
          metadata: {
            module_slug: 'math-review-fractions',
            module_title: 'Review Fractions Foundations',
            reason: 'remediation',
            subject: 'math',
          },
          created_at: '2026-04-03T09:00:00.000Z',
          updated_at: '2026-04-03T09:00:00.000Z',
        },
        {
          id: 302,
          path_id: 201,
          position: 2,
          type: 'lesson',
          module_id: 45,
          lesson_id: null,
          assessment_id: null,
          status: 'not_started',
          score: null,
          time_spent_s: null,
          target_standard_codes: ['6.NS.A.2'],
          metadata: {
            module_slug: 'math-ratios-next',
            module_title: 'Build Ratio Confidence',
            reason: 'subject_placement',
            subject: 'math',
          },
          created_at: '2026-04-03T09:00:00.000Z',
          updated_at: '2026-04-03T09:00:00.000Z',
        },
        {
          id: 303,
          path_id: 201,
          position: 3,
          type: 'lesson',
          module_id: 46,
          lesson_id: null,
          assessment_id: null,
          status: 'not_started',
          score: null,
          time_spent_s: null,
          target_standard_codes: ['6.RP.A.1'],
          metadata: {
            module_slug: 'math-ratios-word-problems',
            module_title: 'Ratios in Word Problems',
            reason: 'subject_placement',
            subject: 'math',
          },
          created_at: '2026-04-03T09:00:00.000Z',
          updated_at: '2026-04-03T09:00:00.000Z',
        },
        {
          id: 401,
          path_id: 202,
          position: 1,
          type: 'lesson',
          module_id: 55,
          lesson_id: null,
          assessment_id: null,
          status: 'not_started',
          score: null,
          time_spent_s: null,
          target_standard_codes: ['RI.6.1'],
          metadata: {
            module_slug: 'english-main-idea',
            module_title: 'Strengthen Main Idea',
            reason: 'subject_placement',
            subject: 'english',
          },
          created_at: '2026-04-02T09:00:00.000Z',
          updated_at: '2026-04-02T09:00:00.000Z',
        },
      ],
      student_events: [
        {
          student_id: 'student-1',
          event_type: 'practice_answered',
          payload: {
            module_id: 44,
            subject: 'math',
            correct: false,
            standards: ['6.NS.A.1'],
            difficulty: 2,
          },
          created_at: '2026-04-03T10:30:00.000Z',
        },
        {
          student_id: 'student-1',
          event_type: 'quiz_submitted',
          payload: {
            module_id: 55,
            subject: 'english',
            score: 92,
            standards: ['RI.6.1'],
            standard_breakdown: { 'RI.6.1': 92 },
            difficulty: 2,
          },
          created_at: '2026-04-03T10:00:00.000Z',
        },
      ],
      student_subject_state: [
        {
          id: 1,
          student_id: 'student-1',
          subject: 'math',
          expected_level: 6,
          working_level: 4,
          level_confidence: 0.7,
          placement_status: 'completed',
          diagnostic_assessment_id: 10,
          diagnostic_attempt_id: 11,
          diagnostic_completed_at: '2026-04-01T00:00:00.000Z',
          strand_scores: {},
          weak_standard_codes: ['6.NS.A.1'],
          recommended_module_slugs: [],
          last_path_id: 201,
          metadata: {},
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 2,
          student_id: 'student-1',
          subject: 'english',
          expected_level: 6,
          working_level: 6,
          level_confidence: 0.8,
          placement_status: 'completed',
          diagnostic_assessment_id: 12,
          diagnostic_attempt_id: 13,
          diagnostic_completed_at: '2026-04-01T00:00:00.000Z',
          strand_scores: {},
          weak_standard_codes: [],
          recommended_module_slugs: [],
          last_path_id: 202,
          metadata: {},
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
        },
      ],
      student_mastery_by_subject: [
        { student_id: 'student-1', subject: 'math', mastery: 58, cohort_average: 70 },
        { student_id: 'student-1', subject: 'english', mastery: 91, cohort_average: 73 },
      ],
      modules: [
        { id: 44, subject: 'math' },
        { id: 55, subject: 'english' },
      ],
      learning_sequences: [
        {
          grade_band: '6',
          position: 1,
          module_id: 601,
          module_slug: '6-science-ecosystems',
          module_title: 'Explore Ecosystems',
          subject: 'science',
          standard_codes: ['MS-LS2-1'],
        },
        {
          grade_band: '6',
          position: 1,
          module_id: 701,
          module_slug: '6-social-ancient-civilizations',
          module_title: 'Ancient Civilizations',
          subject: 'social_studies',
          standard_codes: ['SS.6.1'],
        },
      ],
    });

    const result = await applyAdaptiveEvent(supabase as never, 'student-1', {
      eventType: 'lesson_completed',
      pathEntryId: 301,
      status: 'completed',
      timeSpentSeconds: 180,
      payload: {
        module_id: 44,
        lesson_id: 900,
        subject: 'math',
        standards: ['6.NS.A.1'],
        difficulty: 2,
      },
    });

    const storedLearningPath = supabase.tables.student_profiles[0]?.learning_path as Array<Record<string, unknown>>;
    expect(storedLearningPath.map((entry) => entry.subject)).toEqual([
      'math',
      'math',
      'english',
      'science',
      'social_studies',
    ]);
    expect(storedLearningPath[0]).toMatchObject({
      subject: 'math',
      topic: 'Build Ratio Confidence',
      pathSource: 'subject_placement',
    });
    expect(storedLearningPath[1]).toMatchObject({
      subject: 'math',
      topic: 'Ratios in Word Problems',
      pathSource: 'subject_placement',
    });
    expect(storedLearningPath[3]).toMatchObject({
      subject: 'science',
      pathSource: 'cross_subject_access',
      themeGrade: 6,
      accessibilityLevel: 6,
    });

    const mathState = supabase.tables.student_subject_state.find((row) => row.subject === 'math');
    expect((mathState?.metadata as Record<string, unknown>).profile_blend_signal).toMatchObject({
      mastery_trend: 'support',
      trigger_subject: 'math',
      trigger_event_type: 'lesson_completed',
    });

    expect(result.path?.entries.map((entry) => (entry.metadata as Record<string, unknown>).subject)).toEqual([
      'math',
      'math',
      'english',
      'science',
      'social_studies',
    ]);
  });
});
