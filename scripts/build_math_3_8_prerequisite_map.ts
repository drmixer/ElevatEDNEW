import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

type SkeletonModule = {
  grade: string;
  subject: string;
  strand: string;
  topic: string;
  subtopic?: string;
};

type BuiltModule = {
  slug: string;
  grade: number;
  subject: string;
  strand: string;
  topic: string;
  subtopic: string;
};

type AdaptiveStrand =
  | 'place_value_operations'
  | 'fractions_decimals'
  | 'ratios_rates_percent'
  | 'expressions_equations_functions'
  | 'geometry_measurement'
  | 'data_probability_statistics'
  | 'problem_solving_modeling';

type MathMapEntry = {
  slug: string;
  grade: number;
  title: string;
  source_strand: string;
  adaptive_strand: AdaptiveStrand;
  concept: string;
  sequence_order: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimated_time_minutes: number;
  prerequisites: string[];
  diagnostic_tags: string[];
  mastery_evidence: string[];
  remediation_targets: string[];
  challenge_targets: string[];
};

type MathPrerequisiteMap = {
  version: 1;
  scope: {
    subject: 'Mathematics';
    grades: number[];
    purpose: string;
  };
  adaptive_strands: Array<{
    id: AdaptiveStrand;
    label: string;
    placement_priority: number;
    description: string;
  }>;
  policy: {
    root_module_rule: string;
    prerequisite_rule: string;
    adaptation_rule: string;
  };
  modules: MathMapEntry[];
};

type AuditResult = {
  moduleCount: number;
  missingCurrentModules: string[];
  extraMappedModules: string[];
  brokenPrerequisites: string[];
  forwardPrerequisites: string[];
  selfPrerequisites: string[];
  duplicateModules: string[];
  cycles: string[][];
  strandCounts: Record<string, number>;
};

