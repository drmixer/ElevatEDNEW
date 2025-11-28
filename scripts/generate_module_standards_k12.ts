import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { createServiceRoleClient } from './utils/supabase.js';

type ModuleRow = {
  id: number;
  slug: string;
  title: string;
  subject: string;
  grade_band: string;
  strand: string | null;
  topic: string | null;
  subtopic: string | null;
};

type StandardRef = { framework: string; code: string };

const OUTPUT_PATH = path.resolve(process.cwd(), 'mappings/module_standards_k12.json');

const normalize = (value: string | null | undefined): string => (value ?? '').toLowerCase();
const gradeNumber = (gradeBand: string | null | undefined): number =>
  Number.isFinite(Number.parseInt(String(gradeBand ?? '').trim(), 10))
    ? Number.parseInt(String(gradeBand ?? '').trim(), 10)
    : -1;

const pickMathStandard = (module: ModuleRow): StandardRef => {
  const grade = gradeNumber(module.grade_band);
  const topic = normalize(`${module.topic ?? ''} ${module.subtopic ?? ''} ${module.slug}`);
  const strand = normalize(module.strand);
  const isPrimary = grade >= 0 && grade <= 2;
  const isHighSchool = grade >= 9;

  if (isPrimary) {
    if (topic.includes('probability') || topic.includes('data') || topic.includes('graph') || topic.includes('tally')) {
      if (grade === 0) return { framework: 'CCSS-M', code: 'K.MD.B.3' };
      if (grade === 1) return { framework: 'CCSS-M', code: '1.MD.C.4' };
      return { framework: 'CCSS-M', code: '2.MD.D.10' };
    }
    if (topic.includes('geometry') || topic.includes('shape') || strand.includes('geometry')) {
      if (grade === 0) return { framework: 'CCSS-M', code: 'K.G.A.1' };
      if (grade === 1) return { framework: 'CCSS-M', code: '1.G.A.1' };
      return { framework: 'CCSS-M', code: '2.G.A.1' };
    }
    if (topic.includes('length') || topic.includes('weight') || topic.includes('capacity')) {
      if (grade === 0) return { framework: 'CCSS-M', code: 'K.MD.A.1' };
      if (grade === 1) return { framework: 'CCSS-M', code: '1.MD.A.1' };
      return { framework: 'CCSS-M', code: '2.MD.A.1' };
    }
    if (topic.includes('time') || topic.includes('money')) {
      if (grade === 0) return { framework: 'CCSS-M', code: 'K.MD.B.3' };
      if (grade === 1) return { framework: 'CCSS-M', code: '1.MD.B.3' };
      return { framework: 'CCSS-M', code: '2.MD.C.8' };
    }
    if (topic.includes('place value')) {
      if (grade === 0) return { framework: 'CCSS-M', code: 'K.NBT.A.1' };
      if (grade === 1) return { framework: 'CCSS-M', code: '1.NBT.B.2' };
      return { framework: 'CCSS-M', code: '2.NBT.A.1' };
    }
    if (topic.includes('skip counting')) {
      if (grade === 0) return { framework: 'CCSS-M', code: 'K.CC.A.2' };
      if (grade === 1) return { framework: 'CCSS-M', code: '1.NBT.A.1' };
      return { framework: 'CCSS-M', code: '2.NBT.A.2' };
    }
    if (topic.includes('compare')) {
      if (grade === 0) return { framework: 'CCSS-M', code: 'K.CC.C.6' };
      if (grade === 1) return { framework: 'CCSS-M', code: '1.NBT.B.3' };
      return { framework: 'CCSS-M', code: '2.NBT.A.4' };
    }
    if (topic.includes('counting')) {
      if (grade === 0) return { framework: 'CCSS-M', code: 'K.CC.B.4' };
      if (grade === 1) return { framework: 'CCSS-M', code: '1.NBT.A.1' };
      return { framework: 'CCSS-M', code: '2.NBT.A.1' };
    }
    if (topic.includes('fraction') || topic.includes('decimal')) {
      return { framework: 'CCSS-M', code: grade <= 1 ? '1.OA.C.6' : '2.OA.B.2' };
    }
    if (topic.includes('addition') || topic.includes('subtraction') || topic.includes('number')) {
      if (grade === 0) return { framework: 'CCSS-M', code: 'K.OA.A.1' };
      if (grade === 1) return { framework: 'CCSS-M', code: '1.OA.C.6' };
      return { framework: 'CCSS-M', code: '2.OA.B.2' };
    }
  }

  if (isHighSchool) {
    if (topic.includes('regression')) return { framework: 'CCSS-M', code: 'HSS-ID.B.6' };
    if (topic.includes('normal distribution')) return { framework: 'CCSS-M', code: 'HSS-ID.A.4' };
    if (topic.includes('statistics')) return { framework: 'CCSS-M', code: 'HSS-IC.A.1' };
    if (topic.includes('vector')) return { framework: 'CCSS-M', code: 'HSN-VM.A.1' };
    if (topic.includes('matrix') || topic.includes('matrices')) return { framework: 'CCSS-M', code: 'HSN-VM.C.8' };
    if (topic.includes('complex')) return { framework: 'CCSS-M', code: 'HSN-CN.A.1' };
    if (topic.includes('sequence') || topic.includes('series')) return { framework: 'CCSS-M', code: 'HSF-IF.3' };
    if (topic.includes('parametric') || topic.includes('polar')) return { framework: 'CCSS-M', code: 'CALC.PARAMETRIC' };
    if (topic.includes('derivative')) return { framework: 'CCSS-M', code: 'CALC.DERIVATIVES' };
    if (topic.includes('integral')) return { framework: 'CCSS-M', code: 'CALC.INTEGRALS' };
    if (topic.includes('limit')) return { framework: 'CCSS-M', code: 'CALC.LIMITS' };
    if (topic.includes('trigonometric identities')) return { framework: 'CCSS-M', code: 'HSF-TF.C.8' };
    if (topic.includes('trigonometry')) return { framework: 'CCSS-M', code: 'HSF-TF.A.3' };
    if (topic.includes('conic')) return { framework: 'CCSS-M', code: 'HSG-GPE.A.3' };
    if (topic.includes('transformations')) return { framework: 'CCSS-M', code: 'HSG-CO.A.5' };
    if (topic.includes('proof')) return { framework: 'CCSS-M', code: 'HSG-CO.C.9' };
    if (topic.includes('exponential') || topic.includes('logarithmic')) return { framework: 'CCSS-M', code: 'HSF-LE.4' };
    if (topic.includes('rational') || topic.includes('radical')) return { framework: 'CCSS-M', code: 'HSF-IF.7d' };
    if (topic.includes('polynomial') && topic.includes('ident')) return { framework: 'CCSS-M', code: 'HSA-APR.3' };
    if (topic.includes('polynomial')) return { framework: 'CCSS-M', code: 'HSA-APR.1' };
    if (topic.includes('modeling') || topic.includes('applications')) return { framework: 'CCSS-M', code: 'HSN-Q.A.2' };
    if (topic.includes('piecewise') || topic.includes('absolute value')) return { framework: 'CCSS-M', code: 'HSF-IF.7b' };
    if (topic.includes('function') || topic.includes('linear') || topic.includes('quadratic')) {
      return { framework: 'CCSS-M', code: 'HSF-IF.4' };
    }
  }

  return { framework: 'CCSS-M', code: isPrimary ? '1.OA.C.6' : 'HSF-IF.4' };
};

