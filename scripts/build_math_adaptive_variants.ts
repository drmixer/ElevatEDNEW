import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import type {
  MathAdaptiveVariant,
  MathAdaptiveVariantCatalog,
  MathAdaptiveVariantKind,
} from '../shared/mathAdaptiveVariants.js';
import type { MathPrerequisiteMap, MathMapEntry } from '../shared/mathAdaptivePolicy.js';

const MAP_PATH = path.resolve(process.cwd(), 'data/curriculum/math_3_8_prerequisite_map.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'data/curriculum/math_adaptive_variants_3_8.json');

const PRIORITY_CONCEPTS = new Set([
  'multiplication_division',
  'fractions',
  'decimals',
  'ratios',
  'percent_rates',
  'expressions_equations',
]);

const VARIANT_KINDS: MathAdaptiveVariantKind[] = [
  'repair_lesson',
  'guided_repair_practice',
  'challenge_task',
  'exit_ticket',
];

const conceptLabel = (concept: string): string => {
  const labels: Record<string, string> = {
    multiplication_division: 'multiplication and division',
    fractions: 'fractions',
    decimals: 'decimals',
    ratios: 'ratios and proportional reasoning',
    percent_rates: 'percent and rates',
    expressions_equations: 'expressions and equations',
  };
  return labels[concept] ?? concept.replace(/_/g, ' ');
};

const numbersFor = (grade: number, concept: string): { a: number; b: number; c: number } => {
  const base = grade + 2;
  if (concept === 'multiplication_division') return { a: base, b: grade + 4, c: 3 };
  if (concept === 'fractions') return { a: grade + 1, b: grade + 3, c: 2 };
  if (concept === 'decimals') return { a: grade * 10 + 5, b: grade + 2, c: 10 };
  if (concept === 'ratios') return { a: grade + 2, b: (grade + 2) * 3, c: 3 };
  if (concept === 'percent_rates') return { a: 25, b: grade * 8, c: 100 };
  return { a: grade + 3, b: 2, c: grade + 5 };
};

const repairModel = (module: MathMapEntry): string => {
  const n = numbersFor(module.grade, module.concept);
  switch (module.concept) {
    case 'multiplication_division':
      return `Use equal groups. ${n.a} groups of ${n.b} means ${n.a} x ${n.b}. To divide, use the total and ask how many equal groups or how many in each group.`;
    case 'fractions':
      return `Name the whole first. If ${n.a} of ${n.b} equal parts are shaded, the fraction is ${n.a}/${n.b}. Equivalent fractions keep the same value by multiplying or dividing numerator and denominator by the same number.`;
    case 'decimals':
      return `Connect decimals to place value. ${n.a / 10} means ${n.a} tenths. Line up decimal points before comparing or adding.`;
    case 'ratios':
      return `Read a ratio as a relationship. If ${n.a} notebooks cost $${n.b}, one notebook costs $${n.b / n.a}. A table helps keep equivalent ratios organized.`;
    case 'percent_rates':
      return `Percent means per 100. ${n.a}% of ${n.b} can be written as ${n.a}/100 x ${n.b}. Estimate first so the answer has a reasonable size.`;
    case 'expressions_equations':
      return `Keep both sides balanced. If x + ${n.b} = ${n.c + n.b}, subtract ${n.b} from both sides to isolate x.`;
    default:
      return `Break the problem into quantities, relationships, and a check for reasonableness.`;
  }
};

const repairPractice = (module: MathMapEntry): string[] => {
  const n = numbersFor(module.grade, module.concept);
  switch (module.concept) {
    case 'multiplication_division':
      return [
        `Draw or imagine ${n.a} equal groups with ${n.b} in each group. What is the total?`,
        `A total of ${n.a * n.b} objects is split into ${n.a} equal groups. How many are in each group?`,
      ];
    case 'fractions':
      return [
        `Write a fraction for ${n.a} shaded parts out of ${n.b} equal parts.`,
        `Create an equivalent fraction for ${n.a}/${n.b} by multiplying numerator and denominator by ${n.c}.`,
      ];
    case 'decimals':
      return [
        `Write ${n.a} tenths as a decimal.`,
        `Which is greater: ${(n.a / 10).toFixed(1)} or ${((n.a + 2) / 10).toFixed(1)}? Explain using tenths.`,
      ];
    case 'ratios':
      return [
        `Complete the ratio table: ${n.a} items cost $${n.b}; ${n.a * 2} items cost ___; ${n.a * 3} items cost ___.`,
        `What is the unit rate for ${n.a} items costing $${n.b}?`,
      ];
    case 'percent_rates':
      return [
        `Find ${n.a}% of ${n.b}.`,
        `Estimate first: should ${n.a}% of ${n.b} be less than, equal to, or greater than ${n.b}?`,
      ];
    case 'expressions_equations':
      return [
        `Solve x + ${n.b} = ${n.b + n.c}.`,
        `Write an expression for a number plus ${n.b}, then evaluate it when the number is ${n.c}.`,
      ];
    default:
      return [`Solve one aligned problem and explain each step.`, `Check the answer with a second strategy.`];
  }
};

const challengePrompt = (module: MathMapEntry): string => {
  const n = numbersFor(module.grade, module.concept);
  switch (module.concept) {
    case 'multiplication_division':
      return `A club packs ${n.a * n.b} snacks into bags. Each bag has ${n.b} snacks. Then ${n.c} more bags are added. How many snacks are packed now? Show two operations.`;
    case 'fractions':
      return `Two recipes use ${n.a}/${n.b} cup and ${(n.a + 1)}/${n.b} cup of flour. Compare them, then write one equivalent fraction for each.`;
    case 'decimals':
      return `A runner records ${(n.a / 10).toFixed(1)} miles on Monday and ${((n.a + n.b) / 10).toFixed(1)} miles on Tuesday. How many miles total, and how do you know the decimal point is placed correctly?`;
    case 'ratios':
      return `A map uses ${n.a} inches for ${n.b} miles. Build a table for ${n.a}, ${n.a * 2}, and ${n.a * 5} inches, then find the miles per inch.`;
    case 'percent_rates':
      return `A store discounts a $${n.b} item by ${n.a}%, then adds $${n.c} shipping. What is the final cost?`;
    case 'expressions_equations':
      return `Write and solve an equation for: a number multiplied by ${n.b}, then increased by ${n.c}, equals ${n.b * n.c + n.c}.`;
    default:
      return `Solve a multi-step problem, explain the model, and check the answer with estimation.`;
  }
};

const buildMarkdown = (module: MathMapEntry, kind: MathAdaptiveVariantKind): string => {
  const focus = conceptLabel(module.concept);
  const practice = repairPractice(module);
  if (kind === 'repair_lesson') {
    return [
      `# Repair: ${module.title}`,
      '',
      `## Goal`,
      `Rebuild the missing piece for grade ${module.grade} ${focus}.`,
      '',
      `## Key Idea`,
      repairModel(module),
      '',
      `## Worked Example`,
      `Read the problem slowly. Name the quantities. Draw a quick model. Then write the equation that matches the model.`,
      '',
      `## Common Mistake`,
      `Do not start with a memorized operation. First decide what the numbers mean.`,
      '',
      `## Try It`,
      `- ${practice[0]}`,
      `- Explain why your answer fits the model.`,
    ].join('\n');
  }

  if (kind === 'guided_repair_practice') {
    return [
      `# Guided Practice: ${module.title}`,
      '',
      `1. Name what each number represents.`,
      `2. Choose a model: equal groups, fraction bar, decimal grid, ratio table, percent equation, or balance equation.`,
      `3. Solve one step at a time.`,
      `4. Check whether the answer is reasonable.`,
      '',
      `## Practice Set`,
      `- ${practice[0]}`,
      `- ${practice[1]}`,
      `- Write one sentence explaining the strategy you used.`,
    ].join('\n');
  }

  if (kind === 'challenge_task') {
    return [
      `# Challenge: ${module.title}`,
      '',
      `## Task`,
      challengePrompt(module),
      '',
      `## Requirements`,
      `- Show a model or table before calculating.`,
      `- Write the equation or steps.`,
      `- Explain why the answer makes sense.`,
      '',
      `## Stretch`,
      `Change one number in the problem and predict how the answer changes before recalculating.`,
    ].join('\n');
  }

  return [
    `# Exit Ticket: ${module.title}`,
    '',
    `Solve one short ${focus} problem without hints. This is not a speed test. It checks whether the strategy is ready to use again tomorrow.`,
    '',
    `## Task`,
    repairPractice(module)[0],
    '',
    `## Explain`,
    `Write one sentence that names the model or strategy you used. Use labels, units, or variables so the work is easy to check.`,
    '',
    `## Check`,
    `Estimate or reverse the operation to prove your answer is reasonable.`,
    '',
    `## Ready To Move On`,
    `A strong response has the correct answer, a clear model or equation, and a reasonableness check.`,
  ].join('\n');
};

const buildPracticeItems = (module: MathMapEntry, kind: MathAdaptiveVariantKind) => {
  const prompts = kind === 'challenge_task' ? [challengePrompt(module)] : repairPractice(module);
  return prompts.map((prompt) => ({
    prompt,
    answer: 'Student response should include the correct computation and a labeled model or equation.',
    explanation: `Look for accurate ${conceptLabel(module.concept)} reasoning, clear labels, and a reasonableness check.`,
  }));
};

const buildVariant = (module: MathMapEntry, kind: MathAdaptiveVariantKind): MathAdaptiveVariant => {
  const titlePrefix: Record<MathAdaptiveVariantKind, string> = {
    repair_lesson: 'Repair Lesson',
    guided_repair_practice: 'Guided Repair Practice',
    challenge_task: 'Challenge Task',
    exit_ticket: 'Exit Ticket',
  };
  const minuteMap: Record<MathAdaptiveVariantKind, number> = {
    repair_lesson: 20,
    guided_repair_practice: 12,
    challenge_task: 25,
    exit_ticket: 5,
  };

  return {
    id: `${module.slug}::${kind}`,
    moduleSlug: module.slug,
    kind,
    title: `${titlePrefix[kind]}: ${module.title}`,
    estimatedMinutes: minuteMap[kind],
    purpose:
      kind === 'challenge_task'
        ? `Stretch strong mastery of grade ${module.grade} ${conceptLabel(module.concept)}.`
        : `Strengthen grade ${module.grade} ${conceptLabel(module.concept)} before moving on.`,
    markdown: buildMarkdown(module, kind),
    practiceItems: buildPracticeItems(module, kind),
    masteryCheck:
      kind === 'challenge_task'
        ? 'Student solves the multi-step task, explains the model, and checks reasonableness.'
        : 'Student solves an aligned problem without hints and explains the strategy.',
  };
};

const loadMap = async (): Promise<MathPrerequisiteMap> => {
  const raw = await fs.readFile(MAP_PATH, 'utf8');
  return JSON.parse(raw) as MathPrerequisiteMap;
};

const buildCatalog = (map: MathPrerequisiteMap): MathAdaptiveVariantCatalog => {
  const targetModules = map.modules
    .filter((module) => PRIORITY_CONCEPTS.has(module.concept))
    .sort((a, b) => a.sequence_order - b.sequence_order);
  const variants = targetModules.flatMap((module) => VARIANT_KINDS.map((kind) => buildVariant(module, kind)));

  return {
    version: 1,
    scope: {
      subject: 'Mathematics',
      grades: [3, 4, 5, 6, 7, 8],
      concepts: Array.from(PRIORITY_CONCEPTS),
    },
    variants,
  };
};

const auditCatalog = (catalog: MathAdaptiveVariantCatalog, map: MathPrerequisiteMap): string[] => {
  const failures: string[] = [];
  const priorityModules = map.modules.filter((module) => PRIORITY_CONCEPTS.has(module.concept));
  for (const module of priorityModules) {
    for (const kind of VARIANT_KINDS) {
      const variant = catalog.variants.find((entry) => entry.moduleSlug === module.slug && entry.kind === kind);
      if (!variant) {
        failures.push(`${module.slug} missing ${kind}`);
        continue;
      }
      if (variant.markdown.split(/\s+/).length < 45) failures.push(`${variant.id} markdown too short`);
      if (variant.practiceItems.length === 0) failures.push(`${variant.id} missing practice`);
    }
  }
  return failures;
};

const main = async (): Promise<void> => {
  const write = process.argv.includes('--write');
  const map = await loadMap();
  const catalog = buildCatalog(map);
  const failures = auditCatalog(catalog, map);

  if (write) {
    await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
    console.log(`Wrote ${catalog.variants.length} variants to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  }

  const moduleCount = new Set(catalog.variants.map((variant) => variant.moduleSlug)).size;
  console.log(`Math adaptive variants audit: ${catalog.variants.length} variants across ${moduleCount} modules`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('Audit passed.');
};

const invokedFromCli =
  process.argv[1]?.includes('build_math_adaptive_variants.ts') ||
  process.argv[1]?.includes('build_math_adaptive_variants.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
