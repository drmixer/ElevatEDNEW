import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import composeAttribution from './utils/attribution.js';
import { assertLicenseAllowed } from './utils/license.js';
import { createServiceRoleClient } from './utils/supabase.js';

type ModuleRow = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  subject: string;
  grade_band: string;
  strand: string | null;
  topic: string | null;
  open_track: boolean;
  metadata: Record<string, unknown> | null;
};

type ModuleMetadata = {
  raw?: {
    grade?: string;
    subject?: string;
    strand?: string;
    topic?: string;
    subtopic?: string;
  };
};

type SubjectConfig = {
  lessonFocus: string;
  launch: string;
  guided: string;
  practice: string;
  exitTicket: string;
  extensions: string;
  duration: number;
  assets: AssetTemplate[];
};

type AssetTemplate = {
  title: string;
  url: string;
  description: string;
  tags: string[];
  sourceName: string;
};

type SeedAsset = {
  module_id: number;
  lesson_id: number;
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

type ContentSourceDefinition = {
  license: string;
  license_url?: string;
  attribution_text?: string;
  summary?: string;
};

type ContentSourceRecord = {
  id: number;
  name: string;
  license: string;
  license_url: string | null;
  attribution_text: string | null;
};

const CONTENT_SOURCE_DEFINITIONS: Record<string, ContentSourceDefinition> = {
  'OpenStax': {
    summary: 'Peer-reviewed open textbooks developed by Rice University.',
    license: 'CC BY',
    license_url: 'https://openstax.org/terms',
    attribution_text: 'OpenStax, Rice University',
  },
  'Project Gutenberg': {
    summary: 'Public-domain literature digitized by Project Gutenberg.',
    license: 'Public Domain',
    license_url: 'https://www.gutenberg.org/policy/license.html',
    attribution_text: 'Project Gutenberg',
  },
  'NASA Image and Video Library': {
    summary: 'NASA-curated media available for educational reuse.',
    license: 'Public Domain',
    license_url: 'https://www.nasa.gov/multimedia/guidelines/index.html',
    attribution_text: 'Courtesy NASA',
  },
  'Smithsonian Open Access': {
    summary: 'Smithsonian Open Access collection (CC0).',
    license: 'CC0',
    license_url: 'https://www.si.edu/openaccess',
    attribution_text: 'Smithsonian Open Access',
  },
  'Library of Congress': {
    summary: 'Library of Congress primary sources and maps.',
    license: 'Public Domain',
    license_url: 'https://www.loc.gov/legal/',
    attribution_text: 'Library of Congress',
  },
  'ElevatED Author Team': {
    summary: 'Teacher-authored lessons curated by ElevatED.',
    license: 'CC BY',
    attribution_text: 'ElevatED Curriculum Team',
  },
};

const SUBJECT_CONFIGS: Record<string, SubjectConfig> = {
  Science: {
    lessonFocus: 'Investigate real-world phenomena through inquiry and data analysis.',
    launch: 'Begin with a phenomenon image or short clip that students can observe and discuss in pairs.',
    guided:
      'Facilitate a hands-on or virtual lab where students collect evidence, record data in a shared table, and justify claims.',
    practice:
      'Learners analyze an OpenStax reading excerpt, then respond to scaffolded stop-and-think questions in their notebooks.',
    exitTicket:
      'Students write a two-sentence CER (claim, evidence, reasoning) summary explaining how the phenomenon works.',
    extensions:
      'Offer an optional NASA visualization for students who finish early and want to explore related satellite data.',
    duration: 45,
    assets: [
      {
        title: 'OpenStax Earth Science: Investigating Plate Tectonics',
        url: 'https://openstax.org/books/earth-science-2e/pages/7-introduction',
        description: 'Phenomenon-driven reading on how scientists interpret changes in Earth’s crust.',
        tags: ['science', 'earth-science', 'reading'],
        sourceName: 'OpenStax',
      },
      {
        title: 'NASA Earth Observatory: Plate Boundary Map',
        url: 'https://earthobservatory.nasa.gov/features/PlateTectonics',
        description: 'Interactive satellite imagery that highlights tectonic plate boundaries.',
        tags: ['science', 'visualization', 'nasa'],
        sourceName: 'NASA Image and Video Library',
      },
    ],
  },
  Mathematics: {
    lessonFocus: 'Connect multiple representations to deepen conceptual understanding.',
    launch: 'Pose a real-world scenario and ask students to predict the relationship using estimation strategies.',
    guided:
      'Lead a worked example on a whiteboard, pausing for turn-and-talks and quick checks for understanding.',
    practice:
      'Students tackle a tiered problem set, first with structured tables and then with open-ended extensions.',
    exitTicket:
      'Learners submit a short Flipgrid or written reflection explaining the strategy they used and why it worked.',
    extensions:
      'Invite students to explore a Desmos or GeoGebra activity that links the concept to interactive graphs.',
    duration: 40,
    assets: [
      {
        title: 'OpenStax Algebra: Graphs of Linear Functions',
        url: 'https://openstax.org/books/algebra-and-trigonometry/pages/3-4-graphs-of-linear-functions',
        description: 'Student-friendly review of linear function representations with worked examples.',
        tags: ['math', 'algebra', 'reading'],
        sourceName: 'OpenStax',
      },
      {
        title: 'Smithsonian Open Access: Golden Ratio in Design',
        url: 'https://www.si.edu/object/recorded-sound:sova-nmah-ac-0308',
        description: 'Primary source image illustrating proportional reasoning in real-world contexts.',
        tags: ['math', 'proportional-reasoning', 'art'],
        sourceName: 'Smithsonian Open Access',
      },
    ],
  },
  'English Language Arts': {
    lessonFocus: 'Analyze how authors develop themes through character choices and language.',
    launch:
      'Display a compelling quote from the text and ask students to predict the character’s motivation or conflict.',
    guided:
      'Conduct a close reading of a pivotal passage, modeling annotation strategies and figurative language analysis.',
    practice:
      'Students work in small groups to create evidence charts, then craft paragraph responses using the claim-evidence-commentary frame.',
    exitTicket:
      'Learners identify one new textual detail they noticed and explain how it reinforces the unit’s essential question.',
    extensions:
      'Pair the text with an audio narration or dramatic reading to support fluency and expose students to interpretive choices.',
    duration: 50,
    assets: [
      {
        title: 'Project Gutenberg: Narrative of the Life of Frederick Douglass',
        url: 'https://www.gutenberg.org/files/23/23-h/23-h.htm',
        description: 'Public-domain autobiographical text aligned to informational reading standards.',
        tags: ['ela', 'primary-source', 'biography'],
        sourceName: 'Project Gutenberg',
      },
      {
        title: 'Library of Congress: Frederick Douglass Portrait',
        url: 'https://www.loc.gov/item/2018663013/',
        description: 'Primary-source photograph to support visual literacy and context building.',
        tags: ['ela', 'primary-source', 'visual'],
        sourceName: 'Library of Congress',
      },
    ],
  },
  'Social Studies': {
    lessonFocus: 'Compare primary and secondary sources to build historical understanding.',
    launch:
      'Display two contrasting images from the time period and ask students what they notice, wonder, and infer.',
    guided:
      'Model sourcing and contextualization strategies using a primary source, annotating for purpose, audience, and perspective.',
    practice:
      'Students analyze a complementary secondary source, then complete a Venn diagram of corroborating and conflicting details.',
    exitTicket:
      'Learners craft a three-sentence historical summary that cites both sources with evidence.',
    extensions:
      'Offer an optional timeline-building activity where students place sources chronologically and explain their significance.',
    duration: 45,
    assets: [
      {
        title: 'Library of Congress Primary Source Set',
        url: 'https://www.loc.gov/classroom-materials/',
        description: 'Curated primary sources for classroom analysis and inquiry.',
        tags: ['social-studies', 'primary-source'],
        sourceName: 'Library of Congress',
      },
      {
        title: 'Smithsonian Teaching Collection: Inquiry Starter',
        url: 'https://learninglab.si.edu/collections/inquiry-starters/5f1J3lPb2PBqjZzz',
        description: 'Inquiry-based Smithsonian artifacts to spark discussion.',
        tags: ['social-studies', 'artifact'],
        sourceName: 'Smithsonian Open Access',
      },
    ],
  },
};

const DEFAULT_SUBJECT_CONFIG: SubjectConfig = {
  lessonFocus: 'Engage students with an authentic problem, then scaffold practice toward mastery.',
  launch: 'Open with a curiosity-sparking question or scenario tied to the module’s big idea.',
  guided:
    'Model expert thinking through a mini-lesson or think-aloud, pausing for student talk and formative checks.',
  practice:
    'Provide collaborative practice tasks that encourage students to apply the concept in multiple ways.',
  exitTicket: 'Collect a quick formative check (poll, reflection, or short response) to close the loop.',
  extensions:
    'Include enrichment or support options, such as targeted videos or manipulatives, to meet diverse needs.',
  duration: 40,
  assets: [
    {
      title: 'ElevatED Facilitator Guide Template',
      url: 'https://docs.google.com/document/d/1np-elevated-template',
      description: 'Reusable facilitator guide scaffold licensed under CC BY.',
      tags: ['elevated', 'teacher-guide'],
      sourceName: 'ElevatED Author Team',
    },
  ],
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

const pickSubjectConfig = (subject: string): SubjectConfig => SUBJECT_CONFIGS[subject] ?? DEFAULT_SUBJECT_CONFIG;

const collectModules = (modules: ModuleRow[]): ModuleRow[] => {
  const selected = new Map<string, ModuleRow>();
  for (const module of modules) {
    const key = `${module.subject}::${module.grade_band}`;
    if (!selected.has(key)) {
      selected.set(key, module);
    }
  }
  return Array.from(selected.values());
};

const normalizeMetadata = (metadata: ModuleRow['metadata']): ModuleMetadata => {
  if (metadata && typeof metadata === 'object') {
    return metadata as ModuleMetadata;
  }
  return {};
};

const ensureSubjectId = async (
  supabase: SupabaseClient,
  cache: Map<string, number>,
  subjectName: string,
): Promise<number> => {
  if (cache.has(subjectName)) {
    return cache.get(subjectName)!;
  }

  const { data: existing, error: loadError } = await supabase
    .from('subjects')
    .select('id')
    .eq('name', subjectName)
    .limit(1)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load subject "${subjectName}": ${loadError.message}`);
  }

  if (existing?.id) {
    cache.set(subjectName, existing.id as number);
    return existing.id as number;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('subjects')
    .insert({ name: subjectName })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Failed to insert subject "${subjectName}": ${insertError.message}`);
  }

  const subjectId = inserted.id as number;
  cache.set(subjectName, subjectId);
  return subjectId;
};