const pickElaStandard = (module: ModuleRow): StandardRef => {
  const grade = gradeNumber(module.grade_band);
  const strand = normalize(module.strand);
  const topic = normalize(`${module.topic ?? ''} ${module.subtopic ?? ''} ${module.slug}`);
  const isPrimary = grade >= 0 && grade <= 2;
  const upperBand = grade >= 11 ? '11-12' : '9-10';

  if (isPrimary) {
    if (strand.includes('reading literature') || topic.includes('reading-literature')) {
      if (grade === 0) return { framework: 'CCSS-ELA', code: 'RL.K.1' };
      if (grade === 1) return { framework: 'CCSS-ELA', code: 'RL.1.1' };
      return { framework: 'CCSS-ELA', code: 'RL.2.1' };
    }
    if (strand.includes('reading informational') || topic.includes('informational')) {
      if (grade === 0) return { framework: 'CCSS-ELA', code: 'RI.K.1' };
      if (grade === 1) return { framework: 'CCSS-ELA', code: 'RI.1.2' };
      return { framework: 'CCSS-ELA', code: 'RI.2.2' };
    }
    if (strand.includes('vocabulary') || topic.includes('phonics')) {
      if (grade === 0) return { framework: 'CCSS-ELA', code: 'RF.K.3' };
      if (grade === 1) return { framework: 'CCSS-ELA', code: 'RF.1.3' };
      return { framework: 'CCSS-ELA', code: 'RF.2.3' };
    }
    if (strand.includes('writing') || topic.includes('handwriting') || topic.includes('punctuation')) {
      if (grade === 0) return { framework: 'CCSS-ELA', code: 'W.K.1' };
      if (grade === 1) return { framework: 'CCSS-ELA', code: 'W.1.2' };
      return { framework: 'CCSS-ELA', code: 'W.2.2' };
    }
    if (strand.includes('speaking') || topic.includes('show') || topic.includes('retelling')) {
      if (grade === 0) return { framework: 'CCSS-ELA', code: 'SL.K.1' };
      if (grade === 1) return { framework: 'CCSS-ELA', code: 'SL.1.1' };
      return { framework: 'CCSS-ELA', code: 'SL.2.1' };
    }
    return { framework: 'CCSS-ELA', code: grade === 0 ? 'RL.K.1' : grade === 1 ? 'RL.1.1' : 'RL.2.1' };
  }

  if (topic.includes('primary-sources') || topic.includes('literary-nonfiction')) {
    return { framework: 'CCSS-ELA', code: upperBand === '11-12' ? 'RI.11-12.2' : 'RI.9-10.2' };
  }
  if (topic.includes('rhetoric') || topic.includes('argument')) {
    return { framework: 'CCSS-ELA', code: 'RI.11-12.8' };
  }
  if (topic.includes('research') || topic.includes('papers')) {
    return { framework: 'CCSS-ELA', code: upperBand === '11-12' ? 'W.11-12.7' : 'W.9-10.1' };
  }
  if (topic.includes('vocabulary') || topic.includes('test prep') || topic.includes('discipline-specific')) {
    return { framework: 'CCSS-ELA', code: 'L.11-12.4' };
  }
  if (topic.includes('speaking') || topic.includes('presentations') || topic.includes('seminars')) {
    return { framework: 'CCSS-ELA', code: 'SL.11-12.1' };
  }
  if (topic.includes('world-lit') || topic.includes('poetry') || topic.includes('drama') || topic.includes('american-british')) {
    return { framework: 'CCSS-ELA', code: upperBand === '11-12' ? 'RL.11-12.2' : 'RL.9-10.2' };
  }

  return { framework: 'CCSS-ELA', code: upperBand === '11-12' ? 'RI.11-12.2' : 'RI.9-10.2' };
};

