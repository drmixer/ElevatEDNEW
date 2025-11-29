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

type StandardRow = { id: number; framework: string; code: string };

type StandardRef = { framework: string; code: string };

const TARGET_SUBJECTS = ['Mathematics', 'English Language Arts', 'Science', 'Social Studies'];
const TARGET_GRADES = ['3', '4', '5', '6', '7', '8'];

const normalize = (value: string | null | undefined): string => (value ?? '').toLowerCase();
const toGrade = (value: string | null | undefined): number =>
  Number.parseInt((value ?? '').trim(), 10) || 0;

const uniqueRefs = (standards: StandardRef[]): StandardRef[] => {
  const map = new Map<string, StandardRef>();
  standards.forEach((ref) => {
    const key = `${ref.framework.trim().toLowerCase()}::${ref.code.trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, { framework: ref.framework.trim(), code: ref.code.trim() });
    }
  });
  return Array.from(map.values());
};

const mathStandards = (module: ModuleRow): StandardRef[] => {
  const grade = toGrade(module.grade_band);
  const topic = normalize(`${module.topic ?? ''} ${module.subtopic ?? ''}`);
  const strand = normalize(module.strand);
  const refs: StandardRef[] = [];

  const add = (...codes: string[]) => codes.forEach((code) => refs.push({ framework: 'CCSS-M', code }));

  if (topic.includes('ratio') || topic.includes('proportion') || topic.includes('percent') || topic.includes('rate')) {
    if (grade === 6) add('6.RP.A.1', '6.RP.A.3');
    else if (grade === 7) add('7.RP.A.2');
    else if (grade === 8) add('8.EE.B.5');
  }

  if (topic.includes('equation') || topic.includes('expression') || topic.includes('inequality')) {
    if (grade === 6) add('6.EE.B.7', '6.EE.C.9');
    else if (grade === 7) add('7.EE.B.3', '7.EE.B.4a');
    else if (grade === 8) add('8.EE.A.2', '8.EE.C.8');
  }

  if (topic.includes('function')) {
    if (grade === 8) add('8.F.A.1', '8.F.B.4');
    else if (grade >= 6) add('6.EE.C.9');
  }

  if (topic.includes('fraction') || topic.includes('decimal')) {
    if (grade === 3) add('3.NF.A.1', '3.NF.A.3');
    else if (grade === 4) add('4.NF.B.3', '4.NF.C.7');
    else if (grade === 5) add('5.NF.A.1', '5.NF.B.4', '5.NBT.B.7');
    else if (grade === 6) add('6.NS.C.7');
    else if (grade === 7) add('7.NS.A.1', '7.NS.A.2');
  }

  if (topic.includes('integer') || topic.includes('rational') || topic.includes('place value') || topic.includes('round')) {
    if (grade === 3) add('3.NBT.A.2');
    else if (grade === 4) add('4.NBT.B.4');
    else if (grade === 5) add('5.NBT.B.7');
    else if (grade === 6) add('6.NS.C.7');
    else if (grade === 7) add('7.NS.A.1');
    else if (grade === 8) add('8.NS.A.1');
  }

  if (topic.includes('data') || topic.includes('statistic') || topic.includes('probability') || strand.includes('data')) {
    if (grade === 3) add('3.MD.B.3');
    else if (grade === 6) add('6.SP.B.4', '6.SP.B.5');
    else if (grade === 7) add('7.SP.C.7');
    else if (grade === 8) add('8.SP.A.1', '8.SP.A.3');
  }

  if (
    topic.includes('geometry') ||
    topic.includes('angle') ||
    topic.includes('triangle') ||
    topic.includes('volume') ||
    topic.includes('surface area') ||
    topic.includes('congruence') ||
    strand.includes('geometry')
  ) {
    if (grade === 3) add('3.G.A.1');
    else if (grade === 4) add('4.G.A.2');
    else if (grade === 5) add('5.G.A.1', '5.G.B.3', '5.MD.C.5');
    else if (grade === 6) add('6.G.A.1');
    else if (grade === 7) add('7.G.B.6');
    else if (grade === 8) add('8.G.B.6');
  }

  if (refs.length === 0) {
    // Fallback grade-level anchor.
    if (grade === 3) add('3.NBT.A.2');
    else if (grade === 4) add('4.NBT.B.4');
    else if (grade === 5) add('5.NBT.B.7');
    else if (grade === 6) add('6.NS.C.7');
    else if (grade === 7) add('7.NS.A.1');
    else if (grade === 8) add('8.NS.A.1');
  }

  return uniqueRefs(refs);
};

const elaStandards = (module: ModuleRow): StandardRef[] => {
  const grade = toGrade(module.grade_band);
  const strand = normalize(module.strand);
  const refs: StandardRef[] = [];
  const add = (...codes: string[]) => codes.forEach((code) => refs.push({ framework: 'CCSS-ELA', code }));

  if (strand.includes('reading literature')) add(`RL.${grade}.1`, `RL.${grade}.2`);
  if (strand.includes('reading informational')) {
    if (grade <= 5) add(`RI.${grade}.2`, `RI.${grade}.5`, `RI.${grade}.8`);
    else if (grade === 6) add('RI.6.3', 'RI.6.5');
    else if (grade === 7) add('RI.7.8');
    else if (grade >= 8) add('RI.8.5', 'RI.8.8');
  }
  if (strand.includes('writing')) add(`W.${grade}.1`, `W.${grade}.2`);
  if (strand.includes('vocabulary') || strand.includes('grammar')) add(`L.${grade}.4`);
  if (strand.includes('speaking')) {
    if (grade === 3) add('SL.3.1');
    else if (grade === 4) add('SL.4.4');
    else if (grade === 5) add('SL.5.1');
    else if (grade === 6) add('SL.6.1');
    else if (grade === 7) add('SL.7.1');
    else add('SL.8.4');
  }

  if (refs.length === 0) {
    if (grade <= 5) add(`RI.${grade}.2`);
    else if (grade === 6) add('RI.6.3');
    else if (grade === 7) add('RI.7.8');
    else add('RI.8.5');
  }

  return uniqueRefs(refs);
};

const scienceStandards = (module: ModuleRow): StandardRef[] => {
  const topic = normalize(`${module.topic ?? ''} ${module.subtopic ?? ''}`);
  const strand = normalize(module.strand);
  const slug = normalize(module.slug);
  const refs: StandardRef[] = [];
  const add = (...codes: string[]) => codes.forEach((code) => refs.push({ framework: 'NGSS', code }));

  if (topic.includes('astronomy') || topic.includes('solar system') || topic.includes('galax') || slug.includes('astronomy'))
    add('MS-ESS1-2');
  if (topic.includes('plate tectonic') || topic.includes('earth history') || topic.includes('weather') || slug.includes('tectonic'))
    add('MS-ESS2-2');
  if (topic.includes('resource') || topic.includes('natural resource')) add('MS-ESS3-1');

  if (topic.includes('ecosystem') || topic.includes('biodiversity')) add('MS-LS2-3');
  if (topic.includes('cell') || topic.includes('human body')) add('MS-LS1-3');
  if (topic.includes('genetic') || topic.includes('heredity')) add('MS-LS3-2');
  if (topic.includes('evolution') || topic.includes('adaptation')) add('MS-LS4-4');

  if (topic.includes('chemistry') || topic.includes('atom') || topic.includes('matter')) add('MS-PS1-2');
  if (topic.includes('force') || topic.includes('motion') || topic.includes('kinematic')) add('MS-PS2-2');
  if (topic.includes('energy') || topic.includes('heat')) add('MS-PS3-1');
  if (topic.includes('wave')) add('MS-PS3-1');

  if (strand.includes('engineering')) add('MS-ETS1-2');

  if (refs.length === 0 && strand.includes('earth')) add('MS-ESS2-2');
  if (refs.length === 0 && strand.includes('physical')) add('MS-PS3-1');
  if (refs.length === 0 && strand.includes('life')) add('MS-LS2-3');

  return uniqueRefs(refs);
};

const socialStandards = (module: ModuleRow): StandardRef[] => {
  const grade = toGrade(module.grade_band);
  const strand = normalize(module.strand);
  const band = grade <= 5 ? '3-5' : '6-8';
  const refs: StandardRef[] = [];
  const add = (...codes: string[]) => codes.forEach((code) => refs.push({ framework: 'C3', code: code.replace('{band}', band) }));

  if (strand.includes('civics')) add('Civ.{band}');
  if (strand.includes('economics')) add('Econ.{band}');
  if (strand.includes('us history')) add('Hist.{band}');
  if (strand.includes('world history') || strand.includes('geography')) add('Geo.{band}');

  if (refs.length === 0) add('Civ.{band}');

  return uniqueRefs(refs);
};

const resolveStandards = (module: ModuleRow): StandardRef[] => {
  switch (module.subject) {
    case 'Mathematics':
      return mathStandards(module);
    case 'English Language Arts':
      return elaStandards(module);
    case 'Science':
      return scienceStandards(module);
    case 'Social Studies':
      return socialStandards(module);
    default:
      return [];
  }
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

const fetchStandards = async (supabase: ReturnType<typeof createServiceRoleClient>): Promise<Map<string, number>> => {
  const { data, error } = await supabase.from('standards').select('id, framework, code');
  if (error) {
    throw new Error(`Failed to load standards: ${error.message}`);
  }
  const map = new Map<string, number>();
  for (const row of (data ?? []) as StandardRow[]) {
    const key = `${row.framework.trim().toLowerCase()}::${row.code.trim().toLowerCase()}`;
    map.set(key, row.id);
  }
  return map;
};

const upsertModuleStandards = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  module: ModuleRow,
  standardIds: number[],
): Promise<void> => {
  if (standardIds.length === 0) {
    return;
  }

  const payload = standardIds.map((standardId) => ({
    module_id: module.id,
    standard_id: standardId,
    alignment_strength: 'anchor',
    metadata: { seeded_by: 'seed_module_standards_auto' },
  }));

  const { error } = await supabase
    .from('module_standards')
    .upsert(payload, { onConflict: 'module_id,standard_id' });

  if (error) {
    throw new Error(`Failed to upsert module standards for ${module.slug}: ${error.message}`);
  }
};

const seedModuleStandards = async (): Promise<void> => {
  const supabase = createServiceRoleClient();
  const [modules, standardsMap] = await Promise.all([fetchModules(supabase), fetchStandards(supabase)]);

  let linked = 0;
  const missing: string[] = [];

  for (const module of modules) {
    const refs = resolveStandards(module);
    const ids = refs
      .map((ref) => standardsMap.get(`${ref.framework.trim().toLowerCase()}::${ref.code.trim().toLowerCase()}`))
      .filter((id): id is number => typeof id === 'number');

    if (ids.length === 0) {
      missing.push(`${module.slug} (${refs.map((r) => `${r.framework}:${r.code}`).join(', ') || 'no refs'})`);
      continue;
    }

    await upsertModuleStandards(supabase, module, ids);
    linked += ids.length;
  }

  console.log(`Linked ${linked} module-standard pairs.`);
  if (missing.length > 0) {
    console.warn(`Modules without resolvable standards (${missing.length}):`);
    missing.slice(0, 10).forEach((slug) => console.warn(`- ${slug}`));
    if (missing.length > 10) console.warn('... more not shown');
  }
};

const invokedFromCli =
  process.argv[1]?.includes('seed_module_standards_auto.ts') ||
  process.argv[1]?.includes('seed_module_standards_auto.js');

if (invokedFromCli) {
  seedModuleStandards().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
