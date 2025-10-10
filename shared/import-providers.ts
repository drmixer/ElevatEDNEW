export type ImportProviderId =
  | 'openstax'
  | 'c3teachers'
  | 'siyavula'
  | 'nasa_noaa'
  | 'gutenberg'
  | 'federal';

export type ImportProviderDefinition = {
  id: ImportProviderId;
  label: string;
  description: string;
  samplePath?: string;
  contentSource: string;
  defaultLicense: string;
  importKind: 'mapping' | 'dataset';
  notes?: string;
};

export const IMPORT_PROVIDERS: ImportProviderDefinition[] = [
  {
    id: 'openstax',
    label: 'OpenStax',
    description: 'Full-text chapter ingestion and module lesson alignment.',
    samplePath: 'mappings/openstax.json',
    contentSource: 'OpenStax',
    defaultLicense: 'CC BY 4.0',
    importKind: 'mapping',
    notes: 'Supports mapping modules to OpenStax chapter URLs with optional lesson overrides.',
  },
  {
    id: 'c3teachers',
    label: 'C3 Teachers',
    description: 'Inquiry-based humanities units with lesson-level assets.',
    samplePath: 'mappings/c3_teachers.json',
    contentSource: 'C3 Teachers',
    defaultLicense: 'CC BY-NC-SA 4.0',
    importKind: 'dataset',
    notes: 'Raw datasets are normalized into module/lesson/asset structures before import.',
  },
  {
    id: 'siyavula',
    label: 'Siyavula',
    description: 'STEM practice sets and open textbooks from Siyavula Foundation.',
    samplePath: 'mappings/siyavula.json',
    contentSource: 'Siyavula',
    defaultLicense: 'CC BY 4.0',
    importKind: 'dataset',
  },
  {
    id: 'nasa_noaa',
    label: 'NASA / NOAA',
    description: 'Multimedia assets curated from NASA and NOAA public-domain libraries.',
    samplePath: 'mappings/nasa_noaa.json',
    contentSource: 'Federal PD',
    defaultLicense: 'Public Domain',
    importKind: 'dataset',
  },
  {
    id: 'gutenberg',
    label: 'Project Gutenberg',
    description: 'Public domain literature aligned to humanities modules.',
    samplePath: 'mappings/gutenberg.json',
    contentSource: 'Project Gutenberg',
    defaultLicense: 'Public Domain',
    importKind: 'mapping',
  },
  {
    id: 'federal',
    label: 'Federal Public Domain',
    description: 'NASA, NOAA, NARA, LOC curated media bundles.',
    samplePath: 'mappings/federal_pd.json',
    contentSource: 'Federal PD',
    defaultLicense: 'Public Domain',
    importKind: 'mapping',
  },
];

export const IMPORT_PROVIDER_MAP = new Map(
  IMPORT_PROVIDERS.map((provider) => [provider.id, provider]),
);

export const isImportProviderId = (value: string): value is ImportProviderId =>
  IMPORT_PROVIDER_MAP.has(value as ImportProviderId);
