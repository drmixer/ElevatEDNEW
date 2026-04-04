import { describe, expect, it } from 'vitest';

import { createServiceRoleClient } from '../../scripts/utils/supabase.js';
import { applyAdaptiveEvent } from '../learningPaths.js';

const runDbIntegrationTests =
  process.env.RUN_DB_INTEGRATION_TESTS === 'true' &&
  Boolean(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

type DbError = { message: string } | null;

type EventSeed = {
  student_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  path_entry_id?: number | null;
};

type ScenarioContext = {
  prefix: string;
  studentId: string;
  mathReviewEntryId: number;
  moduleIdBySlug: Map<string, number>;
};

type ScenarioOptions = {
  buildEventRows: (context: ScenarioContext) => EventSeed[];
  mathMasteryPct?: number;
  englishMasteryPct?: number;
  mathStateMetadata?: Record<string, unknown>;
  englishStateMetadata?: Record<string, unknown>;
};

type AdaptiveDbScenario = ScenarioContext & {
  cleanup: () => Promise<void>;
};

const mustGetInsertedRow = async <T>(
  promise: PromiseLike<{ data: T | null; error: DbError }>,
  label: string,
): Promise<T> => {
  const { data, error } = await promise;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  if (!data) {
    throw new Error(`${label}: missing row`);
  }
  return data;
};

const mustGetInsertedRows = async <T>(
  promise: PromiseLike<{ data: T[] | null; error: DbError }>,
  label: string,
): Promise<T[]> => {
  const { data, error } = await promise;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data ?? [];
};

const setupAdaptiveDbScenario = async (options: ScenarioOptions): Promise<AdaptiveDbScenario> => {
  const supabase = createServiceRoleClient();
  const prefix = `codex-adaptive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userIds: string[] = [];
  const skillIds: number[] = [];
  const moduleIds: number[] = [];
  const learningSequenceIds: number[] = [];

  try {
    const parentUser = await mustGetInsertedRow(
      supabase.auth.admin.createUser({
        email: `${prefix}-parent@example.com`,
        password: 'TempPass123!x',
        email_confirm: true,
        user_metadata: {
          role: 'parent',
          full_name: 'Codex Adaptive Parent',
        },
      }),
      'create parent auth user',
    );
    if (!parentUser.user) {
      throw new Error('create parent auth user: missing user');
    }
    userIds.push(parentUser.user.id);

    const studentUser = await mustGetInsertedRow(
      supabase.auth.admin.createUser({
        email: `${prefix}-student@example.com`,
        password: 'TempPass123!x',
        email_confirm: true,
        user_metadata: {
          role: 'student',
          full_name: 'Codex Adaptive Student',
          grade: 6,
        },
      }),
      'create student auth user',
    );
    if (!studentUser.user) {
      throw new Error('create student auth user: missing user');
    }
    userIds.push(studentUser.user.id);

    const parentId = parentUser.user.id;
    const studentId = studentUser.user.id;

    const { error: studentProfileError } = await supabase
      .from('student_profiles')
      .update({
        parent_id: parentId,
        first_name: 'Codex',
        last_name: 'Adaptive',
        age_years: 11,
        grade_level: 6,
        grade_band: '6-8',
        learning_path: [],
        assessment_completed: true,
      })
      .eq('id', studentId);
    if (studentProfileError) {
      throw new Error(`update student profile: ${studentProfileError.message}`);
    }

    const subjects = await mustGetInsertedRows(
      supabase.from('subjects').select('id, name').in('name', ['Mathematics', 'English Language Arts']),
      'load subject ids',
    );
    const mathSubjectId = subjects.find((row) => row.name === 'Mathematics')?.id as number | undefined;
    const englishSubjectId = subjects.find((row) => row.name === 'English Language Arts')?.id as number | undefined;
    if (!mathSubjectId || !englishSubjectId) {
      throw new Error('load subject ids: expected Mathematics and English Language Arts');
    }

    const mathSkill = await mustGetInsertedRow(
      supabase
        .from('skills')
        .insert({
          subject_id: mathSubjectId,
          name: `${prefix}-math-skill`,
          standard_code: '6.NS.A.1',
          description: 'DB-backed adaptive test math skill',
        })
        .select('id')
        .single(),
      'insert math skill',
    );
    skillIds.push(mathSkill.id as number);

    const englishSkill = await mustGetInsertedRow(
      supabase
        .from('skills')
        .insert({
          subject_id: englishSubjectId,
          name: `${prefix}-english-skill`,
          standard_code: 'RI.6.1',
          description: 'DB-backed adaptive test english skill',
        })
        .select('id')
        .single(),
      'insert english skill',
    );
    skillIds.push(englishSkill.id as number);

    const modules = await mustGetInsertedRows(
      supabase
        .from('modules')
        .insert([
          {
            title: 'Review Fractions Foundations',
            slug: `${prefix}-math-review-fractions`,
            summary: 'Adaptive DB test module',
            description: 'Adaptive DB test module',
            subject: 'math',
            grade_band: '6',
            visibility: 'public',
            open_track: true,
          },
          {
            title: 'Build Ratio Confidence',
            slug: `${prefix}-math-ratios-next`,
            summary: 'Adaptive DB test module',
            description: 'Adaptive DB test module',
            subject: 'math',
            grade_band: '6',
            visibility: 'public',
            open_track: true,
          },
          {
            title: 'Ratios in Word Problems',
            slug: `${prefix}-math-ratios-word-problems`,
            summary: 'Adaptive DB test module',
            description: 'Adaptive DB test module',
            subject: 'math',
            grade_band: '6',
            visibility: 'public',
            open_track: true,
          },
          {
            title: 'Strengthen Main Idea',
            slug: `${prefix}-english-main-idea`,
            summary: 'Adaptive DB test module',
            description: 'Adaptive DB test module',
            subject: 'english',
            grade_band: '6',
            visibility: 'public',
            open_track: true,
          },
          {
            title: 'Explore Ecosystems',
            slug: `${prefix}-science-ecosystems`,
            summary: 'Adaptive DB test module',
            description: 'Adaptive DB test module',
            subject: 'science',
            grade_band: '6',
            visibility: 'public',
            open_track: true,
          },
          {
            title: 'Ancient Civilizations',
            slug: `${prefix}-social-ancient-civilizations`,
            summary: 'Adaptive DB test module',
            description: 'Adaptive DB test module',
            subject: 'social_studies',
            grade_band: '6',
            visibility: 'public',
            open_track: true,
          },
        ])
        .select('id, slug'),
      'insert modules',
    );
    moduleIds.push(...modules.map((row) => row.id as number));
    const moduleIdBySlug = new Map(modules.map((row) => [row.slug as string, row.id as number] as const));

    const learningSequences = await mustGetInsertedRows(
      supabase
        .from('learning_sequences')
        .insert([
          {
            grade_band: '6',
            subject: 'science',
            position: 900,
            module_slug: `${prefix}-science-ecosystems`,
            module_title: 'Explore Ecosystems',
            standard_codes: ['MS-LS2-1'],
            module_id: moduleIdBySlug.get(`${prefix}-science-ecosystems`) ?? null,
          },
          {
            grade_band: '6',
            subject: 'social_studies',
            position: 900,
            module_slug: `${prefix}-social-ancient-civilizations`,
            module_title: 'Ancient Civilizations',
            standard_codes: ['SS.6.1'],
            module_id: moduleIdBySlug.get(`${prefix}-social-ancient-civilizations`) ?? null,
          },
        ])
        .select('id'),
      'insert learning sequences',
    );
    learningSequenceIds.push(...learningSequences.map((row) => row.id as number));

    const mathPath = await mustGetInsertedRow(
      supabase
        .from('student_paths')
        .insert({
          student_id: studentId,
          subject: 'math',
          status: 'active',
          started_at: '2026-04-03T09:00:00.000Z',
          metadata: {},
        })
        .select('id')
        .single(),
      'insert math path',
    );

    const englishPath = await mustGetInsertedRow(
      supabase
        .from('student_paths')
        .insert({
          student_id: studentId,
          subject: 'english',
          status: 'active',
          started_at: '2026-04-02T09:00:00.000Z',
          metadata: {},
        })
        .select('id')
        .single(),
      'insert english path',
    );

    const mathReviewEntry = await mustGetInsertedRow(
      supabase
        .from('student_path_entries')
        .insert({
          path_id: mathPath.id,
          position: 1,
          type: 'review',
          module_id: moduleIdBySlug.get(`${prefix}-math-review-fractions`) ?? null,
          status: 'not_started',
          target_standard_codes: ['6.NS.A.1'],
          metadata: {
            module_slug: `${prefix}-math-review-fractions`,
            module_title: 'Review Fractions Foundations',
            reason: 'remediation',
            subject: 'math',
          },
        })
        .select('id')
        .single(),
      'insert math review entry',
    );

    await mustGetInsertedRow(
      supabase
        .from('student_path_entries')
        .insert({
          path_id: mathPath.id,
          position: 2,
          type: 'lesson',
          module_id: moduleIdBySlug.get(`${prefix}-math-ratios-next`) ?? null,
          status: 'not_started',
          target_standard_codes: ['6.NS.A.2'],
          metadata: {
            module_slug: `${prefix}-math-ratios-next`,
            module_title: 'Build Ratio Confidence',
            reason: 'subject_placement',
            subject: 'math',
          },
        })
        .select('id')
        .single(),
      'insert math next entry',
    );

    await mustGetInsertedRow(
      supabase
        .from('student_path_entries')
        .insert({
          path_id: mathPath.id,
          position: 3,
          type: 'lesson',
          module_id: moduleIdBySlug.get(`${prefix}-math-ratios-word-problems`) ?? null,
          status: 'not_started',
          target_standard_codes: ['6.RP.A.1'],
          metadata: {
            module_slug: `${prefix}-math-ratios-word-problems`,
            module_title: 'Ratios in Word Problems',
            reason: 'subject_placement',
            subject: 'math',
          },
        })
        .select('id')
        .single(),
      'insert math ratios entry',
    );

    await mustGetInsertedRow(
      supabase
        .from('student_path_entries')
        .insert({
          path_id: englishPath.id,
          position: 1,
          type: 'lesson',
          module_id: moduleIdBySlug.get(`${prefix}-english-main-idea`) ?? null,
          status: 'not_started',
          target_standard_codes: ['RI.6.1'],
          metadata: {
            module_slug: `${prefix}-english-main-idea`,
            module_title: 'Strengthen Main Idea',
            reason: 'subject_placement',
            subject: 'english',
          },
        })
        .select('id')
        .single(),
      'insert english entry',
    );

    await mustGetInsertedRows(
      supabase
        .from('student_subject_state')
        .insert([
          {
            student_id: studentId,
            subject: 'math',
            expected_level: 6,
            working_level: 4,
            level_confidence: 0.7,
            placement_status: 'completed',
            weak_standard_codes: ['6.NS.A.1'],
            recommended_module_slugs: [],
            last_path_id: mathPath.id,
            metadata: options.mathStateMetadata ?? {},
          },
          {
            student_id: studentId,
            subject: 'english',
            expected_level: 6,
            working_level: 6,
            level_confidence: 0.8,
            placement_status: 'completed',
            weak_standard_codes: [],
            recommended_module_slugs: [],
            last_path_id: englishPath.id,
            metadata: options.englishStateMetadata ?? {},
          },
        ])
        .select('id'),
      'insert subject state',
    );

    await mustGetInsertedRows(
      supabase
        .from('student_mastery')
        .insert([
          {
            student_id: studentId,
            skill_id: mathSkill.id,
            mastery_pct: options.mathMasteryPct ?? 58,
          },
          {
            student_id: studentId,
            skill_id: englishSkill.id,
            mastery_pct: options.englishMasteryPct ?? 91,
          },
        ])
        .select('id'),
      'insert mastery rows',
    );

    await mustGetInsertedRows(
      supabase
        .from('student_events')
        .insert(
          options.buildEventRows({
            prefix,
            studentId,
            mathReviewEntryId: mathReviewEntry.id as number,
            moduleIdBySlug,
          }),
        )
        .select('id'),
      'insert event rows',
    );

    return {
      prefix,
      studentId,
      mathReviewEntryId: mathReviewEntry.id as number,
      moduleIdBySlug,
      cleanup: async () => {
        if (learningSequenceIds.length > 0) {
          await supabase.from('learning_sequences').delete().in('id', learningSequenceIds);
        }
        for (const userId of [...userIds].reverse()) {
          await supabase.auth.admin.deleteUser(userId);
        }
        if (skillIds.length > 0) {
          await supabase.from('skills').delete().in('id', skillIds);
        }
        if (moduleIds.length > 0) {
          await supabase.from('modules').delete().in('id', moduleIds);
        }
      },
    };
  } catch (error) {
    if (learningSequenceIds.length > 0) {
      await supabase.from('learning_sequences').delete().in('id', learningSequenceIds);
    }
    for (const userId of [...userIds].reverse()) {
      await supabase.auth.admin.deleteUser(userId);
    }
    if (skillIds.length > 0) {
      await supabase.from('skills').delete().in('id', skillIds);
    }
    if (moduleIds.length > 0) {
      await supabase.from('modules').delete().in('id', moduleIds);
    }
    throw error;
  }
};

const loadProfileLearningPath = async (studentId: string): Promise<Array<Record<string, unknown>>> => {
  const supabase = createServiceRoleClient();
  const profile = await mustGetInsertedRow(
    supabase.from('student_profiles').select('learning_path').eq('id', studentId).single(),
    'load profile learning path',
  );
  return (profile.learning_path as Array<Record<string, unknown>>) ?? [];
};

const loadSubjectSignal = async (studentId: string, subject: string): Promise<Record<string, unknown>> => {
  const supabase = createServiceRoleClient();
  const row = await mustGetInsertedRow(
    supabase
      .from('student_subject_state')
      .select('metadata')
      .eq('student_id', studentId)
      .eq('subject', subject)
      .single(),
    `load ${subject} subject state`,
  );
  return (((row.metadata as Record<string, unknown> | null | undefined) ?? {})
    .profile_blend_signal ?? {}) as Record<string, unknown>;
};

describe.sequential.runIf(runDbIntegrationTests)('learningPaths DB integration', () => {
  it(
    'persists blended profile replans after lesson completion',
    async () => {
      const scenario = await setupAdaptiveDbScenario({
        buildEventRows: ({ prefix, studentId, mathReviewEntryId, moduleIdBySlug }) => [
          {
            student_id: studentId,
            event_type: 'practice_answered',
            payload: {
              module_id: moduleIdBySlug.get(`${prefix}-math-review-fractions`),
              subject: 'math',
              correct: false,
              standards: ['6.NS.A.1'],
              difficulty: 2,
            },
            created_at: '2026-04-03T10:30:00.000Z',
          },
          {
            student_id: studentId,
            event_type: 'quiz_submitted',
            payload: {
              module_id: moduleIdBySlug.get(`${prefix}-english-main-idea`),
              subject: 'english',
              score: 92,
              standards: ['RI.6.1'],
              standard_breakdown: { 'RI.6.1': 92 },
              difficulty: 2,
            },
            created_at: '2026-04-03T10:00:00.000Z',
          },
          {
            student_id: studentId,
            event_type: 'lesson_completed',
            payload: {
              module_id: moduleIdBySlug.get(`${prefix}-math-review-fractions`),
              lesson_id: 900,
              subject: 'math',
              standards: ['6.NS.A.1'],
              difficulty: 2,
            },
            path_entry_id: mathReviewEntryId,
            created_at: '2026-04-03T12:00:00.000Z',
          },
        ],
      });

      try {
        expect(await loadProfileLearningPath(scenario.studentId)).toEqual([]);

        const result = await applyAdaptiveEvent(createServiceRoleClient() as never, scenario.studentId, {
          eventType: 'lesson_completed',
          pathEntryId: scenario.mathReviewEntryId,
          status: 'completed',
          timeSpentSeconds: 180,
          payload: {
            module_id: scenario.moduleIdBySlug.get(`${scenario.prefix}-math-review-fractions`),
            lesson_id: 900,
            subject: 'math',
            standards: ['6.NS.A.1'],
            difficulty: 2,
          },
        });

        const storedLearningPath = await loadProfileLearningPath(scenario.studentId);
        expect(storedLearningPath.length).toBeGreaterThanOrEqual(4);
        expect(storedLearningPath.slice(0, 3).map((entry) => entry.subject)).toEqual([
          'math',
          'math',
          'english',
        ]);
        expect(storedLearningPath.some((entry) => entry.subject === 'science')).toBe(true);
        expect(storedLearningPath.some((entry) => entry.subject === 'social_studies')).toBe(true);
        expect(storedLearningPath[0]).toMatchObject({
          subject: 'math',
          topic: 'Build Ratio Confidence',
          pathSource: 'subject_placement',
        });

        const mathSignal = await loadSubjectSignal(scenario.studentId, 'math');
        expect(mathSignal).toMatchObject({
          mastery_trend: 'support',
          trigger_subject: 'math',
          trigger_event_type: 'lesson_completed',
        });

        const updatedEntry = await mustGetInsertedRow(
          createServiceRoleClient()
            .from('student_path_entries')
            .select('status, metadata')
            .eq('id', scenario.mathReviewEntryId)
            .single(),
          'load updated path entry',
        );
        expect(updatedEntry.status).toBe('completed');
        expect(updatedEntry.metadata).toMatchObject({
          attempts: 1,
          last_correct: true,
        });

        expect(result.path?.entries.map((entry) => (entry.metadata as Record<string, unknown>).subject)).toEqual(
          expect.arrayContaining(['math', 'english', 'science', 'social_studies']),
        );
      } finally {
        await scenario.cleanup();
      }
    },
    30000,
  );

  it(
    'replans after three aligned practice and checkpoint signals',
    async () => {
      const scenario = await setupAdaptiveDbScenario({
        buildEventRows: ({ prefix, studentId, mathReviewEntryId, moduleIdBySlug }) => [
          {
            student_id: studentId,
            event_type: 'practice_answered',
            payload: {
              module_id: moduleIdBySlug.get(`${prefix}-math-review-fractions`),
              subject: 'math',
              correct: false,
              standards: ['6.NS.A.1'],
              difficulty: 2,
            },
            path_entry_id: mathReviewEntryId,
            created_at: '2026-04-03T11:40:00.000Z',
          },
          {
            student_id: studentId,
            event_type: 'quiz_submitted',
            payload: {
              module_id: moduleIdBySlug.get(`${prefix}-math-review-fractions`),
              subject: 'math',
              score: 52,
              standards: ['6.NS.A.1'],
              standard_breakdown: { '6.NS.A.1': 52 },
              difficulty: 2,
            },
            created_at: '2026-04-03T11:50:00.000Z',
          },
          {
            student_id: studentId,
            event_type: 'practice_answered',
            payload: {
              module_id: moduleIdBySlug.get(`${prefix}-math-review-fractions`),
              subject: 'math',
              correct: false,
              standards: ['6.NS.A.1'],
              difficulty: 2,
            },
            path_entry_id: mathReviewEntryId,
            created_at: '2026-04-03T12:00:00.000Z',
          },
        ],
      });

      try {
        expect(await loadProfileLearningPath(scenario.studentId)).toEqual([]);

        const result = await applyAdaptiveEvent(createServiceRoleClient() as never, scenario.studentId, {
          eventType: 'practice_answered',
          pathEntryId: scenario.mathReviewEntryId,
          status: 'in_progress',
          timeSpentSeconds: 45,
          payload: {
            module_id: scenario.moduleIdBySlug.get(`${scenario.prefix}-math-review-fractions`),
            subject: 'math',
            correct: false,
            standards: ['6.NS.A.1'],
            difficulty: 2,
          },
        });

        const storedLearningPath = await loadProfileLearningPath(scenario.studentId);
        expect(storedLearningPath.length).toBeGreaterThanOrEqual(4);
        expect(storedLearningPath.slice(0, 3).map((entry) => entry.subject)).toEqual([
          'math',
          'math',
          'english',
        ]);

        const mathSignal = await loadSubjectSignal(scenario.studentId, 'math');
        expect(mathSignal).toMatchObject({
          mastery_trend: 'support',
          trigger_subject: 'math',
          trigger_event_type: 'practice_answered',
        });
        expect(mathSignal.evidence_count).toBeGreaterThanOrEqual(3);
        expect(mathSignal.lesson_signals).toBe(0);

        expect(result.path?.entries.map((entry) => (entry.metadata as Record<string, unknown>).subject)).toEqual(
          expect.arrayContaining(['math', 'english', 'science', 'social_studies']),
        );
      } finally {
        await scenario.cleanup();
      }
    },
    30000,
  );

  it(
    'debounces repeated practice-only replans when the last replan is too recent',
    async () => {
      const recentReplanAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const signalStart = Date.now() - 90 * 1000;
      const scenario = await setupAdaptiveDbScenario({
        mathStateMetadata: {
          profile_blend_signal: {
            last_replanned_at: recentReplanAt,
            trigger_subject: 'math',
            trigger_event_type: 'practice_answered',
          },
        },
        buildEventRows: ({ prefix, studentId, mathReviewEntryId, moduleIdBySlug }) => [
          {
            student_id: studentId,
            event_type: 'practice_answered',
            payload: {
              module_id: moduleIdBySlug.get(`${prefix}-math-review-fractions`),
              subject: 'math',
              correct: false,
              standards: ['6.NS.A.1'],
              difficulty: 2,
            },
            path_entry_id: mathReviewEntryId,
            created_at: new Date(signalStart).toISOString(),
          },
          {
            student_id: studentId,
            event_type: 'quiz_submitted',
            payload: {
              module_id: moduleIdBySlug.get(`${prefix}-math-review-fractions`),
              subject: 'math',
              score: 48,
              standards: ['6.NS.A.1'],
              standard_breakdown: { '6.NS.A.1': 48 },
              difficulty: 2,
            },
            created_at: new Date(signalStart + 30_000).toISOString(),
          },
          {
            student_id: studentId,
            event_type: 'practice_answered',
            payload: {
              module_id: moduleIdBySlug.get(`${prefix}-math-review-fractions`),
              subject: 'math',
              correct: false,
              standards: ['6.NS.A.1'],
              difficulty: 2,
            },
            path_entry_id: mathReviewEntryId,
            created_at: new Date(signalStart + 60_000).toISOString(),
          },
        ],
      });

      try {
        expect(await loadProfileLearningPath(scenario.studentId)).toEqual([]);

        await applyAdaptiveEvent(createServiceRoleClient() as never, scenario.studentId, {
          eventType: 'practice_answered',
          pathEntryId: scenario.mathReviewEntryId,
          status: 'in_progress',
          timeSpentSeconds: 30,
          payload: {
            module_id: scenario.moduleIdBySlug.get(`${scenario.prefix}-math-review-fractions`),
            subject: 'math',
            correct: false,
            standards: ['6.NS.A.1'],
            difficulty: 2,
          },
        });

        expect(await loadProfileLearningPath(scenario.studentId)).toEqual([]);

        const mathSignal = await loadSubjectSignal(scenario.studentId, 'math');
        expect(mathSignal.last_replanned_at).toBe(recentReplanAt);
        expect(mathSignal.trigger_event_type).toBe('practice_answered');
      } finally {
        await scenario.cleanup();
      }
    },
    30000,
  );

  it(
    'does not replan the blended profile when evidence is still sparse',
    async () => {
      const scenario = await setupAdaptiveDbScenario({
        buildEventRows: ({ prefix, studentId, mathReviewEntryId, moduleIdBySlug }) => [
          {
            student_id: studentId,
            event_type: 'practice_answered',
            payload: {
              module_id: moduleIdBySlug.get(`${prefix}-math-review-fractions`),
              subject: 'math',
              correct: false,
              standards: ['6.NS.A.1'],
              difficulty: 2,
            },
            path_entry_id: mathReviewEntryId,
            created_at: '2026-04-03T11:40:00.000Z',
          },
        ],
      });

      try {
        expect(await loadProfileLearningPath(scenario.studentId)).toEqual([]);

        const result = await applyAdaptiveEvent(createServiceRoleClient() as never, scenario.studentId, {
          eventType: 'practice_answered',
          pathEntryId: scenario.mathReviewEntryId,
          status: 'in_progress',
          timeSpentSeconds: 35,
          payload: {
            module_id: scenario.moduleIdBySlug.get(`${scenario.prefix}-math-review-fractions`),
            subject: 'math',
            correct: false,
            standards: ['6.NS.A.1'],
            difficulty: 2,
          },
        });

        expect(await loadProfileLearningPath(scenario.studentId)).toEqual([]);
        expect(await loadSubjectSignal(scenario.studentId, 'math')).toEqual({});

        const updatedEntry = await mustGetInsertedRow(
          createServiceRoleClient()
            .from('student_path_entries')
            .select('status, metadata')
            .eq('id', scenario.mathReviewEntryId)
            .single(),
          'load sparse evidence path entry',
        );
        expect(updatedEntry.status).toBe('in_progress');
        expect(updatedEntry.metadata).toMatchObject({
          attempts: 1,
          last_correct: false,
        });

        expect(result.path?.entries.map((entry) => entry.id)).toContain(scenario.mathReviewEntryId);
      } finally {
        await scenario.cleanup();
      }
    },
    30000,
  );
});