const ensureTopicId = async (
  supabase: SupabaseClient,
  subjectId: number,
  module: ModuleRow,
  metadata: ModuleMetadata,
): Promise<number> => {
  const candidateTitles = unique(
    [
      metadata.raw?.subtopic,
      metadata.raw?.topic,
      module.topic,
      module.title,
      metadata.raw?.strand,
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value && value.length > 0),
  );

  if (candidateTitles.length === 0) {
    candidateTitles.push(module.title);
  }

  const candidateSlugs = unique(candidateTitles.map((title) => slugify(title)));

  const { data: existingTopics, error: fetchError } = await supabase
    .from('topics')
    .select('id, slug')
    .eq('subject_id', subjectId)
    .in('slug', candidateSlugs)
    .limit(candidateSlugs.length);

  if (fetchError) {
    throw new Error(`Failed to search topics for module ${module.slug}: ${fetchError.message}`);
  }

  const found = existingTopics?.find((topic) => topic.slug && candidateSlugs.includes(topic.slug as string));
  if (found?.id) {
    return found.id as number;
  }

  const targetName = candidateTitles[0];
  const targetSlug = candidateSlugs[0] ?? slugify(targetName);

  const { data: upserted, error: upsertError } = await supabase
    .from('topics')
    .upsert(
      {
        subject_id: subjectId,
        name: targetName,
        slug: targetSlug,
        description: module.summary ?? module.description ?? null,
      },
      { onConflict: 'subject_id,name' },
    )
    .select('id')
    .single();

  if (upsertError) {
    throw new Error(`Failed to ensure topic for module ${module.slug}: ${upsertError.message}`);
  }

  return upserted.id as number;
};

