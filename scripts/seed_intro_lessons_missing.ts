/* eslint-disable @typescript-eslint/no-explicit-any */
import process from 'node:process';

import { loadModuleStandards } from './import_module_standards.js';
import { createServiceRoleClient } from './utils/supabase.js';

type CoverageRow = {
  module_id: number;
  module_slug: string;
  module_title: string;
  subject: string;
  grade_band: string;
  strand: string | null;
  topic: string | null;
  subtopic: string | null;
};

type ModuleRow = CoverageRow & {
  open_track: boolean;
  summary: string | null;
  description: string | null;
  slug: string;
  title: string;
};

const INTRO_DURATION = 30;
const ATTRIBUTION = 'Source: Internal (CC BY)';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

const dedupe = (items: Array<string | null | undefined>): string[] => {
  const set = new Set<string>();
  for (const value of items) {
    const trimmed = value?.trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set);
};

const ensureSubjectId = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  cache: Map<string, number>,
  subjectName: string,
): Promise<number> => {
  const existing = cache.get(subjectName);
  if (existing) return existing;

  const { data: found, error: fetchError } = await supabase
    .from('subjects')
    .select('id')
    .eq('name', subjectName)
    .limit(1)
    .maybeSingle();
  if (fetchError) throw new Error(`Failed to load subject ${subjectName}: ${fetchError.message}`);
  if (found?.id) {
    cache.set(subjectName, found.id as number);
    return found.id as number;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('subjects')
    .insert({ name: subjectName })
    .select('id')
    .single();
  if (insertError) throw new Error(`Failed to insert subject ${subjectName}: ${insertError.message}`);
  cache.set(subjectName, inserted.id as number);
  return inserted.id as number;
};

const ensureTopicId = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  subjectId: number,
  module: ModuleRow,
): Promise<number> => {
  const targetSlug = slugify(module.module_slug);
  const targetName = module.topic?.trim() || module.module_title;

  const { data: bySlug, error: slugError } = await supabase
    .from('topics')
    .select('id')
    .eq('subject_id', subjectId)
    .eq('slug', targetSlug)
    .limit(1)
    .maybeSingle();
  if (slugError) throw new Error(`Failed to load topic for ${module.module_slug}: ${slugError.message}`);
  if (bySlug?.id) return bySlug.id as number;

  const { data: byName, error: nameError } = await supabase
    .from('topics')
    .select('id')
    .eq('subject_id', subjectId)
    .eq('name', targetName)
    .limit(1)
    .maybeSingle();
  if (nameError) throw new Error(`Failed to load topic by name for ${module.module_slug}: ${nameError.message}`);
  if (byName?.id) return byName.id as number;

  const { data: upserted, error: insertError } = await supabase
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
  if (insertError) throw new Error(`Failed to upsert topic for ${module.module_slug}: ${insertError.message}`);
  return upserted.id as number;
};

