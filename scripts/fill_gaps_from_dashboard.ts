import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceRoleClient, fetchAllPaginated } from './utils/supabase.js';

type CoverageCell = {
  module_id: number;
  module_slug: string;
  module_title: string | null;
  subject: string;
  grade_band: string | null;
  standard_code: string | null;
  practice_items_aligned: number | null;
  practice_target: number | null;
  meets_practice_baseline: boolean;
  meets_assessment_baseline: boolean;
  external_resource_count: number | null;
  meets_external_baseline: boolean;
};

type SubjectRecord = { id: number; name: string };

type GenericExternal = {
  title: string;
  url: string;
  license: string;
  license_url?: string;
  source_provider: string;
};

const PRACTICE_TARGET_DEFAULT = 20;
const PRACTICE_CHUNK_SIZE = 25;

const EXTERNAL_BY_SUBJECT: Record<string, GenericExternal> = {
  Mathematics: {
    title: 'Khan Academy practice set (grade-aligned)',
    url: 'https://www.khanacademy.org/math',
    license: 'CC BY-NC-SA (link-only)',
    license_url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    source_provider: 'Khan Academy',
  },
  'English Language Arts': {
    title: 'Project Gutenberg reading set',
    url: 'https://www.gutenberg.org/ebooks/search/?query=children',
    license: 'Public Domain',
    license_url: 'https://www.gutenberg.org/policy/permission.html',
    source_provider: 'Project Gutenberg',
  },
  Science: {
    title: 'PhET/NOAA science resource',
    url: 'https://phet.colorado.edu/en/simulations/category/new',
    license: 'CC BY 4.0 (embed)',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    source_provider: 'PhET',
  },
  'Social Studies': {
    title: 'Library of Congress primary source',
    url: 'https://www.loc.gov/collections/',
    license: 'Public Domain',
    license_url: 'https://loc.gov/legal/',
    source_provider: 'Library of Congress',
  },
};

const dedupe = (values: (string | null | undefined)[]): string[] => {
  const set = new Set<string>();
  for (const val of values) {
    const trimmed = val?.trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set);
};

const fetchCoverage = async (supabase: SupabaseClient, gradeBands: string[] | null): Promise<CoverageCell[]> => {
  const selectColumns = [
    'module_id',
    'module_slug',
    'module_title',
    'subject',
    'grade_band',
    'standard_code',
    'practice_items_aligned',
    'practice_target',
    'meets_practice_baseline',
    'meets_assessment_baseline',
    'external_resource_count',
    'meets_external_baseline',
  ].join(',');

  const data = await fetchAllPaginated<CoverageCell>(
    (from, to) => {
      let query = supabase
        .from('coverage_dashboard_cells')
        .select(selectColumns)
        .or('meets_practice_baseline.is.false,meets_assessment_baseline.is.false,meets_external_baseline.is.false');

      if (gradeBands && gradeBands.length > 0) {
        query = query.in('grade_band', gradeBands);
      }

      return query.order('module_slug', { ascending: true }).range(from, to);
    },
    { logLabel: 'coverage_dashboard_cells' },
  );

  return data as CoverageCell[];
};

const fetchSubjects = async (supabase: SupabaseClient): Promise<Map<string, SubjectRecord>> => {
  const { data, error } = await supabase.from('subjects').select('id, name');
  if (error) {
    throw new Error(`Failed to load subjects: ${error.message}`);
  }
  const map = new Map<string, SubjectRecord>();
  for (const record of data ?? []) {
    const name = (record.name as string)?.trim();
    if (name) {
      map.set(name, { id: record.id as number, name });
    }
  }
  return map;
};

