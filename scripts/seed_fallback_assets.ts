import process from 'node:process';

import composeAttribution from './utils/attribution.js';
import { assertLicenseAllowed } from './utils/license.js';
import {
  createServiceRoleClient,
  fetchLessonsByModuleIds,
  fetchContentSourcesByName,
} from './utils/supabase.js';

type ModuleRow = {
  id: number;
  slug: string;
  title: string;
  subject: string;
  grade_band: string;
};

type AssetTemplate = {
  sourceName: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
};

type SeedAsset = {
  module_id: number;
  lesson_id: number | null;
  source_id: number;
  url: string;
  title: string;
  description: string;
  kind: string;
  license: string;
  license_url: string | null;
  attribution_text: string;
  metadata: Record<string, unknown>;
  tags: string[];
};

const resolveLicense = (rawLicense: string): string => {
  const attempts = [
    rawLicense,
    rawLicense.replace(/\s+us$/iu, '').trim(),
    rawLicense.replace(/\s*\([^)]*\)\s*$/iu, '').trim(),
  ].filter((value) => value.length > 0);

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return assertLicenseAllowed(attempt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const SUBJECT_TEMPLATES: Record<string, AssetTemplate[]> = {
  Mathematics: [
    {
      sourceName: 'Khan Academy',
      url: 'https://www.khanacademy.org/math',
      title: 'Khan Academy Math Library',
      description: 'Video lessons and practice across the full math progression.',
      tags: ['math', 'practice'],
    },
    {
      sourceName: 'EngageNY/Eureka',
      url: 'http://www.engageny.org/math',
      title: 'EngageNY/Eureka Math Curriculum',
      description: 'Module-aligned lesson materials (link-only).',
      tags: ['math', 'curriculum'],
    },
    {
      sourceName: 'OpenStax',
      url: 'https://openstax.org/subjects/math',
      title: 'OpenStax Math Texts',
      description: 'CC BY reference chapters for middle and high school math topics.',
      tags: ['math', 'reference'],
    },
    {
      sourceName: 'PhET',
      url: 'https://phet.colorado.edu/en/simulations/filter?subjects=math&type=html',
      title: 'PhET Math Simulations',
      description: 'Interactive simulations for algebra, geometry, and data.',
      tags: ['math', 'simulation'],
    },
  ],
  'English Language Arts': [
    {
      sourceName: 'Project Gutenberg',
      url: 'https://www.gutenberg.org/ebooks/',
      title: 'Project Gutenberg Library',
      description: 'Public-domain texts for literature and informational reading.',
      tags: ['ela', 'reading', 'primary-source'],
    },
    {
      sourceName: 'Library of Congress',
      url: 'https://www.loc.gov/classroom-materials/',
      title: 'Library of Congress Classroom Materials',
      description: 'Primary source sets and teacher guides for ELA and social studies.',
      tags: ['ela', 'primary-source'],
    },
    {
      sourceName: 'Smithsonian Open Access',
      url: 'https://learninglab.si.edu/openaccess',
      title: 'Smithsonian Open Access Collection',
      description: 'CC0 images/artifacts to spark visual literacy and context building.',
      tags: ['ela', 'visual', 'primary-source'],
    },
    {
      sourceName: 'Khan Academy',
      url: 'https://www.khanacademy.org/ela',
      title: 'Khan Academy ELA Library',
      description: 'Grammar, writing, and reading skills practice (link-only).',
      tags: ['ela', 'practice'],
    },
  ],
  Science: [
    {
      sourceName: 'NASA',
      url: 'https://www.nasa.gov/learning-resources/for-educators/',
      title: 'NASA Learning Resources',
      description: 'STEM lessons, imagery, and videos for classroom use.',
      tags: ['science', 'nasa'],
    },
    {
      sourceName: 'PhET',
      url: 'https://phet.colorado.edu/en/simulations/category/new',
      title: 'PhET Interactive Simulations',
      description: 'CC BY simulations for hands-on science and math exploration.',
      tags: ['science', 'simulation'],
    },
    {
      sourceName: 'NOAA',
      url: 'https://oceanexplorer.noaa.gov/edu/welcome.html',
      title: 'NOAA Ocean Explorer Education',
      description: 'Public-domain ocean, climate, and weather classroom resources.',
      tags: ['science', 'earth-science'],
    },
    {
      sourceName: 'OpenStax',
      url: 'https://openstax.org/subjects/science',
      title: 'OpenStax Science Texts',
      description: 'CC BY science reference chapters for reinforcement.',
      tags: ['science', 'reference'],
    },
  ],
  'Social Studies': [
    {
      sourceName: 'NARA',
      url: 'https://www.archives.gov/education',
      title: 'National Archives Education Resources',
      description: 'Primary sources and lesson plans from the U.S. National Archives.',
      tags: ['social-studies', 'primary-source'],
    },
    {
      sourceName: 'Library of Congress',
      url: 'https://www.loc.gov/classroom-materials/',
      title: 'Library of Congress Classroom Materials',
      description: 'Inquiry-ready primary source sets for civics, history, and culture.',
      tags: ['social-studies', 'primary-source'],
    },
    {
      sourceName: 'Smithsonian Open Access',
      url: 'https://learninglab.si.edu/openaccess',
      title: 'Smithsonian Open Access Collections',
      description: 'Artifacts and images for cultural, civics, and art connections (CC0).',
      tags: ['social-studies', 'artifact'],
    },
    {
      sourceName: 'CIA World Factbook',
      url: 'https://www.cia.gov/the-world-factbook/',
      title: 'CIA World Factbook',
      description: 'Country reference data for geography and comparative studies.',
      tags: ['social-studies', 'geography', 'reference'],
    },
  ],
};

const targetSubjects = Object.keys(SUBJECT_TEMPLATES);
const targetGrades = ['3', '4', '5', '6', '7', '8'];

const MIN_ASSETS_PER_MODULE = 4;

const fetchAssetsPaged = async (supabaseClient: ReturnType<typeof createServiceRoleClient>, moduleIds: number[]) => {
  const pageSize = 1000;
  let page = 0;
  const rows: { module_id: number | null; url: string | null }[] = [];

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabaseClient
      .from('assets')
      .select('module_id, url')
      .in('module_id', moduleIds)
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load assets (page ${page}): ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...(data as typeof rows));

    if (data.length < pageSize) {
      break;
    }

    page += 1;
  }

  return rows;
};

