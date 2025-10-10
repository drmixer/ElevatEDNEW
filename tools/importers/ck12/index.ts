import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';

type UUID = `${string}-${string}-${string}-${string}-${string}`;

type CLIOptions = {
  path: string;
  dryRun: boolean;
  limit?: number;
  subject?: string;
  triggeredBy?: UUID;
};

type CK12Lesson = {
  external_id: string;
  title: string;
  slug?: string;
  content: string;
  estimated_duration_minutes?: number;
  media?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  license?: string;
  source_url?: string;
  attribution?: string;
};

type CK12Topic = {
  external_id: string;
  name: string;
  slug?: string;
  description?: string;
  prerequisites?: string[];
  difficulty_level?: number;
  lessons: CK12Lesson[];
  license?: string;
  source_url?: string;
  attribution?: string;
};

type CK12File = {
  subject: {
    name: string;
    description?: string;
    license?: string;
    source_url?: string;
    attribution?: string;
  };
  topics: CK12Topic[];
};

type EntityMetrics = { created: number; updated: number };

type ImportMetrics = {
  subjects: EntityMetrics;
  topics: EntityMetrics;
  lessons: EntityMetrics;
  prerequisites: EntityMetrics;
};

type TopicPrerequisiteLink = {
  topicId: number;
  topicExternalId?: string;
  prerequisiteExternalId: string;
};

const SOURCE_NAME = 'CK-12';
const DEFAULT_BATCH_SIZE = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const slugify = (value: string | undefined, fallback: string): string => {
  if (!value || !value.trim()) {
    return fallback;
  }

  const trimmed = value.trim().toLowerCase();
  const slug = trimmed.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || fallback;
};

const clampDifficulty = (value?: number | null): number | null => {
  if (value == null) {
    return null;
  }
  const clamped = Math.max(1, Math.min(5, Math.round(value)));
  return Number.isFinite(clamped) ? clamped : null;
};

const parseArgs = (): CLIOptions => {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    path: path.resolve(process.cwd(), './data/ck12'),
    dryRun: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--path': {
        const next = args[i + 1];
        if (!next) {
          throw new Error('Expected value after --path');
        }
        options.path = path.resolve(process.cwd(), next);
        i += 1;
        break;
      }
      case '--dryRun':
      case '--dry-run': {
        options.dryRun = true;
        break;
      }
      case '--limit': {
        const next = args[i + 1];
        if (!next) {
          throw new Error('Expected numeric value after --limit');
        }
        const parsed = Number.parseInt(next, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error('--limit must be a positive integer');
        }
        options.limit = parsed;
        i += 1;
        break;
      }
      case '--subject': {
        const next = args[i + 1];
        if (!next) {
          throw new Error('Expected value after --subject');
        }
        options.subject = next.toLowerCase();
        i += 1;
        break;
      }
      case '--triggeredBy': {
        const next = args[i + 1];
        if (!next) {
          throw new Error('Expected UUID after --triggeredBy');
        }
        options.triggeredBy = next as UUID;
        i += 1;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
};

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const withRetry = async <T>(operation: () => Promise<T>, label: string, attempts = 3): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isLast = attempt === attempts;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[retry] ${label} (attempt ${attempt}/${attempts}) failed: ${message}`);
      if (isLast) {
        break;
      }
      await sleep(250 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const readJsonFiles = async (directory: string): Promise<string[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => path.join(directory, entry.name));
};

const loadCk12File = async (filePath: string): Promise<CK12File> => {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw) as CK12File;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${(error as Error).message}`);
  }
};

const initMetrics = (): ImportMetrics => ({
  subjects: { created: 0, updated: 0 },
  topics: { created: 0, updated: 0 },
  lessons: { created: 0, updated: 0 },
  prerequisites: { created: 0, updated: 0 },
});

const increment = (metrics: EntityMetrics, key: keyof EntityMetrics, delta = 1) => {
  metrics[key] += delta;
};

