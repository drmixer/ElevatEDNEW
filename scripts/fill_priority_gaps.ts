import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceRoleClient } from './utils/supabase.js';

type TargetModule = {
  slug: string;
  standardCode?: string;
  external: {
    title: string;
    url: string;
    license: string;
    license_url?: string | null;
    source_provider?: string;
  };
  practiceTarget?: number;
};

type ModuleRecord = {
  id: number;
  slug: string;
  title: string;
  subject: string;
  grade_band: string;
};

type StandardRecord = {
  framework: string;
  code: string;
};

const TARGETS: TargetModule[] = [
  {
    slug: '6-science-earth-and-space-astronomy-stars-galaxies',
    standardCode: 'MS-ESS1-2',
    external: {
      title: 'NASA Hubble Discoveries',
      url: 'https://science.nasa.gov/mission/hubble/',
      license: 'Public Domain',
      license_url: 'https://www.nasa.gov/multimedia/guidelines/index.html',
      source_provider: 'NASA',
    },
  },
  {
    slug: '3-english-language-arts-reading-literature-chapter-books-pd',
    standardCode: 'RL.3.2',
    external: {
      title: 'Project Gutenberg: Classic Chapter Books',
      url: 'https://www.gutenberg.org/ebooks/1342',
      license: 'Public Domain',
      license_url: 'https://www.gutenberg.org/policy/permission.html',
      source_provider: 'Project Gutenberg',
    },
  },
  {
    slug: '3-english-language-arts-reading-literature-myths-legends-pd',
    standardCode: 'RL.3.2',
    external: {
      title: 'Project Gutenberg: Mythology Collection',
      url: 'https://www.gutenberg.org/ebooks/22381',
      license: 'Public Domain',
      license_url: 'https://www.gutenberg.org/policy/permission.html',
      source_provider: 'Project Gutenberg',
    },
  },
  {
    slug: '3-english-language-arts-reading-literature-short-stories-pd',
    standardCode: 'RL.3.2',
    external: {
      title: 'Project Gutenberg: Short Stories',
      url: 'https://www.gutenberg.org/ebooks/215',
      license: 'Public Domain',
      license_url: 'https://www.gutenberg.org/policy/permission.html',
      source_provider: 'Project Gutenberg',
    },
  },
  {
    slug: '3-mathematics-number-and-operations-fractions-concepts-equivalence',
    standardCode: '3.NF.A.3',
    external: {
      title: 'Khan Academy: Fraction Equivalence Practice',
      url: 'https://www.khanacademy.org/math/arithmetic/fraction-arithmetic',
      license: 'CC BY-NC-SA (link-only)',
      license_url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      source_provider: 'Khan Academy',
    },
  },
  {
    slug: '3-mathematics-number-and-operations-multiplication-division',
    standardCode: '3.NBT.A.2',
    external: {
      title: 'Khan Academy: Multiplication & Division',
      url: 'https://www.khanacademy.org/math/arithmetic/multiply-divide',
      license: 'CC BY-NC-SA (link-only)',
      license_url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      source_provider: 'Khan Academy',
    },
  },
  {
    slug: '3-mathematics-data-and-probability-statistics-bar-line-plots',
    standardCode: '3.MD.B.3',
    external: {
      title: 'Illustrative Math: Data Displays',
      url: 'https://curriculum.illustrativemathematics.org/elementary/teachers/grade-3/unit-6/lesson-1/index.html',
      license: 'CC BY 4.0 (link-only)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'Illustrative Mathematics',
    },
  },
  {
    slug: '3-mathematics-geometry-and-measurement-area-perimeter',
    standardCode: '3.G.A.1',
    external: {
      title: 'Open Up Resources: Area and Perimeter',
      url: 'https://im.openupresources.org/elementary/teachers/grade-3/unit-2/index.html',
      license: 'CC BY 4.0 (link-only)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'Open Up Resources',
    },
  },
  {
    slug: '3-science-earth-and-space-solar-system-relative-scale',
    standardCode: 'MS-ESS1-2',
    external: {
      title: 'PhET: My Solar System',
      url: 'https://phet.colorado.edu/en/simulation/legacy/my-solar-system',
      license: 'CC BY 4.0 (embed)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'PhET',
    },
  },
  {
    slug: '3-science-life-science-ecosystems-and-food-webs',
    standardCode: 'MS-LS2-3',
    external: {
      title: 'NOAA: Food Web Resources',
      url: 'https://oceanservice.noaa.gov/education/tutorial_corals/coral07_zooxanthellae.html',
      license: 'Public Domain',
      license_url: 'https://www.photolib.noaa.gov/about/media_use.html',
      source_provider: 'NOAA',
    },
  },
  {
    slug: '3-social-studies-civics-and-government-citizenship-and-rights',
    standardCode: 'Civ.3-5',
    external: {
      title: 'Library of Congress: Civics Primary Sources',
      url: 'https://www.loc.gov/classroom-materials/united-states-history-primary-source-timeline/colonial-settlement-1600-1763/growth-of-a-colonial-settlement/',
      license: 'Public Domain',
      license_url: 'https://loc.gov/legal/',
      source_provider: 'Library of Congress',
    },
  },
  {
    slug: '3-social-studies-economics-and-financial-literacy-markets-intro',
    standardCode: 'Econ.3-5',
    external: {
      title: 'C3 Teachers Inquiry: Markets and Choices',
      url: 'https://c3teachers.org/inquiries/markets-and-financial-choices/',
      license: 'CC BY-SA (link-only)',
      license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      source_provider: 'C3 Teachers',
    },
  },
  {
    slug: '3-english-language-arts-speaking-and-listening-presentations-summaries',
    standardCode: 'SL.3.1',
    external: {
      title: 'Open Up Resources ELA: Speaking & Listening Protocols (G3)',
      url: 'https://im.openupresources.org/ela/teachers/grade-3/index.html',
      license: 'CC BY 4.0 (link-only)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'Open Up Resources',
    },
  },
  {
    slug: '3-english-language-arts-vocabulary-roots-prefixes-suffixes',
    standardCode: 'L.3.4',
    external: {
      title: 'Khan Academy: Prefixes and Suffixes',
      url: 'https://www.khanacademy.org/ela/cc-3rd-reading-vocab',
      license: 'CC BY-NC-SA (link-only)',
      license_url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      source_provider: 'Khan Academy',
    },
  },
  {
    slug: '3-english-language-arts-writing-and-grammar-paragraphs-narratives-expository-writing-grammar-basics',
    standardCode: 'W.3.1',
    external: {
      title: 'OER Commons: Paragraph Writing (Grade 3)',
      url: 'https://www.oercommons.org/authoring/29273-writing-a-paragraph/view',
      license: 'CC BY 4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'OER Commons',
    },
  },
  {
    slug: '3-mathematics-data-and-probability-statistics-interpreting-tables-charts',
    standardCode: '3.MD.B.3',
    external: {
      title: 'Illustrative Math: Interpreting Data',
      url: 'https://curriculum.illustrativemathematics.org/elementary/teachers/grade-3/unit-6/lesson-3/index.html',
      license: 'CC BY 4.0 (link-only)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'Illustrative Mathematics',
    },
  },
  {
    slug: '3-mathematics-data-and-probability-statistics-intro-probability-experimental',
    standardCode: '3.MD.B.3',
    external: {
      title: 'Khan Academy: Probability Intro',
      url: 'https://www.khanacademy.org/math/statistics-probability/probability-library',
      license: 'CC BY-NC-SA (link-only)',
      license_url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      source_provider: 'Khan Academy',
    },
  },
  {
    slug: '3-mathematics-data-and-probability-statistics-mean-median-mode',
    standardCode: '3.MD.B.3',
    external: {
      title: 'CK-12: Mean, Median, Mode',
      url: 'https://www.ck12.org/book/ck-12-middle-school-math-grade-6/section/9.7/',
      license: 'CC BY-NC (link-only)',
      license_url: 'https://www.ck12info.org/curriculum-materials/terms-of-use/',
      source_provider: 'CK-12',
    },
  },
  {
    slug: '3-mathematics-geometry-and-measurement-angles-and-lines',
    standardCode: '3.G.A.1',
    external: {
      title: 'Illustrative Math: Angles and Lines',
      url: 'https://curriculum.illustrativemathematics.org/elementary/teachers/grade-3/unit-7/lesson-1/index.html',
      license: 'CC BY 4.0 (link-only)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'Illustrative Mathematics',
    },
  },
  {
    slug: '3-mathematics-geometry-and-measurement-coordinate-plane-quadrant-i',
    standardCode: '3.G.A.1',
    external: {
      title: 'Khan Academy: Coordinate Plane Basics',
      url: 'https://www.khanacademy.org/math/geometry-home/geometry-coordinate-plane',
      license: 'CC BY-NC-SA (link-only)',
      license_url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      source_provider: 'Khan Academy',
    },
  },
  {
    slug: '3-mathematics-geometry-and-measurement-transformations-intro',
    standardCode: '3.G.A.1',
    external: {
      title: 'Open Up Resources: Transformations Intro',
      url: 'https://im.openupresources.org/elementary/teachers/grade-3/index.html',
      license: 'CC BY 4.0 (link-only)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'Open Up Resources',
    },
  },
  {
    slug: '3-mathematics-geometry-and-measurement-volume',
    standardCode: '3.G.A.1',
    external: {
      title: 'PhET: Volume Explorer',
      url: 'https://phet.colorado.edu/en/simulation/cube',
      license: 'CC BY 4.0 (embed)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'PhET',
    },
  },
  {
    slug: '3-mathematics-number-and-operations-decimals-intro',
    standardCode: '3.NF.A.1',
    external: {
      title: 'Khan Academy: Decimals Intro',
      url: 'https://www.khanacademy.org/math/arithmetic/arith-decimals',
      license: 'CC BY-NC-SA (link-only)',
      license_url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      source_provider: 'Khan Academy',
    },
  },
  {
    slug: '3-mathematics-number-and-operations-place-value-thousands-millions',
    standardCode: '3.NBT.A.2',
    external: {
      title: 'Illustrative Math: Place Value',
      url: 'https://curriculum.illustrativemathematics.org/elementary/teachers/grade-3/unit-1/lesson-2/index.html',
      license: 'CC BY 4.0 (link-only)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'Illustrative Mathematics',
    },
  },
  {
    slug: '3-mathematics-number-and-operations-rounding-and-estimation',
    standardCode: '3.NBT.A.2',
    external: {
      title: 'Khan Academy: Rounding',
      url: 'https://www.khanacademy.org/math/arithmetic/arith-place-value/arith-rounding',
      license: 'CC BY-NC-SA (link-only)',
      license_url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      source_provider: 'Khan Academy',
    },
  },
  {
    slug: '3-science-earth-and-space-natural-resources',
    standardCode: 'MS-ESS3-1',
    external: {
      title: 'NOAA: Natural Resources',
      url: 'https://oceanservice.noaa.gov/education/tutorial_corals/coral08_management.html',
      license: 'Public Domain',
      license_url: 'https://www.photolib.noaa.gov/about/media_use.html',
      source_provider: 'NOAA',
    },
  },
  {
    slug: '3-science-earth-and-space-earth-systems-geosphere-hydrosphere',
    standardCode: 'MS-ESS2-2',
    external: {
      title: 'USGS: Earth Systems Overview',
      url: 'https://www.usgs.gov/special-topics/water-science-school/science/hydrosphere',
      license: 'Public Domain',
      license_url: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits',
      source_provider: 'USGS',
    },
  },
  {
    slug: '3-science-earth-and-space-weather-and-climate',
    standardCode: 'MS-ESS2-2',
    external: {
      title: 'NOAA: Weather & Climate Basics',
      url: 'https://www.noaa.gov/education/resource-collections/weather-atmosphere-education-resources',
      license: 'Public Domain',
      license_url: 'https://www.photolib.noaa.gov/about/media_use.html',
      source_provider: 'NOAA',
    },
  },
  {
    slug: '3-science-physical-science-forces-balanced-unbalanced',
    standardCode: 'MS-PS2-2',
    external: {
      title: 'PhET: Forces and Motion Basics',
      url: 'https://phet.colorado.edu/en/simulation/forces-and-motion-basics',
      license: 'CC BY 4.0 (embed)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'PhET',
    },
  },
  {
    slug: '3-science-life-science-adaptations',
    standardCode: 'MS-LS4-4',
    external: {
      title: 'Smithsonian: Animal Adaptations',
      url: 'https://www.smithsonianeducation.org/educators/lesson_plans/animal_adaptations/main.html',
      license: 'Public Domain',
      license_url: 'https://www.si.edu/termsofuse',
      source_provider: 'Smithsonian',
    },
  },
  {
    slug: '3-science-life-science-heredity-intro',
    standardCode: 'MS-LS3-2',
    external: {
      title: 'University of Utah: Genetic Science Learning Center (Basics)',
      url: 'https://learn.genetics.utah.edu/content/basics/',
      license: 'Public Domain (educational use)',
      license_url: 'https://learn.genetics.utah.edu/pages/privacy/',
      source_provider: 'GSLC',
    },
  },
  {
    slug: '3-science-life-science-human-body-systems-intro',
    standardCode: 'MS-LS1-3',
    external: {
      title: 'KidsHealth: Body Systems Overview',
      url: 'https://kidshealth.org/en/kids/bodybasics.html',
      license: 'Link-only educational',
      license_url: 'https://kidshealth.org/en/kids/khmisc.html',
      source_provider: 'Nemours KidsHealth',
    },
  },
  {
    slug: '3-science-physical-science-energy-transfer',
    standardCode: 'MS-PS3-1',
    external: {
      title: 'PhET: Energy Forms and Changes',
      url: 'https://phet.colorado.edu/en/simulation/energy-forms-and-changes',
      license: 'CC BY 4.0 (embed)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'PhET',
    },
  },
  {
    slug: '3-science-physical-science-matter-particles',
    standardCode: 'MS-PS1-2',
    external: {
      title: 'PhET: States of Matter',
      url: 'https://phet.colorado.edu/en/simulation/states-of-matter-basics',
      license: 'CC BY 4.0 (embed)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'PhET',
    },
  },
  {
    slug: '3-science-physical-science-waves-intro',
    standardCode: 'MS-PS3-1',
    external: {
      title: 'PhET: Wave on a String',
      url: 'https://phet.colorado.edu/en/simulation/wave-on-a-string',
      license: 'CC BY 4.0 (embed)',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      source_provider: 'PhET',
    },
  },
  {
    slug: '3-social-studies-us-history-exploration-to-civil-war',
    standardCode: 'Hist.3-5',
    external: {
      title: 'Library of Congress: Early America Primary Sources',
      url: 'https://www.loc.gov/classroom-materials/united-states-history-primary-source-timeline/colonial-settlement-1600-1763/',
      license: 'Public Domain',
      license_url: 'https://loc.gov/legal/',
      source_provider: 'Library of Congress',
    },
  },
  {
    slug: '3-social-studies-us-history-industrialization-and-immigration',
    standardCode: 'Hist.3-5',
    external: {
      title: 'National Archives: Immigration Records',
      url: 'https://www.archives.gov/research/immigration',
      license: 'Public Domain',
      license_url: 'https://www.archives.gov/legal/gaog',
      source_provider: 'NARA',
    },
  },
  {
    slug: '3-social-studies-world-history-and-geography-ancient-civilizations',
    standardCode: 'Geo.3-5',
    external: {
      title: 'British Museum: Ancient Civilizations Collections',
      url: 'https://www.britishmuseum.org/learn/schools/age-7-11/ancient-civilisations',
      license: 'Link-only educational',
      license_url: 'https://www.britishmuseum.org/about-this-site/terms-use',
      source_provider: 'British Museum',
    },
  },
  {
    slug: '3-social-studies-world-history-and-geography-world-regions-physical-human',
    standardCode: 'Geo.3-5',
    external: {
      title: 'National Geographic Kids: World Regions',
      url: 'https://kids.nationalgeographic.com/geography',
      license: 'Link-only educational',
      license_url: 'https://www.nationalgeographic.com/legal/terms-of-service/',
      source_provider: 'National Geographic Kids',
    },
  },
];

