import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

type SkeletonModule = {
  grade: string;
  subject: string;
  strand: string;
  topic: string;
  subtopic?: string;
  suggested_source_category?: string;
  example_source?: string;
  license_requirement?: string;
  notes?: string;
};

type Lesson = {
  title: string;
  summary: string;
  objectives: string[];
  grade_band: string;
  subject: string;
  standards?: string[];
  outline: {
    hook: string;
    direct_instruction: string;
    guided_practice: string;
    independent_practice: string;
    check_for_understanding: string;
    exit_ticket: string;
    materials?: string[];
  };
  content_markdown?: string;
  content_markdown_file?: string;
};

type PracticeOption = {
  text: string;
  isCorrect: boolean;
  feedback?: string;
};

type PracticeItem = {
  prompt: string;
  type: 'multiple_choice';
  difficulty: number;
  explanation: string;
  skills: string[];
  standards: string[];
  tags: string[];
  options: PracticeOption[];
};

type QuizDefinition = {
  title: string;
  description: string;
  estimatedDuration: number;
  standards: string[];
  questions: PracticeItem[];
};

type LessonConfig = Record<string, Lesson>;
type PracticeConfig = Record<string, PracticeItem[]>;
type QuizConfig = Record<string, QuizDefinition>;

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');
const GRADES = ['3', '4', '5', '6', '7', '8'];

const CORE_TOPICS: Record<'Mathematics' | 'English Language Arts' | 'Science' | 'Social Studies', string[]> = {
  Mathematics: [
    'Estimation Strategies',
    'Error Analysis and Revision',
    'Mathematical Modeling',
    'Patterns and Rules',
    'Performance Task: Plan a Field Trip',
  ],
  'English Language Arts': [
    'Comparing Two Texts',
    'Author Purpose and Point of View',
    'Evidence Paragraphs',
    'Vocabulary in Context',
    'Discussion and Collaborative Conversation',
    'Research Notes and Source Cards',
    'Revision for Clarity',
  ],
  Science: [
    'Data Tables and Graphs',
    'Variables and Fair Tests',
    'Systems and Interactions',
    'Model Revision',
  ],
  'Social Studies': [
    'Map Skills and Spatial Reasoning',
    'Primary and Secondary Sources',
    'Cause and Effect in History',
    'Community and Civic Problem Solving',
    'Economic Choices and Tradeoffs',
    'Culture and Perspective',
  ],
};

const ELECTIVE_TOPICS = [
  { lane: 'Arts & Music', strand: 'Arts and Music', topic: 'Creative Composition Studio' },
  { lane: 'Computer Science', strand: 'Computer Science', topic: 'Computational Thinking Lab' },
  { lane: 'Health & PE', strand: 'Health and PE', topic: 'Personal Wellness Plan' },
  { lane: 'Study Skills', strand: 'Study Skills', topic: 'Goal Setting and Reflection' },
  { lane: 'Financial Literacy', strand: 'Financial Literacy', topic: 'Money Decisions in Real Life' },
];

const LESSON_FILES: Record<string, string> = {
  Mathematics: 'data/lessons/authored_launch_lessons.json',
  'English Language Arts': 'data/lessons/ela_authored_launch_lessons.json',
  Science: 'data/lessons/science_authored_launch_lessons.json',
  'Social Studies': 'data/lessons/social_studies_authored_launch_lessons.json',
  'Arts & Music': 'data/lessons/arts_music_authored_launch_lessons.json',
  'Computer Science': 'data/lessons/cs_authored_launch_lessons.json',
  'Health & PE': 'data/lessons/health_pe_authored_launch_lessons.json',
  'Financial Literacy': 'data/lessons/financial_literacy_authored_launch_lessons.json',
  'Study Skills': 'data/lessons/study_skills_authored_launch_lessons.json',
};

const PRACTICE_FILES: Record<string, string> = {
  Mathematics: 'data/practice/authored_practice_items.json',
  'English Language Arts': 'data/practice/ela_authored_practice_items.json',
  Science: 'data/practice/science_authored_practice_items.json',
  'Social Studies': 'data/practice/authored_practice_items.json',
  'Arts & Music': 'data/practice/arts_music_authored_practice_items.json',
  'Computer Science': 'data/practice/cs_authored_practice_items.json',
  'Health & PE': 'data/practice/health_pe_authored_practice_items.json',
  'Financial Literacy': 'data/practice/financial_literacy_authored_practice_items.json',
  'Study Skills': 'data/practice/study_skills_authored_practice_items.json',
};

