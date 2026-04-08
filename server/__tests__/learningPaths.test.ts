import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyAdaptiveEvent,
  buildStudentPath,
  buildSubjectSignalSnapshot,
  deriveExpectedLevel,
  deriveWorkingLevelEstimate,
  hasStableSignalCluster,
  savePlacementResponse,
  startPlacementAssessment,
  submitPlacementAssessment,
  resolvePlacementEngineVersion,
} from '../learningPaths.js';
import { clearOpsEventsForTests, getOpsSnapshot } from '../opsMetrics.js';

type TestRow = Record<string, unknown>;

const cloneRow = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const createLearningPathsSupabaseStub = (seed: Record<string, TestRow[]>) => {
  const tables = Object.fromEntries(
    Object.entries(seed).map(([table, rows]) => [table, rows.map((row) => cloneRow(row))]),
  ) as Record<string, TestRow[]>;
  const nextIdByTable = new Map<string, number>(
    Object.entries(tables).map(([table, rows]) => [
      table,
      rows.reduce((max, row) => {
        const id = typeof row.id === 'number' ? row.id : 0;
        return Math.max(max, id);
      }, 0) + 1,
    ]),
  );

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
    let mode: 'select' | 'update' | 'insert' | 'upsert' = 'select';
    let payload: TestRow | TestRow[] | null = null;
    let onConflictKeys: string[] = [];

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
      const cloned = inserts.map((row) => {
        const copy = cloneRow(row);
        if (copy.id == null) {
          const nextId = nextIdByTable.get(table) ?? 1;
          copy.id = nextId;
          nextIdByTable.set(table, nextId + 1);
        }
        return copy;
      });
      tables[table] = [...(tables[table] ?? []), ...cloned];
      return { data: cloned.map((row) => projectRow(row, selectedColumns)), error: null };
    };

    const runUpsert = () => {
      const rows = tables[table] ?? [];
      const inserts = (Array.isArray(payload) ? payload : [payload]).filter(Boolean) as TestRow[];
      const upserted: TestRow[] = [];

      inserts.forEach((entry) => {
        const clone = cloneRow(entry);
        const match = rows.find((row) =>
          onConflictKeys.length > 0 ? onConflictKeys.every((key) => row[key] === clone[key]) : row.id === clone.id,
        );
        if (match) {
          Object.assign(match, clone);
          upserted.push(cloneRow(match));
          return;
        }
        if (clone.id == null) {
          const nextId = nextIdByTable.get(table) ?? 1;
          clone.id = nextId;
          nextIdByTable.set(table, nextId + 1);
        }
        rows.push(clone);
        upserted.push(cloneRow(clone));
      });

      tables[table] = rows;
      return { data: upserted.map((row) => projectRow(row, selectedColumns)), error: null };
    };

    const execute = async () => {
      if (mode === 'update') return runUpdate();
      if (mode === 'insert') return runInsert();
      if (mode === 'upsert') return runUpsert();
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
      is: (key: string, value: unknown) => {
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
      upsert: (value: TestRow | TestRow[], options?: { onConflict?: string }) => {
        mode = 'upsert';
        payload = value;
        onConflictKeys = options?.onConflict?.split(',').map((entry) => entry.trim()).filter(Boolean) ?? [];
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
  clearOpsEventsForTests();
});

describe('learningPaths placement helpers', () => {
  it('derives expected level from age and grade with clamping', () => {
    expect(deriveExpectedLevel({ ageYears: 13, gradeLevel: 6 })).toBe(7);
    expect(deriveExpectedLevel({ ageYears: 6, gradeLevel: null })).toBe(1);
    expect(deriveExpectedLevel({ ageYears: 8, gradeLevel: null })).toBe(3);
    expect(deriveExpectedLevel({ ageYears: null, gradeBand: 'K-2' })).toBe(2);
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

  it('gates CAT v2 to grades 3-8 math/ELA requests', () => {
    const catConfig = {
      adaptive: {
        targetAccuracyMin: 0.65,
        targetAccuracyMax: 0.8,
        maxRemediationPending: 2,
        maxPracticePending: 3,
        struggleConsecutiveMisses: 3,
      },
      xp: {
        multiplier: 1,
        difficultyBonusMultiplier: 1,
        accuracyBonusMultiplier: 1,
        streakBonusMultiplier: 1,
      },
      tutor: { timeoutMs: 12000 },
      placement: {
        activeEngine: 'cat_v2',
        catV2NewStudentsEnabled: false,
        catV2RestartEnabled: false,
      },
    };

    expect(resolvePlacementEngineVersion({ config: catConfig, subject: 'math', gradeBand: '6-8' })).toBe('cat_v2');
    expect(resolvePlacementEngineVersion({ config: catConfig, subject: 'english', gradeBand: '3' })).toBe('cat_v2');
    expect(resolvePlacementEngineVersion({ config: catConfig, subject: 'science', gradeBand: '6-8' })).toBe('legacy_v1');
    expect(resolvePlacementEngineVersion({ config: catConfig, subject: 'math', gradeBand: 'K-2' })).toBe('legacy_v1');
  });

  it('runs CAT v2 start, save, and submit through the live placement entry points', async () => {
    const supabase = createLearningPathsSupabaseStub({
      platform_config: [{ key: 'placement.engine_active', value: 'cat_v2' }],
      student_profiles: [
        {
          id: 'student-1',
          grade_level: 6,
          grade_band: '6-8',
          age_years: 11,
          learning_path: [],
          assessment_completed: false,
        },
      ],
      student_preferences: [
        {
          student_id: 'student-1',
          avatar_id: 'avatar-starter',
          tutor_persona_id: null,
          opt_in_ai: true,
          goal_focus: null,
          theme: null,
        },
      ],
      assessments: [
        {
          id: 105,
          module_id: null,
          created_at: '2026-04-01T00:00:00.000Z',
          metadata: {
            purpose: 'diagnostic',
            grade_band: '5',
            subject_key: 'math',
            placement_level: 5,
            placement_window: { min_level: 4, max_level: 6 },
          },
        },
        {
          id: 106,
          module_id: null,
          created_at: '2026-04-02T00:00:00.000Z',
          metadata: {
            purpose: 'diagnostic',
            grade_band: '6',
            subject_key: 'math',
            placement_level: 6,
            placement_window: { min_level: 5, max_level: 7 },
          },
        },
        {
          id: 107,
          module_id: null,
          created_at: '2026-04-03T00:00:00.000Z',
          metadata: {
            purpose: 'diagnostic',
            grade_band: '7',
            subject_key: 'math',
            placement_level: 7,
            placement_window: { min_level: 6, max_level: 8 },
          },
        },
      ],
      assessment_sections: [
        { id: 205, assessment_id: 105, section_order: 1 },
        { id: 206, assessment_id: 106, section_order: 1 },
        { id: 207, assessment_id: 107, section_order: 1 },
      ],
      assessment_questions: [
        { section_id: 205, question_id: 5001, question_order: 1, weight: 1, metadata: null },
        { section_id: 206, question_id: 6001, question_order: 1, weight: 1, metadata: null },
        { section_id: 206, question_id: 6002, question_order: 2, weight: 1, metadata: null },
        { section_id: 207, question_id: 7001, question_order: 1, weight: 1, metadata: null },
      ],
      question_bank: [
        {
          id: 5001,
          prompt: 'Level 5 question',
          question_type: 'multiple_choice',
          difficulty: 2,
          metadata: { placement_level: 5, strand: 'fractions', standards: ['5.NF.A.1'] },
          tags: ['fractions'],
        },
        {
          id: 6001,
          prompt: 'Level 6 question A',
          question_type: 'multiple_choice',
          difficulty: 2,
          metadata: { placement_level: 6, strand: 'expressions', standards: ['6.EE.A.1'] },
          tags: ['expressions'],
        },
        {
          id: 6002,
          prompt: 'Level 6 question B',
          question_type: 'multiple_choice',
          difficulty: 2,
          metadata: { placement_level: 6, strand: 'expressions', standards: ['6.EE.A.2'] },
          tags: ['expressions'],
        },
        {
          id: 7001,
          prompt: 'Level 7 question',
          question_type: 'multiple_choice',
          difficulty: 3,
          metadata: { placement_level: 7, strand: 'ratios', standards: ['7.RP.A.1'] },
          tags: ['ratios'],
        },
      ],
      question_options: [
        { id: 1, question_id: 5001, option_order: 1, content: 'A', is_correct: true, feedback: null },
        { id: 2, question_id: 5001, option_order: 2, content: 'B', is_correct: false, feedback: null },
        { id: 3, question_id: 6001, option_order: 1, content: 'A', is_correct: true, feedback: null },
        { id: 4, question_id: 6001, option_order: 2, content: 'B', is_correct: false, feedback: null },
        { id: 5, question_id: 6002, option_order: 1, content: 'A', is_correct: true, feedback: null },
        { id: 6, question_id: 6002, option_order: 2, content: 'B', is_correct: false, feedback: null },
        { id: 7, question_id: 7001, option_order: 1, content: 'A', is_correct: true, feedback: null },
        { id: 8, question_id: 7001, option_order: 2, content: 'B', is_correct: false, feedback: null },
      ],
      question_skills: [],
      student_assessment_attempts: [],
      student_assessment_responses: [],
      student_events: [],
      student_paths: [],
      student_path_entries: [],
      student_subject_state: [],
      learning_sequences: [
        {
          grade_band: '6',
          position: 1,
          module_id: 901,
          module_slug: 'math-core-1',
          module_title: 'Math Core 1',
          subject: 'math',
          standard_codes: ['6.EE.A.1'],
        },
        {
          grade_band: '6',
          position: 2,
          module_id: 902,
          module_slug: 'math-core-2',
          module_title: 'Math Core 2',
          subject: 'math',
          standard_codes: ['6.EE.A.2'],
        },
      ],
      modules: [],
    });

    const started = await startPlacementAssessment(supabase as never, 'student-1', {
      subject: 'math',
      serviceSupabase: supabase as never,
    });

    expect(started.engineVersion).toBe('cat_v2');
    expect(started.assessmentId).toBe(106);
    expect(started.items).toHaveLength(1);
    expect(started.items[0]?.bankQuestionId).toBe(6001);

    const savedOne = await savePlacementResponse(
      supabase as never,
      'student-1',
      {
        assessmentId: started.assessmentId,
        attemptId: started.attemptId,
        bankQuestionId: 6001,
        optionId: 3,
      },
      supabase as never,
    );

    expect(savedOne.engineVersion).toBe('cat_v2');
    expect(savedOne.nextItem?.bankQuestionId).toBe(7001);
    expect(savedOne.isComplete).toBe(false);

    await savePlacementResponse(
      supabase as never,
      'student-1',
      {
        assessmentId: started.assessmentId,
        attemptId: started.attemptId,
        bankQuestionId: 7001,
        optionId: 8,
      },
      supabase as never,
    );

    const submitted = await submitPlacementAssessment(
      supabase as never,
      'student-1',
      {
        assessmentId: started.assessmentId,
        attemptId: started.attemptId,
        subject: 'math',
        responses: [
          { bankQuestionId: 6001, optionId: 3 },
          { bankQuestionId: 7001, optionId: 8 },
          { bankQuestionId: 6002, optionId: 5 },
        ],
      },
      supabase as never,
    );

    expect(submitted.subject).toBe('math');
    expect(submitted.workingLevel).toBe(6);
    expect(submitted.levelConfidence).toBeGreaterThan(0.5);
    expect(submitted.subjectState?.diagnostic_version).toBe('cat_v2');
    expect(submitted.subjectState?.confidence_low).not.toBeNull();
    expect(submitted.subjectState?.confidence_high).not.toBeNull();
    expect(submitted.entries).toHaveLength(2);

    const responseRows = supabase.tables.student_assessment_responses;
    expect(responseRows).toHaveLength(3);
    expect((responseRows.find((row) => row.question_id === 6002)?.metadata as Record<string, unknown>)?.diagnostic_version).toBe('cat_v2');
  });

  it('records CAT coverage-gap and low-confidence ops signals when routing must fall back', async () => {
    const supabase = createLearningPathsSupabaseStub({
      platform_config: [{ key: 'placement.engine_active', value: 'cat_v2' }],
      student_profiles: [
        {
          id: 'student-1',
          grade_level: 6,
          grade_band: '6-8',
          age_years: 11,
          learning_path: [],
          assessment_completed: false,
        },
      ],
      student_preferences: [
        {
          student_id: 'student-1',
          avatar_id: 'avatar-starter',
          tutor_persona_id: null,
          opt_in_ai: true,
          goal_focus: null,
          theme: null,
        },
      ],
      assessments: [
        {
          id: 206,
          module_id: null,
          created_at: '2026-04-02T00:00:00.000Z',
          metadata: {
            purpose: 'diagnostic',
            grade_band: '6',
            subject_key: 'math',
            placement_level: 6,
            placement_window: { min_level: 5, max_level: 7 },
          },
        },
        {
          id: 208,
          module_id: null,
          created_at: '2026-04-03T00:00:00.000Z',
          metadata: {
            purpose: 'diagnostic',
            grade_band: '8',
            subject_key: 'math',
            placement_level: 8,
            placement_window: { min_level: 6, max_level: 8 },
          },
        },
      ],
      assessment_sections: [
        { id: 306, assessment_id: 206, section_order: 1 },
        { id: 308, assessment_id: 208, section_order: 1 },
      ],
      assessment_questions: [
        { section_id: 306, question_id: 4001, question_order: 1, weight: 1, metadata: null },
        { section_id: 308, question_id: 8001, question_order: 1, weight: 1, metadata: null },
      ],
      question_bank: [
        {
          id: 4001,
          prompt: 'Fallback question low',
          question_type: 'multiple_choice',
          difficulty: 2,
          metadata: { placement_level: 4, strand: 'fractions', standards: ['4.NF.A.1'] },
          tags: ['fractions'],
        },
        {
          id: 8001,
          prompt: 'Fallback question high',
          question_type: 'multiple_choice',
          difficulty: 3,
          metadata: { placement_level: 8, strand: 'functions', standards: ['8.F.A.1'] },
          tags: ['functions'],
        },
      ],
      question_options: [
        { id: 31, question_id: 4001, option_order: 1, content: 'A', is_correct: true, feedback: null },
        { id: 32, question_id: 4001, option_order: 2, content: 'B', is_correct: false, feedback: null },
        { id: 33, question_id: 8001, option_order: 1, content: 'A', is_correct: true, feedback: null },
        { id: 34, question_id: 8001, option_order: 2, content: 'B', is_correct: false, feedback: null },
      ],
      question_skills: [],
      student_assessment_attempts: [],
      student_assessment_responses: [],
      student_events: [],
      student_paths: [],
      student_path_entries: [],
      student_subject_state: [],
      learning_sequences: [
        {
          grade_band: '7',
          position: 1,
          module_id: 990,
          module_slug: 'math-support-1',
          module_title: 'Math Support',
          subject: 'math',
          standard_codes: ['4.NF.A.1'],
        },
      ],
      modules: [],
    });

    const started = await startPlacementAssessment(supabase as never, 'student-1', {
      subject: 'math',
      serviceSupabase: supabase as never,
    });

    expect(started.items[0]?.bankQuestionId).toBe(4001);

    await savePlacementResponse(
      supabase as never,
      'student-1',
      {
        assessmentId: 206,
        attemptId: started.attemptId,
        bankQuestionId: 4001,
        optionId: 31,
      },
      supabase as never,
    );

    await submitPlacementAssessment(
      supabase as never,
      'student-1',
      {
        assessmentId: 206,
        attemptId: started.attemptId,
        subject: 'math',
        responses: [{ bankQuestionId: 4001, optionId: 31 }],
      },
      supabase as never,
    );

    const snapshot = getOpsSnapshot();
    expect(snapshot.totals.cat_content_gap_detected).toBeGreaterThanOrEqual(1);
    expect(snapshot.totals.cat_low_confidence).toBe(1);
    expect(snapshot.catContentGapsBySubject[0]).toEqual({ label: 'math', count: 1 });
    expect(snapshot.catLowConfidenceBySubject[0]).toEqual({ label: 'math', count: 1 });
  });

  it('front-loads prerequisite remediation modules when no downstream anchor exists', async () => {
    const supabase = createLearningPathsSupabaseStub({
      student_profiles: [
        {
          id: 'student-1',
          grade_level: 6,
          grade_band: '6-8',
          age_years: 11,
          learning_path: [],
        },
      ],
      student_paths: [],
      student_path_entries: [],
      learning_sequences: [
        {
          grade_band: '6',
          position: 1,
          module_id: 901,
          module_slug: 'math-core-1',
          module_title: 'Math Core 1',
          subject: 'math',
          standard_codes: ['6.EE.A.1'],
        },
        {
          grade_band: '6',
          position: 2,
          module_id: 902,
          module_slug: 'math-core-2',
          module_title: 'Math Core 2',
          subject: 'math',
          standard_codes: ['6.EE.A.2'],
        },
      ],
      modules: [
        { id: 801, slug: 'math-gap-review-a', title: 'Fraction Foundations Review', grade_band: '5', subject: 'math' },
        { id: 802, slug: 'math-gap-review-b', title: 'Fraction Fluency Review', grade_band: '5', subject: 'math' },
        { id: 901, slug: 'math-core-1', title: 'Math Core 1', grade_band: '6', subject: 'math' },
        { id: 902, slug: 'math-core-2', title: 'Math Core 2', grade_band: '6', subject: 'math' },
      ],
      standards: [{ id: 1, code: '5.NF.A.1' }],
      module_standards: [
        { module_id: 801, standard_id: 1 },
        { module_id: 802, standard_id: 1 },
      ],
    });

    const result = await buildStudentPath(supabase as never, 'student-1', {
      subject: 'math',
      workingLevel: 6,
      preferredModuleSlugs: ['math-gap-review-b'],
      metadata: {
        prerequisite_gaps: [{ standardCode: '5.NF.A.1', observedLevel: 5, confidence: 0.7 }],
      },
    });

    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]?.type).toBe('review');
    expect(result.entries[0]?.module_id).toBe(802);
    expect(result.entries[0]?.target_standard_codes).toEqual(['5.NF.A.1']);
    expect(result.entries[0]?.metadata).toMatchObject({
      module_slug: 'math-gap-review-b',
      reason: 'remediation',
      gap_standard_code: '5.NF.A.1',
    });
    expect(result.entries.slice(1).map((entry) => entry.module_id)).toEqual([901, 902]);
    expect(result.entries.map((entry) => entry.position)).toEqual([1, 2, 3]);
  });

  it('anchors prerequisite remediation modules before the first related core lesson in the same standard family', async () => {
    const supabase = createLearningPathsSupabaseStub({
      student_profiles: [
        {
          id: 'student-1',
          grade_level: 6,
          grade_band: '6-8',
          age_years: 11,
          learning_path: [],
        },
      ],
      student_paths: [],
      student_path_entries: [],
      learning_sequences: [
        {
          grade_band: '6',
          position: 1,
          module_id: 901,
          module_slug: 'math-core-1',
          module_title: 'Math Core 1',
          subject: 'math',
          standard_codes: ['6.G.A.1'],
        },
        {
          grade_band: '6',
          position: 2,
          module_id: 902,
          module_slug: 'math-core-2',
          module_title: 'Math Core 2',
          subject: 'math',
          standard_codes: ['6.EE.B.5'],
        },
      ],
      modules: [
        { id: 801, slug: 'math-gap-review-a', title: 'Expressions Foundations Review', grade_band: '6', subject: 'math' },
        { id: 901, slug: 'math-core-1', title: 'Math Core 1', grade_band: '6', subject: 'math' },
        { id: 902, slug: 'math-core-2', title: 'Math Core 2', grade_band: '6', subject: 'math' },
      ],
      standards: [{ id: 1, code: '6.EE.A.1' }],
      module_standards: [{ module_id: 801, standard_id: 1 }],
    });

    const result = await buildStudentPath(supabase as never, 'student-1', {
      subject: 'math',
      workingLevel: 6,
      metadata: {
        prerequisite_gaps: [{ standardCode: '6.EE.A.1', observedLevel: 6, confidence: 0.7 }],
      },
    });

    expect(result.entries).toHaveLength(3);
    expect(result.entries.map((entry) => entry.module_id)).toEqual([901, 801, 902]);
    expect(result.entries[1]?.type).toBe('review');
    expect(result.entries[1]?.target_standard_codes).toEqual(['6.EE.A.1']);
    expect(result.entries[1]?.metadata).toMatchObject({
      module_slug: 'math-gap-review-a',
      reason: 'remediation',
      gap_standard_code: '6.EE.A.1',
    });
  });

  it('prefers explicit prerequisite metadata on sequence nodes over inferred family matches', async () => {
    const supabase = createLearningPathsSupabaseStub({
      student_profiles: [
        {
          id: 'student-1',
          grade_level: 6,
          grade_band: '6-8',
          age_years: 11,
          learning_path: [],
        },
      ],
      student_paths: [],
      student_path_entries: [],
      learning_sequences: [
        {
          grade_band: '6',
          position: 1,
          module_id: 901,
          module_slug: 'math-core-1',
          module_title: 'Math Core 1',
          subject: 'math',
          standard_codes: ['5.NF.B.3'],
          metadata: {},
        },
        {
          grade_band: '6',
          position: 2,
          module_id: 902,
          module_slug: 'math-core-2',
          module_title: 'Math Core 2',
          subject: 'math',
          standard_codes: ['6.G.A.1'],
          metadata: { prerequisite_standard_codes: ['5.NF.A.1'] },
        },
      ],
      modules: [
        { id: 801, slug: 'math-gap-review-a', title: 'Fraction Foundations Review', grade_band: '5', subject: 'math' },
        { id: 901, slug: 'math-core-1', title: 'Math Core 1', grade_band: '6', subject: 'math' },
        { id: 902, slug: 'math-core-2', title: 'Math Core 2', grade_band: '6', subject: 'math' },
      ],
      standards: [{ id: 1, code: '5.NF.A.1' }],
      module_standards: [{ module_id: 801, standard_id: 1 }],
    });

    const result = await buildStudentPath(supabase as never, 'student-1', {
      subject: 'math',
      workingLevel: 6,
      metadata: {
        prerequisite_gaps: [{ standardCode: '5.NF.A.1', observedLevel: 5, confidence: 0.7 }],
      },
    });

    expect(result.entries).toHaveLength(3);
    expect(result.entries.map((entry) => entry.module_id)).toEqual([901, 801, 902]);
    expect(result.entries[1]?.type).toBe('review');
    expect(result.entries[1]?.metadata).toMatchObject({
      module_slug: 'math-gap-review-a',
      reason: 'remediation',
      gap_standard_code: '5.NF.A.1',
    });
  });

  it('leaves the core placement sequence untouched when no aligned remediation module exists', async () => {
    const supabase = createLearningPathsSupabaseStub({
      student_profiles: [
        {
          id: 'student-1',
          grade_level: 6,
          grade_band: '6-8',
          age_years: 11,
          learning_path: [],
        },
      ],
      student_paths: [],
      student_path_entries: [],
      learning_sequences: [
        {
          grade_band: '6',
          position: 1,
          module_id: 901,
          module_slug: 'math-core-1',
          module_title: 'Math Core 1',
          subject: 'math',
          standard_codes: ['6.EE.A.1'],
        },
      ],
      modules: [{ id: 901, slug: 'math-core-1', title: 'Math Core 1', grade_band: '6', subject: 'math' }],
      standards: [],
      module_standards: [],
    });

    const result = await buildStudentPath(supabase as never, 'student-1', {
      subject: 'math',
      workingLevel: 6,
      metadata: {
        prerequisite_gaps: [{ standardCode: '5.NF.A.1', observedLevel: 5, confidence: 0.7 }],
      },
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.type).toBe('lesson');
    expect(result.entries[0]?.module_id).toBe(901);
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