const SKELETON_PATH = path.resolve(process.cwd(), 'data/curriculum/ElevatED_K12_Curriculum_Skeleton.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'data/curriculum/math_3_8_prerequisite_map.json');

const ADAPTIVE_STRANDS: MathPrerequisiteMap['adaptive_strands'] = [
  {
    id: 'place_value_operations',
    label: 'Place Value and Operations',
    placement_priority: 1,
    description: 'Whole-number size, operations, rounding, estimation, and fluency foundations.',
  },
  {
    id: 'fractions_decimals',
    label: 'Fractions and Decimals',
    placement_priority: 2,
    description: 'Fraction concepts, equivalence, decimal notation, and rational-number readiness.',
  },
  {
    id: 'ratios_rates_percent',
    label: 'Ratios, Rates, and Percent',
    placement_priority: 3,
    description: 'Ratio reasoning, proportional relationships, rates, and percent applications.',
  },
  {
    id: 'expressions_equations_functions',
    label: 'Expressions, Equations, and Functions',
    placement_priority: 4,
    description: 'Patterns, variables, equations, functions, and symbolic reasoning.',
  },
  {
    id: 'geometry_measurement',
    label: 'Geometry and Measurement',
    placement_priority: 5,
    description: 'Shapes, measurement, coordinate geometry, transformations, similarity, and volume.',
  },
  {
    id: 'data_probability_statistics',
    label: 'Data, Probability, and Statistics',
    placement_priority: 6,
    description: 'Tables, graphs, center, probability, two-way tables, scatterplots, and sampling.',
  },
  {
    id: 'problem_solving_modeling',
    label: 'Problem Solving and Modeling',
    placement_priority: 7,
    description: 'Multi-step word problems, modeling, error analysis, performance tasks, and applications.',
  },
];

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

const normalize = (value: string): string => slugify(value);

const loadSkeleton = async (): Promise<SkeletonModule[]> => {
  const raw = await fs.readFile(SKELETON_PATH, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${SKELETON_PATH} to contain an array.`);
  }
  return parsed as SkeletonModule[];
};

const buildModules = (entries: SkeletonModule[]): BuiltModule[] => {
  const slugCounts = new Map<string, number>();

  return entries.map((entry) => {
    const grade = entry.grade.trim();
    const subject = entry.subject.trim();
    const strand = entry.strand?.trim() ?? '';
    const topic = entry.topic?.trim() ?? '';
    const subtopic = entry.subtopic?.trim() ?? '';
    const baseSlugParts = [grade, subject, strand, topic, subtopic].filter((part) => part.length > 0);
    let slugBase = slugify(baseSlugParts.join('-'));
    if (!slugBase) slugBase = slugify(`${subject}-${grade}`);

    const currentCount = slugCounts.get(slugBase) ?? 0;
    slugCounts.set(slugBase, currentCount + 1);
    const slug = currentCount === 0 ? slugBase : `${slugBase}-${currentCount}`;

    return {
      slug,
      grade: Number.parseInt(grade, 10),
      subject,
      strand,
      topic,
      subtopic,
    };
  });
};

const getConcept = (module: BuiltModule): string => {
  const topic = normalize(module.topic);

  if (topic.includes('place-value')) return 'place_value';
  if (topic.includes('rounding') || topic.includes('estimation-strategies')) return 'estimation';
  if (topic.includes('multiplication-division')) return 'multiplication_division';
  if (topic.includes('fractions')) return 'fractions';
  if (topic.includes('decimals')) return 'decimals';
  if (topic.includes('ratios')) return 'ratios';
  if (topic.includes('percent') || topic.includes('rates')) return 'percent_rates';
  if (topic.includes('integers') || topic.includes('rational')) return 'integers_rational_numbers';
  if (topic.includes('expressions') || topic.includes('equations')) return 'expressions_equations';
  if (topic.includes('functions')) return 'functions';
  if (topic.includes('patterns')) return 'patterns_rules';
  if (topic.includes('area') || topic.includes('perimeter')) return 'area_perimeter';
  if (topic.includes('volume-and-surface-area')) return 'volume_surface_area';
  if (topic.includes('volume')) return 'volume';
  if (topic.includes('angles') || topic.includes('lines')) return 'angles_lines';
  if (topic.includes('coordinate-plane') || topic.includes('coordinate-geometry')) return 'coordinate_geometry';
  if (topic.includes('transformations')) return 'transformations';
  if (topic.includes('similarity') || topic.includes('congruence')) return 'similarity_congruence';
  if (topic.includes('pythagorean')) return 'pythagorean_theorem';
  if (topic.includes('bar-line-plots')) return 'bar_line_plots';
  if (topic.includes('interpreting-tables-charts')) return 'tables_charts';
  if (topic.includes('mean-median-mode')) return 'center_spread';
  if (topic.includes('intro-probability') || topic.includes('probability-rules')) return 'probability';
  if (topic.includes('two-way-tables')) return 'two_way_tables';
  if (topic.includes('scatterplots')) return 'scatterplots';
  if (topic.includes('sampling')) return 'sampling_inference';
  if (topic.includes('multi-step-word-problems')) return 'multi_step_word_problems';
  if (topic.includes('error-analysis')) return 'error_analysis';
  if (topic.includes('mathematical-modeling')) return 'mathematical_modeling';
  if (topic.includes('performance-task')) return 'performance_task';

  return topic.replace(/-/g, '_');
};

const getAdaptiveStrand = (concept: string): AdaptiveStrand => {
  if (['place_value', 'estimation', 'multiplication_division'].includes(concept)) return 'place_value_operations';
  if (['fractions', 'decimals', 'integers_rational_numbers'].includes(concept)) return 'fractions_decimals';
  if (['ratios', 'percent_rates'].includes(concept)) return 'ratios_rates_percent';
  if (['expressions_equations', 'functions', 'patterns_rules'].includes(concept)) {
    return 'expressions_equations_functions';
  }
  if (
    [
      'area_perimeter',
      'volume',
      'volume_surface_area',
      'angles_lines',
      'coordinate_geometry',
      'transformations',
      'similarity_congruence',
      'pythagorean_theorem',
    ].includes(concept)
  ) {
    return 'geometry_measurement';
  }
  if (
    [
      'bar_line_plots',
      'tables_charts',
      'center_spread',
      'probability',
      'two_way_tables',
      'scatterplots',
      'sampling_inference',
    ].includes(concept)
  ) {
    return 'data_probability_statistics';
  }
  return 'problem_solving_modeling';
};

const getSequenceOrder = (concept: string): number => {
  const order: Record<string, number> = {
    place_value: 10,
    multiplication_division: 20,
    estimation: 30,
    fractions: 40,
    decimals: 50,
    ratios: 60,
    percent_rates: 70,
    integers_rational_numbers: 80,
    patterns_rules: 90,
    expressions_equations: 100,
    functions: 110,
    angles_lines: 120,
    area_perimeter: 130,
    volume: 140,
    coordinate_geometry: 150,
    transformations: 160,
    similarity_congruence: 170,
    pythagorean_theorem: 180,
    volume_surface_area: 190,
    bar_line_plots: 200,
    tables_charts: 210,
    center_spread: 220,
    probability: 230,
    two_way_tables: 240,
    scatterplots: 250,
    sampling_inference: 260,
    multi_step_word_problems: 270,
    error_analysis: 280,
    mathematical_modeling: 290,
    performance_task: 300,
  };
  return order[concept] ?? 999;
};

const getDifficulty = (module: BuiltModule, concept: string): MathMapEntry['difficulty'] => {
  if (module.grade <= 3) return concept === 'performance_task' ? 4 : 2;
  if (module.grade <= 5) return concept === 'performance_task' ? 4 : 3;
  if (['pythagorean_theorem', 'similarity_congruence', 'sampling_inference', 'functions'].includes(concept)) return 4;
  return concept === 'performance_task' ? 5 : 3;
};

const getEstimatedTime = (concept: string): number => {
  if (concept === 'performance_task') return 50;
  if (['mathematical_modeling', 'multi_step_word_problems', 'error_analysis'].includes(concept)) return 40;
  if (['expressions_equations', 'functions', 'pythagorean_theorem', 'similarity_congruence'].includes(concept)) return 40;
  return 35;
};

const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const previousConceptSlugs = (
  modulesByGradeConcept: Map<string, string>,
  grade: number,
  concepts: string[],
  minGrade = 3,
): string[] => {
  const prerequisites: string[] = [];
  for (const concept of concepts) {
    for (let candidateGrade = grade - 1; candidateGrade >= minGrade; candidateGrade -= 1) {
      const slug = modulesByGradeConcept.get(`${candidateGrade}:${concept}`);
      if (slug) {
        prerequisites.push(slug);
        break;
      }
    }
  }
  return prerequisites;
};

const sameGradeConceptSlugs = (
  modulesByGradeConcept: Map<string, string>,
  grade: number,
  concepts: string[],
): string[] => concepts.map((concept) => modulesByGradeConcept.get(`${grade}:${concept}`) ?? '');

const buildPrerequisites = (
  module: BuiltModule,
  concept: string,
  modulesByGradeConcept: Map<string, string>,
): string[] => {
  const previousSameConcept = previousConceptSlugs(modulesByGradeConcept, module.grade, [concept]);
  const same = (concepts: string[]): string[] => sameGradeConceptSlugs(modulesByGradeConcept, module.grade, concepts);
  const previous = (concepts: string[]): string[] => previousConceptSlugs(modulesByGradeConcept, module.grade, concepts);
  const grade5 = (concepts: string[]): string[] => sameGradeConceptSlugs(modulesByGradeConcept, 5, concepts);

  const conceptualPrerequisites: Record<string, string[]> = {
    place_value: [],
    multiplication_division: [...same(['place_value']), ...previous(['multiplication_division'])],
    estimation: [...same(['place_value']), ...previous(['estimation'])],
    fractions: [...same(['multiplication_division']), ...previous(['fractions'])],
    decimals: [...same(['place_value', 'fractions']), ...previous(['decimals'])],
    ratios: [...grade5(['fractions', 'decimals', 'multiplication_division']), ...previous(['ratios'])],
    percent_rates: [...same(['ratios']), ...previous(['percent_rates'])],
    integers_rational_numbers: [...grade5(['decimals', 'fractions']), ...previous(['integers_rational_numbers'])],
    patterns_rules: [...same(['place_value']), ...previous(['patterns_rules'])],
    expressions_equations: [...same(['patterns_rules', 'integers_rational_numbers']), ...previous(['expressions_equations'])],
    functions: [...same(['expressions_equations']), ...previous(['functions'])],
    angles_lines: [...previous(['angles_lines'])],
    area_perimeter: [...same(['multiplication_division']), ...previous(['area_perimeter'])],
    volume: [...same(['area_perimeter']), ...previous(['volume'])],
    coordinate_geometry: [...previous(['coordinate_geometry']), ...same(['place_value', 'integers_rational_numbers'])],
    transformations: [...same(['angles_lines', 'coordinate_geometry']), ...previous(['transformations'])],
    similarity_congruence: [...same(['ratios', 'transformations']), ...previous(['similarity_congruence'])],
    pythagorean_theorem: [...same(['coordinate_geometry', 'expressions_equations']), ...previous(['pythagorean_theorem'])],
    volume_surface_area: [...same(['expressions_equations']), ...previous(['volume', 'volume_surface_area'])],
    bar_line_plots: [...same(['place_value']), ...previous(['bar_line_plots'])],
    tables_charts: [...same(['bar_line_plots']), ...previous(['tables_charts'])],
    center_spread: [...same(['tables_charts', 'multiplication_division']), ...previous(['center_spread'])],
    probability: [...same(['fractions', 'ratios']), ...previous(['probability'])],
    two_way_tables: [...same(['ratios']), ...previous(['tables_charts', 'two_way_tables'])],
    scatterplots: [...same(['coordinate_geometry']), ...previous(['tables_charts', 'scatterplots'])],
    sampling_inference: [
      ...same(['center_spread']),
      ...previous(['center_spread', 'tables_charts', 'sampling_inference']),
    ],
    multi_step_word_problems: [...same(['multiplication_division', 'fractions', 'decimals']), ...previous(['multi_step_word_problems'])],
    error_analysis: [...same(['estimation']), ...previous(['error_analysis'])],
    mathematical_modeling: [...same(['multi_step_word_problems', 'estimation']), ...previous(['mathematical_modeling'])],
    performance_task: [...same(['mathematical_modeling', 'tables_charts', 'estimation']), ...previous(['performance_task'])],
  };

  return unique([...previousSameConcept, ...(conceptualPrerequisites[concept] ?? [])]).filter((slug) => slug !== module.slug);
};

const buildEntry = (
  module: BuiltModule,
  modulesByGradeConcept: Map<string, string>,
): MathMapEntry => {
  const concept = getConcept(module);
  const adaptiveStrand = getAdaptiveStrand(concept);
  const prerequisites = buildPrerequisites(module, concept, modulesByGradeConcept);
  const title = module.topic || module.subtopic || `Grade ${module.grade} Mathematics`;

  return {
    slug: module.slug,
    grade: module.grade,
    title,
    source_strand: module.strand,
    adaptive_strand: adaptiveStrand,
    concept,
    sequence_order: module.grade * 1000 + getSequenceOrder(concept),
    difficulty: getDifficulty(module, concept),
    estimated_time_minutes: getEstimatedTime(concept),
    prerequisites,
    diagnostic_tags: unique([adaptiveStrand, concept, `grade_${module.grade}`]),
    mastery_evidence: [
      'explains the strategy in words',
      'solves aligned problems without step-by-step hints',
      'checks the answer for reasonableness',
    ],
    remediation_targets: prerequisites.slice(0, 4),
    challenge_targets: [],
  };
};

const attachChallengeTargets = (entries: MathMapEntry[]): MathMapEntry[] => {
  const dependents = new Map<string, string[]>();
  for (const entry of entries) {
    for (const prerequisite of entry.prerequisites) {
      const current = dependents.get(prerequisite) ?? [];
      current.push(entry.slug);
      dependents.set(prerequisite, current);
    }
  }

  return entries.map((entry) => ({
    ...entry,
    challenge_targets: (dependents.get(entry.slug) ?? []).slice(0, 5),
  }));
};

const buildMathPrerequisiteMap = (entries: SkeletonModule[]): MathPrerequisiteMap => {
  const mathModules = buildModules(entries)
    .filter((entry) => entry.subject === 'Mathematics' && entry.grade >= 3 && entry.grade <= 8)
    .sort((a, b) => a.grade - b.grade || getSequenceOrder(getConcept(a)) - getSequenceOrder(getConcept(b)) || a.slug.localeCompare(b.slug));

  const modulesByGradeConcept = new Map<string, string>();
  for (const module of mathModules) {
    modulesByGradeConcept.set(`${module.grade}:${getConcept(module)}`, module.slug);
  }

  const modules = attachChallengeTargets(mathModules.map((module) => buildEntry(module, modulesByGradeConcept))).sort(
    (a, b) => a.sequence_order - b.sequence_order || a.slug.localeCompare(b.slug),
  );

  return {
    version: 1,
    scope: {
      subject: 'Mathematics',
      grades: [3, 4, 5, 6, 7, 8],
      purpose:
        'Prerequisite-aware adaptive routing for a 3-8 homeschool math spine. Grade is a placement prior; mastery evidence can move a student up, down, or across strands.',
    },
    adaptive_strands: ADAPTIVE_STRANDS,
    policy: {
      root_module_rule:
        'Modules with no prerequisites are valid diagnostic roots or backfill roots. They should be short enough to verify quickly before assigning later content.',
      prerequisite_rule:
        'A module may depend on prior-grade same-concept content and same-grade enabling concepts. Same-grade dependencies must point to lower sequence_order modules.',
      adaptation_rule:
        'Use diagnostics and recent evidence to choose the next module by strand. Strong mastery can advance to challenge_targets; repeated misses should assign remediation_targets first.',
    },
    modules,
  };
};

const findCycles = (entries: MathMapEntry[]): string[][] => {
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry] as const));
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (slug: string, pathStack: string[]): void => {
    if (visiting.has(slug)) {
      const cycleStart = pathStack.indexOf(slug);
      cycles.push(pathStack.slice(cycleStart).concat(slug));
      return;
    }
    if (visited.has(slug)) return;

    visiting.add(slug);
    const entry = bySlug.get(slug);
    for (const prerequisite of entry?.prerequisites ?? []) {
      visit(prerequisite, pathStack.concat(prerequisite));
    }
    visiting.delete(slug);
    visited.add(slug);
  };

  for (const entry of entries) {
    visit(entry.slug, [entry.slug]);
  }

  return cycles;
};

const auditMap = (map: MathPrerequisiteMap, currentModules: BuiltModule[]): AuditResult => {
  const currentSlugs = new Set(currentModules.map((module) => module.slug));
  const mappedSlugs = new Set<string>();
  const duplicateModules: string[] = [];
  const brokenPrerequisites: string[] = [];
  const forwardPrerequisites: string[] = [];
  const selfPrerequisites: string[] = [];
  const strandCounts: Record<string, number> = {};
  const entriesBySlug = new Map(map.modules.map((entry) => [entry.slug, entry] as const));

  for (const entry of map.modules) {
    if (mappedSlugs.has(entry.slug)) duplicateModules.push(entry.slug);
    mappedSlugs.add(entry.slug);
    strandCounts[entry.adaptive_strand] = (strandCounts[entry.adaptive_strand] ?? 0) + 1;

    for (const prerequisite of entry.prerequisites) {
      const prerequisiteEntry = entriesBySlug.get(prerequisite);
      if (!mappedSlugs.has(prerequisite) && !prerequisiteEntry) {
        brokenPrerequisites.push(`${entry.slug} -> ${prerequisite}`);
      }
      if (prerequisite === entry.slug) {
        selfPrerequisites.push(entry.slug);
      }
      if (prerequisiteEntry && prerequisiteEntry.sequence_order >= entry.sequence_order) {
        forwardPrerequisites.push(`${entry.slug} -> ${prerequisite}`);
      }
    }
  }

  const missingCurrentModules = Array.from(currentSlugs).filter((slug) => !mappedSlugs.has(slug));
  const extraMappedModules = Array.from(mappedSlugs).filter((slug) => !currentSlugs.has(slug));

  return {
    moduleCount: map.modules.length,
    missingCurrentModules,
    extraMappedModules,
    brokenPrerequisites,
    forwardPrerequisites,
    selfPrerequisites,
    duplicateModules,
    cycles: findCycles(map.modules),
    strandCounts,
  };
};

const parseArgs = (): { write: boolean; auditOnly: boolean } => {
  const args = process.argv.slice(2);
  return {
    write: args.includes('--write'),
    auditOnly: args.includes('--audit'),
  };
};

const main = async (): Promise<void> => {
  const { write, auditOnly } = parseArgs();
  const skeleton = await loadSkeleton();
  const map = buildMathPrerequisiteMap(skeleton);
  const currentModules = buildModules(skeleton).filter(
    (entry) => entry.subject === 'Mathematics' && entry.grade >= 3 && entry.grade <= 8,
  );
  const audit = auditMap(map, currentModules);

  if (write) {
    await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(map, null, 2)}\n`);
    console.log(`Wrote ${map.modules.length} math prerequisite entries to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  }

  console.log(`Math prerequisite map audit: ${audit.moduleCount} modules`);
  for (const [strand, count] of Object.entries(audit.strandCounts).sort()) {
    console.log(`  ${strand}: ${count}`);
  }

  const failures = [
    ['missing current modules', audit.missingCurrentModules],
    ['extra mapped modules', audit.extraMappedModules],
    ['broken prerequisites', audit.brokenPrerequisites],
    ['forward prerequisites', audit.forwardPrerequisites],
    ['self prerequisites', audit.selfPrerequisites],
    ['duplicate modules', audit.duplicateModules],
    ['cycles', audit.cycles.map((cycle) => cycle.join(' -> '))],
  ] as const;

  for (const [label, values] of failures) {
    if (values.length > 0) {
      console.error(`\n${label}:`);
      for (const value of values) console.error(`  - ${value}`);
    }
  }

  if (failures.some(([, values]) => values.length > 0)) {
    process.exitCode = 1;
    return;
  }

  if (auditOnly && !write) {
    console.log(`Audit passed for ${path.relative(process.cwd(), OUTPUT_PATH)} generation rules.`);
  } else {
    console.log('Audit passed.');
  }
};

const invokedFromCli =
  process.argv[1]?.includes('build_math_3_8_prerequisite_map.ts') ||
  process.argv[1]?.includes('build_math_3_8_prerequisite_map.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