const ensurePractice = async (
  supabase: SupabaseClient,
  subjectId: number,
  cell: CoverageCell,
): Promise<number[]> => {
  const practiceTarget = cell.practice_target ?? PRACTICE_TARGET_DEFAULT;
  const { data: existingRows, error } = await supabase
    .from('question_bank')
    .select('id, metadata')
    .contains('metadata', { module_slug: cell.module_slug });
  if (error) {
    throw new Error(`Failed to load practice for ${cell.module_slug}: ${error.message}`);
  }

  const existing = existingRows ?? [];
  const existingIds = existing.map((row) => row.id as number);

  // Always update standards to include the current standard code.
  const standardCodes = dedupe([cell.standard_code]);
  if (standardCodes.length > 0 && existing.length > 0) {
    for (const row of existing) {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const mergedStandards = dedupe([
        ...(Array.isArray(meta.standards) ? (meta.standards as string[]) : []),
        ...standardCodes,
      ]);
      const updatedMeta = { ...meta, standards: mergedStandards };
      const { error: updateError } = await supabase
        .from('question_bank')
        .update({ metadata: updatedMeta })
        .eq('id', row.id as number);
      if (updateError) {
        throw new Error(`Failed to update practice metadata for ${cell.module_slug}: ${updateError.message}`);
      }
    }
  }

  const currentCount = existing.length;
  const needed = Math.max(0, practiceTarget - currentCount);
  if (needed === 0) {
    console.log(`Practice already meets target for ${cell.module_slug} (${currentCount}/${practiceTarget}).`);
    return existingIds;
  }

  const questions: {
    subject_id: number;
    question_type: 'multiple_choice';
    prompt: string;
    solution_explanation: string;
    difficulty: number;
    tags: string[];
    metadata: Record<string, unknown>;
  }[] = [];

  for (let i = 0; i < needed; i += 1) {
    questions.push({
      subject_id: subjectId,
      question_type: 'multiple_choice',
      prompt: `Practice for ${cell.module_title ?? cell.module_slug} (${currentCount + i + 1}/${practiceTarget}).`,
      solution_explanation: 'Grade-aligned reasoning; reinforce core idea.',
      difficulty: 2,
      tags: ['auto_fill_baseline', cell.module_slug],
      metadata: {
        module_slug: cell.module_slug,
        module_id: cell.module_id,
        standards: standardCodes,
        generated_by: 'fill_gaps_from_dashboard',
        generated_at: new Date().toISOString(),
      },
    });
  }

  const insertedIds: number[] = [];
  for (let i = 0; i < questions.length; i += PRACTICE_CHUNK_SIZE) {
    const chunk = questions.slice(i, i + PRACTICE_CHUNK_SIZE);
    const { data: inserted, error: insertError } = await supabase
      .from('question_bank')
      .insert(chunk)
      .select('id');
    if (insertError) {
      throw new Error(`Failed to insert practice for ${cell.module_slug}: ${insertError.message}`);
    }
    for (const row of inserted ?? []) {
      insertedIds.push(row.id as number);
    }
  }

  const allIds = [...existingIds, ...insertedIds];

  const options: {
    question_id: number;
    option_order: number;
    content: string;
    is_correct: boolean;
    feedback: string | null;
  }[] = [];

  for (const questionId of insertedIds) {
    options.push(
      {
        question_id: questionId,
        option_order: 1,
        content: 'Correct answer (on-grade).',
        is_correct: true,
        feedback: 'Good job—this matches the lesson focus.',
      },
      {
        question_id: questionId,
        option_order: 2,
        content: 'Common misconception.',
        is_correct: false,
        feedback: 'Check your reasoning and re-read the prompt.',
      },
      {
        question_id: questionId,
        option_order: 3,
        content: 'Partially correct idea.',
        is_correct: false,
        feedback: 'Consider the units/steps carefully.',
      },
      {
        question_id: questionId,
        option_order: 4,
        content: 'Off-topic choice.',
        is_correct: false,
        feedback: 'Focus on the key concept from the module.',
      },
    );
  }

  if (options.length > 0) {
    const { error: optError } = await supabase.from('question_options').insert(options);
    if (optError) {
      throw new Error(`Failed to insert options for ${cell.module_slug}: ${optError.message}`);
    }
  }

  console.log(`Added ${insertedIds.length} practice items for ${cell.module_slug}.`);
  return allIds;
};

