import path from 'node:path';
import process from 'node:process';

import { loadStructuredFile } from './utils/files.js';
import {
  MAX_PLACEMENT_LEVEL,
  MIN_PLACEMENT_LEVEL,
  PHASE1_PLACEMENT_LEVELS,
  normalizePlacementLevel,
  normalizePlacementSubjectKey,
  parsePlacementSubjectList,
  placementSubjectLabel,
  placementWindowForLevel,
} from './utils/placementMetadata.js';

type DiagnosticOption = {
  text: string;
  isCorrect: boolean;
};

type DiagnosticItem = {
  id: string;
  prompt: string;
  strand?: string;
  standard?: string;
  options?: DiagnosticOption[];
};

type BlueprintSection = {
  strand: string;
  itemCount: number;
};

type DiagnosticConfig = {
  grade_band: string;
  subject: string;
  title: string;
  blueprint?: {
    sections?: BlueprintSection[];
  };
  items?: DiagnosticItem[];
};

type DiagnosticFile = Record<string, DiagnosticConfig>;

type AssessmentAudit = {
  key: string;
  filePath: string;
  subjectKey: 'math' | 'ela' | 'science';
  gradeBand: string;
  placementLevel: number;
  window: { min_level: number; max_level: number };
  itemCount: number;
  issues: string[];
};

const DEFAULT_FILES = [
  'data/assessments/diagnostics_phase13.json',
  'data/assessments/diagnostics_gradesK2.json',
  'data/assessments/diagnostics_grades35.json',
  'data/assessments/diagnostics_k_complete.json',
  'data/assessments/diagnostics_grade2.json',
  'data/assessments/diagnostics_grade3.json',
  'data/assessments/diagnostics_grade5.json',
  'data/assessments/diagnostics_grades912.json',
].map((entry) => path.resolve(process.cwd(), entry));

const parseArgs = (argv: string[]) => {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    index += 1;
  }

  const filesArg = args.get('files');
  const files =
    typeof filesArg === 'string' && filesArg.trim().length
      ? filesArg.split(',').map((entry) => path.resolve(process.cwd(), entry.trim()))
      : DEFAULT_FILES;
  const subjects = parsePlacementSubjectList(args.get('subjects') as string | undefined);
  const levelsArg = (args.get('levels') as string | undefined) ?? PHASE1_PLACEMENT_LEVELS.join(',');
  const levels = Array.from(
    new Set(
      levelsArg
        .split(',')
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isFinite(entry))
        .map((entry) => Math.max(MIN_PLACEMENT_LEVEL, Math.min(MAX_PLACEMENT_LEVEL, entry))),
    ),
  ).sort((a, b) => a - b);
  const help = Boolean(args.get('help')) || Boolean(args.get('h'));

  return { files, subjects, levels, help };
};

const printHelp = () => {
  console.log(`
audit_placement_readiness.ts

Audits local diagnostic source files for Phase 1 placement readiness.

Usage:
  npx tsx scripts/audit_placement_readiness.ts [--subjects math,ela] [--levels 0,1,2,3,4,5,6,7,8]
      [--files data/assessments/diagnostics_phase13.json,data/assessments/diagnostics_grades35.json]

Defaults:
  --subjects  math,ela
  --levels    0,1,2,3,4,5,6,7,8
  --files     all diagnostics JSON files used by seed_diagnostic_assessments.ts
`.trim());
};

