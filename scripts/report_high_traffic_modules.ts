import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceRoleClient } from './utils/supabase.js';

type SessionRow = { id: number; lesson_id: number | null };
type LessonRow = { id: number; module_id: number | null };
type ModuleRow = { id: number; slug: string; title: string | null; subject: string | null; grade_band: string | null };
type CoverageRow = {
  module_slug: string;
  meets_explanation_baseline: boolean;
  meets_practice_baseline: boolean;
  meets_assessment_baseline: boolean;
  meets_external_baseline: boolean;
};

type Options = {
  days: number;
  limit: number;
  grades: string[] | null;
  subjects: string[] | null;
  outputPath: string | null;
};

type ModuleStats = {
  module: ModuleRow;
  sessions: number;
  aiEvents: number;
  lessonsTouched: Set<number>;
  coverage?: CoverageRow;
};

const DEFAULT_DAYS = 14;
const DEFAULT_LIMIT = 25;
const PAGE_SIZE = 1000;
const AI_EVENT_TYPES = ['hint_request', 'system_feedback'];

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    days: DEFAULT_DAYS,
    limit: DEFAULT_LIMIT,
    grades: null,
    subjects: null,
    outputPath: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--days') {
      const value = Number.parseInt(args[i + 1] ?? '', 10);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Expected a positive integer after --days');
      options.days = value;
      i += 1;
    } else if (arg === '--limit') {
      const value = Number.parseInt(args[i + 1] ?? '', 10);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Expected a positive integer after --limit');
      options.limit = value;
      i += 1;
    } else if (arg === '--grades' || arg === '--grade-bands') {
      const value = args[i + 1];
      if (!value) throw new Error(`Expected comma-separated grades after ${arg}`);
      options.grades = value
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);
      i += 1;
    } else if (arg === '--subjects') {
      const value = args[i + 1];
      if (!value) throw new Error('Expected comma-separated subjects after --subjects');
      options.subjects = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i += 1;
    } else if (arg === '--out' || arg === '--output') {
      const value = args[i + 1];
      if (!value) throw new Error('Expected a file path after --out/--output');
      options.outputPath = value;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    parts.push(items.slice(i, i + size));
  }
  return parts;
};