const upsertSubject = async (
  client: SupabaseClient,
  file: CK12File,
  options: CLIOptions,
  metrics: ImportMetrics,
): Promise<number | null> => {
  const { subject } = file;
  const name = subject.name.trim();
  const normalizedDescription = subject.description ?? null;
  const fallbackAttribution = subject.attribution ?? `${SOURCE_NAME} (ck12.org)`;

  const { data: existing, error: selectError } = await client
    .from('subjects')
    .select('id')
    .eq('name', name)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to load subject "${name}": ${selectError.message}`);
  }

  if (options.dryRun) {
    increment(metrics.subjects, existing ? 'updated' : 'created');
    return existing?.id ?? null;
  }

  const payload = {
    name,
    description: normalizedDescription,
    source: SOURCE_NAME,
    source_url: subject.source_url ?? null,
    license: subject.license ?? null,
    attribution: fallbackAttribution,
  };

  const { data, error } = await client
    .from('subjects')
    .upsert(payload, { onConflict: 'name' })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert subject "${name}": ${error.message}`);
  }

  increment(metrics.subjects, existing ? 'updated' : 'created');
  return data.id;
};

const fetchExistingTopics = async (
  client: SupabaseClient,
  subjectId: number,
  slugs: string[],
): Promise<Map<string, { id: number; external_id: string | null }>> => {
  if (!slugs.length) {
    return new Map();
  }
  const unique = Array.from(new Set(slugs));
  const { data, error } = await client
    .from('topics')
    .select('id, slug, external_id')
    .eq('subject_id', subjectId)
    .in('slug', unique);

  if (error) {
    throw new Error(`Failed to load existing topics: ${error.message}`);
  }

  return new Map(data.map((topic) => [topic.slug, { id: topic.id, external_id: topic.external_id ?? null }]));
};

const fetchExistingLessons = async (
  client: SupabaseClient,
  topicId: number,
  slugs: string[],
): Promise<Map<string, { id: number; external_id: string | null }>> => {
  if (!slugs.length) {
    return new Map();
  }

  const unique = Array.from(new Set(slugs));
  const { data, error } = await client
    .from('lessons')
    .select('id, slug, external_id')
    .eq('topic_id', topicId)
    .in('slug', unique);

  if (error) {
    throw new Error(`Failed to load existing lessons: ${error.message}`);
  }

  return new Map(data.map((lesson) => [lesson.slug, { id: lesson.id, external_id: lesson.external_id ?? null }]));
};