const pickScienceStandard = (module: ModuleRow): StandardRef => {
  const grade = gradeNumber(module.grade_band);
  const topic = normalize(`${module.topic ?? ''} ${module.subtopic ?? ''} ${module.slug}`);
  const isPrimary = grade >= 0 && grade <= 2;

  if (isPrimary) {
    if (topic.includes('earth materials')) return { framework: 'NGSS', code: 'K-ESS2-1' };
    if (topic.includes('weather') || topic.includes('seasons')) return { framework: 'NGSS', code: 'K-ESS3-2' };
    if (topic.includes('sun') || topic.includes('moon') || topic.includes('stars')) return { framework: 'NGSS', code: '1-ESS1-1' };
    if (topic.includes('energy') || topic.includes('heat')) return { framework: 'NGSS', code: 'K-PS3-1' };
    if (topic.includes('force') || topic.includes('motion')) return { framework: 'NGSS', code: 'K-PS2-1' };
    if (topic.includes('light') || topic.includes('sound')) return { framework: 'NGSS', code: '1-PS4-1' };
    if (topic.includes('matter') || topic.includes('properties')) return { framework: 'NGSS', code: '2-PS1-1' };
    if (topic.includes('habitat') || topic.includes('plants') || topic.includes('animals')) return { framework: 'NGSS', code: 'K-LS1-1' };
    if (topic.includes('life cycle')) return { framework: 'NGSS', code: '2-LS4-1' };
    if (topic.includes('design cycle') || topic.includes('engineering')) return { framework: 'NGSS', code: 'K-2-ETS1-1' };
    return { framework: 'NGSS', code: 'K-ESS2-1' };
  }

  if (topic.includes('mechanics')) return { framework: 'NGSS', code: 'HS-PS2-1' };
  if (topic.includes('thermodynamics')) return { framework: 'NGSS', code: 'HS-PS3-1' };
  if (topic.includes('waves') || topic.includes('optics')) return { framework: 'NGSS', code: 'HS-PS4-1' };
  if (topic.includes('electricity') || topic.includes('magnetism')) return { framework: 'NGSS', code: 'HS-PS2-4' };
  if (topic.includes('biochemistry')) return { framework: 'NGSS', code: 'HS-LS1-6' };
  if (topic.includes('genetic')) return { framework: 'NGSS', code: 'HS-LS3-1' };
  if (topic.includes('physiology')) return { framework: 'NGSS', code: 'HS-LS1-3' };
  if (topic.includes('ecology')) return { framework: 'NGSS', code: 'HS-LS2-1' };
  if (topic.includes('evolution')) return { framework: 'NGSS', code: 'HS-LS4-2' };
  if (topic.includes('geology') || topic.includes('rocks')) return { framework: 'NGSS', code: 'HS-ESS2-1' };
  if (topic.includes('climate')) return { framework: 'NGSS', code: 'HS-ESS3-5' };
  if (topic.includes('oceanography') || topic.includes('atmospheric')) return { framework: 'NGSS', code: 'HS-ESS2-5' };
  if (topic.includes('astronomy') || topic.includes('astrophysics')) return { framework: 'NGSS', code: 'HS-ESS1-4' };
  if (topic.includes('computational modeling')) return { framework: 'NGSS', code: 'HS-ETS1-4' };
  if (topic.includes('experiment design') || topic.includes('statistics in labs')) return { framework: 'NGSS', code: 'HS-ETS1-3' };
  if (topic.includes('systems design')) return { framework: 'NGSS', code: 'HS-ETS1-2' };
  if (topic.includes('earth') || topic.includes('space')) return { framework: 'NGSS', code: 'HS-ESS1-2' };

  return { framework: 'NGSS', code: 'HS-ETS1-2' };
};