const QUIZ_FILES: Record<string, string> = {
  Mathematics: 'data/assessments/module_quizzes_authored.json',
  'English Language Arts': 'data/assessments/ela_module_quizzes_authored.json',
  Science: 'data/assessments/science_module_quizzes_authored.json',
  'Social Studies': 'data/assessments/social_studies_module_quizzes_authored.json',
  'Arts & Music': 'data/assessments/arts_music_module_quizzes_authored.json',
  'Computer Science': 'data/assessments/cs_module_quizzes_authored.json',
  'Health & PE': 'data/assessments/health_pe_module_quizzes_authored.json',
  'Financial Literacy': 'data/assessments/financial_literacy_module_quizzes_authored.json',
  'Study Skills': 'data/assessments/study_skills_module_quizzes_authored.json',
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

const moduleSlug = (entry: SkeletonModule): string =>
  slugify([entry.grade, entry.subject, entry.strand, entry.topic, entry.subtopic].filter(Boolean).join('-'));

const readJson = async <T>(relativePath: string): Promise<T> =>
  JSON.parse(await fs.readFile(path.join(ROOT, relativePath), 'utf8')) as T;

const writeJson = async (relativePath: string, data: unknown): Promise<void> => {
  if (!APPLY) return;
  await fs.writeFile(path.join(ROOT, relativePath), `${JSON.stringify(data, null, 2)}\n`);
};

const ensureFileObject = async <T extends Record<string, unknown>>(relativePath: string): Promise<T> => {
  try {
    return await readJson<T>(relativePath);
  } catch {
    return {} as T;
  }
};

const standardsFor = (grade: string, subject: string, topic: string): string[] => {
  if (subject === 'Mathematics') return [`${grade}.MP.1`, `${grade}.OA.REASONING`];
  if (subject === 'English Language Arts') return [`CCSS.ELA-LITERACY.RI.${grade}.1`, `CCSS.ELA-LITERACY.W.${grade}.2`];
  if (subject === 'Science') return [`${grade}-SCI-PRACTICE`, '3-5-ETS1-3'];
  if (subject === 'Social Studies') return [`SS.${grade}.INQ.1`, `SS.${grade}.CIV.2`];
  if (subject === 'Arts & Music') return [`VA.${grade}.CR.1`, `MU.${grade}.RE.7`];
  if (subject === 'Computer Science') return [`CS.${grade}.AP.1`, `CS.${grade}.IC.1`];
  if (subject === 'Health & PE') return [`HP.${grade}.WELL.1`, `PE.${grade}.FIT.1`];
  if (subject === 'Financial Literacy') return [`FL.${grade}.DEC.1`, `FL.${grade}.BUD.1`];
  return [`SSK.${grade}.${slugify(topic).toUpperCase()}`];
};

const lessonSubjectForModule = (entry: SkeletonModule): string => {
  if (entry.subject !== 'Electives') return entry.subject;
  const elective = ELECTIVE_TOPICS.find((item) => item.strand === entry.strand);
  return elective?.lane ?? entry.strand;
};

const skillName = (slug: string): string =>
  slug
    .replace(/^[0-9]+-/, '')
    .replace(/english-language-arts/g, 'ela')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90);

const optionSet = (correct: string, a: string, b: string, c: string, feedback: string): PracticeOption[] => [
  { text: correct, isCorrect: true, feedback },
  { text: a, isCorrect: false, feedback: 'This choice does not match the lesson evidence.' },
  { text: b, isCorrect: false, feedback: 'Check the task, labels, and reasoning before choosing.' },
  { text: c, isCorrect: false, feedback: 'Try again by naming the main concept first.' },
];

