import process from 'node:process';

import composeAttribution from './utils/attribution.js';
import { createServiceRoleClient, fetchLessonsByModuleIds, fetchContentSourcesByName } from './utils/supabase.js';

type ModuleRow = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  subject: string;
  grade_band: string;
  strand: string | null;
  topic: string | null;
  subtopic: string | null;
  open_track: boolean;
  metadata: Record<string, unknown> | null;
};

type SubjectRecord = { id: number; name: string };

const GRADE_BANDS = ['3', '4', '5', '6', '7', '8'];
const SUBJECTS = ['Mathematics', 'English Language Arts', 'Science', 'Social Studies'];
const LESSON_SUFFIX = 'launch';
const DEFAULT_DURATION = 45;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

const buildLessonSlug = (moduleSlug: string): string => `${moduleSlug}-${LESSON_SUFFIX}`;

const SUBJECT_TEMPLATES: Record<
  string,
  { lessonFocus: string; launch: string; guided: string; practice: string; exit: string; extensions: string; duration: number }
> = {
  Mathematics: {
    lessonFocus: 'Connect visual, numeric, and verbal representations to strengthen concept fluency.',
    launch: 'Quick estimation or notice/wonder task that surfaces intuitive ideas tied to the module’s focus.',
    guided:
      'Model a worked example on the board, pausing for turn-and-talks and micro-checks (fist-to-five, mini whiteboards).',
    practice:
      'Students solve 3–5 scaffolded problems that increase in complexity; encourage multiple strategies and share-outs.',
    exit: 'One short prompt (compute/explain) that requires naming the strategy used.',
    extensions: 'Early finishers explore an interactive (Desmos/PhET/Khan) or create a mini-poster of a strategy.',
    duration: 40,
  },
  'English Language Arts': {
    lessonFocus: 'Analyze how authors develop meaning through structure, language choices, and evidence.',
    launch:
      'Display a provocative quote/image from the text; students predict theme, tone, or point of view with a quick write.',
    guided:
      'Close-read a short passage; model annotation (vocab, figurative language, syntax) and evidence gathering.',
    practice:
      'Pairs create an evidence chart responding to a prompt (claim/evidence/commentary) using text details or visuals.',
    exit: 'Students craft a 2–3 sentence response using one quoted detail and a sentence starter.',
    extensions: 'Offer an audio/dramatic reading or primary-source image to deepen context and fluency.',
    duration: 50,
  },
  Science: {
    lessonFocus: 'Use a phenomenon to drive questioning, evidence collection, and simple modeling.',
    launch: 'Show a short clip/image; students record observations, questions, and initial hypotheses.',
    guided:
      'Demonstrate or simulate the core idea; co-construct a data table/model and discuss sources of evidence.',
    practice:
      'Small groups run a quick investigation or virtual sim, then explain patterns using CER (claim, evidence, reasoning).',
    exit: 'Write a 2-sentence CER responding to the launch question, citing the strongest evidence.',
    extensions: 'Provide an optional NASA/NOAA visual or PhET sim for deeper exploration.',
    duration: 45,
  },
  'Social Studies': {
    lessonFocus: 'Evaluate primary/secondary sources for perspective, evidence, and relevance to the inquiry question.',
    launch:
      'Examine a primary-source image/text; students note sourcing (author, date, audience) and initial inferences.',
    guided:
      'Model sourcing/corroboration with a second source; highlight bias, reliability, and key contextual details.',
    practice:
      'Students compare two sources using a T-chart (agreements, conflicts) and draft a claim supported by evidence.',
    exit: 'One-sentence claim with one cited piece of evidence (source + detail).',
    extensions: 'Optional timeline/map activity or museum/LOC/NARA artifact to widen context.',
    duration: 45,
  },
};

const pickTemplate = (subject: string) => SUBJECT_TEMPLATES[subject] ?? SUBJECT_TEMPLATES.Mathematics;