const pickSocialStudiesStandard = (module: ModuleRow): StandardRef => {
  const grade = gradeNumber(module.grade_band);
  const strand = normalize(module.strand);
  const isPrimary = grade >= 0 && grade <= 2;

  if (isPrimary) {
    if (strand.includes('civics')) return { framework: 'C3', code: 'Civ.K-2' };
    if (strand.includes('economics') || strand.includes('financial')) return { framework: 'C3', code: 'Econ.K-2' };
    if (strand.includes('world')) return { framework: 'C3', code: 'Geo.K-2' };
    if (strand.includes('geography')) return { framework: 'C3', code: 'Geo.K-2' };
    if (strand.includes('history')) return { framework: 'C3', code: 'Hist.K-2' };
    return { framework: 'C3', code: 'Hist.K-2' };
  }

  if (strand.includes('civics')) return { framework: 'C3', code: 'Civ.9-12' };
  if (strand.includes('economics') || strand.includes('financial')) return { framework: 'C3', code: 'Econ.9-12' };
  if (strand.includes('geography')) return { framework: 'C3', code: 'Geo.9-12' };
  if (strand.includes('world')) return { framework: 'C3', code: 'Geo.9-12' };
  if (strand.includes('history') || strand.includes('us history')) return { framework: 'C3', code: 'Hist.9-12' };

  return { framework: 'C3', code: isPrimary ? 'Hist.K-2' : 'Hist.9-12' };
};

