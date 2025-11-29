import process from 'node:process';

import composeAttribution from './utils/attribution.js';
import { createServiceRoleClient, fetchContentSourcesByName } from './utils/supabase.js';

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
  subtopic: string | null;
  open_track: boolean;
  metadata: Record<string, unknown> | null;
};

const GRADE_BANDS = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SUBJECTS = ['Mathematics', 'English Language Arts', 'Science', 'Social Studies', 'Electives'];
const LESSON_SUFFIX = 'launch';
const DEFAULT_DURATION = 45;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

const buildLessonSlug = (moduleSlug: string): string => `${moduleSlug}-${LESSON_SUFFIX}`;

type LessonTemplate = {
  lessonFocus: string;
  launch: string;
  guided: string;
  practice: string;
  exit: string;
  extensions: string;
  duration: number;
};

const TEMPLATES_K2: Record<string, LessonTemplate> = {
  Mathematics: {
    lessonFocus: 'Use concrete objects and pictures to build number sense and simple operations.',
    launch: 'Hands-on warmup with manipulatives or counting song; students notice, point, or clap to show quantities.',
    guided: 'Teacher models with real objects; students chorally respond and show with fingers or counters.',
    practice: 'Pairs rotate through 3 stations (count/build/compare) with adult checks for accuracy and language.',
    exit: 'One quick show-me card or thumbs response using a picture or ten-frame.',
    extensions: 'Choice time with math tubs (pattern blocks, connecting cubes) and a prompt to explain one creation.',
    duration: 30,
  },
  'English Language Arts': {
    lessonFocus: 'Listen, speak, and track print with rich read-alouds and shared writing.',
    launch: 'Picture walk and prediction; students turn and tell a partner what they notice.',
    guided: 'Teacher reads aloud, modeling pointing to words and thinking aloud about characters or facts.',
    practice: 'Students draw or act out key details; dictate a sentence or label with teacher support.',
    exit: 'Oral check: name a character/detail or echo a sentence starter.',
    extensions: 'Play-based literacy center: letter tiles, story retell props, or class bookmaking.',
    duration: 30,
  },
  Science: {
    lessonFocus: 'Explore a simple phenomenon with senses and talk about observations.',
    launch: 'Show/handle a real object or short clip; students say what they see, hear, feel, or smell.',
    guided: 'Teacher models a mini-investigation (pouring, shining light, moving objects) and names what happens.',
    practice: 'Small groups repeat the mini test with adult help; use picture words to describe changes.',
    exit: 'Students share one observation using a sentence stem: “I saw/heard/felt...”.',
    extensions: 'Outdoor walk or center with magnifiers and natural items; invite kids to sort and explain.',
    duration: 30,
  },
  'Social Studies': {
    lessonFocus: 'Connect self, family, and community through stories, maps, and routines.',
    launch: 'Share a photo/map; students point to where they live or who is in their community.',
    guided: 'Teacher models reading a simple map or calendar; practice vocabulary (home, school, helper).',
    practice: 'Students place picture cards on a map/chart and explain their choice to a partner.',
    exit: 'Quick check: students circle or point to a community helper/object on a card.',
    extensions: 'Role-play or block center to build a community street and narrate who helps where.',
    duration: 30,
  },
  General: {
    lessonFocus: 'Use concrete experiences, pictures, and oral language to build understanding.',
    launch: 'Short visual or object; students notice/wonder with gestures or simple words.',
    guided: 'Model the task with think-aloud and plenty of repetition; invite choral responses.',
    practice: 'Hands-on stations with adult prompts and picture cues.',
    exit: 'One-picture check-in with thumbs or a single word.',
    extensions: 'Free explore with related materials and a prompt to “tell a friend what you made/saw.”',
    duration: 30,
  },
};

