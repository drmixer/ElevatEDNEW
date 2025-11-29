import process from 'node:process';

import { createServiceRoleClient } from './utils/supabase.js';

type ModuleRow = {
  id: number;
  slug: string;
  subject: string;
  grade_band: string;
  strand: string | null;
  topic: string | null;
  subtopic: string | null;
};

type LessonRow = {
  id: number;
  module_id: number;
  slug: string | null;
  metadata: Record<string, unknown> | null;
  estimated_duration_minutes: number | null;
};

type StandardRef = { framework: string; code: string };

const TARGET_SUBJECTS = ['Mathematics', 'English Language Arts', 'Science', 'Social Studies'];
const TARGET_GRADES = ['3', '4', '5', '6', '7', '8'];

const unique = <T>(items: Array<T | null | undefined>): T[] =>
  Array.from(new Set(items.filter(Boolean) as T[]));

const dedupeStandards = (items: StandardRef[]): StandardRef[] => {
  const map = new Map<string, StandardRef>();
  for (const entry of items) {
    if (!entry.framework || !entry.code) continue;
    const key = `${entry.framework.trim().toLowerCase()}::${entry.code.trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, { framework: entry.framework.trim(), code: entry.code.trim() });
    }
  }
  return Array.from(map.values());
};

const gradeNumber = (gradeBand: string | null | undefined): number | null => {
  const parsed = Number.parseInt(String(gradeBand ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalize = (value: string | null | undefined): string => (value ?? '').toLowerCase();

const resolveDifficulty = (gradeBand: string): number => {
  const grade = gradeNumber(gradeBand) ?? 0;
  if (grade <= 4) return 2;
  if (grade === 5 || grade === 6) return 3;
  return 4;
};

const resolveMathSkills = (module: ModuleRow): string[] => {
  const strand = normalize(module.strand);
  const topic = normalize(`${module.topic ?? ''} ${module.subtopic ?? ''}`);
  const skills = new Set<string>();

  if (topic.includes('fraction') || topic.includes('decimal')) {
    skills.add('fractions_decimals');
  }
  if (
    topic.includes('ratio') ||
    topic.includes('proportion') ||
    topic.includes('percent') ||
    topic.includes('rate')
  ) {
    skills.add('ratios_proportions');
  }
  if (topic.includes('expression') || topic.includes('equation') || topic.includes('inequality')) {
    skills.add('expressions_equations');
  }
  if (topic.includes('function')) {
    skills.add('functions_linear');
  }
  if (
    topic.includes('place value') ||
    topic.includes('rounding') ||
    topic.includes('multiplication') ||
    topic.includes('division') ||
    topic.includes('integer') ||
    topic.includes('rational')
  ) {
    skills.add('number_sense_operations');
  }

  if (strand.includes('data') || strand.includes('statistics') || topic.includes('probability')) {
    skills.add('statistics_probability');
  }
  if (strand.includes('geometry') || topic.includes('geometry') || topic.includes('volume')) {
    skills.add('geometry_measurement');
  }

  if (skills.size === 0) {
    if (strand.includes('number')) skills.add('number_sense_operations');
    if (strand.includes('probability') || strand.includes('statistics')) skills.add('statistics_probability');
    if (strand.includes('geometry')) skills.add('geometry_measurement');
  }

  return Array.from(skills);
};

const resolveMathStandards = (module: ModuleRow): StandardRef[] => {
  const grade = gradeNumber(module.grade_band) ?? 0;
  const strand = normalize(module.strand);
  const topic = normalize(`${module.topic ?? ''} ${module.subtopic ?? ''}`);
  const standards: StandardRef[] = [];
  const add = (code: string | null) => {
    if (code) standards.push({ framework: 'CCSS-M', code });
  };

  if (
    topic.includes('ratio') ||
    topic.includes('proportion') ||
    topic.includes('percent') ||
    topic.includes('rate')
  ) {
    add(`${grade >= 6 ? `${grade}.RP` : `${grade}.NF`}`);
  }

  if (topic.includes('expression') || topic.includes('equation') || topic.includes('inequality')) {
    add(`${grade >= 6 ? `${grade}.EE` : `${grade}.OA`}`);
  }

  if (topic.includes('function')) {
    add(`${grade >= 8 ? '8.F' : `${grade}.F`}`);
  }

  if (topic.includes('fraction') || topic.includes('decimal')) {
    add(`${grade <= 5 ? `${grade}.NF` : `${grade}.NS`}`);
  }

  if (topic.includes('integer') || topic.includes('rational') || topic.includes('place value')) {
    add(`${grade <= 5 ? `${grade}.NBT` : `${grade}.NS`}`);
  }

  if (topic.includes('multiplication') || topic.includes('division')) {
    add(`${grade <= 5 ? `${grade}.OA` : `${grade}.NS`}`);
  }

  if (strand.includes('geometry') || topic.includes('geometry') || topic.includes('volume') || topic.includes('angle')) {
    add(`${grade <= 5 ? `${grade}.MD` : `${grade}.G`}`);
  }

  if (strand.includes('probability') || strand.includes('statistics') || topic.includes('probability')) {
    add(`${grade >= 6 ? `${grade}.SP` : `${grade}.MD`}`);
  }

  return dedupeStandards(standards);
};

const resolveElaSkills = (module: ModuleRow): string[] => {
  const strand = normalize(module.strand);
  const skills = new Set<string>();

  if (strand.includes('reading literature')) skills.add('reading_literature');
  if (strand.includes('reading informational')) skills.add('reading_informational');
  if (strand.includes('reading')) skills.add('evidence_reasoning');
  if (strand.includes('writing')) {
    skills.add('informative_writing');
    skills.add('argument_writing');
    skills.add('narrative_writing');
  }
  if (strand.includes('vocabulary')) skills.add('vocabulary_language');
  if (strand.includes('speaking')) skills.add('speaking_listening');
  if (strand.includes('grammar')) skills.add('vocabulary_language');

  if (skills.size === 0) {
    skills.add('evidence_reasoning');
  }

  return Array.from(skills);
};

const resolveElaStandards = (module: ModuleRow): StandardRef[] => {
  const grade = gradeNumber(module.grade_band) ?? 0;
  const strand = normalize(module.strand);
  const standards: StandardRef[] = [];
  const add = (code: string | null) => code && standards.push({ framework: 'CCSS-ELA', code });

  if (strand.includes('reading literature')) add(`RL.${grade}`);
  if (strand.includes('reading informational')) add(`RI.${grade}`);
  if (strand.includes('writing')) add(`W.${grade}`);
  if (strand.includes('grammar')) add(`L.${grade}`);
  if (strand.includes('vocabulary')) add(`L.${grade}`);
  if (strand.includes('speaking')) add(`SL.${grade}`);

  return dedupeStandards(standards);
};

const resolveScienceSkills = (module: ModuleRow): string[] => {
  const strand = normalize(module.strand);
  const topic = normalize(`${module.topic ?? ''} ${module.subtopic ?? ''}`);
  const skills = new Set<string>();

  if (strand.includes('earth') || topic.includes('climate') || topic.includes('weather') || topic.includes('tectonic')) {
    skills.add('earth_space_systems');
  }
  if (
    topic.includes('force') ||
    topic.includes('motion') ||
    topic.includes('kinematic') ||
    topic.includes('wave')
  ) {
    skills.add('forces_motion');
  }
  if (
    topic.includes('matter') ||
    topic.includes('chemistry') ||
    topic.includes('energy') ||
    topic.includes('heat')
  ) {
    skills.add('matter_interactions');
  }
  if (topic.includes('ecosystem') || topic.includes('biodiversity')) {
    skills.add('ecosystems_energy_matter');
  }
  if (
    topic.includes('genetic') ||
    topic.includes('heredity') ||
    topic.includes('evolution') ||
    topic.includes('adaptation')
  ) {
    skills.add('genetics_evolution');
  }
  if (topic.includes('engineering') || topic.includes('design') || strand.includes('engineering')) {
    skills.add('engineering_design');
  }
  if (topic.includes('human body')) {
    skills.add('ecosystems_energy_matter');
  }

  if (skills.size === 0) {
    if (strand.includes('life')) skills.add('ecosystems_energy_matter');
    if (strand.includes('physical')) skills.add('matter_interactions');
  }

  return Array.from(skills);
};

const resolveScienceStandards = (module: ModuleRow): StandardRef[] => {
  const grade = gradeNumber(module.grade_band) ?? 0;
  const strand = normalize(module.strand);
  const topic = normalize(`${module.topic ?? ''} ${module.subtopic ?? ''}`);
  const standards: StandardRef[] = [];
  const add = (code: string | null) => code && standards.push({ framework: 'NGSS', code });
  const isMiddle = grade >= 6;

  if (isMiddle) {
    if (topic.includes('astronomy')) add('MS-ESS1');
    else if (topic.includes('tectonic') || topic.includes('earth history') || topic.includes('weather')) add('MS-ESS2');
    else if (strand.includes('earth')) add('MS-ESS2');

    if (topic.includes('cell') || topic.includes('human body')) add('MS-LS1');
    if (topic.includes('genetic') || topic.includes('heredity')) add('MS-LS3');
    if (topic.includes('evolution') || topic.includes('adaptation')) add('MS-LS4');
    if (topic.includes('ecology') || topic.includes('biodiversity') || topic.includes('ecosystem')) add('MS-LS2');

    if (topic.includes('chemistry') || topic.includes('atom') || topic.includes('matter')) add('MS-PS1');
    if (topic.includes('force') || topic.includes('motion') || topic.includes('kinematic')) add('MS-PS2');
    if (topic.includes('energy') || topic.includes('heat')) add('MS-PS3');
    if (topic.includes('wave') || topic.includes('spectrum')) add('MS-PS4');

    if (strand.includes('engineering') || topic.includes('design')) add('MS-ETS1');
  } else {
    if (strand.includes('earth')) add('3-5-ESS');
    if (strand.includes('life')) add('3-5-LS');
    if (strand.includes('physical')) add('3-5-PS');
    if (strand.includes('engineering')) add('3-5-ETS1');
  }

  return dedupeStandards(standards);
};

const resolveSocialSkills = (module: ModuleRow): string[] => {
  const strand = normalize(module.strand);
  const topic = normalize(`${module.topic ?? ''} ${module.subtopic ?? ''}`);
  const skills = new Set<string>();

  if (strand.includes('civic')) skills.add('civics_government');
  if (topic.includes('election') || topic.includes('participation')) skills.add('civic_participation');
  if (strand.includes('economics')) skills.add('economics_financial_literacy');
  if (topic.includes('finance') || topic.includes('budget')) skills.add('economics_financial_literacy');
  if (strand.includes('us history') || topic.includes('civil war') || topic.includes('reconstruction')) skills.add('us_history');
  if (strand.includes('world history') || strand.includes('geography') || topic.includes('global')) {
    skills.add('world_history_geography');
  }

  if (skills.size === 0) {
    skills.add('civics_government');
  }

  return Array.from(skills);
};

const resolveSocialStandards = (module: ModuleRow): StandardRef[] => {
  const grade = gradeNumber(module.grade_band) ?? 0;
  const strand = normalize(module.strand);
  const band = grade <= 5 ? '3-5' : '6-8';
  const standards: StandardRef[] = [];
  const add = (code: string | null) => code && standards.push({ framework: 'C3', code });

  if (strand.includes('civic')) add(`Civ.${band}`);
  if (strand.includes('economics')) add(`Econ.${band}`);
  if (strand.includes('us history')) add(`Hist.${band}`);
  if (strand.includes('world history') || strand.includes('geography')) add(`Geo.${band}`);

  return dedupeStandards(standards);
};

const resolveSkills = (module: ModuleRow): string[] => {
  switch (module.subject) {
    case 'Mathematics':
      return resolveMathSkills(module);
    case 'English Language Arts':
      return resolveElaSkills(module);
    case 'Science':
      return resolveScienceSkills(module);
    case 'Social Studies':
      return resolveSocialSkills(module);
    default:
      return [];
  }
};

const resolveStandardsForModule = (
  module: ModuleRow,
  moduleStandards: Map<number, StandardRef[]>,
): StandardRef[] => {
  const seeded = moduleStandards.get(module.id) ?? [];
  let inferred: StandardRef[] = [];
  switch (module.subject) {
    case 'Mathematics':
      inferred = resolveMathStandards(module);
      break;
    case 'English Language Arts':
      inferred = resolveElaStandards(module);
      break;
    case 'Science':
      inferred = resolveScienceStandards(module);
      break;
    case 'Social Studies':
      inferred = resolveSocialStandards(module);
      break;
    default:
      inferred = [];
  }
  return dedupeStandards([...seeded, ...inferred]);
};

const buildMetadata = (
  lesson: LessonRow,
  module: ModuleRow,
  moduleStandards: Map<number, StandardRef[]>,
): Record<string, unknown> => {
  const base = (lesson.metadata && typeof lesson.metadata === 'object' && !Array.isArray(lesson.metadata)
    ? { ...lesson.metadata }
    : {}) as Record<string, unknown>;

  const grades = gradeNumber(module.grade_band);
  const skills = unique<string>([...(Array.isArray(base.skills) ? (base.skills as string[]) : []), ...resolveSkills(module)]);
  const standards = dedupeStandards([
    ...((base.standards as StandardRef[]) ?? []),
    ...resolveStandardsForModule(module, moduleStandards),
  ]);

  return {
    ...base,
    subject: module.subject,
    grades: grades ? [grades] : [],
    skills,
    standards,
    difficulty: resolveDifficulty(module.grade_band),
    estimated_time_minutes: lesson.estimated_duration_minutes ?? base.estimated_time_minutes ?? 45,
    media_type: base.media_type ?? 'mixed',
    storage_mode: base.storage_mode ?? 'stored',
  };
};

const fetchModules = async (supabase: ReturnType<typeof createServiceRoleClient>): Promise<ModuleRow[]> => {
  const { data, error } = await supabase
    .from('modules')
    .select('id, slug, subject, grade_band, strand, topic, subtopic')
    .in('subject', TARGET_SUBJECTS)
    .in('grade_band', TARGET_GRADES);

  if (error) {
    throw new Error(`Failed to load modules: ${error.message}`);
  }
  return (data ?? []) as ModuleRow[];
};

const fetchLessons = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  moduleIds: number[],
): Promise<Map<number, LessonRow[]>> => {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, module_id, slug, metadata, estimated_duration_minutes')
    .in('module_id', moduleIds);

  if (error) {
    throw new Error(`Failed to load lessons: ${error.message}`);
  }

  const map = new Map<number, LessonRow[]>();
  for (const record of (data ?? []) as LessonRow[]) {
    const list = map.get(record.module_id) ?? [];
    list.push(record);
    map.set(record.module_id, list);
  }
  return map;
};

const fetchModuleStandards = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  moduleIds: number[],
): Promise<Map<number, StandardRef[]>> => {
  const { data, error } = await supabase
    .from('module_standards')
    .select('module_id, standard:standard_id (framework, code)')
    .in('module_id', moduleIds);

  if (error) {
    throw new Error(`Failed to load module standards: ${error.message}`);
  }

  const map = new Map<number, StandardRef[]>();
  for (const row of data ?? []) {
    const existing = map.get(row.module_id as number) ?? [];
    const entry = (row as { standard?: { framework?: string; code?: string } }).standard;
    if (entry?.framework && entry?.code) {
      existing.push({ framework: entry.framework, code: entry.code });
    }
    map.set(row.module_id as number, dedupeStandards(existing));
  }
  return map;
};

const seedLessonMetadata = async (): Promise<void> => {
  const supabase = createServiceRoleClient();
  const modules = await fetchModules(supabase);
  if (modules.length === 0) {
    console.log('No modules found for target subjects/grades.');
    return;
  }

  const moduleIds = modules.map((mod) => mod.id);
  const lessonsByModule = await fetchLessons(supabase, moduleIds);
  const moduleStandards = await fetchModuleStandards(supabase, moduleIds);

  let updated = 0;
  const missingLessons: string[] = [];

  for (const module of modules) {
    const lessons = lessonsByModule.get(module.id) ?? [];
    if (lessons.length === 0) {
      missingLessons.push(module.slug);
      continue;
    }

    for (const lesson of lessons) {
      const metadata = buildMetadata(lesson, module, moduleStandards);
      const { error } = await supabase.from('lessons').update({ metadata }).eq('id', lesson.id);
      if (error) {
        throw new Error(`Failed to update lesson ${lesson.id} (${module.slug}): ${error.message}`);
      }
      updated += 1;
    }
  }

  console.log(`Updated metadata for ${updated} lessons.`);
  if (missingLessons.length > 0) {
    console.warn(`Modules without lessons: ${missingLessons.join(', ')}`);
  }
};

const invokedFromCli =
  process.argv[1]?.includes('seed_lesson_metadata.ts') ||
  process.argv[1]?.includes('seed_lesson_metadata.js');

if (invokedFromCli) {
  seedLessonMetadata().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