const buildMarkdown = (entry: SkeletonModule, lessonSubject: string): string => {
  const grade = entry.grade;
  const topic = entry.topic;
  const subject = lessonSubject;
  const isMath = subject === 'Mathematics';
  const isEla = subject === 'English Language Arts';
  const isScience = subject === 'Science';
  const isSocial = subject === 'Social Studies';

  const framing = isMath
    ? 'solve a realistic problem, compare strategies, and explain why the answer is reasonable'
    : isEla
      ? 'read or write with a clear claim, useful evidence, and an explanation that connects the two'
      : isScience
        ? 'observe a phenomenon, collect evidence, and revise a model or explanation'
        : isSocial
          ? 'analyze a source, map, scenario, or civic problem using evidence and context'
          : 'create, test, reflect, and revise a practical product or personal plan';

  const example = isMath
    ? `A class has a budget, a schedule, and several choices. Students must decide which information matters, choose operations, and defend the final decision.`
    : isEla
      ? `A student reads two short sources about the same issue. One source gives a fact, while the other gives an opinion. The student must decide which details belong in a written response.`
      : isScience
        ? `A group tests two versions of a model. The first model explains part of the data, but the second model explains more of the pattern.`
        : isSocial
          ? `A community has two possible choices. Students compare a source, a map or chart, and a short scenario before making a claim.`
          : `A learner makes a first draft, tests it, gets feedback, and improves the product or plan before sharing it.`;

  return `# ${topic}

## Learning Goal
- I can explain the main idea of ${topic.toLowerCase()} in grade ${grade} language.
- I can use evidence, examples, or a model to complete the task.
- I can revise my thinking after checking for accuracy and clarity.

## Introduction
This lesson adds depth to the grade ${grade} ${subject} pathway. The focus is ${topic.toLowerCase()}. Students will not only learn a definition; they will use the idea in a realistic task, explain their reasoning, and check whether the work is clear enough for someone else to follow.

The central move is to ${framing}. That move matters because strong learning is not just getting an answer. Strong learning includes choosing useful information, using vocabulary accurately, and explaining why the evidence supports the result.

## Key Vocabulary
**Focus**: The specific idea or problem the lesson asks you to study.

**Evidence**: Information from a text, model, data table, source, example, or observation that supports your answer.

**Strategy**: The method you choose to complete the task.

**Revision**: A purposeful change that makes the work more accurate, clearer, or better supported.

## Worked Example
${example}

A strong response follows this pattern:

1. Name the task in your own words.
2. Identify the most useful evidence or information.
3. Apply a strategy that matches the task.
4. Explain why the result makes sense.
5. Revise one part of the work after checking it.

For ${topic.toLowerCase()}, the explanation is just as important as the answer. A reader, partner, or tutor should be able to see what you used as evidence and how that evidence shaped the result.

## Guided Practice
Use this four-question check:

- What is the exact task?
- What evidence or information matters most?
- Which strategy fits this task best?
- What would make the answer stronger or clearer?

Answer in short notes first. Then turn the notes into a complete explanation. If the explanation sounds vague, add a specific example, label, quote, data point, source detail, or step.

## Common Mistake
A common mistake is doing the visible part of the task without explaining the thinking. In math, that can mean writing an answer without labels. In reading, it can mean quoting without explaining. In science, it can mean naming a vocabulary word without evidence. In social studies, it can mean giving an opinion without context. In electives, it can mean making a product without reflecting on whether it works.

Fix the mistake by adding the missing link: "This evidence matters because..." or "This strategy fits because..."

## Independent Practice
Create or complete a short task connected to ${topic.toLowerCase()}. Include:

- one piece of evidence or information
- one strategy choice
- one explanation sentence
- one revision after checking your work

Then write a reflection: "The part I improved was ___ because ___."

## Summary
${topic} helps make the grade ${grade} ${subject} pathway more complete because it asks students to apply, explain, and revise. The most important habit is to connect evidence to strategy. When evidence, strategy, and explanation fit together, the work becomes stronger and easier to trust.

<!-- generated_by: expand_grades_3_8_curriculum_depth.ts -->`;
};

const buildLesson = (entry: SkeletonModule): Lesson => {
  const subject = lessonSubjectForModule(entry);
  const standards = standardsFor(entry.grade, subject, entry.topic);
  return {
    title: entry.topic,
    summary: `Grade ${entry.grade} ${subject} depth lesson on ${entry.topic} with direct instruction, worked example, guided practice, independent practice, and reflection.`,
    objectives: [
      `Explain ${entry.topic.toLowerCase()} using grade-level vocabulary`,
      'Use evidence, examples, or a model to complete a task',
      'Revise and explain thinking after a check',
    ],
    grade_band: entry.grade,
    subject,
    standards,
    outline: {
      hook: `Open with a realistic grade ${entry.grade} scenario for ${entry.topic}.`,
      direct_instruction: 'Teach the vocabulary and model the strategy with a worked example.',
      guided_practice: 'Students answer the guided questions and explain the evidence or strategy they used.',
      independent_practice: 'Students complete an aligned task and revise one part after checking.',
      check_for_understanding: 'Look for accurate vocabulary, relevant evidence, and a clear explanation.',
      exit_ticket: 'Students name the strategy, evidence, and revision they used.',
      materials: ['Notebook or digital workspace', 'Pencil', 'Source, model, data table, or planning template'],
    },
    content_markdown: buildMarkdown(entry, subject),
  };
};