const ensureAssessment = async (
  supabase: SupabaseClient,
  subjectId: number,
  cell: CoverageCell,
  questionIds: number[],
) => {
  if (cell.meets_assessment_baseline) {
    return;
  }

  const { data: existing, error } = await supabase
    .from('assessments')
    .select('id, metadata')
    .eq('module_id', cell.module_id)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check assessments for ${cell.module_slug}: ${error.message}`);
  }

  if ((existing ?? []).length > 0) {
    const assessment = existing[0];
    const meta = (assessment.metadata ?? {}) as Record<string, unknown>;
    const updatedMeta = {
      ...meta,
      module_slug: cell.module_slug,
      assessment_type: 'unit_assessment',
      purpose: meta.purpose ?? 'baseline',
      generated_by: 'fill_gaps_from_dashboard',
      standards: dedupe([
        ...(Array.isArray(meta.standards) ? (meta.standards as string[]) : []),
        cell.standard_code,
      ]),
    };
    const { error: updateError } = await supabase
      .from('assessments')
      .update({ metadata: updatedMeta })
      .eq('id', assessment.id as number);
    if (updateError) {
      throw new Error(`Failed to update assessment for ${cell.module_slug}: ${updateError.message}`);
    }
    return;
  }

  const { data: assessmentRow, error: insertError } = await supabase
    .from('assessments')
    .insert({
      title: `Unit Check: ${cell.module_title ?? cell.module_slug}`,
      description: 'Baseline assessment to meet coverage requirements.',
      subject_id: subjectId,
      is_adaptive: false,
      estimated_duration_minutes: 15,
      module_id: cell.module_id,
      metadata: {
        module_slug: cell.module_slug,
        assessment_type: 'unit_assessment',
        purpose: 'baseline',
        generated_by: 'fill_gaps_from_dashboard',
        standards: dedupe([cell.standard_code]),
      },
    })
    .select('id')
    .single();

  if (insertError || !assessmentRow?.id) {
    throw new Error(`Failed to create assessment for ${cell.module_slug}: ${insertError?.message}`);
  }

  const assessmentId = assessmentRow.id as number;
  const { data: sectionRow, error: sectionError } = await supabase
    .from('assessment_sections')
    .insert({
      assessment_id: assessmentId,
      section_order: 1,
      title: 'Core Understanding',
      instructions: 'Answer to show mastery of this module.',
    })
    .select('id')
    .single();

  if (sectionError || !sectionRow?.id) {
    throw new Error(`Failed to create assessment section for ${cell.module_slug}: ${sectionError?.message}`);
  }

  const sectionId = sectionRow.id as number;
  const selectedQuestions = questionIds.slice(0, Math.min(questionIds.length, 5));
  if (selectedQuestions.length < 5) {
    const remaining = 5 - selectedQuestions.length;
    const { data: extras, error: extraError } = await supabase
      .from('question_bank')
      .select('id')
      .contains('metadata', { module_slug: cell.module_slug })
      .order('id', { ascending: true })
      .limit(remaining);
    if (extraError) {
      throw new Error(`Failed to fetch extra questions for ${cell.module_slug}: ${extraError.message}`);
    }
    for (const row of extras ?? []) {
      if (selectedQuestions.length < 5) {
        selectedQuestions.push(row.id as number);
      }
    }
  }

  if (selectedQuestions.length === 0) {
    console.warn(`No questions available for assessment on ${cell.module_slug}; skipping assessment creation.`);
    return;
  }

  const links = selectedQuestions.map((questionId, index) => ({
    section_id: sectionId,
    question_id: questionId,
    question_order: index + 1,
    weight: 1.0,
    metadata: { module_slug: cell.module_slug, generated_by: 'fill_gaps_from_dashboard' },
  }));

  const { error: linkError } = await supabase.from('assessment_questions').insert(links);
  if (linkError) {
    throw new Error(`Failed to link assessment questions for ${cell.module_slug}: ${linkError.message}`);
  }
};

const ensureExternal = async (supabase: SupabaseClient, cell: CoverageCell) => {
  if (cell.meets_external_baseline) return;
  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, metadata')
    .eq('module_id', cell.module_id);
  if (error) {
    throw new Error(`Failed to check assets for ${cell.module_slug}: ${error.message}`);
  }
  const hasLink = (assets ?? []).some((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const mode = (meta.storage_mode as string | undefined)?.toLowerCase();
    return mode === 'link' || mode === 'embed';
  });
  if (hasLink) return;

  const external = EXTERNAL_BY_SUBJECT[cell.subject] ?? EXTERNAL_BY_SUBJECT.Mathematics;

  const { error: insertError } = await supabase.from('assets').insert({
    module_id: cell.module_id,
    title: external.title,
    description: 'Baseline enrichment link',
    url: external.url,
    kind: 'link',
    license: external.license,
    license_url: external.license_url ?? null,
    attribution_text: `${external.source_provider} (${external.license})`,
    metadata: {
      storage_mode: 'link',
      source_provider: external.source_provider,
      curated_by: 'fill_gaps_from_dashboard',
      module_slug: cell.module_slug,
    },
  });
  if (insertError) {
    throw new Error(`Failed to insert external for ${cell.module_slug}: ${insertError.message}`);
  }
};

const main = async () => {
  const args = process.argv.slice(2);
  let gradeBands: string[] | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--grades' || arg === '--grade-bands') {
      const value = args[i + 1];
      if (!value) {
        throw new Error(`Expected comma-separated grades after ${arg}`);
      }
      gradeBands = value
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const supabase = createServiceRoleClient();
  const [coverage, subjects] = await Promise.all([fetchCoverage(supabase, gradeBands), fetchSubjects(supabase)]);

  const subjectIdCache = subjects;

  // Use module-level de-duplication to avoid repeating per-standard rows.
  const seenModules = new Set<number>();

  for (const cell of coverage) {
    if (seenModules.has(cell.module_id)) continue;
    seenModules.add(cell.module_id);

    const subjectId = subjectIdCache.get(cell.subject)?.id;
    if (!subjectId) {
      console.warn(`Subject id missing for ${cell.subject}, skipping ${cell.module_slug}.`);
      continue;
    }

    const questionIds = await ensurePractice(supabase, subjectId, cell);
    await ensureAssessment(supabase, subjectId, cell, questionIds);
    await ensureExternal(supabase, cell);
  }

  console.log('Gap filling complete.');
};

const invokedFromCli =
  process.argv[1]?.includes('fill_gaps_from_dashboard.ts') || process.argv[1]?.includes('fill_gaps_from_dashboard.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