const seedFallbackAssets = async (): Promise<void> => {
  const supabase = createServiceRoleClient();

  const { data: modules, error: moduleError } = await supabase
    .from('modules')
    .select('id, slug, title, subject, grade_band')
    .in('subject', targetSubjects)
    .in('grade_band', targetGrades);

  if (moduleError) {
    throw new Error(`Failed to load modules: ${moduleError.message}`);
  }

  const moduleRows = (modules ?? []) as ModuleRow[];
  if (moduleRows.length === 0) {
    console.log('No target modules found.');
    return;
  }

  const moduleIds = moduleRows.map((m) => m.id);
  const assetRows = await fetchAssetsPaged(supabase, moduleIds);

  const urlsByModule = new Map<number, Set<string>>();
  const countsByModule = new Map<number, number>();
  for (const row of assetRows ?? []) {
    if (row.module_id != null) {
      const moduleId = row.module_id as number;
      const url = (row.url as string | null)?.trim();
      if (url) {
        const set = urlsByModule.get(moduleId) ?? new Set<string>();
        set.add(url);
        urlsByModule.set(moduleId, set);
      }
    }
  }
  for (const [moduleId, set] of urlsByModule.entries()) {
    countsByModule.set(moduleId, set.size);
  }

  const modulesNeedingAssets = moduleRows.filter((m) => (countsByModule.get(m.id) ?? 0) < MIN_ASSETS_PER_MODULE);
  if (modulesNeedingAssets.length === 0) {
    console.log('All target modules already have assets; nothing to seed.');
    return;
  }

  const lessonsByModule = await fetchLessonsByModuleIds(
    supabase,
    modulesNeedingAssets.map((m) => m.id),
  );

  const sourceNames = Array.from(
    new Set(
      Object.values(SUBJECT_TEMPLATES)
        .flat()
        .map((template) => template.sourceName),
    ),
  );
  const sources = await fetchContentSourcesByName(supabase, sourceNames);

  const assets: SeedAsset[] = [];

  for (const module of modulesNeedingAssets) {
    const templates = SUBJECT_TEMPLATES[module.subject] ?? [];
    const lessons = lessonsByModule.get(module.id) ?? [];
    const lessonId = lessons[0]?.id ?? null;

    const existingUrls = new Set(urlsByModule.get(module.id) ?? []);

    let added = 0;

    for (const template of templates) {
      const currentTotal = (countsByModule.get(module.id) ?? 0) + added;
      if (currentTotal >= MIN_ASSETS_PER_MODULE) {
        break;
      }
      if (existingUrls.has(template.url)) {
        continue;
      }

      const source = sources.get(template.sourceName);
      if (!source) {
        throw new Error(`Content source "${template.sourceName}" not found.`);
      }
      const license = resolveLicense(source.license);
      const attribution = composeAttribution({
        sourceName: source.name,
        license,
        license_url: source.license_url ?? undefined,
        attribution_text: source.attribution_text ?? undefined,
      });

      assets.push({
        module_id: module.id,
        lesson_id: lessonId,
        source_id: source.id,
        url: template.url,
        title: template.title,
        description: template.description,
        kind: 'link',
        license,
        license_url: source.license_url ?? null,
        attribution_text: attribution,
        metadata: {
          module_slug: module.slug,
          seeded_by: 'seed_fallback_assets',
          seeded_at: new Date().toISOString(),
          source_provider: source.name,
          storage_mode: 'link',
        },
        tags: template.tags,
      });

      existingUrls.add(template.url);
      added += 1;
    }
  }

  if (assets.length === 0) {
    console.log('No assets prepared for insertion.');
    return;
  }

  const { error: insertError } = await supabase.from('assets').upsert(assets, { onConflict: 'module_id,url' });
  if (insertError) {
    throw new Error(`Failed to upsert fallback assets: ${insertError.message}`);
  }

  console.log(`Inserted ${assets.length} fallback assets across ${modulesNeedingAssets.length} modules.`);
};

const invokedFromCli =
  process.argv[1]?.includes('seed_fallback_assets.ts') ||
  process.argv[1]?.includes('seed_fallback_assets.js');

if (invokedFromCli) {
  seedFallbackAssets().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