const TEMPLATES_3_8: Record<string, LessonTemplate> = {
  Mathematics: {
    lessonFocus: 'Connect visual, numeric, and verbal representations to strengthen concept fluency.',
    launch: 'Quick estimation or notice/wonder task that surfaces intuitive ideas tied to the module focus.',
    guided:
      'Model a worked example on the board, pausing for turn-and-talks and micro-checks (fist-to-five, mini whiteboards).',
    practice:
      'Students solve 3–5 scaffolded problems that increase in complexity; encourage multiple strategies and share-outs.',
    exit: 'One short prompt (compute/explain) that requires naming the strategy used.',
    extensions: 'Early finishers explore an interactive (Desmos/PhET/Khan) or create a mini-poster of a strategy.',
    duration: 40,
  },
  'English Language Arts': {
    lessonFocus: 'Analyze how authors develop meaning through structure, language choices, and evidence.',
    launch:
      'Display a provocative quote/image from the text; students predict theme, tone, or point of view with a quick write.',
    guided:
      'Close-read a short passage; model annotation (vocab, figurative language, syntax) and evidence gathering.',
    practice:
      'Pairs create an evidence chart responding to a prompt (claim/evidence/commentary) using text details or visuals.',
    exit: 'Students craft a 2–3 sentence response using one quoted detail and a sentence starter.',
    extensions: 'Offer an audio/dramatic reading or primary-source image to deepen context and fluency.',
    duration: 50,
  },
  Science: {
    lessonFocus: 'Use a phenomenon to drive questioning, evidence collection, and simple modeling.',
    launch: 'Show a short clip/image; students record observations, questions, and initial hypotheses.',
    guided:
      'Demonstrate or simulate the core idea; co-construct a data table/model and discuss sources of evidence.',
    practice:
      'Small groups run a quick investigation or virtual sim, then explain patterns using CER (claim, evidence, reasoning).',
    exit: 'Write a 2-sentence CER responding to the launch question, citing the strongest evidence.',
    extensions: 'Provide an optional NASA/NOAA visual or PhET sim for deeper exploration.',
    duration: 45,
  },
  'Social Studies': {
    lessonFocus: 'Evaluate primary/secondary sources for perspective, evidence, and relevance to the inquiry question.',
    launch:
      'Examine a primary-source image/text; students note sourcing (author, date, audience) and initial inferences.',
    guided:
      'Model sourcing/corroboration with a second source; highlight bias, reliability, and key contextual details.',
    practice:
      'Students compare two sources using a T-chart (agreements, conflicts) and draft a claim supported by evidence.',
    exit: 'One-sentence claim with one cited piece of evidence (source + detail).',
    extensions: 'Optional timeline/map activity or museum/LOC/NARA artifact to widen context.',
    duration: 45,
  },
  General: {
    lessonFocus: 'Engage students with a quick hook, model thinking, then practice and reflect.',
    launch: 'Use a visual or prompt to spark predictions or recall prior knowledge.',
    guided: 'Teacher models the core move, inviting brief partner talk to check understanding.',
    practice: 'Students complete a short, scaffolded set of tasks with checks for sense-making.',
    exit: 'One concise prompt to confirm the day’s takeaway.',
    extensions: 'Optional enrichment link or reflection question.',
    duration: 40,
  },
};