const buildLessonContent = (module: ModuleRow): string => {
  const overview = [
    `**Grade:** ${module.grade_band}`,
    `**Subject:** ${module.subject}`,
    module.strand ? `**Strand:** ${module.strand}` : null,
    module.topic ? `**Focus:** ${module.topic}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const lines = [
    `# Intro: ${module.module_title}`,
    overview,
    '## Overview',
    `Welcome to ${module.module_title}. In this short lesson, students preview the big idea and why it matters.`,
    '## Example',
    `Walk through one concrete example for ${module.module_title}. Model thinking aloud and highlight the core move learners will practice.`,
    '## Quick Check',
    `Ask students to answer one fast question about ${module.module_title} (oral or written). Collect a thumbs-up/thumbs-sideways for confidence.`,
    '## Reflection',
    'Invite students to share one connection or question they still have. Capture 1–2 responses to revisit later in the unit.',
    '## Attribution',
    ATTRIBUTION,
  ];

  return lines.join('\n\n').trim();
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  let gradeBands: string[] | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--grades' || arg === '--grade-bands') {
      const next = args[i + 1];
      if (!next) throw new Error(`Expected comma-separated grades after ${arg}`);
      gradeBands = next
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const supabase = createServiceRoleClient();

  let coverageQuery = supabase
    .from('coverage_dashboard_cells')
    .select(
      [
        'module_id',
        'module_slug',
        'module_title',
        'subject',
        'grade_band',
        'strand',
        'topic',
        'subtopic',
        'public_lesson_count',
      ].join(','),
    )
    .eq('public_lesson_count', 0);

  if (gradeBands && gradeBands.length > 0) {
    coverageQuery = coverageQuery.in('grade_band', gradeBands);
  }

  const { data: coverage, error: coverageError } = await coverageQuery;

  if (coverageError) {
    throw new Error(`Failed to load coverage cells: ${coverageError.message}`);
  }

  const moduleIds = Array.from(new Set((coverage ?? []).map((row) => row.module_id as number))).filter(Boolean);
  if (moduleIds.length === 0) {
    console.log('No modules missing public lessons.');
    return;
  }

  const { data: modulesRaw, error: modulesError } = await supabase
    .from('modules')
    .select('id, slug, title, subject, grade_band, strand, topic, subtopic, open_track, summary, description')
    .in('id', moduleIds);
  if (modulesError) throw new Error(`Failed to load modules: ${modulesError.message}`);

  const modules: ModuleRow[] =
    modulesRaw?.map((m) => ({
      module_id: m.id as number,
      module_slug: m.slug as string,
      module_title: m.title as string,
      subject: m.subject as string,
      grade_band: m.grade_band as string,
      strand: m.strand as string | null,
      topic: m.topic as string | null,
      subtopic: m.subtopic as string | null,
      open_track: (m.open_track as boolean) ?? false,
      summary: m.summary as string | null,
      description: m.description as string | null,
      slug: m.slug as string,
      title: m.title as string,
    })) ?? [];

  const subjectCache = new Map<string, number>();
  const mappings = await loadModuleStandards('mappings/module_standards_k12.json');
  const standardsBySlug = new Map<string, string[]>();
  for (const entry of mappings) {
    standardsBySlug.set(
      entry.moduleSlug,
      entry.entries.map((std) => std.code),
    );
  }

  let inserted = 0;
  let refreshed = 0;

  for (const module of modules ?? []) {
    const subjectId = await ensureSubjectId(supabase, subjectCache, module.subject as string);
    const topicId = await ensureTopicId(supabase, subjectId, module);
    const lessonSlug = `intro-${module.module_slug}`;
    const desiredTitle = `Intro: ${module.module_title} (Grade ${module.grade_band})`;
    const legacyTitle = `Intro: ${module.module_title}`;

    const { data: existing, error: existingError } = await supabase
      .from('lessons')
      .select('id, module_id, topic_id, metadata, attribution_block, visibility, is_published, open_track')
      .eq('topic_id', topicId)
      .eq('slug', lessonSlug)
      .limit(1)
      .maybeSingle();
    if (existingError) {
      throw new Error(`Failed to check existing lesson for ${module.slug}: ${existingError.message}`);
    }
    if (existing?.id) {
      const mergedMetadata = {
        ...(existing.metadata ?? {}),
        module_slug: module.module_slug,
        subject: module.subject,
        grades: dedupe([
          ...(Array.isArray((existing.metadata as any)?.grades) ? (existing.metadata as any).grades : []),
          module.grade_band,
        ]),
        standards: dedupe([
          ...(Array.isArray((existing.metadata as any)?.standards) ? (existing.metadata as any).standards : []),
          ...(standardsBySlug.get(module.module_slug) ?? []),
        ]),
        estimated_time_minutes: (existing.metadata as any)?.estimated_time_minutes ?? INTRO_DURATION,
        media_type: (existing.metadata as any)?.media_type ?? 'reading',
        storage_mode: (existing.metadata as any)?.storage_mode ?? 'stored',
        seeded_by: 'seed_intro_lessons_missing',
      };

      const needsLink =
        existing.module_id == null || existing.module_id !== module.module_id || existing.topic_id !== topicId;
      const updatePayload: Record<string, unknown> = {
        metadata: mergedMetadata,
        title: desiredTitle,
      };
      if (needsLink) {
        updatePayload.module_id = module.module_id;
        updatePayload.topic_id = topicId;
      }
      if (!existing.attribution_block || existing.attribution_block.trim().length === 0) {
        updatePayload.attribution_block = ATTRIBUTION;
      }
      if (!existing.visibility) updatePayload.visibility = 'public';
      if (existing.is_published == null) updatePayload.is_published = true;
      if (existing.open_track == null) updatePayload.open_track = module.open_track;

      const { error: updateExisting } = await supabase.from('lessons').update(updatePayload).eq('id', existing.id as number);
      if (updateExisting) {
        throw new Error(`Failed to update lesson linkage for ${module.module_slug}: ${updateExisting.message}`);
      }
      refreshed += 1;
      continue;
    }

    const fetchByTitle = async (title: string) =>
      supabase
        .from('lessons')
        .select('id, module_id, topic_id, metadata, attribution_block, visibility, is_published, open_track')
        .eq('topic_id', topicId)
        .eq('title', title)
        .limit(1)
        .maybeSingle();

    const { data: desiredMatch, error: desiredError } = await fetchByTitle(desiredTitle);
    if (desiredError) {
      throw new Error(`Failed to check existing lesson title for ${module.slug}: ${desiredError.message}`);
    }
    let existingByTitle = desiredMatch;
    if (!existingByTitle) {
      const { data: legacyMatch, error: legacyError } = await fetchByTitle(legacyTitle);
      if (legacyError) {
        throw new Error(`Failed to check legacy lesson title for ${module.slug}: ${legacyError.message}`);
      }
      existingByTitle = legacyMatch;
    }

    if (existingByTitle?.id && (!existingByTitle.module_id || existingByTitle.module_id === module.module_id)) {
      const mergedMetadata = {
        ...(existingByTitle.metadata ?? {}),
        module_slug: module.module_slug,
        subject: module.subject,
        grades: dedupe([
          ...(Array.isArray((existingByTitle.metadata as any)?.grades) ? (existingByTitle.metadata as any).grades : []),
          module.grade_band,
        ]),
        standards: dedupe([
          ...(Array.isArray((existingByTitle.metadata as any)?.standards) ? (existingByTitle.metadata as any).standards : []),
          ...(standardsBySlug.get(module.module_slug) ?? []),
        ]),
        estimated_time_minutes: (existingByTitle.metadata as any)?.estimated_time_minutes ?? INTRO_DURATION,
        media_type: (existingByTitle.metadata as any)?.media_type ?? 'reading',
        storage_mode: (existingByTitle.metadata as any)?.storage_mode ?? 'stored',
        seeded_by: 'seed_intro_lessons_missing',
      };

      const needsLink =
        existingByTitle.module_id == null ||
        existingByTitle.module_id !== module.module_id ||
        existingByTitle.topic_id !== topicId;
      const updatePayload: Record<string, unknown> = { metadata: mergedMetadata, title: desiredTitle };
      if (needsLink) {
        updatePayload.module_id = module.module_id;
        updatePayload.topic_id = topicId;
      }
      if (!existingByTitle.attribution_block || existingByTitle.attribution_block.trim().length === 0) {
        updatePayload.attribution_block = ATTRIBUTION;
      }
      if (!existingByTitle.visibility) updatePayload.visibility = 'public';
      if (existingByTitle.is_published == null) updatePayload.is_published = true;
      if (existingByTitle.open_track == null) updatePayload.open_track = module.open_track;

      const { error: updateExisting } = await supabase.from('lessons').update(updatePayload).eq('id', existingByTitle.id as number);
      if (updateExisting) {
        throw new Error(`Failed to update lesson linkage for ${module.module_slug}: ${updateExisting.message}`);
      }
      refreshed += 1;
      continue;
    }

    const standards = standardsBySlug.get(module.slug) ?? [];
    const content = buildLessonContent(module as unknown as ModuleRow);

    const { error: insertError } = await supabase.from('lessons').insert({
      topic_id: topicId,
      module_id: module.module_id,
      title: desiredTitle,
      slug: lessonSlug,
      content,
      visibility: 'public',
      open_track: (module.open_track as boolean) ?? false,
      is_published: true,
      estimated_duration_minutes: INTRO_DURATION,
      attribution_block: ATTRIBUTION,
      media_url: null,
      metadata: {
        module_slug: module.slug,
        subject: module.subject,
        grades: [module.grade_band],
        standards,
        estimated_time_minutes: INTRO_DURATION,
        media_type: 'reading',
        storage_mode: 'stored',
        seeded_by: 'seed_intro_lessons_missing',
      },
    });

    if (insertError) {
      throw new Error(`Failed to insert lesson for ${module.slug}: ${insertError.message}`);
    }

    inserted += 1;
  }

  console.log(
    `Processed ${modules.length} modules (grades ${gradeBands?.join(',') ?? 'all'}): inserted ${inserted}, refreshed ${refreshed}, skipped ${modules.length - inserted - refreshed}.`,
  );
};

const invokedFromCli =
  process.argv[1]?.includes('seed_intro_lessons_missing.ts') ||
  process.argv[1]?.includes('seed_intro_lessons_missing.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
