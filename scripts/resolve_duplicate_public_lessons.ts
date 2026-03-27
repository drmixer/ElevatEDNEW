import 'dotenv/config';

import process from 'node:process';

import { createServiceRoleClient } from './utils/supabase.js';

type LessonRow = {
  id: number;
  module_id: number;
  slug: string;
  title: string;
  visibility: string | null;
  metadata: Record<string, unknown> | null;
};

type ModuleRow = {
  id: number;
  slug: string;
  title: string;
  subject: string;
  grade_band: string;
};

type Candidate = LessonRow & {
  managedBy: string | null;
  sourceOfTruthFile: string | null;
  score: number;
  reasons: string[];
};

type CliOptions = {
  apply: boolean;
  grades: string[];
  moduleIds: number[];
};

const DEFAULT_GRADES = ['3', '4', '5', '6', '7', '8'];
const DECIDED_BY = 'resolve_duplicate_public_lessons';

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    apply: false,
    grades: [...DEFAULT_GRADES],
    moduleIds: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--grades') {
      const value = args[index + 1];
      if (!value) throw new Error('Expected comma-separated grade bands after --grades');
      options.grades = value
        .split(',')
        .map((grade) => grade.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (arg === '--module-ids') {
      const value = args[index + 1];
      if (!value) throw new Error('Expected comma-separated ids after --module-ids');
      options.moduleIds = value
        .split(',')
        .map((id) => Number.parseInt(id.trim(), 10))
        .filter((id) => Number.isFinite(id) && id > 0);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const getManagedBy = (lesson: LessonRow): string | null => {
  const metadata = (lesson.metadata ?? {}) as Record<string, unknown>;
  return typeof metadata.managed_by === 'string'
    ? metadata.managed_by
    : typeof metadata.seeded_by === 'string'
      ? metadata.seeded_by
      : null;
};

const getSourceOfTruthFile = (lesson: LessonRow): string | null => {
  const metadata = (lesson.metadata ?? {}) as Record<string, unknown>;
  return typeof metadata.source_of_truth_file === 'string' ? metadata.source_of_truth_file : null;
};

const scoreLesson = (module: ModuleRow, lesson: LessonRow): Candidate => {
  const metadata = (lesson.metadata ?? {}) as Record<string, unknown>;
  const managedBy = getManagedBy(lesson);
  const sourceOfTruthFile = getSourceOfTruthFile(lesson);
  const reasons: string[] = [];
  let score = 0;

  if (metadata.canonical_public_lesson === true) {
    score += 1000;
    reasons.push('metadata.canonical_public_lesson');
  }

  if (managedBy === 'sync_lesson_markdown') {
    score += 900;
    reasons.push('managed_by=sync_lesson_markdown');
  }

  if (sourceOfTruthFile?.endsWith('.md')) {
    score += 850;
    reasons.push('source_of_truth=.md');
  }

  if (managedBy === 'seed_authored_launch_lessons' || sourceOfTruthFile?.endsWith('authored_launch_lessons.json')) {
    score += 700;
    reasons.push('authored_launch');
  }

  if (lesson.slug === `${module.slug}-launch`) {
    score += 400;
    reasons.push('exact_module_launch_slug');
  }

  if (managedBy === 'seed_launch_lessons_all') {
    score += 300;
    reasons.push('seed_launch_lessons_all');
  }

  if (managedBy === 'seed_lessons') {
    score += 200;
    reasons.push('seed_lessons');
  }

  if (managedBy === 'generate_missing_lessons') {
    score += 100;
    reasons.push('generate_missing_lessons');
  }

  if (managedBy === 'seed_intro_lessons_missing') {
    score -= 150;
    reasons.push('temporary_intro_scaffold_penalty');
  }

  if (lesson.slug.startsWith('intro-')) {
    score -= 100;
    reasons.push('intro_slug_penalty');
  }

  if (managedBy === null) {
    score -= 200;
    reasons.push('unmanaged_penalty');
  }

  return {
    ...lesson,
    managedBy,
    sourceOfTruthFile,
    score,
    reasons,
  };
};

const pickCanonicalLesson = (module: ModuleRow, lessons: LessonRow[]) => {
  const candidates = lessons.map((lesson) => scoreLesson(module, lesson)).sort((a, b) => b.score - a.score || a.id - b.id);

  if (candidates.length < 2) {
    return { candidates, keeper: candidates[0] ?? null, ambiguous: false };
  }

  const [best, second] = candidates;
  if (!best) {
    return { candidates, keeper: null, ambiguous: true };
  }

  const bestHasPositiveSignal = best.score > 0 && best.reasons.length > 0;
  const tiesWithSecond = second ? best.score === second.score : false;

  return {
    candidates,
    keeper: bestHasPositiveSignal && !tiesWithSecond ? best : null,
    ambiguous: !bestHasPositiveSignal || tiesWithSecond,
  };
};

const main = async () => {
  const options = parseArgs();
  const supabase = createServiceRoleClient();

  let moduleQuery = supabase
    .from('modules')
    .select('id, slug, title, subject, grade_band')
    .order('id');

  if (options.moduleIds.length > 0) {
    moduleQuery = moduleQuery.in('id', options.moduleIds);
  } else {
    moduleQuery = moduleQuery.in('grade_band', options.grades);
  }

  const { data: modulesData, error: modulesError } = await moduleQuery;
  if (modulesError) {
    throw new Error(`Failed to load modules: ${modulesError.message}`);
  }

  const modules = (modulesData ?? []) as ModuleRow[];
  const moduleMap = new Map(modules.map((module) => [module.id, module]));
  const moduleIds = modules.map((module) => module.id);
  if (moduleIds.length === 0) {
    console.log('No matching modules found.');
    return;
  }

  const { data: lessonsData, error: lessonsError } = await supabase
    .from('lessons')
    .select('id, module_id, slug, title, visibility, metadata')
    .in('module_id', moduleIds)
    .eq('visibility', 'public')
    .order('module_id')
    .order('id');

  if (lessonsError) {
    throw new Error(`Failed to load lessons: ${lessonsError.message}`);
  }

  const publicLessons = (lessonsData ?? []) as LessonRow[];
  const lessonsByModule = new Map<number, LessonRow[]>();
  for (const lesson of publicLessons) {
    const existing = lessonsByModule.get(lesson.module_id);
    if (existing) {
      existing.push(lesson);
    } else {
      lessonsByModule.set(lesson.module_id, [lesson]);
    }
  }

  const decisions: Array<{
    module: ModuleRow;
    keeper: Candidate;
    demoted: Candidate[];
  }> = [];
  const ambiguousModules: Array<{
    module: ModuleRow;
    candidates: Candidate[];
  }> = [];

  for (const [moduleId, lessons] of lessonsByModule.entries()) {
    if (lessons.length <= 1) continue;
    const module = moduleMap.get(moduleId);
    if (!module) continue;

    const decision = pickCanonicalLesson(module, lessons);
    if (!decision.keeper || decision.ambiguous) {
      ambiguousModules.push({ module, candidates: decision.candidates });
      continue;
    }

    decisions.push({
      module,
      keeper: decision.keeper,
      demoted: decision.candidates.filter((candidate) => candidate.id !== decision.keeper!.id),
    });
  }

  console.log(
    JSON.stringify(
      {
        apply: options.apply,
        scope: options.moduleIds.length > 0 ? { moduleIds: options.moduleIds } : { grades: options.grades },
        duplicateModuleCount: Array.from(lessonsByModule.values()).filter((lessons) => lessons.length > 1).length,
        resolvedModuleCount: decisions.length,
        ambiguousModuleCount: ambiguousModules.length,
        resolvedPreview: decisions.slice(0, 20).map((decision) => ({
          moduleId: decision.module.id,
          moduleSlug: decision.module.slug,
          keeper: {
            id: decision.keeper.id,
            slug: decision.keeper.slug,
            managedBy: decision.keeper.managedBy,
            score: decision.keeper.score,
            reasons: decision.keeper.reasons,
          },
          demoted: decision.demoted.map((candidate) => ({
            id: candidate.id,
            slug: candidate.slug,
            managedBy: candidate.managedBy,
            score: candidate.score,
          })),
        })),
        ambiguousPreview: ambiguousModules.slice(0, 20).map((decision) => ({
          moduleId: decision.module.id,
          moduleSlug: decision.module.slug,
          candidates: decision.candidates.map((candidate) => ({
            id: candidate.id,
            slug: candidate.slug,
            managedBy: candidate.managedBy,
            score: candidate.score,
            reasons: candidate.reasons,
          })),
        })),
      },
      null,
      2,
    ),
  );

  if (!options.apply) {
    console.log('Dry run only. Re-run with --apply to demote duplicate public lessons.');
    return;
  }

  const decidedAt = new Date().toISOString();

  for (const decision of decisions) {
    const keeperMetadata = {
      ...((decision.keeper.metadata as Record<string, unknown> | null) ?? {}),
      canonical_public_lesson: true,
      canonical_decided_at: decidedAt,
      canonical_decided_by: DECIDED_BY,
      canonical_sibling_lessons: decision.demoted.map((lesson) => lesson.id),
    };

    const { error: keeperError } = await supabase
      .from('lessons')
      .update({ metadata: keeperMetadata })
      .eq('id', decision.keeper.id);

    if (keeperError) {
      throw new Error(`Failed to update canonical metadata for lesson ${decision.keeper.id}: ${keeperError.message}`);
    }

    for (const duplicate of decision.demoted) {
      const duplicateMetadata = {
        ...((duplicate.metadata as Record<string, unknown> | null) ?? {}),
        canonical_status: 'demoted_duplicate',
        canonical_decided_at: decidedAt,
        canonical_decided_by: DECIDED_BY,
        canonical_sibling_lesson_id: decision.keeper.id,
      };

      const { error: duplicateError } = await supabase
        .from('lessons')
        .update({
          visibility: 'draft',
          metadata: duplicateMetadata,
        })
        .eq('id', duplicate.id);

      if (duplicateError) {
        throw new Error(`Failed to demote lesson ${duplicate.id}: ${duplicateError.message}`);
      }
    }
  }

  console.log(`Demoted duplicate public lessons in ${decisions.length} module(s).`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
