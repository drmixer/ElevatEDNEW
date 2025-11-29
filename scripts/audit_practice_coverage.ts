import process from 'node:process';

import { createServiceRoleClient, resolveModules } from './utils/supabase.js';

type ModuleDetails = { id: number; slug: string; subject: string; grade_band: string };

type QuestionRow = {
  id: number;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  difficulty: number | null;
};

type ModuleRecord = { id: number; slug: string; subject: string; grade_band: string };

const TARGET_GRADES = ['3', '4', '5', '6', '7', '8'];

const summarize = (questions: QuestionRow[], modules: Map<string, ModuleRecord>) => {
  const perSkill = new Map<string, number>();
  const perStandard = new Map<string, number>();
  const perModule = new Map<string, number>();

  for (const question of questions) {
    const metadata = (question.metadata ?? {}) as Record<string, unknown>;
    const moduleSlug = typeof metadata.module_slug === 'string' ? metadata.module_slug : null;
    const skills = Array.isArray(metadata.skills) ? (metadata.skills as string[]) : [];
    const standards = Array.isArray(metadata.standards) ? (metadata.standards as string[]) : [];

    if (moduleSlug) {
      perModule.set(moduleSlug, (perModule.get(moduleSlug) ?? 0) + 1);
    }
    for (const skill of skills) {
      if (!skill) continue;
      perSkill.set(skill, (perSkill.get(skill) ?? 0) + 1);
    }
    for (const code of standards) {
      if (!code) continue;
      perStandard.set(code, (perStandard.get(code) ?? 0) + 1);
    }
  }

  const entriesBySubjectGrade = new Map<string, number>();
  for (const [moduleSlug, count] of perModule.entries()) {
    const module = modules.get(moduleSlug) ?? modules.get(moduleSlug.trim());
    if (!module) continue;
    if (!TARGET_GRADES.includes(module.grade_band)) continue;
    const key = `${module.subject} ${module.grade_band}`;
    entriesBySubjectGrade.set(key, (entriesBySubjectGrade.get(key) ?? 0) + count);
  }

  return { perSkill, perStandard, entriesBySubjectGrade };
};

const printTop = (label: string, map: Map<string, number>, limit = 10) => {
  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  console.log(`\n${label} (top ${Math.min(limit, sorted.length)})`);
  for (const [key, value] of sorted.slice(0, limit)) {
    console.log(`  ${key}: ${value}`);
  }
};

const main = async () => {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('question_bank')
    .select('id, tags, metadata, difficulty');
  if (error) {
    throw new Error(`Failed to load questions: ${error.message}`);
  }

  const questions = (data ?? []) as QuestionRow[];
  if (questions.length === 0) {
    console.log('No practice items found in question_bank.');
    return;
  }

  const moduleSlugs = Array.from(
    new Set(
      questions
        .map((q) => (q.metadata as Record<string, unknown> | null)?.module_slug)
        .filter((slug): slug is string => typeof slug === 'string' && slug.length > 0),
    ),
  );

  const modules = new Map<string, ModuleDetails>();
  if (moduleSlugs.length > 0) {
    const chunkSize = 150;
    for (let i = 0; i < moduleSlugs.length; i += chunkSize) {
      const chunk = moduleSlugs.slice(i, i + chunkSize);
      const partial = await resolveModules(supabase, chunk);
      const ids = Array.from(new Set(Array.from(partial.values()).map((m) => m.id)));
      const { data: details, error: moduleError } = await supabase
        .from('modules')
        .select('id, slug, subject, grade_band')
        .in('id', ids);
      if (moduleError) {
        throw new Error(`Failed to load module details: ${moduleError.message}`);
      }
      for (const record of (details ?? []) as ModuleDetails[]) {
        modules.set(record.slug, record);
      }
    }
  }

  const { perSkill, perStandard, entriesBySubjectGrade } = summarize(questions, modules);

  console.log(`Analyzed ${questions.length} questions across ${modules.size} modules.`);
  printTop('Subject/grade totals', entriesBySubjectGrade, 20);
  printTop('Skills', perSkill, 15);
  printTop('Standards', perStandard, 15);
};

const invokedFromCli =
  process.argv[1]?.includes('audit_practice_coverage.ts') ||
  process.argv[1]?.includes('audit_practice_coverage.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
