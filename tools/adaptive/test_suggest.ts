import { randomUUID } from 'node:crypto';
import process from 'node:process';

import { createClient, type PostgrestError } from '@supabase/supabase-js';

type UUID = `${string}-${string}-${string}-${string}-${string}`;

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable ${key}`);
  }
  return value;
};

type TopicRecord = {
  id: number;
  name: string;
  slug: string;
};

type LessonRecord = {
  id: number;
  topic_id: number;
  title: string;
};

type Scenario = 'reinforcement' | 'advance_next_topic' | 'complete_topic';

const logHeader = (title: string) => {
  console.log(`\n=== ${title.toUpperCase()} ===`);
};

const insertSubject = async (supabase: ReturnType<typeof createClient>, name: string) => {
  const { data, error } = await supabase
    .from('subjects')
    .insert({
      name,
      description: 'Adaptive rule engine test subject',
      source: 'test-harness',
      source_url: 'https://example.org/open-numeracy',
      license: 'CC BY',
      attribution: 'Open Numeracy Initiative',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert subject: ${error.message}`);
  }

  return data.id as number;
};

const insertTopics = async (
  supabase: ReturnType<typeof createClient>,
  subjectId: number,
  suffix: string,
): Promise<TopicRecord[]> => {
  const payload = [
    {
      subject_id: subjectId,
      name: 'Foundations',
      slug: `foundations-${suffix}`,
      description: 'Core skills.',
      difficulty_level: 1,
      external_id: `demo:foundations:${suffix}`,
      source: 'test-harness',
      license: 'CC BY',
      attribution: 'Demo OER Attribution',
      source_url: 'https://example.org/foundations',
    },
    {
      subject_id: subjectId,
      name: 'Practice',
      slug: `practice-${suffix}`,
      description: 'Applied practice.',
      difficulty_level: 2,
      external_id: `demo:practice:${suffix}`,
      source: 'test-harness',
      license: 'CC BY',
      attribution: 'Demo OER Attribution',
      source_url: 'https://example.org/practice',
    },
    {
      subject_id: subjectId,
      name: 'Extensions',
      slug: `extensions-${suffix}`,
      description: 'Challenge problems.',
      difficulty_level: 3,
      external_id: `demo:extensions:${suffix}`,
      source: 'test-harness',
      license: 'CC BY',
      attribution: 'Demo OER Attribution',
      source_url: 'https://example.org/extensions',
    },
  ];

  const { data, error } = await supabase
    .from('topics')
    .insert(payload)
    .select('id, name, slug')
    .order('id');

  if (error) {
    throw new Error(`Failed to insert topics: ${error.message}`);
  }

  return data as TopicRecord[];
};

const insertLessons = async (
  supabase: ReturnType<typeof createClient>,
  topics: TopicRecord[],
  suffix: string,
): Promise<LessonRecord[]> => {
  const lessons = [
    {
      topic_id: topics[0].id,
      slug: `foundations-1-${suffix}`,
      external_id: `demo:foundations:lesson1:${suffix}`,
      title: 'Number Sense Warmup',
      content: '<p>Warmup content</p>',
      estimated_duration_minutes: 10,
      media: [],
      metadata: { tag: 'warmup' },
      source: 'test-harness',
      source_url: 'https://example.org/foundations/1',
      license: 'CC BY',
      attribution: 'Demo OER Attribution',
      is_published: true,
    },
    {
      topic_id: topics[0].id,
      slug: `foundations-2-${suffix}`,
      external_id: `demo:foundations:lesson2:${suffix}`,
      title: 'Number Sense Practice',
      content: '<p>Practice content</p>',
      estimated_duration_minutes: 12,
      media: [],
      metadata: { tag: 'practice' },
      source: 'test-harness',
      source_url: 'https://example.org/foundations/2',
      license: 'CC BY',
      attribution: 'Demo OER Attribution',
      is_published: true,
    },
    {
      topic_id: topics[1].id,
      slug: `practice-1-${suffix}`,
      external_id: `demo:practice:lesson1:${suffix}`,
      title: 'Applied Practice Set',
      content: '<p>Practice set</p>',
      estimated_duration_minutes: 15,
      media: [],
      metadata: { tag: 'applied' },
      source: 'test-harness',
      source_url: 'https://example.org/practice/1',
      license: 'CC BY',
      attribution: 'Demo OER Attribution',
      is_published: true,
    },
    {
      topic_id: topics[1].id,
      slug: `practice-2-${suffix}`,
      external_id: `demo:practice:lesson2:${suffix}`,
      title: 'Applied Practice Review',
      content: '<p>Review content</p>',
      estimated_duration_minutes: 18,
      media: [],
      metadata: { tag: 'review' },
      source: 'test-harness',
      source_url: 'https://example.org/practice/2',
      license: 'CC BY',
      attribution: 'Demo OER Attribution',
      is_published: true,
    },
    {
      topic_id: topics[2].id,
      slug: `extensions-1-${suffix}`,
      external_id: `demo:extensions:lesson1:${suffix}`,
      title: 'Challenge Problems',
      content: '<p>Challenge content</p>',
      estimated_duration_minutes: 20,
      media: [],
      metadata: { tag: 'challenge' },
      source: 'test-harness',
      source_url: 'https://example.org/extensions/1',
      license: 'CC BY',
      attribution: 'Demo OER Attribution',
      is_published: true,
    },
  ];

  const { data, error } = await supabase
    .from('lessons')
    .insert(lessons)
    .select('id, topic_id, title')
    .order('id');

  if (error) {
    throw new Error(`Failed to insert lessons: ${error.message}`);
  }

  return data as LessonRecord[];
};