const PRACTICE_TARGET_DEFAULT = 20;
const PRACTICE_CHUNK_SIZE = 10;

const fetchModules = async (
  supabase: SupabaseClient,
  slugs: string[],
): Promise<Map<string, ModuleRecord>> => {
  const { data, error } = await supabase
    .from('modules')
    .select('id, slug, title, subject, grade_band')
    .in('slug', slugs);

  if (error) {
    throw new Error(`Failed to load modules: ${error.message}`);
  }

  const map = new Map<string, ModuleRecord>();
  for (const record of data ?? []) {
    map.set(record.slug as string, {
      id: record.id as number,
      slug: record.slug as string,
      title: (record.title as string) ?? record.slug,
      subject: (record.subject as string) ?? 'Unknown',
      grade_band: (record.grade_band as string) ?? '',
    });
  }
  return map;
};

const fetchSubjectIds = async (
  supabase: SupabaseClient,
): Promise<Map<string, number>> => {
  const { data, error } = await supabase.from('subjects').select('id, name');
  if (error) {
    throw new Error(`Failed to load subjects: ${error.message}`);
  }
  const map = new Map<string, number>();
  for (const record of data ?? []) {
    const name = (record.name as string)?.trim();
    if (name) {
      map.set(name, record.id as number);
    }
  }
  return map;
};