const ensureContentSources = async (
  supabase: SupabaseClient,
  definitions: Record<string, ContentSourceDefinition>,
): Promise<Map<string, ContentSourceRecord>> => {
  const cache = new Map<string, ContentSourceRecord>();
  const names = Object.keys(definitions);

  if (names.length === 0) {
    return cache;
  }

  const { data: existing, error: loadError } = await supabase
    .from('content_sources')
    .select('id, name, license, license_url, attribution_text')
    .in('name', names);

  if (loadError) {
    throw new Error(`Failed to load content sources: ${loadError.message}`);
  }

  for (const record of existing ?? []) {
    cache.set(record.name as string, {
      id: record.id as number,
      name: record.name as string,
      license: record.license as string,
      license_url: (record.license_url as string | null) ?? null,
      attribution_text: (record.attribution_text as string | null) ?? null,
    });
  }

  for (const name of names) {
    if (cache.has(name)) {
      continue;
    }
    const definition = definitions[name];
    const normalizedLicense = assertLicenseAllowed(definition.license);

    const { data: inserted, error: insertError } = await supabase
      .from('content_sources')
      .insert({
        name,
        summary: definition.summary ?? null,
        license: normalizedLicense,
        license_url: definition.license_url ?? null,
        attribution_text: definition.attribution_text ?? null,
        metadata: {
          seeded_by: 'seed_lessons',
          seeded_at: new Date().toISOString(),
        },
      })
      .select('id, name, license, license_url, attribution_text')
      .single();

    if (insertError) {
      throw new Error(`Failed to insert content source "${name}": ${insertError.message}`);
    }

    cache.set(name, {
      id: inserted.id as number,
      name: inserted.name as string,
      license: inserted.license as string,
      license_url: (inserted.license_url as string | null) ?? null,
      attribution_text: (inserted.attribution_text as string | null) ?? null,
    });
  }

  return cache;
};