const TEMPLATES_9_12: Record<string, LessonTemplate> = {
  Mathematics: {
    lessonFocus: 'Link concepts to real data or models and push multiple solution paths.',
    launch: 'Pose a context-rich prompt (graph, data table, or scenario) and ask for a quick estimate or claim.',
    guided:
      'Model one representation (graph/algebraic/visual) and narrate choices; invite students to suggest alternate approaches.',
    practice:
      'Students tackle 2–3 multi-step problems; half the time is collaborative with whiteboard share-outs and error analysis.',
    exit: 'One reasoning item (justify a step, explain a graph feature, or critique a sample solution).',
    extensions: 'Mini-project idea: collect a small data set or find a real-world example and model it for next class.',
    duration: 50,
  },
  'English Language Arts': {
    lessonFocus: 'Engage with complex texts through argument, craft, and synthesis.',
    launch:
      'Use a short excerpt or visual to surface stance or theme; quick write on a prompt tied to author purpose or rhetoric.',
    guided:
      'Model close reading with annotation for claims, evidence, and craft moves; show how to paraphrase and integrate quotes.',
    practice:
      'Small groups build a claim + evidence + commentary paragraph or outline; peer feedback on clarity and relevance.',
    exit: 'Exit slip: one-sentence claim with one cited detail or a rhetorical move identified and explained.',
    extensions: 'Optional: connect to a secondary source, podcast clip, or op-ed for synthesis in the next lesson.',
    duration: 55,
  },
  Science: {
    lessonFocus: 'Frame an investigation or case study that mirrors scientific reasoning.',
    launch: 'Show a data-rich figure or brief phenomenon clip; students draft a claim or question.',
    guided:
      'Model designing or critiquing a simple procedure/model; highlight variables, controls, and data interpretation.',
    practice:
      'Teams analyze a provided data set or simulation output; produce a CER explaining patterns and limitations.',
    exit: 'Write one claim with evidence and a limitation or next-step question.',
    extensions: 'Project idea: mini-lab plan, short research synopsis, or model revision to bring back tomorrow.',
    duration: 55,
  },
  'Social Studies': {
    lessonFocus: 'Analyze sources and construct defensible arguments with evidence and context.',
    launch: 'Present a provocative primary source or data graphic; students note sourcing and initial claims.',
    guided:
      'Model sourcing/corroboration and a quick outline for an argument; highlight contextualization and counterclaims.',
    practice:
      'Groups annotate a second source, compare perspectives, and draft a claim with two pieces of evidence.',
    exit: 'One-sentence thesis or counterclaim with one cited source detail.',
    extensions: 'Assign a short document-based prompt or mini-research lead for next class.',
    duration: 55,
  },
  General: {
    lessonFocus: 'Lead with authentic problems or texts and push toward analysis and application.',
    launch: 'Show a case, data set, or excerpt; students take a position or predict an outcome.',
    guided: 'Model how to frame the task, demonstrating one analytic move or representation.',
    practice: 'Students work in teams on a short problem set or source packet with structured roles.',
    exit: 'Brief reflection: “What convinced you?” or “Which step mattered most?”',
    extensions: 'Invite a short prep task (find a source/example) to deepen tomorrow’s work.',
    duration: 55,
  },
};

const pickTemplate = (subject: string, gradeBand: string): LessonTemplate => {
  const normalizedGrade = gradeBand.trim();
  const isK2 = ['K', '1', '2'].includes(normalizedGrade);
  const isUpper = ['9', '10', '11', '12'].includes(normalizedGrade);

  if (isK2) {
    return TEMPLATES_K2[subject] ?? TEMPLATES_K2.General;
  }
  if (isUpper) {
    return TEMPLATES_9_12[subject] ?? TEMPLATES_9_12.General;
  }
  return TEMPLATES_3_8[subject] ?? TEMPLATES_3_8.General;
};

const buildLessonMarkdown = (module: ModuleRow): { content: string; duration: number } => {
  const template = pickTemplate(module.subject, module.grade_band);
  const header = `# ${module.title}: Launch Lesson`;
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
    `- ${template.lessonFocus}`,
    '## Launch (5-7 minutes)',
    `- ${template.launch}`,
    '## Guided Exploration (10-15 minutes)',
    `- ${template.guided}`,
    '## Collaborative Practice (15-20 minutes)',
    `- ${template.practice}`,
    '## Exit Ticket (5 minutes)',
    `- ${template.exit}`,
    '## Extensions & Differentiation',
    `- ${template.extensions}`,
  ];

  return {
    content: [header, overview, '', ...sections].join('\n\n').trim(),
    duration: template.duration,
  };
};