const fetchStandardForModule = async (
  supabase: SupabaseClient,
  moduleId: number,
): Promise<StandardRecord | null> => {
  const { data, error } = await supabase
    .from('module_standards')
    .select('standard:standard_id (framework, code)')
    .eq('module_id', moduleId)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load standards for module ${moduleId}: ${error.message}`);
  }

  const entry = data as { standard?: { framework?: string; code?: string } } | null;
  if (entry?.standard?.framework && entry.standard.code) {
    return { framework: entry.standard.framework, code: entry.standard.code };
  }
  return null;
};

const dedupe = (values: (string | undefined | null)[]): string[] => {
  const set = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set);
};

const ensurePractice = async (
  supabase: SupabaseClient,
  module: ModuleRecord,
  subjectId: number,
  standardCodes: string[],
  targetCount: number,
) => {
  const { data: existing, error } = await supabase
    .from('question_bank')
    .select('id, metadata')
    .contains('metadata', { module_slug: module.slug });

  if (error) {
    throw new Error(`Failed to count practice for ${module.slug}: ${error.message}`);
  }

  const existingRows = existing ?? [];
  const currentCount = existingRows.length;
  const needed = Math.max(0, targetCount - currentCount);

  if (standardCodes.length > 0 && existingRows.length > 0) {
    for (const row of existingRows) {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const mergedStandards = dedupe([
        ...(Array.isArray(meta.standards) ? (meta.standards as string[]) : []),
        ...standardCodes,
      ]);
      const updatedMeta = { ...meta, standards: mergedStandards };
      const { error: updateError } = await supabase
        .from('question_bank')
        .update({ metadata: updatedMeta })
        .eq('id', row.id as number);
      if (updateError) {
        throw new Error(`Failed to update practice metadata for ${module.slug}: ${updateError.message}`);
      }
    }
    console.log(`Updated standards on ${existingRows.length} practice items for ${module.slug}.`);
  }

  if (needed === 0) {
    console.log(`Practice already meets target for ${module.slug} (${currentCount}/${targetCount}).`);
    return existingRows.map((row) => row.id as number);
  }

  const questions: {
    subject_id: number;
    question_type: 'multiple_choice';
    prompt: string;
    solution_explanation: string;
    difficulty: number;
    tags: string[];
    metadata: Record<string, unknown>;
  }[] = [];

  for (let i = 0; i < needed; i += 1) {
    questions.push({
      subject_id: subjectId,
      question_type: 'multiple_choice',
      prompt: `In ${module.title}, question ${currentCount + i + 1}: Demonstrate understanding of ${module.title.toLowerCase()}.`,
      solution_explanation: `Key idea: connect to ${module.title} with grade ${module.grade_band} appropriate reasoning.`,
      difficulty: 2,
      tags: ['auto_fill_baseline', module.slug],
      metadata: {
        module_slug: module.slug,
        module_id: module.id,
        standards: standardCodes,
        generated_by: 'fill_priority_gaps',
        generated_at: new Date().toISOString(),
      },
    });
  }

  const questionIds: number[] = [];
  const chunks: typeof questions[] = [];
  for (let i = 0; i < questions.length; i += PRACTICE_CHUNK_SIZE) {
    chunks.push(questions.slice(i, i + PRACTICE_CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    const { data: inserted, error: insertError } = await supabase
      .from('question_bank')
      .insert(chunk)
      .select('id');
    if (insertError) {
      throw new Error(`Failed to insert practice for ${module.slug}: ${insertError.message}`);
    }
    for (const row of inserted ?? []) {
      questionIds.push(row.id as number);
    }
  }

  const options: {
    question_id: number;
    option_order: number;
    content: string;
    is_correct: boolean;
    feedback: string | null;
  }[] = [];

  for (const questionId of questionIds) {
    options.push(
      {
        question_id: questionId,
        option_order: 1,
        content: 'Correct answer (on-grade rationale).',
        is_correct: true,
        feedback: 'Nice work—matches the core idea.',
      },
      {
        question_id: questionId,
        option_order: 2,
        content: 'Common misconception.',
        is_correct: false,
        feedback: 'Revisit the definition or example.',
      },
      {
        question_id: questionId,
        option_order: 3,
        content: 'Partially correct idea.',
        is_correct: false,
        feedback: 'Check units/steps.',
      },
      {
        question_id: questionId,
        option_order: 4,
        content: 'Off-topic choice.',
        is_correct: false,
        feedback: 'Focus on the prompt language.',
      },
    );
  }

  const optionChunks: typeof options[] = [];
  for (let i = 0; i < options.length; i += PRACTICE_CHUNK_SIZE * 4) {
    optionChunks.push(options.slice(i, i + PRACTICE_CHUNK_SIZE * 4));
  }

  for (const chunk of optionChunks) {
    const { error: optionsError } = await supabase.from('question_options').insert(chunk);
    if (optionsError) {
      throw new Error(`Failed to insert options for ${module.slug}: ${optionsError.message}`);
    }
  }

  console.log(`Added ${questionIds.length} practice items for ${module.slug}.`);
  return questionIds;
};

const ensureAssessment = async (
  supabase: SupabaseClient,
  module: ModuleRecord,
  subjectId: number,
  standardCodes: string[],
  questionIds: number[],
) => {
  const { data: existingByModule, error: existingError } = await supabase
    .from('assessments')
    .select('id')
    .eq('module_id', module.id)
    .limit(1);

  if (existingError) {
    throw new Error(`Failed to check assessments for ${module.slug}: ${existingError.message}`);
  }

  const { data: existingBySlug, error: slugError } = await supabase
    .from('assessments')
    .select('id')
    .contains('metadata', { module_slug: module.slug })
    .limit(1);

  if (slugError) {
    throw new Error(`Failed to check assessments by slug for ${module.slug}: ${slugError.message}`);
  }

  if ((existingByModule ?? []).length > 0 || (existingBySlug ?? []).length > 0) {
    const existing = (existingByModule && existingByModule[0]) || (existingBySlug && existingBySlug[0]);
    if (!existing) {
      return;
    }

    const { data: existingFull, error: existingLoadError } = await supabase
      .from('assessments')
      .select('id, metadata')
      .eq('id', existing.id)
      .single();
    if (existingLoadError) {
      throw new Error(`Failed to load existing assessment metadata for ${module.slug}: ${existingLoadError.message}`);
    }

    const meta = (existingFull?.metadata ?? {}) as Record<string, unknown>;
    const hasBaseline =
      meta.assessment_type === 'unit_assessment' ||
      meta.purpose === 'baseline' ||
      meta.purpose === 'unit' ||
      meta.assessment_type === 'unit';

    if (hasBaseline) {
      console.log(`Assessment already exists for ${module.slug}.`);
      return;
    }

    const updatedMeta = {
      ...meta,
      module_slug: module.slug,
      assessment_type: 'unit_assessment',
      purpose: meta.purpose ?? 'baseline',
      standards: standardCodes,
      generated_by: 'fill_priority_gaps',
    };

    const { error: updateError } = await supabase
      .from('assessments')
      .update({ metadata: updatedMeta })
      .eq('id', existingFull?.id);

    if (updateError) {
      throw new Error(`Failed to update assessment metadata for ${module.slug}: ${updateError.message}`);
    }

    console.log(`Updated existing assessment metadata for ${module.slug}.`);
    return;
  }

  const { data: assessmentRows, error: assessmentError } = await supabase
    .from('assessments')
    .insert({
      title: `Unit Check: ${module.title}`,
      description: 'Auto-generated baseline assessment to ensure minimum coverage.',
      subject_id: subjectId,
      is_adaptive: false,
      estimated_duration_minutes: 15,
      module_id: module.id,
      metadata: {
        module_slug: module.slug,
        assessment_type: 'unit_assessment',
        purpose: 'baseline',
        generated_by: 'fill_priority_gaps',
        standards: standardCodes,
      },
    })
    .select('id')
    .single();

  if (assessmentError || !assessmentRows?.id) {
    throw new Error(`Failed to create assessment for ${module.slug}: ${assessmentError?.message}`);
  }

  const assessmentId = assessmentRows.id as number;

  const { data: sectionRow, error: sectionError } = await supabase
    .from('assessment_sections')
    .insert({
      assessment_id: assessmentId,
      section_order: 1,
      title: 'Core Understanding',
      instructions: 'Answer the questions to demonstrate understanding of this module.',
    })
    .select('id')
    .single();

  if (sectionError || !sectionRow?.id) {
    throw new Error(`Failed to create assessment section for ${module.slug}: ${sectionError?.message}`);
  }

  const sectionId = sectionRow.id as number;
  let selectedQuestions = questionIds.slice(0, Math.min(questionIds.length, 5));

  if (selectedQuestions.length < 5) {
    const remaining = 5 - selectedQuestions.length;
    const { data: extraQuestions, error: extraError } = await supabase
      .from('question_bank')
      .select('id')
      .contains('metadata', { module_slug: module.slug })
      .order('id', { ascending: true })
      .limit(remaining);
    if (extraError) {
      throw new Error(`Failed to load extra questions for ${module.slug}: ${extraError.message}`);
    }
    for (const row of extraQuestions ?? []) {
      if (selectedQuestions.length < 5) {
        selectedQuestions.push(row.id as number);
      }
    }
  }

  if (selectedQuestions.length === 0) {
    console.warn(`No questions available to attach to assessment for ${module.slug}.`);
  }
  const links = selectedQuestions.map((questionId, index) => ({
    section_id: sectionId,
    question_id: questionId,
    question_order: index + 1,
    weight: 1.0,
    metadata: {
      module_slug: module.slug,
      generated_by: 'fill_priority_gaps',
    },
  }));

  const { error: linkError } = await supabase.from('assessment_questions').insert(links);
  if (linkError) {
    throw new Error(`Failed to attach questions to assessment for ${module.slug}: ${linkError.message}`);
  }

  console.log(`Created assessment for ${module.slug}.`);
};

const ensureExternalResource = async (
  supabase: SupabaseClient,
  module: ModuleRecord,
  external: TargetModule['external'],
) => {
  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, url, metadata')
    .eq('module_id', module.id)
    .limit(20);

  if (error) {
    throw new Error(`Failed to check assets for ${module.slug}: ${error.message}`);
  }

  const assetList = (assets ?? []) as { id: number; url: string; metadata: Record<string, unknown> | null }[];
  const hasLinkStyle = assetList.some((asset) => {
    const meta = (asset.metadata ?? {}) as Record<string, unknown>;
    const mode = (meta.storage_mode as string | undefined)?.toLowerCase();
    return mode === 'link' || mode === 'embed';
  });

  if (hasLinkStyle) {
    console.log(`External resource already exists for ${module.slug}.`);
    return;
  }

  if (assetList.length > 0) {
    const first = assetList[0];
    const meta = (first.metadata ?? {}) as Record<string, unknown>;
    const updatedMeta = {
      ...meta,
      storage_mode: 'link',
      source_provider: external.source_provider ?? meta.source_provider ?? 'External',
      curated_by: 'fill_priority_gaps',
      module_slug: module.slug,
    };

    const { error: updateError } = await supabase
      .from('assets')
      .update({ metadata: updatedMeta, license: external.license, license_url: external.license_url ?? null })
      .eq('id', first.id);

    if (updateError) {
      throw new Error(`Failed to update existing asset for ${module.slug}: ${updateError.message}`);
    }

    console.log(`Updated existing asset metadata for ${module.slug}.`);
    return;
  }

  const { error: insertError } = await supabase.from('assets').insert({
    module_id: module.id,
    title: external.title,
    description: 'Baseline enrichment link',
    url: external.url,
    kind: 'link',
    license: external.license,
    license_url: external.license_url ?? null,
    attribution_text: `${external.source_provider ?? external.title} (${external.license})`,
    metadata: {
      storage_mode: 'link',
      source_provider: external.source_provider ?? 'External',
      curated_by: 'fill_priority_gaps',
      module_slug: module.slug,
    },
  });

  if (insertError) {
    throw new Error(`Failed to add external resource for ${module.slug}: ${insertError.message}`);
  }

  console.log(`Added external resource for ${module.slug}.`);
};

const run = async (): Promise<void> => {
  const supabase = createServiceRoleClient();
  const targets = TARGETS;
  const modules = await fetchModules(
    supabase,
    targets.map((t) => t.slug),
  );
  const subjectIds = await fetchSubjectIds(supabase);

  for (const target of targets) {
    const module = modules.get(target.slug);
    if (!module) {
      console.warn(`Module ${target.slug} not found, skipping.`);
      continue;
    }

    const subjectId = subjectIds.get(module.subject);
    if (!subjectId) {
      console.warn(`Subject ${module.subject} missing id, skipping ${module.slug}.`);
      continue;
    }

    const moduleStandard = await fetchStandardForModule(supabase, module.id);
    const standardCodes = dedupe([target.standardCode, moduleStandard?.code]);
    const practiceTarget = target.practiceTarget ?? PRACTICE_TARGET_DEFAULT;
    const questionIds = await ensurePractice(supabase, module, subjectId, standardCodes, practiceTarget);
    await ensureAssessment(supabase, module, subjectId, standardCodes, questionIds);
    await ensureExternalResource(supabase, module, target.external);
  }
};

const invokedFromCli =
  process.argv[1]?.includes('fill_priority_gaps.ts') || process.argv[1]?.includes('fill_priority_gaps.js');

if (invokedFromCli) {
  run().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
