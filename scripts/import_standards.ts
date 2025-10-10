import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

import { loadStructuredFile } from './utils/files.js';
import { createServiceRoleClient } from './utils/supabase.js';

type StandardInput = {
  framework: string;
  code: string;
  description?: string | null;
  subject?: string | null;
  grade_band?: string | null;
  gradeBand?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

type StandardUpsert = {
  framework: string;
  code: string;
  description: string | null;
  subject: string | null;
  grade_band: string | null;
  metadata: Record<string, unknown>;
};

const DEFAULT_FILE = path.resolve(process.cwd(), 'data/standards/standards.json');
const BATCH_SIZE = 200;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value == null) {
    return null;
  }
  return String(value).trim() || null;
};

const toMetadata = (input: StandardInput): Record<string, unknown> => {
  if (isObject(input.metadata)) {
    return { ...input.metadata };
  }

  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      ['framework', 'code', 'description', 'subject', 'grade_band', 'gradeBand', 'notes', 'metadata'].includes(key)
    ) {
      continue;
    }
    if (value !== undefined) {
      metadata[key] = value;
    }
  }

  if (input.notes) {
    metadata.notes = input.notes;
  }

  return metadata;
};

const normalizeStandard = (input: StandardInput): StandardUpsert => {
  const framework = normalizeString(input.framework);
  const code = normalizeString(input.code);
  if (!framework || !code) {
    throw new Error(`Standard entries must include framework and code. Received: ${JSON.stringify(input)}`);
  }

  return {
    framework,
    code,
    description: normalizeString(input.description) ?? null,
    subject: normalizeString(input.subject) ?? null,
    grade_band: normalizeString(input.grade_band) ?? normalizeString(input.gradeBand) ?? null,
    metadata: toMetadata(input),
  };
};

const parseCsvFile = async (filePath: string): Promise<StandardInput[]> => {
  const raw = await fs.readFile(filePath, 'utf8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];
  return records.map((record) => record as StandardInput);
};

const loadStandardsFile = async (filePath: string): Promise<StandardInput[]> => {
  const resolved = path.resolve(process.cwd(), filePath);

  if (resolved.endsWith('.csv')) {
    return parseCsvFile(resolved);
  }

  const payload = await loadStructuredFile<unknown>(resolved);
  if (Array.isArray(payload)) {
    return payload as StandardInput[];
  }

  if (isObject(payload) && Array.isArray(payload.standards)) {
    return payload.standards as StandardInput[];
  }

  throw new Error(`Unsupported standards file format for ${resolved}. Provide an array or { "standards": [] }`);
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const upsertStandards = async (supabase: SupabaseClient, standards: StandardUpsert[]): Promise<number> => {
  let inserted = 0;
  for (const chunk of chunkArray(standards, BATCH_SIZE)) {
    const { error, data } = await supabase
      .from('standards')
      .upsert(chunk, { onConflict: 'framework,code' })
      .select('id');

    if (error) {
      throw new Error(`Failed to upsert standards: ${error.message}`);
    }

    inserted += data?.length ?? 0;
  }
  return inserted;
};

const parseArgs = (): { file: string } => {
  const args = process.argv.slice(2);
  let file = DEFAULT_FILE;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file' || arg === '--path') {
      const next = args[i + 1];
      if (!next) {
        throw new Error(`Expected value after ${arg}`);
      }
      file = path.resolve(process.cwd(), next);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { file };
};

const main = async () => {
  const { file } = parseArgs();
  const inputs = await loadStandardsFile(file);
  if (inputs.length === 0) {
    console.log(`No standards found in ${file}`);
    return;
  }

  const normalized = inputs.map(normalizeStandard);
  const supabase = createServiceRoleClient();
  const inserted = await upsertStandards(supabase, normalized);

  console.log(`Upserted ${inserted} standards from ${file}`);
};

const invokedFromCli =
  process.argv[1]?.includes('import_standards.ts') || process.argv[1]?.includes('import_standards.js');

if (invokedFromCli) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