const processLessons = async (
  client: SupabaseClient,
  options: CLIOptions,
  metrics: ImportMetrics,
  errors: string[],
  subject: CK12File['subject'],
  topic: CK12Topic,
  topicId: number,
): Promise<void> => {
  if (!topic.lessons.length) {
    return;
  }

  const topicBaseSlug = slugify(topic.slug ?? topic.name, `topic-${topicId}`);
  const lessonSlugs = topic.lessons.map((lesson, index) =>
    slugify(lesson.slug, `${topicBaseSlug}-lesson-${index + 1}`),
  );

  const existingMap = await fetchExistingLessons(client, topicId, lessonSlugs);

  for (let i = 0; i < topic.lessons.length; i += 1) {
    const lesson = topic.lessons[i];
    const slug = lessonSlugs[i];
    const existing = existingMap.get(slug);
    const attribution = lesson.attribution ?? topic.attribution ?? `${SOURCE_NAME} (ck12.org)`;
    const payload = {
      topic_id: topicId,
      slug,
      external_id: lesson.external_id ?? null,
      title: lesson.title,
      content: lesson.content,
      estimated_duration_minutes: lesson.estimated_duration_minutes ?? null,
      media: Array.isArray(lesson.media) ? lesson.media : [],
      metadata: lesson.metadata ?? {},
      source: SOURCE_NAME,
      source_url: lesson.source_url ?? topic.source_url ?? null,
      license: lesson.license ?? topic.license ?? subject.license ?? null,
      attribution,
      is_published: true,
    };

    if (options.dryRun) {
      increment(metrics.lessons, existing ? 'updated' : 'created');
      continue;
    }

    try {
      await withRetry(
        async () => {
          const { error } = await client.from('lessons').upsert(payload, { onConflict: 'topic_id,slug' });
          if (error) {
            throw new Error(error.message);
          }
        },
        `lesson:${payload.slug}`,
      );
      increment(metrics.lessons, existing ? 'updated' : 'created');
    } catch (error) {
      errors.push(
        `Failed to upsert lesson "${lesson.title}" (topic ${topic.name}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
};

const processTopics = async (
  client: SupabaseClient,
  options: CLIOptions,
  metrics: ImportMetrics,
  errors: string[],
  subject: CK12File['subject'],
  topics: CK12Topic[],
  subjectId: number,
  topicIdByExternalId: Map<string, number>,
  pendingPrereqs: TopicPrerequisiteLink[],
): Promise<void> => {
  if (!topics.length) {
    return;
  }

  const topicEntries = topics.map((topic, index) => ({
    topic,
    index,
    slug: slugify(topic.slug ?? topic.name, `topic-${subjectId}-${index + 1}`),
  }));

  const existingMap = await fetchExistingTopics(
    client,
    subjectId,
    topicEntries.map((entry) => entry.slug),
  );

  const chunks: typeof topicEntries[] = [];
  for (let i = 0; i < topicEntries.length; i += DEFAULT_BATCH_SIZE) {
    chunks.push(topicEntries.slice(i, i + DEFAULT_BATCH_SIZE));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async ({ topic, slug }) => {
        const existing = existingMap.get(slug);
        const difficulty = clampDifficulty(topic.difficulty_level);
        const attribution = topic.attribution ?? subject.attribution ?? `${SOURCE_NAME} (ck12.org)`;

        const payload = {
          subject_id: subjectId,
          name: topic.name,
          description: topic.description ?? null,
          slug,
          external_id: topic.external_id ?? existing?.external_id ?? null,
          difficulty_level: difficulty,
          source: SOURCE_NAME,
          source_url: topic.source_url ?? subject.source_url ?? null,
          license: topic.license ?? subject.license ?? null,
          attribution,
        };

        const existed = Boolean(existing);
        let topicId = existing?.id ?? null;

        if (!options.dryRun) {
          try {
            const { data, error } = await withRetry(
              async () =>
                client
                  .from('topics')
                  .upsert(payload, { onConflict: 'subject_id,slug' })
                  .select()
                  .single(),
              `topic:${payload.slug}`,
            );

            if (error) {
              throw new Error(error.message);
            }

            topicId = data?.id ?? null;
          } catch (error) {
            errors.push(
              `Failed to upsert topic "${topic.name}": ${error instanceof Error ? error.message : String(error)}`,
            );
            return;
          }
        }

        increment(metrics.topics, existed ? 'updated' : 'created');

        if (topicId == null) {
          // Dry-run new topics will not have synthetic IDs; skip downstream work.
          if (!options.dryRun) {
            errors.push(`Topic "${topic.name}" resolved without ID; skipping lessons and prerequisites.`);
          }
          return;
        }

        if (topic.external_id) {
          topicIdByExternalId.set(topic.external_id, topicId);
        }

        if (Array.isArray(topic.prerequisites)) {
          for (const prerequisiteId of topic.prerequisites) {
            pendingPrereqs.push({
              topicId,
              topicExternalId: topic.external_id,
              prerequisiteExternalId: prerequisiteId,
            });
          }
        }

        await processLessons(client, options, metrics, errors, subject, topic, topicId);
      }),
    );
  }
};

const processPrerequisites = async (
  client: SupabaseClient,
  options: CLIOptions,
  metrics: ImportMetrics,
  errors: string[],
  pendingPrereqs: TopicPrerequisiteLink[],
  topicIdByExternalId: Map<string, number>,
): Promise<void> => {
  if (!pendingPrereqs.length) {
    return;
  }

  const grouped = new Map<number, TopicPrerequisiteLink[]>();
  for (const link of pendingPrereqs) {
    grouped.set(link.topicId, [...(grouped.get(link.topicId) ?? []), link]);
  }

  for (const [topicId, links] of grouped.entries()) {
    const prerequisiteIds = links
      .map((link) => topicIdByExternalId.get(link.prerequisiteExternalId) ?? null)
      .filter((value): value is number => value != null);

    const missing = links.filter((link) => !topicIdByExternalId.has(link.prerequisiteExternalId));
    for (const record of missing) {
      errors.push(
        `Missing prerequisite topic for external_id "${record.prerequisiteExternalId}" (required by topic ${record.topicExternalId ?? '(unknown)'})`,
      );
    }

    if (!prerequisiteIds.length) {
      continue;
    }

    const { data: existing, error: existingError } = await client
      .from('topic_prerequisites')
      .select('prerequisite_id')
      .eq('topic_id', topicId)
      .in('prerequisite_id', prerequisiteIds);

    if (existingError) {
      errors.push(
        `Failed to load existing prerequisites for topic ${topicId}: ${existingError.message}`,
      );
      continue;
    }

    const existingSet = new Set(existing?.map((row) => row.prerequisite_id));
    const toInsert = prerequisiteIds
      .filter((id) => !existingSet.has(id))
      .map((prerequisiteId) => ({ topic_id: topicId, prerequisite_id: prerequisiteId }));

    const updatedCount = prerequisiteIds.length - toInsert.length;
    if (updatedCount > 0) {
      increment(metrics.prerequisites, 'updated', updatedCount);
    }

    if (!toInsert.length) {
      continue;
    }

    if (options.dryRun) {
      increment(metrics.prerequisites, 'created', toInsert.length);
      continue;
    }

    const { error } = await client
      .from('topic_prerequisites')
      .upsert(toInsert, { onConflict: 'topic_id,prerequisite_id' });

    if (error) {
      errors.push(`Failed to upsert prerequisites for topic ${topicId}: ${error.message}`);
      continue;
    }

    increment(metrics.prerequisites, 'created', toInsert.length);
  }
};

const startImportRun = async (
  client: SupabaseClient,
  options: CLIOptions,
  totals: ImportMetrics,
): Promise<number | null> => {
  if (options.dryRun) {
    return null;
  }

  const payload = {
    source: SOURCE_NAME,
    totals,
    triggered_by: options.triggeredBy ?? null,
    errors: [],
  };

  const { data, error } = await client.from('import_runs').insert(payload).select().single();
  if (error) {
    throw new Error(`Failed to start import run: ${error.message}`);
  }
  return data.id;
};

const finalizeImportRun = async (
  client: SupabaseClient,
  importRunId: number | null,
  totals: ImportMetrics,
  errors: string[],
): Promise<void> => {
  if (!importRunId) {
    return;
  }

  const payload = {
    finished_at: new Date().toISOString(),
    totals,
    errors,
  };

  const { error } = await client
    .from('import_runs')
    .update(payload)
    .eq('id', importRunId);

  if (error) {
    console.error(`Failed to finalize import run ${importRunId}: ${error.message}`);
  }
};

const run = async () => {
  const startedAt = Date.now();
  const options = parseArgs();

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const metrics = initMetrics();
  const errors: string[] = [];
  const topicIdByExternalId = new Map<string, number>();
  const pendingPrereqs: TopicPrerequisiteLink[] = [];

  const files = await readJsonFiles(options.path);
  if (!files.length) {
    console.warn(`No CK-12 JSON files found in ${options.path}`);
    return;
  }

  console.log(`Found ${files.length} CK-12 file(s). Starting import...`);

  let remainingTopics = options.limit ?? Number.POSITIVE_INFINITY;
  const importRunId = await startImportRun(supabase, options, metrics);

  try {
    for (const filePath of files) {
      if (remainingTopics <= 0) {
        console.log('Topic limit reached; stopping import.');
        break;
      }

      const dataset = await loadCk12File(filePath);
      const subjectNameMatch = options.subject
        ? dataset.subject.name.toLowerCase() === options.subject
        : true;

      if (!subjectNameMatch) {
        console.log(`Skipping ${filePath} (subject ${dataset.subject.name} does not match filter).`);
        continue;
      }

      console.log(`Processing ${filePath} (subject: ${dataset.subject.name})`);
      const subjectId = await upsertSubject(supabase, dataset, options, metrics);
      if (subjectId == null) {
        console.warn(`Subject "${dataset.subject.name}" unresolved in dry-run; skipping topics.`);
        continue;
      }

      const topicsToProcess = dataset.topics.slice(0, Math.min(dataset.topics.length, remainingTopics));
      remainingTopics -= topicsToProcess.length;

      await processTopics(
        supabase,
        options,
        metrics,
        errors,
        dataset.subject,
        topicsToProcess,
        subjectId,
        topicIdByExternalId,
        pendingPrereqs,
      );
    }

    await processPrerequisites(supabase, options, metrics, errors, pendingPrereqs, topicIdByExternalId);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    await finalizeImportRun(supabase, importRunId, metrics, errors);
  }

  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log('Import complete.');
  console.table([
    { entity: 'subjects', ...metrics.subjects },
    { entity: 'topics', ...metrics.topics },
    { entity: 'lessons', ...metrics.lessons },
    { entity: 'prerequisites', ...metrics.prerequisites },
  ]);
  if (errors.length) {
    console.warn(`Encountered ${errors.length} issue(s):`);
    errors.forEach((error) => console.warn(`  - ${error}`));
  }
  console.log(`Duration: ${durationSeconds}s`);
};

run().catch((error: PostgrestError | Error | unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fatal] ${message}`);
  process.exitCode = 1;
});
