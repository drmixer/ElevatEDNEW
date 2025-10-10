import fs from 'node:fs/promises';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

export async function loadStructuredFile<T = unknown>(inputPath: string): Promise<T> {
  const resolvedPath = path.resolve(process.cwd(), inputPath);
  const data = await fs.readFile(resolvedPath, 'utf8');
  if (resolvedPath.endsWith('.json')) {
    return JSON.parse(data) as T;
  }
  if (resolvedPath.endsWith('.yaml') || resolvedPath.endsWith('.yml')) {
    return parseYaml(data) as T;
  }
  throw new Error(`Unsupported mapping file format for ${resolvedPath}. Use .json, .yaml, or .yml`);
}

export function ensureArray<T>(value: T | T[]): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}