const buildPractice = (slug: string, lesson: Lesson): PracticeItem[] => {
  const standards = lesson.standards ?? ['LOCAL.REVIEW'];
  const skill = skillName(slug);
  const topic = lesson.title;
  const grade = lesson.grade_band.replace(/^Grade\s+/i, '').trim();
  const scenarios = [
    'during guided practice',
    'while checking independent work',
    'after comparing two possible strategies',
    'during a partner explanation',
    'while revising an exit-ticket response',
  ];

  return scenarios.flatMap((scenario, index): PracticeItem[] => [
    {
      prompt: `In grade ${grade} ${topic}, ${scenario}, which response best shows that the student used evidence rather than guessing?`,
      type: 'multiple_choice',
      difficulty: 1 + (index % 2),
      explanation: 'A strong response names specific evidence and connects it to the answer.',
      skills: [skill],
      standards,
      tags: ['depth-expansion', 'evidence'],
      options: optionSet(
        'The student names specific evidence and explains how it supports the answer.',
        'The student writes only that the answer looks right.',
        'The student chooses the longest answer without checking it.',
        'The student ignores the task and gives an unrelated fact.',
        'Correct. Evidence plus explanation makes the response stronger.',
      ),
    },
    {
      prompt: `A grade ${grade} task for ${topic} feels confusing ${scenario}. What should the student do first?`,
      type: 'multiple_choice',
      difficulty: 2,
      explanation: 'The first step is to restate the task and identify the useful information.',
      skills: [skill],
      standards,
      tags: ['depth-expansion', 'strategy'],
      options: optionSet(
        'Restate the task and identify the useful information.',
        'Skip the evidence and write any answer.',
        'Change the topic to something easier.',
        'Copy a sentence without checking whether it fits.',
        'Correct. Clarifying the task makes the strategy easier to choose.',
      ),
    },
    {
      prompt: `Which revision would most improve grade ${grade} work on ${topic} ${scenario}?`,
      type: 'multiple_choice',
      difficulty: 2 + (index % 2),
      explanation: 'The best revision adds clarity, accuracy, or stronger support.',
      skills: [skill],
      standards,
      tags: ['depth-expansion', 'revision'],
      options: optionSet(
        'Add a specific example, label, quote, data point, or source detail.',
        'Remove the explanation because the answer is enough.',
        'Make the response shorter by deleting all evidence.',
        'Add a decorative detail that does not support the answer.',
        'Correct. Revision should strengthen the reasoning or support.',
      ),
    },
    {
      prompt: `How does grade ${grade} ${topic} strengthen transfer ${scenario}?`,
      type: 'multiple_choice',
      difficulty: 3,
      explanation: 'The module builds transfer by asking students to apply, explain, and revise.',
      skills: [skill],
      standards,
      tags: ['depth-expansion', 'transfer'],
      options: optionSet(
        'It asks students to apply a skill, explain reasoning, and revise work.',
        'It only adds more vocabulary to memorize.',
        'It replaces all other modules in the subject.',
        'It avoids evidence so the task is faster.',
        'Correct. Fuller curriculum needs application and transfer, not only exposure.',
      ),
    },
  ]);
};

const buildCoreEntries = (): SkeletonModule[] => {
  const entries: SkeletonModule[] = [];
  for (const grade of GRADES) {
    for (const [subject, topics] of Object.entries(CORE_TOPICS)) {
      for (const topic of topics) {
        const strand =
          subject === 'Mathematics'
            ? 'Depth and Application'
            : subject === 'English Language Arts'
              ? 'Reading Writing and Communication'
              : subject === 'Science'
                ? 'Science and Engineering Practices'
                : 'Inquiry and Civic Reasoning';
        entries.push({
          grade,
          subject,
          strand,
          topic,
          suggested_source_category: 'Self-authored CC BY depth lessons and practice',
          example_source: 'ElevatED authored curriculum',
          license_requirement: 'CC BY / original authored content',
          notes: 'Depth expansion module added during grades 3-8 curriculum buildout.',
        });
      }
    }
  }
  return entries;
};