const buildLessonMarkdown = (module: ModuleRow): { content: string; duration: number } => {
  const template = pickTemplate(module.subject);
  const header = `# ${module.title}: Launch Lesson`;
  const overview = [
    `**Grade band:** ${module.grade_band}`,
    `**Subject:** ${module.subject}`,
    module.strand ? `**Strand:** ${module.strand}` : null,
    module.topic ? `**Focus topic:** ${module.topic}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const sections = [
    '## Learning Goals',
    `- ${template.lessonFocus}`,
    '## Launch (5-7 minutes)',
    `- ${template.launch}`,
    '## Guided Exploration (10-15 minutes)',
    `- ${template.guided}`,
    '## Collaborative Practice (15-20 minutes)',
    `- ${template.practice}`,
    '## Exit Ticket (5 minutes)',
    `- ${template.exit}`,
    '## Extensions & Differentiation',
    `- ${template.extensions}`,
  ];

  return {
    content: [header, overview, '', ...sections].join('\n\n').trim(),
    duration: template.duration,
  };
};

const ensureSubjectId = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  cache: Map<string, number>,
  subjectName: string,
): Promise<number> => {
  if (cache.has(subjectName)) {
    return cache.get(subjectName)!;
  }

  const { data: existing, error: loadError } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('name', subjectName)
    .limit(1)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load subject "${subjectName}": ${loadError.message}`);
  }

  if (existing?.id) {
    cache.set(subjectName, existing.id as number);
    return existing.id as number;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('subjects')
    .insert({ name: subjectName })
    .select('id, name')
    .single();

  if (insertError) {
    throw new Error(`Failed to insert subject "${subjectName}": ${insertError.message}`);
  }

  cache.set(subjectName, inserted.id as number);
  return inserted.id as number;
};

const ensureTopicId = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  subjectId: number,
  module: ModuleRow,
): Promise<number> => {
  const targetName = `${module.grade_band} ${module.topic?.trim() || module.title || module.slug}`.trim();
  const targetSlug = slugify(`${module.slug}-topic`);

  const { data: upserted, error: upsertError } = await supabase
    .from('topics')
    .upsert(
      {
        subject_id: subjectId,
        name: targetName,
        slug: targetSlug,
        description: module.summary ?? module.description ?? null,
      },
      { onConflict: 'subject_id,slug' },
    )
    .select('id')
    .single();

  if (upsertError) {
    throw new Error(`Failed to ensure topic for module ${module.slug}: ${upsertError.message}`);
  }

  return upserted.id as number;
};

const seedLaunchLessons = async (): Promise<void> => {
  const supabase = createServiceRoleClient();
  const subjectCache = new Map<string, number>();

  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select(
      'id, slug, title, summary, description, subject, grade_band, strand, topic, subtopic, open_track, metadata',
    )
    .in('subject', SUBJECTS)
    .in('grade_band', GRADE_BANDS);

  if (modulesError) {
    throw new Error(`Failed to load modules: ${modulesError.message}`);
  }

  const moduleRows = (modules ?? []) as ModuleRow[];
  if (moduleRows.length === 0) {
    console.log('No modules found for target grades/subjects.');
    return;
  }

  const lessonsByModule = await fetchLessonsByModuleIds(
    supabase,
    moduleRows.map((m) => m.id),
  );

  const sources = await fetchContentSourcesByName(supabase, ['ElevatED Author Team']);
  const authorSource = sources.get('ElevatED Author Team');
  if (!authorSource) {
    throw new Error('Content source "ElevatED Author Team" not found. Seed content_sources first.');
  }

  const attribution = composeAttribution({
    sourceName: authorSource.name,
    license: authorSource.license,
    license_url: authorSource.license_url ?? undefined,
    attribution_text: authorSource.attribution_text ?? undefined,
  });

  let insertedCount = 0;

  for (const module of moduleRows) {
    const lessonSlug = buildLessonSlug(module.slug);
    const existing = (lessonsByModule.get(module.id) ?? []).find(
      (lesson) => lesson.slug && lesson.slug.toLowerCase() === lessonSlug.toLowerCase(),
    );
    const subjectId = await ensureSubjectId(supabase, subjectCache, module.subject);
    const topicId = await ensureTopicId(supabase, subjectId, module);
    const { content, duration } = buildLessonMarkdown(module);

    const { error: insertError } = await supabase
      .from('lessons')
      .upsert(
        {
          topic_id: topicId,
          module_id: module.id,
          title: `${module.title} Launch Lesson`,
          slug: lessonSlug,
          content,
          visibility: 'public',
          open_track: module.open_track,
          is_published: true,
          estimated_duration_minutes: duration || DEFAULT_DURATION,
          attribution_block: attribution,
          media_url: null,
          metadata: {
            module_slug: module.slug,
            seeded_by: 'seed_launch_lessons_all',
            seeded_at: new Date().toISOString(),
          },
        },
        { onConflict: 'topic_id,title' },
      );

    if (insertError) {
      throw new Error(`Failed to upsert lesson for module ${module.slug}: ${insertError.message}`);
    }

    insertedCount += 1;
  }

  console.log(`Inserted ${insertedCount} launch lessons across ${moduleRows.length} modules.`);
};

const invokedFromCli =
  process.argv[1]?.includes('seed_launch_lessons_all.ts') ||
  process.argv[1]?.includes('seed_launch_lessons_all.js');

if (invokedFromCli) {
  seedLaunchLessons().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
