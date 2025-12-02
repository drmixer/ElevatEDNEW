import path from 'node:path';
import process from 'node:process';

import composeAttribution from './utils/attribution.js';
import { loadStructuredFile } from './utils/files.js';
import { createServiceRoleClient, fetchContentSourcesByName, resolveModules } from './utils/supabase.js';

type AuthoredLessonOutline = {
  hook: string;
  direct_instruction: string;
  guided_practice: string;
  independent_practice: string;
  check_for_understanding: string;
  exit_ticket: string;
  materials?: string[];
};

type AuthoredLesson = {
  title: string;
  summary: string;
  objectives: string[];
  grade_band: string;
  subject: string;
  standards?: string[];
  outline: AuthoredLessonOutline;
};

type AuthoredLessonConfig = Record<string, AuthoredLesson>;

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
};

type SubjectRow = { id: number; name: string };

const DEFAULT_FILE = path.resolve(process.cwd(), 'data/lessons/authored_launch_lessons.json');

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

const buildLessonSlug = (moduleSlug: string): string => `${moduleSlug}-launch`;

const fetchSubjects = async (supabase: ReturnType<typeof createServiceRoleClient>): Promise<Map<string, SubjectRow>> => {
  const { data, error } = await supabase.from('subjects').select('id, name');
  if (error) {
    throw new Error(`Failed to load subjects: ${error.message}`);
  }
  const map = new Map<string, SubjectRow>();
  for (const record of (data ?? []) as SubjectRow[]) {
    const name = (record.name as string)?.trim();
    if (name) {
      map.set(name, { id: record.id as number, name });
    }
  }
  return map;
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

const buildLessonContent = (module: ModuleRow, lesson: AuthoredLesson): string => {
  const header = `# ${lesson.title}`;
  const overviewLines = [
    lesson.summary,
    '',
    `**Grade band:** ${lesson.grade_band}`,
    `**Subject:** ${lesson.subject}`,
    module.strand ? `**Strand:** ${module.strand}` : null,
    module.topic ? `**Focus topic:** ${module.topic}` : null,
    lesson.standards && lesson.standards.length > 0
      ? `**Standards:** ${lesson.standards.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const objectives = lesson.objectives?.length
    ? ['## Learning Objectives', ...lesson.objectives.map((objective) => `- ${objective}`)].join('\n')
    : '';

  const sections = [
    objectives,
    '## Hook',
    lesson.outline.hook,
    '## Direct Instruction',
    lesson.outline.direct_instruction,
    '## Guided Practice',
    lesson.outline.guided_practice,
    '## Independent Practice',
    lesson.outline.independent_practice,
    '## Check for Understanding',
    lesson.outline.check_for_understanding,
    '## Exit Ticket',
    lesson.outline.exit_ticket,
  ];

  if (lesson.outline.materials && lesson.outline.materials.length > 0) {
    sections.push('## Materials');
    sections.push(...lesson.outline.materials.map((material) => `- ${material}`));
  }

  return [header, overviewLines, '', ...sections.filter(Boolean)].join('\n\n').trim();
};

const parseArgs = (): { file: string } => {
  const args = process.argv.slice(2);
  let file = DEFAULT_FILE;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file' || arg === '--path') {
      const next = args[i + 1];
      if (!next) {
        throw new Error(`Expected value after ${arg}`);
      }
      file = path.resolve(process.cwd(), next);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { file };
};

const seedAuthoredLaunchLessons = async () => {
  const { file } = parseArgs();
  const config = (await loadStructuredFile<AuthoredLessonConfig>(file)) ?? {};
  const entries = Object.entries(config);

  if (entries.length === 0) {
    console.log(`No authored launch lesson definitions found in ${file}`);
    return;
  }

  const moduleSlugs = entries.map(([slug]) => slug);
  const supabase = createServiceRoleClient();

  const moduleMap = await resolveModules(supabase, moduleSlugs);
  const moduleIds = Array.from(new Set(Array.from(moduleMap.values()).map((record) => record.id)));

  const { data: modulesData, error: modulesError } = await supabase
    .from('modules')
    .select('id, slug, title, summary, description, subject, grade_band, strand, topic, subtopic, open_track')
    .in('id', moduleIds);

  if (modulesError) {
    throw new Error(`Failed to load module metadata: ${modulesError.message}`);
  }

  const modules = new Map<number, ModuleRow>();
  for (const record of (modulesData ?? []) as ModuleRow[]) {
    modules.set(record.id, record);
  }

  const subjects = await fetchSubjects(supabase);
  const subjectCache = new Map<string, number>();

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

  let upsertedCount = 0;

  for (const [moduleSlug, lesson] of entries) {
    const moduleRecord = moduleMap.get(moduleSlug) ?? moduleMap.get(moduleSlug.trim());
    if (!moduleRecord) {
      throw new Error(`Module "${moduleSlug}" not resolved during processing.`);
    }

    const module = modules.get(moduleRecord.id);
    if (!module) {
      throw new Error(`Module metadata missing for "${moduleSlug}".`);
    }

    const subject = subjects.get(module.subject);
    if (!subject) {
      throw new Error(`Subject "${module.subject}" not found for module ${module.slug}`);
    }

    const subjectId = await ensureSubjectId(supabase, subjectCache, module.subject);
    const topicId = await ensureTopicId(supabase, subjectId, module);

    const content = buildLessonContent(module, lesson);
    const lessonSlug = buildLessonSlug(module.slug);

    const { error: upsertError } = await supabase
      .from('lessons')
      .upsert(
        {
          topic_id: topicId,
          module_id: module.id,
          title: lesson.title || `${module.title} Launch Lesson`,
          slug: lessonSlug,
          content,
          visibility: 'public',
          open_track: module.open_track,
          is_published: true,
          estimated_duration_minutes: 45,
          attribution_block: attribution,
          media_url: null,
          metadata: {
            module_slug: module.slug,
            grade_band: module.grade_band,
            subject: module.subject,
            seeded_by: 'seed_authored_launch_lessons',
            seeded_at: new Date().toISOString(),
          },
        },
        { onConflict: 'topic_id,slug' },
      );

    if (upsertError) {
      throw new Error(
        `Failed to upsert authored launch lesson for module ${module.slug}: ${upsertError.message}`,
      );
    }

    upsertedCount += 1;
  }

  console.log(`Seeded ${upsertedCount} authored launch lessons from ${file}`);
};

const invokedFromCli =
  process.argv[1]?.includes('seed_authored_launch_lessons.ts') ||
  process.argv[1]?.includes('seed_authored_launch_lessons.js');

if (invokedFromCli) {
  seedAuthoredLaunchLessons().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