const buildElectiveEntries = (): SkeletonModule[] => {
  const entries: SkeletonModule[] = [];
  for (const grade of GRADES) {
    for (const topic of ELECTIVE_TOPICS) {
      entries.push({
        grade,
        subject: 'Electives',
        strand: topic.strand,
        topic: topic.topic,
        suggested_source_category: 'Self-authored CC BY enrichment lessons and practice',
        example_source: 'ElevatED authored curriculum',
        license_requirement: 'CC BY / original authored content',
        notes: 'Elective enrichment module added during grades 3-8 curriculum buildout.',
      });
    }
  }
  return entries;
};

const updateSkeleton = async (entries: SkeletonModule[]): Promise<number> => {
  const skeleton = await readJson<SkeletonModule[]>('data/curriculum/ElevatED_K12_Curriculum_Skeleton.json');
  const existing = new Set(skeleton.map((entry) => moduleSlug(entry)));
  let added = 0;
  for (const entry of entries) {
    const slug = moduleSlug(entry);
    if (!existing.has(slug)) {
      skeleton.push(entry);
      existing.add(slug);
      added += 1;
    }
  }
  await writeJson('data/curriculum/ElevatED_K12_Curriculum_Skeleton.json', skeleton);
  return added;
};

const upsertSources = async (entries: SkeletonModule[]): Promise<{ lessons: number; practice: number; quizzes: number }> => {
  const lessonFiles = new Map<string, LessonConfig>();
  const practiceFiles = new Map<string, PracticeConfig>();
  const quizFiles = new Map<string, QuizConfig>();
  let lessons = 0;
  let practice = 0;
  let quizzes = 0;

  for (const entry of entries) {
    const subject = lessonSubjectForModule(entry);
    const lessonPath = LESSON_FILES[subject];
    const practicePath = PRACTICE_FILES[subject];
    const quizPath = QUIZ_FILES[subject];
    if (!lessonPath || !practicePath || !quizPath) {
      throw new Error(`No source file mapping for ${subject}`);
    }

    if (!lessonFiles.has(lessonPath)) lessonFiles.set(lessonPath, await ensureFileObject<LessonConfig>(lessonPath));
    if (!practiceFiles.has(practicePath)) practiceFiles.set(practicePath, await ensureFileObject<PracticeConfig>(practicePath));
    if (!quizFiles.has(quizPath)) quizFiles.set(quizPath, await ensureFileObject<QuizConfig>(quizPath));

    const slug = moduleSlug(entry);
    const lesson = buildLesson(entry);
    const practiceItems = buildPractice(slug, lesson);

    lessonFiles.get(lessonPath)![slug] = lesson;
    practiceFiles.get(practicePath)![slug] = practiceItems;
    quizFiles.get(quizPath)![slug] = {
      title: `${lesson.title} Checkpoint`,
      description: `Baseline quiz for grade ${entry.grade} ${subject}: ${lesson.title}.`,
      estimatedDuration: 10,
      standards: lesson.standards ?? ['LOCAL.REVIEW'],
      questions: practiceItems.slice(0, 4),
    };
    lessons += 1;
    practice += practiceItems.length;
    quizzes += 1;
  }

  for (const [file, data] of lessonFiles) await writeJson(file, data);
  for (const [file, data] of practiceFiles) await writeJson(file, data);
  for (const [file, data] of quizFiles) await writeJson(file, data);

  return { lessons, practice, quizzes };
};

const main = async (): Promise<void> => {
  console.log(`${APPLY ? 'Applying' : 'Previewing'} grades 3-8 depth expansion...`);
  const entries = [...buildCoreEntries(), ...buildElectiveEntries()];
  const addedToSkeleton = await updateSkeleton(entries);
  const sourceCounts = await upsertSources(entries);
  console.log(`Expansion entries considered: ${entries.length}`);
  console.log(`New skeleton modules: ${addedToSkeleton}`);
  console.log(`Lesson sources upserted: ${sourceCounts.lessons}`);
  console.log(`Practice items upserted: ${sourceCounts.practice}`);
  console.log(`Quiz definitions upserted: ${sourceCounts.quizzes}`);
  if (!APPLY) console.log('No files were written. Re-run with --apply to update source files.');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
