import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  IMPORT_PROVIDER_MAP,
  type ImportProviderId,
} from '../../../shared/import-providers.js';
import type { NormalizedProviderDataset } from '../../../shared/importers/normalized.js';
import type { OpenStaxMapping } from '../../../scripts/import_openstax.js';
import { loadC3TeachersDataset } from './loaders/c3teachers.js';
import { loadNasaNoaaDataset } from './loaders/nasaNoaa.js';
import { loadOpenStaxMapping } from './loaders/openstax.js';
import { loadSiyavulaDataset } from './loaders/siyavula.js';
import type { ProviderLoader, ProviderLoaderOptions, ProviderLoaderResult } from './types.js';

const loaders: Record<ImportProviderId, ProviderLoader> = {
  openstax: loadOpenStaxMapping,
  c3teachers: loadC3TeachersDataset,
  siyavula: loadSiyavulaDataset,
  nasa_noaa: loadNasaNoaaDataset,
  gutenberg: async () => {
    throw new Error('Gutenberg raw ingestion is handled via CSV mappings today. No raw loader implemented.');
  },
  federal: async () => {
    throw new Error('Federal PD raw ingestion is handled via curated mapping files.');
  },
};

type CLIArgs = {
  provider: ImportProviderId;
  input: string;
  output?: string;
  pretty: boolean;
  limit?: number;
};

const parseArgs = (): CLIArgs => {
  const args = process.argv.slice(2);
  const options: Partial<CLIArgs> = {
    pretty: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--provider':
      case '-p': {
        const next = args[index + 1];
        if (!next) {
          throw new Error('Expected provider id after --provider.');
        }
        if (!IMPORT_PROVIDER_MAP.has(next as ImportProviderId)) {
          throw new Error(`Unsupported provider "${next}".`);
        }
        options.provider = next as ImportProviderId;
        index += 1;
        break;
      }
      case '--input':
      case '-i': {
        const next = args[index + 1];
        if (!next) {
          throw new Error('Expected input file path after --input.');
        }
        options.input = next;
        index += 1;
        break;
      }
      case '--output':
      case '-o': {
        const next = args[index + 1];
        if (!next) {
          throw new Error('Expected output file path after --output.');
        }
        options.output = next;
        index += 1;
        break;
      }
      case '--pretty': {
        options.pretty = true;
        break;
      }
      case '--limit': {
        const next = args[index + 1];
        if (!next) {
          throw new Error('Expected numeric value after --limit.');
        }
        const parsed = Number.parseInt(next, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          throw new Error('--limit must be a positive integer.');
        }
        options.limit = parsed;
        index += 1;
        break;
      }
      default:
        throw new Error(`Unknown argument ${arg}`);
    }
  }

  if (!options.provider) {
    throw new Error('Missing required --provider argument.');
  }
  if (!options.input) {
    throw new Error('Missing required --input argument.');
  }

  return options as CLIArgs;
};

const normalisePath = (value: string): string => path.resolve(process.cwd(), value);

const writeOutput = async (
  payload: OpenStaxMapping | NormalizedProviderDataset | Record<string, unknown>,
  destination: string | undefined,
  pretty: boolean,
) => {
  const json = JSON.stringify(payload, undefined, pretty ? 2 : undefined);
  if (!destination) {
    process.stdout.write(`${json}\n`);
    return;
  }
  const target = normalisePath(destination);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${json}\n`, 'utf8');
  console.log(`Wrote normalized payload to ${target}`);
};

const summarizeResult = (result: ProviderLoaderResult) => {
  if (result.format === 'dataset') {
    const dataset = result.payload;
    console.log(
      `[${result.provider}] modules=${dataset.modules.length} generatedAt=${dataset.generatedAt ?? 'n/a'}`,
    );
  } else {
    const mapping = result.payload;
    const keys = Object.keys(mapping);
    console.log(`[${result.provider}] mapping contains ${keys.length} module entries.`);
  }
};

const main = async () => {
  try {
    const args = parseArgs();
    const loader = loaders[args.provider];
    if (!loader) {
      throw new Error(`No loader implemented for provider ${args.provider}.`);
    }

    const options: ProviderLoaderOptions = {
      limit: args.limit,
    };
    const inputPath = normalisePath(args.input);
    console.log(`Normalizing ${args.provider} dataset from ${inputPath} ...`);

    const result = await loader(inputPath, options);
    summarizeResult(result);
    await writeOutput(result.payload, args.output, args.pretty);
  } catch (error) {
    console.error(
      `[providers] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
};

await main();