const normalizeStrandKey = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const auditAssessment = (filePath: string, key: string, config: DiagnosticConfig): AssessmentAudit | null => {
  const subjectKey = normalizePlacementSubjectKey(config.subject);
  if (!subjectKey) return null;

  const issues: string[] = [];
  const sections = Array.isArray(config.blueprint?.sections) ? config.blueprint.sections : [];
  const items = Array.isArray(config.items) ? config.items : [];
  const strandCounts = new Map<string, number>();
  const knownStrands = new Set(sections.map((section) => normalizeStrandKey(section.strand)).filter(Boolean));
  const itemIds = new Set<string>();

  if (!config.title?.trim().length) issues.push('missing title');
  if (!config.grade_band?.trim().length) issues.push('missing grade_band');
  if (!sections.length) issues.push('missing blueprint sections');
  if (!items.length) issues.push('missing diagnostic items');

  for (const item of items) {
    const itemPrefix = `item ${item.id || '(missing id)'}`;
    if (!item.id?.trim().length) {
      issues.push('item missing id');
    } else if (itemIds.has(item.id)) {
      issues.push(`${itemPrefix} duplicated`);
    } else {
      itemIds.add(item.id);
    }

    if (!item.prompt?.trim().length) issues.push(`${itemPrefix} missing prompt`);
    if (!item.strand?.trim().length) {
      issues.push(`${itemPrefix} missing strand`);
    } else {
      const strandKey = normalizeStrandKey(item.strand);
      strandCounts.set(strandKey, (strandCounts.get(strandKey) ?? 0) + 1);
      if (knownStrands.size > 0 && !knownStrands.has(strandKey)) {
        issues.push(`${itemPrefix} strand not present in blueprint`);
      }
    }
    if (!item.standard?.trim().length) issues.push(`${itemPrefix} missing standard`);
    if (!Array.isArray(item.options) || item.options.length < 2) {
      issues.push(`${itemPrefix} missing options`);
    } else if (!item.options.some((option) => option.isCorrect)) {
      issues.push(`${itemPrefix} has no correct option`);
    }
  }

  for (const section of sections) {
    const strandKey = normalizeStrandKey(section.strand);
    if (!strandKey) {
      issues.push('blueprint section missing strand');
      continue;
    }

    const actualCount = strandCounts.get(strandKey) ?? 0;
    if (actualCount < section.itemCount) {
      issues.push(`blueprint strand "${section.strand}" expects ${section.itemCount} items but only has ${actualCount}`);
    }
  }

  const placementLevel = normalizePlacementLevel(config.grade_band);
  return {
    key,
    filePath,
    subjectKey,
    gradeBand: config.grade_band,
    placementLevel,
    window: placementWindowForLevel(placementLevel),
    itemCount: items.length,
    issues,
  };
};

export async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const audits: AssessmentAudit[] = [];
  for (const filePath of args.files) {
    const payload = await loadStructuredFile<DiagnosticFile>(filePath);
    for (const [key, config] of Object.entries(payload)) {
      const audited = auditAssessment(filePath, key, config);
      if (audited) audits.push(audited);
    }
  }

  const filtered = audits.filter((audit) => args.subjects.includes(audit.subjectKey));
  const totalIssues = filtered.reduce((count, audit) => count + audit.issues.length, 0);

  console.log(`Placement readiness audit`);
  console.log(`Subjects: ${args.subjects.join(', ')}`);
  console.log(`Levels required: ${args.levels.join(', ')}`);
  console.log(`Assessments scanned: ${filtered.length}`);
  console.log('');

  let hasBlockingIssue = false;
  for (const subjectKey of args.subjects) {
    const subjectAudits = filtered.filter((audit) => audit.subjectKey === subjectKey);
    const coveredLevels = new Set<number>();
    subjectAudits.forEach((audit) => {
      for (let level = audit.window.min_level; level <= audit.window.max_level; level += 1) {
        coveredLevels.add(level);
      }
    });

    const missingLevels = args.levels.filter((level) => !coveredLevels.has(level));
    if (missingLevels.length > 0) hasBlockingIssue = true;

    console.log(`${placementSubjectLabel(subjectKey)}:`);
    console.log(`  assessments: ${subjectAudits.length}`);
    console.log(`  covered levels: ${Array.from(coveredLevels).sort((a, b) => a - b).join(', ') || 'none'}`);
    console.log(`  missing levels: ${missingLevels.join(', ') || 'none'}`);
    console.log(`  total items: ${subjectAudits.reduce((sum, audit) => sum + audit.itemCount, 0)}`);

    for (const audit of subjectAudits) {
      const issueLabel = audit.issues.length ? `${audit.issues.length} issue(s)` : 'ok';
      console.log(
        `  - ${audit.key} [band ${audit.gradeBand}, level ${audit.placementLevel}, window ${audit.window.min_level}-${audit.window.max_level}, items ${audit.itemCount}] ${issueLabel}`,
      );
    }

    console.log('');
  }

  if (totalIssues > 0) {
    hasBlockingIssue = true;
    console.log(`Blocking issues:`);
    filtered
      .filter((audit) => audit.issues.length > 0)
      .forEach((audit) => {
        console.log(`- ${audit.key} (${path.relative(process.cwd(), audit.filePath)})`);
        audit.issues.forEach((issue) => console.log(`  ${issue}`));
      });
  } else {
    console.log('No blocking content issues found in the scanned assessments.');
  }

  if (hasBlockingIssue) {
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1]?.includes('audit_placement_readiness.ts') ||
  process.argv[1]?.includes('audit_placement_readiness.js');

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