const pickElectivesStandard = (module: ModuleRow): StandardRef => {
  const grade = gradeNumber(module.grade_band);
  const topic = normalize(`${module.topic ?? ''} ${module.subtopic ?? ''} ${module.slug}`);
  const strand = normalize(module.strand);
  const isPrimary = grade >= 0 && grade <= 2;
  const isHighSchool = grade >= 9;

  if (strand.includes('computer science')) {
    if (isHighSchool) return { framework: 'CSTA', code: topic.includes('data') ? 'CSTA.9-12.DA' : 'CSTA.9-12.AP' };
    return { framework: 'CSTA', code: topic.includes('data') ? 'CSTA.K-2.CS' : 'CSTA.K-2.AP' };
  }

  if (strand.includes('arts') || strand.includes('music')) {
    return { framework: 'NCAS', code: isHighSchool ? 'NCAS.9-12.CR' : 'NCAS.K-2.CR' };
  }

  if (strand.includes('health') || strand.includes('pe')) {
    return { framework: 'SHAPE', code: isHighSchool ? 'SHAPE.9-12.HL' : 'SHAPE.K-2.HL' };
  }

  if (strand.includes('financial')) {
    return { framework: 'C3', code: isHighSchool ? 'Econ.9-12' : 'Econ.K-2' };
  }

  return { framework: 'C3', code: isHighSchool ? 'Econ.9-12' : 'Econ.K-2' };
};

const pickStandardsForModule = (module: ModuleRow): StandardRef[] => {
  const subject = (module.subject ?? '').trim();
  switch (subject) {
    case 'Mathematics':
      return [pickMathStandard(module)];
    case 'English Language Arts':
      return [pickElaStandard(module)];
    case 'Science':
      return [pickScienceStandard(module)];
    case 'Social Studies':
      return [pickSocialStudiesStandard(module)];
    case 'Electives':
      return [pickElectivesStandard(module)];
    default:
      return [];
  }
};

const main = async (): Promise<void> => {
  const supabase = createServiceRoleClient();

  const { data: cells, error: coverageError } = await supabase
    .from('coverage_dashboard_cells')
    .select('module_id')
    .is('standard_code', null);

  if (coverageError) {
    throw new Error(`Failed to load coverage dashboard cells: ${coverageError.message}`);
  }

  const moduleIds = Array.from(new Set((cells ?? []).map((row) => row.module_id as number))).filter(Boolean);
  if (moduleIds.length === 0) {
    console.log('No modules missing standards detected.');
    return;
  }

  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select('id, slug, title, subject, grade_band, strand, topic, subtopic')
    .in('id', moduleIds)
    .order('grade_band', { ascending: true })
    .order('subject', { ascending: true })
    .order('slug', { ascending: true });

  if (modulesError) {
    throw new Error(`Failed to load modules: ${modulesError.message}`);
  }

  const mapping: Record<string, { framework: string; standards: StandardRef[] }> = {};
  let missing = 0;

  for (const module of modules ?? []) {
    const standards = pickStandardsForModule(module as ModuleRow);
    if (!standards.length) {
      missing += 1;
      continue;
    }
    mapping[module.slug] = {
      framework: standards[0].framework,
      standards,
    };
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(mapping, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(mapping).length} module standard mappings to ${OUTPUT_PATH}`);
  if (missing > 0) {
    console.warn(`Skipped ${missing} modules because no standard rule was found.`);
  }
};

const invokedFromCli =
  process.argv[1]?.includes('generate_module_standards_k12.ts') ||
  process.argv[1]?.includes('generate_module_standards_k12.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