const buildLessonMarkdown = (module: ModuleRow, config: SubjectConfig): string => {
  const header = `# ${module.title}: Launch Lesson\n`;
  const overview = [
    `**Grade band:** ${module.grade_band}`,
    `**Subject:** ${module.subject}`,
    module.strand ? `**Strand:** ${module.strand}` : null,
    module.topic ? `**Focus topic:** ${module.topic}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const sections = [
    '## Learning Goals',
    `- ${config.lessonFocus}`,
    '## Launch (5-7 minutes)',
    config.launch,
    '## Guided Exploration (15 minutes)',
    config.guided,
    '## Collaborative Practice (15-20 minutes)',
    config.practice,
    '## Exit Ticket (5 minutes)',
    config.exitTicket,
    '## Extensions & Differentiation',
    config.extensions,
  ];

  return [header, overview, '', ...sections].join('\n\n').trim();
};

const prepareAssets = (
  module: ModuleRow,
  config: SubjectConfig,
  sources: Map<string, ContentSourceRecord>,
): { assets: SeedAsset[]; attribution: string } => {
  const assets = [];
  const attributions = new Set<string>();

  for (const template of config.assets) {
    const source = sources.get(template.sourceName);
    if (!source) {
      throw new Error(`Content source "${template.sourceName}" not available for module ${module.slug}`);
    }

    const license = assertLicenseAllowed(source.license);
    const attribution = composeAttribution({
      sourceName: source.name,
      license,
      license_url: source.license_url ?? undefined,
      attribution_text: source.attribution_text ?? undefined,
    });
    attributions.add(attribution);

    const asset: SeedAsset = {
      module_id: module.id,
      lesson_id: 0, // placeholder, replaced later
      source_id: source.id,
      url: template.url,
      title: template.title,
      description: template.description,
      kind: 'link',
      license,
      license_url: source.license_url ?? null,
      attribution_text: attribution,
      metadata: {
        subject: module.subject,
        grade_band: module.grade_band,
        seeded_by: 'seed_lessons',
        seeded_at: new Date().toISOString(),
        origin: template.sourceName,
      },
      tags: template.tags,
    };

    assets.push(asset);
  }

  return {
    assets,
    attribution: Array.from(attributions).join('\n'),
  };
};

const upsertLesson = async (
  supabase: SupabaseClient,
  module: ModuleRow,
  topicId: number,
  markdown: string,
  attributionBlock: string,
  duration: number,
): Promise<number> => {
  const lessonSlug = `${slugify(module.slug)}-launch`;

  const { data, error } = await supabase
    .from('lessons')
    .upsert(
      {
        topic_id: topicId,
        module_id: module.id,
        title: `${module.title} Launch Lesson`,
        slug: lessonSlug,
        content: markdown,
        visibility: 'public',
        open_track: module.open_track,
        is_published: true,
        estimated_duration_minutes: duration,
        attribution_block: attributionBlock,
        media_url: null,
        metadata: {
          module_slug: module.slug,
          seeded_by: 'seed_lessons',
          seeded_at: new Date().toISOString(),
        },
      },
      { onConflict: 'topic_id,title' },
    )
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to upsert lesson for module ${module.slug}: ${error.message}`);
  }

  return data.id as number;
};

