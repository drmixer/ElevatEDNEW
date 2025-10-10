import type { ImportProviderId } from '../../../shared/import-providers.js';
import type { NormalizedProviderDataset } from '../../../shared/importers/normalized.js';
import type { OpenStaxMapping } from '../../../scripts/import_openstax.js';

export type ProviderLoaderOptions = {
  limit?: number;
};

export type ProviderLoaderResult =
  | {
    provider: ImportProviderId;
    format: 'mapping';
    payload: OpenStaxMapping | Record<string, unknown>;
  }
  | {
    provider: ImportProviderId;
    format: 'dataset';
    payload: NormalizedProviderDataset;
  };

export type ProviderLoader = (
  inputPath: string,
  options: ProviderLoaderOptions,
) => Promise<ProviderLoaderResult>;