const fetchSessions = async (supabase: SupabaseClient, cutoffIso: string): Promise<SessionRow[]> => {
  const rows: SessionRow[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('practice_sessions')
      .select('id, lesson_id')
      .gte('started_at', cutoffIso)
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load practice sessions: ${error.message}`);
    }

    const batch = (data ?? []) as SessionRow[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return rows;
};

const fetchLessons = async (supabase: SupabaseClient, lessonIds: number[]): Promise<Map<number, LessonRow>> => {
  const map = new Map<number, LessonRow>();
  for (const group of chunk(Array.from(new Set(lessonIds)), 500)) {
    const { data, error } = await supabase.from('lessons').select('id, module_id').in('id', group);
    if (error) {
      throw new Error(`Failed to load lessons: ${error.message}`);
    }
    for (const row of data ?? []) {
      map.set(row.id as number, { id: row.id as number, module_id: row.module_id as number | null });
    }
  }
  return map;
};

const fetchModules = async (supabase: SupabaseClient, moduleIds: number[]): Promise<Map<number, ModuleRow>> => {
  const map = new Map<number, ModuleRow>();
  for (const group of chunk(Array.from(new Set(moduleIds)), 250)) {
    const { data, error } = await supabase
      .from('modules')
      .select('id, slug, title, subject, grade_band')
      .in('id', group);
    if (error) {
      throw new Error(`Failed to load modules: ${error.message}`);
    }
    for (const row of data ?? []) {
      map.set(row.id as number, {
        id: row.id as number,
        slug: row.slug as string,
        title: (row.title as string | null) ?? null,
        subject: (row.subject as string | null) ?? null,
        grade_band: (row.grade_band as string | null) ?? null,
      });
    }
  }
  return map;
};

const fetchAiEventCounts = async (supabase: SupabaseClient, sessionIds: number[]): Promise<Map<number, number>> => {
  const counts = new Map<number, number>();
  for (const group of chunk(sessionIds, 500)) {
    const { data, error } = await supabase
      .from('practice_events')
      .select('session_id, event_type')
      .in('session_id', group)
      .in('event_type', AI_EVENT_TYPES);
    if (error) {
      throw new Error(`Failed to load practice events: ${error.message}`);
    }
    for (const row of data ?? []) {
      const sessionId = row.session_id as number;
      counts.set(sessionId, (counts.get(sessionId) ?? 0) + 1);
    }
  }
  return counts;
};

const fetchCoverage = async (supabase: SupabaseClient, slugs: string[]): Promise<Map<string, CoverageRow>> => {
  const map = new Map<string, CoverageRow>();
  for (const group of chunk(Array.from(new Set(slugs)), 250)) {
    const { data, error } = await supabase
      .from('coverage_dashboard_cells')
      .select(
        [
          'module_slug',
          'meets_explanation_baseline',
          'meets_practice_baseline',
          'meets_assessment_baseline',
          'meets_external_baseline',
        ].join(','),
      )
      .in('module_slug', group);
    if (error) {
      throw new Error(`Failed to load coverage dashboard cells: ${error.message}`);
    }
    for (const row of data ?? []) {
      const slug = row.module_slug as string;
      map.set(slug, {
        module_slug: slug,
        meets_explanation_baseline: Boolean(row.meets_explanation_baseline),
        meets_practice_baseline: Boolean(row.meets_practice_baseline),
        meets_assessment_baseline: Boolean(row.meets_assessment_baseline),
        meets_external_baseline: Boolean(row.meets_external_baseline),
      });
    }
  }
  return map;
};

const formatCoverage = (coverage?: CoverageRow): string => {
  if (!coverage) return 'L?:P?:A?:E?';
  const mark = (value: boolean, label: string): string => `${label}${value ? '✓' : '✗'}`;
  return [mark(coverage.meets_explanation_baseline, 'L'), mark(coverage.meets_practice_baseline, 'P'), mark(coverage.meets_assessment_baseline, 'A'), mark(coverage.meets_external_baseline, 'E')].join('/');
};

const printReport = (rows: ModuleStats[], options: Options, destination?: fs.WriteStream) => {
  const lines: string[] = [];
  lines.push(
    `Top ${Math.min(options.limit, rows.length)} modules by practice sessions (last ${options.days} days${
      options.grades?.length ? `, grades ${options.grades.join('/')}` : ''
    }${options.subjects?.length ? `, subjects ${options.subjects.join('/')}` : ''}):`,
  );
  lines.push('rank | module_slug | subject | grade | sessions_14d | ai_events_14d | lessons_touched | coverage(L/P/A/E)');

  rows.slice(0, options.limit).forEach((entry, index) => {
    const gradeLabel = entry.module.grade_band ?? 'n/a';
    const subjectLabel = entry.module.subject ?? 'Unknown';
    lines.push(
      `${index + 1}`.padStart(4, ' ') +
        ` | ${entry.module.slug}` +
        ` | ${subjectLabel}` +
        ` | ${gradeLabel}` +
        ` | ${entry.sessions}` +
        ` | ${entry.aiEvents}` +
        ` | ${entry.lessonsTouched.size}` +
        ` | ${formatCoverage(entry.coverage)}`,
    );
  });

  const output = lines.join('\n');
  if (destination) {
    destination.write(`${output}\n`);
  } else {
    console.log(output);
  }
};

const resolveOutputStream = (outputPath: string | null): fs.WriteStream | null => {
  if (!outputPath) return null;
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return fs.createWriteStream(resolved, { flags: 'w' });
};

const main = async () => {
  const options = parseArgs();
  const supabase = createServiceRoleClient();
  const cutoff = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  const sessions = await fetchSessions(supabase, cutoffIso);
  if (sessions.length === 0) {
    console.log(`No practice sessions found in the last ${options.days} days.`);
    return;
  }

  const lessonIds = Array.from(new Set(sessions.map((s) => s.lesson_id).filter((id): id is number => typeof id === 'number')));
  const lessons = await fetchLessons(supabase, lessonIds);

  const moduleIds: number[] = [];
  const sessionModule = new Map<number, number>();
  const moduleLessons = new Map<number, Set<number>>();
  for (const session of sessions) {
    const lesson = session.lesson_id != null ? lessons.get(session.lesson_id) : null;
    const moduleId = lesson?.module_id ?? null;
    if (!moduleId) continue;
    sessionModule.set(session.id, moduleId);
    moduleIds.push(moduleId);
    const lessonSet = moduleLessons.get(moduleId) ?? new Set<number>();
    if (lesson?.id) {
      lessonSet.add(lesson.id);
    }
    moduleLessons.set(moduleId, lessonSet);
  }

  if (moduleIds.length === 0) {
    console.log('No practice sessions were linked to modules.');
    return;
  }

  const modules = await fetchModules(supabase, moduleIds);

  const aiEventsBySession = await fetchAiEventCounts(
    supabase,
    Array.from(new Set(sessions.map((s) => s.id))),
  );

  const stats = new Map<number, ModuleStats>();
  for (const [sessionId, moduleId] of sessionModule.entries()) {
    const module = modules.get(moduleId);
    if (!module) continue;

    if (options.grades && !options.grades.includes((module.grade_band ?? '').trim())) {
      continue;
    }
    if (options.subjects && !options.subjects.includes((module.subject ?? '').trim())) {
      continue;
    }

    if (!stats.has(moduleId)) {
      stats.set(moduleId, {
        module,
        sessions: 0,
        aiEvents: 0,
        lessonsTouched: moduleLessons.get(moduleId) ?? new Set<number>(),
      });
    }
    const entry = stats.get(moduleId)!;
    entry.sessions += 1;
    entry.aiEvents += aiEventsBySession.get(sessionId) ?? 0;
  }

  const sorted = Array.from(stats.values()).sort((a, b) => {
    if (b.sessions !== a.sessions) return b.sessions - a.sessions;
    if (b.aiEvents !== a.aiEvents) return b.aiEvents - a.aiEvents;
    return (a.module.slug ?? '').localeCompare(b.module.slug ?? '');
  });

  const coverageMap = await fetchCoverage(
    supabase,
    sorted.map((s) => s.module.slug).filter(Boolean),
  );
  sorted.forEach((entry) => {
    entry.coverage = coverageMap.get(entry.module.slug);
  });

  const stream = resolveOutputStream(options.outputPath);
  printReport(sorted, options, stream ?? undefined);
  if (stream) {
    stream.end();
    console.log(`Report written to ${path.resolve(options.outputPath!)}.`);
  }
};

const invokedFromCli =
  process.argv[1]?.includes('report_high_traffic_modules.ts') ||
  process.argv[1]?.includes('report_high_traffic_modules.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