const upsertAssets = async (supabase: SupabaseClient, assets: SeedAsset[]): Promise<void> => {
  if (assets.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('assets')
    .upsert(
      assets.map((asset) => ({
        ...asset,
        metadata: {
          ...asset.metadata,
          lesson_seeded_at: new Date().toISOString(),
        },
      })),
      { onConflict: 'module_id,url' },
    );

  if (error) {
    throw new Error(`Failed to upsert assets: ${error.message}`);
  }
};

const seedLessons = async (): Promise<void> => {
  const supabase = createServiceRoleClient();
  const subjectCache = new Map<string, number>();

  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select(
      'id, slug, title, summary, description, subject, grade_band, strand, topic, open_track, metadata',
    )
    .eq('visibility', 'public')
    .order('subject', { ascending: true })
    .order('grade_band', { ascending: true });

  if (modulesError) {
    throw new Error(`Failed to load modules: ${modulesError.message}`);
  }

  const selectedModules = collectModules((modules ?? []) as ModuleRow[]);
  if (selectedModules.length === 0) {
    console.log('No public modules found; nothing to seed.');
    return;
  }

  const contentSources = await ensureContentSources(supabase, CONTENT_SOURCE_DEFINITIONS);
  let seededCount = 0;

  for (const module of selectedModules) {
    const metadata = normalizeMetadata(module.metadata);
    const subjectId = await ensureSubjectId(supabase, subjectCache, module.subject);
    const topicId = await ensureTopicId(supabase, subjectId, module, metadata);
    const config = pickSubjectConfig(module.subject);
    const markdown = buildLessonMarkdown(module, config);
    const { assets, attribution } = prepareAssets(module, config, contentSources);
    const lessonId = await upsertLesson(supabase, module, topicId, markdown, attribution, config.duration);

    await upsertAssets(
      supabase,
      assets.map((asset) => ({
        ...asset,
        lesson_id: lessonId,
      })),
    );

    seededCount += 1;
  }

  console.log(`Seeded ${seededCount} representative lessons across ${selectedModules.length} subject-grade combinations.`);
};

const invokedFromCli =
  process.argv[1]?.includes('seed_lessons.ts') || process.argv[1]?.includes('seed_lessons.js');

if (invokedFromCli) {
  seedLessons().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