const insertPrerequisites = async (
  supabase: ReturnType<typeof createClient>,
  topics: TopicRecord[],
): Promise<void> => {
  const [foundations, practice, extensions] = topics;
  const { error } = await supabase.from('topic_prerequisites').insert([
    { topic_id: practice.id, prerequisite_id: foundations.id },
    { topic_id: extensions.id, prerequisite_id: practice.id },
  ]);

  if (error) {
    throw new Error(`Failed to insert topic prerequisites: ${error.message}`);
  }
};

const insertAdaptiveRule = async (supabase: ReturnType<typeof createClient>, suffix: string): Promise<number> => {
  const { data, error } = await supabase
    .from('adaptive_rules')
    .insert({
      name: `test_ruleset_${suffix}`,
      params: {
        min_mastery_to_advance: 85,
        review_threshold: 70,
        max_attempts_for_fast_track: 2,
      },
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert adaptive rule: ${error.message}`);
  }

  return data.id as number;
};

const createParentUser = async (supabase: ReturnType<typeof createClient>, email: string) => {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: {
      role: 'parent',
      full_name: 'Test Parent',
    },
  });

  if (error || !data.user) {
    throw new Error(`Failed to create parent user: ${error?.message ?? 'unknown error'}`);
  }

  return data.user.id as UUID;
};

const createStudentUser = async (supabase: ReturnType<typeof createClient>, email: string) => {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: {
      role: 'student',
      full_name: 'Test Student',
    },
  });

  if (error || !data.user) {
    throw new Error(`Failed to create student user: ${error?.message ?? 'unknown error'}`);
  }

  return data.user.id as UUID;
};

const insertStudentProfile = async (
  supabase: ReturnType<typeof createClient>,
  studentId: UUID,
  parentId: UUID,
): Promise<void> => {
  const { error } = await supabase.from('student_profiles').insert({
    id: studentId,
    parent_id: parentId,
    first_name: 'Ada',
    last_name: 'Lovelace',
    grade_level: 4,
  });

  if (error) {
    throw new Error(`Failed to insert student profile: ${error.message}`);
  }
};

type ProgressRecord = {
  lesson_id: number;
  status: 'not_started' | 'in_progress' | 'completed';
  mastery_pct: number | null;
  attempts: number;
  last_activity_at?: string;
};

const resetProgress = async (
  supabase: ReturnType<typeof createClient>,
  studentId: UUID,
  records: ProgressRecord[],
): Promise<void> => {
  await supabase.from('student_progress').delete().eq('student_id', studentId);

  if (!records.length) {
    return;
  }

  const payload = records.map((record) => ({
    student_id: studentId,
    lesson_id: record.lesson_id,
    status: record.status,
    score: record.mastery_pct,
    mastery_pct: record.mastery_pct,
    attempts: record.attempts,
    last_activity_at: record.last_activity_at ?? new Date().toISOString(),
  }));

  const { error } = await supabase.from('student_progress').upsert(payload);
  if (error) {
    throw new Error(`Failed to insert student progress: ${error.message}`);
  }
};

const showSuggestions = (
  scenario: Scenario,
  suggestions: Array<{ lesson_id: number; topic_id: number; reason: string; confidence: number }>,
  lessonLookup: Map<number, LessonRecord>,
) => {
  logHeader(`Scenario: ${scenario}`);
  if (!suggestions.length) {
    console.log('No suggestions were returned.');
    return;
  }

  for (const suggestion of suggestions) {
    const lesson = lessonLookup.get(suggestion.lesson_id);
    console.log(
      `${suggestion.reason.padEnd(18)} | lesson: ${lesson?.title ?? suggestion.lesson_id} | topic_id: ${
        suggestion.topic_id
      } | confidence: ${suggestion.confidence.toFixed(3)}`,
    );
  }
};

const cleanup = async (
  supabase: ReturnType<typeof createClient>,
  resources: {
    studentId: UUID;
    parentId: UUID;
    lessonIds: number[];
    topicIds: number[];
    subjectId: number;
    adaptiveRuleId: number;
  },
) => {
  await supabase.from('student_progress').delete().eq('student_id', resources.studentId);
  if (resources.lessonIds.length) {
    await supabase.from('lessons').delete().in('id', resources.lessonIds);
  }
  if (resources.topicIds.length) {
    await supabase.from('topic_prerequisites').delete().in('topic_id', resources.topicIds);
    await supabase.from('topics').delete().in('id', resources.topicIds);
  }
  await supabase.from('subjects').delete().eq('id', resources.subjectId);
  await supabase.from('adaptive_rules').delete().eq('id', resources.adaptiveRuleId);
  await supabase.from('student_profiles').delete().eq('id', resources.studentId);

  await supabase.auth.admin.deleteUser(resources.studentId);
  await supabase.auth.admin.deleteUser(resources.parentId);
};

const run = async () => {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const suffix = `${Date.now()}`;
  const subjectName = `Adaptive Demo ${suffix}`;
  const parentEmail = `parent-${suffix}@example.com`;
  const studentEmail = `student-${suffix}@example.com`;

  const parentId = await createParentUser(supabase, parentEmail);
  const studentId = await createStudentUser(supabase, studentEmail);
  await insertStudentProfile(supabase, studentId, parentId);

  const subjectId = await insertSubject(supabase, subjectName);
  const topics = await insertTopics(supabase, subjectId, suffix);
  const lessons = await insertLessons(supabase, topics, suffix);
  const adaptiveRuleId = await insertAdaptiveRule(supabase, suffix);
  await insertPrerequisites(supabase, topics);

  const lessonLookup = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  try {
    // Scenario 1: reinforcement (mastery below review threshold).
    await resetProgress(supabase, studentId, [
      {
        lesson_id: lessons[0].id,
        status: 'in_progress',
        mastery_pct: 60,
        attempts: 1,
        last_activity_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    ]);
    const reinforcement = await supabase.rpc('suggest_next_lessons', {
      p_student_id: studentId,
      limit_count: 3,
    });
    if (reinforcement.error) {
      throw new Error(`reinforcement RPC failed: ${reinforcement.error.message}`);
    }
    showSuggestions('reinforcement', reinforcement.data ?? [], lessonLookup);

    // Scenario 2: advance to the next topic (high mastery, low attempts).
    await resetProgress(supabase, studentId, [
      {
        lesson_id: lessons[0].id,
        status: 'completed',
        mastery_pct: 92,
        attempts: 1,
        last_activity_at: new Date().toISOString(),
      },
    ]);
    const advance = await supabase.rpc('suggest_next_lessons', {
      p_student_id: studentId,
      limit_count: 3,
    });
    if (advance.error) {
      throw new Error(`advance RPC failed: ${advance.error.message}`);
    }
    showSuggestions('advance_next_topic', advance.data ?? [], lessonLookup);

    // Scenario 3: complete topic (mastery between review and advance thresholds).
    await resetProgress(supabase, studentId, [
      {
        lesson_id: lessons[0].id,
        status: 'in_progress',
        mastery_pct: 80,
        attempts: 3,
        last_activity_at: new Date().toISOString(),
      },
    ]);
    const complete = await supabase.rpc('suggest_next_lessons', {
      p_student_id: studentId,
      limit_count: 3,
    });
    if (complete.error) {
      throw new Error(`complete RPC failed: ${complete.error.message}`);
    }
    showSuggestions('complete_topic', complete.data ?? [], lessonLookup);
  } finally {
    await cleanup(supabase, {
      studentId,
      parentId,
      lessonIds: lessons.map((lesson) => lesson.id),
      topicIds: topics.map((topic) => topic.id),
      subjectId,
      adaptiveRuleId,
    });
  }
};

run().catch((error: PostgrestError | Error | unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[test-suggest] ${message}`);
  process.exitCode = 1;
});