const ensureSubjectId = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  cache: Map<string, number>,
  subjectName: string,
): Promise<number> => {
  if (cache.has(subjectName)) {
    return cache.get(subjectName)!;
  }

  const { data: existing, error: loadError } = await supabase
    .from('subjects')
    .select('id, name')
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
    .select('id, name')
    .single();

  if (insertError) {
    throw new Error(`Failed to insert subject "${subjectName}": ${insertError.message}`);
  }

  cache.set(subjectName, inserted.id as number);
  return inserted.id as number;
};

const ensureTopicId = async (
  supabase: ReturnType<typeof createServiceRoleClient>,
  subjectId: number,
  module: ModuleRow,
): Promise<number> => {
  const targetName = `${module.grade_band} ${module.topic?.trim() || module.title || module.slug}`.trim();
  const targetSlug = slugify(`${module.slug}-topic`);

  const { data: upserted, error: upsertError } = await supabase
    .from('topics')
    .upsert(
      {
        subject_id: subjectId,
        name: targetName,
        slug: targetSlug,
        description: module.summary ?? module.description ?? null,
      },
      { onConflict: 'subject_id,slug' },
    )
    .select('id')
    .single();

  if (upsertError) {
    throw new Error(`Failed to ensure topic for module ${module.slug}: ${upsertError.message}`);
  }

  return upserted.id as number;
};

const seedLaunchLessons = async (): Promise<void> => {
  const supabase = createServiceRoleClient();
  const subjectCache = new Map<string, number>();

  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select(
      'id, slug, title, summary, description, subject, grade_band, strand, topic, subtopic, open_track, metadata',
    )
    .in('subject', SUBJECTS)
    .in('grade_band', GRADE_BANDS);

  if (modulesError) {
    throw new Error(`Failed to load modules: ${modulesError.message}`);
  }

  const moduleRows = (modules ?? []) as ModuleRow[];
  if (moduleRows.length === 0) {
    console.log('No modules found for target grades/subjects.');
    return;
  }

  const sources = await fetchContentSourcesByName(supabase, ['ElevatED Author Team']);
  const authorSource = sources.get('ElevatED Author Team');
  if (!authorSource) {
    throw new Error('Content source "ElevatED Author Team" not found. Seed content_sources first.');
  }

  const attribution = composeAttribution({
    sourceName: authorSource.name,
    license: authorSource.license,
    license_url: authorSource.license_url ?? undefined,
    attribution_text: authorSource.attribution_text ?? undefined,
  });

  let insertedCount = 0;

  for (const module of moduleRows) {
    const lessonSlug = buildLessonSlug(module.slug);
    const subjectId = await ensureSubjectId(supabase, subjectCache, module.subject);
    const topicId = await ensureTopicId(supabase, subjectId, module);
    const { content, duration } = buildLessonMarkdown(module);

    const { error: insertError } = await supabase
      .from('lessons')
      .upsert(
        {
          topic_id: topicId,
          module_id: module.id,
          title: `${module.title} Launch Lesson`,
          slug: lessonSlug,
          content,
          visibility: 'public',
          open_track: module.open_track,
          is_published: true,
          estimated_duration_minutes: duration || DEFAULT_DURATION,
          attribution_block: attribution,
          media_url: null,
          metadata: {
            module_slug: module.slug,
            seeded_by: 'seed_launch_lessons_all',
            seeded_at: new Date().toISOString(),
          },
        },
        { onConflict: 'topic_id,title' },
      );

    if (insertError) {
      throw new Error(`Failed to upsert lesson for module ${module.slug}: ${insertError.message}`);
    }

    insertedCount += 1;
  }

  console.log(`Inserted ${insertedCount} launch lessons across ${moduleRows.length} modules.`);
};

const invokedFromCli =
  process.argv[1]?.includes('seed_launch_lessons_all.ts') ||
  process.argv[1]?.includes('seed_launch_lessons_all.js');

if (invokedFromCli) {
  seedLaunchLessons().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
