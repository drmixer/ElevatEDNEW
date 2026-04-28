import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

type LessonOutline = {
  hook: string;
  direct_instruction: string;
  guided_practice: string;
  independent_practice: string;
  check_for_understanding: string;
  exit_ticket: string;
  materials?: string[];
};

type Lesson = {
  title: string;
  summary: string;
  objectives: string[];
  grade_band: string;
  subject: string;
  standards?: string[];
  outline: LessonOutline;
  content_markdown?: string;
  content_markdown_file?: string;
};

type LessonConfig = Record<string, Lesson>;

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

type QuizDefinition = {
  title: string;
  description: string;
  estimatedDuration: number;
  standards: string[];
  questions: PracticeItem[];
};

const ROOT = process.cwd();
const TARGET_GRADES = new Set(['3', '4', '5']);
const APPLY = process.argv.includes('--apply');

const wordCount = (value: string): number => value.split(/\s+/).filter(Boolean).length;

const readJson = async <T>(relativePath: string): Promise<T> => {
  const filePath = path.join(ROOT, relativePath);
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
};

const writeJson = async (relativePath: string, data: unknown): Promise<void> => {
  const filePath = path.join(ROOT, relativePath);
  const next = `${JSON.stringify(data, null, 2)}\n`;
  if (APPLY) {
    await fs.writeFile(filePath, next);
  }
};

const gradeOf = (lesson: Lesson): string => lesson.grade_band.replace(/^Grade\s+/i, '').trim();

const cleanTitle = (title: string): string =>
  title
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[/:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const sentenceTopic = (lesson: Lesson): string => cleanTitle(lesson.title).toLowerCase();

const skillName = (slug: string): string =>
  slug
    .replace(/^[0-9]+-/, '')
    .replace(/english-language-arts/g, 'ela')
    .replace(/number-and-operations/g, 'number')
    .replace(/geometry-and-measurement/g, 'geometry')
    .replace(/data-and-probability/g, 'data')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

const buildModuleSlug = (entry: SkeletonModule): string =>
  slugify([entry.grade, entry.subject, entry.strand, entry.topic, entry.subtopic].filter(Boolean).join('-'));

const EXPANSION_MODULES: SkeletonModule[] = [
  {
    grade: '3',
    subject: 'Mathematics',
    strand: 'Problem Solving',
    topic: 'Multi-Step Word Problems',
    suggested_source_category: 'Self-authored CC BY lessons and practice',
    example_source: 'ElevatED authored curriculum',
    license_requirement: 'CC BY / original authored content',
    notes: 'Grade 3 expansion module added during 3-5 hardening pass.',
  },
  {
    grade: '4',
    subject: 'Mathematics',
    strand: 'Problem Solving',
    topic: 'Multi-Step Word Problems',
    suggested_source_category: 'Self-authored CC BY lessons and practice',
    example_source: 'ElevatED authored curriculum',
    license_requirement: 'CC BY / original authored content',
    notes: 'Grade 4 expansion module added during 3-5 hardening pass.',
  },
  {
    grade: '5',
    subject: 'Mathematics',
    strand: 'Problem Solving',
    topic: 'Multi-Step Word Problems',
    suggested_source_category: 'Self-authored CC BY lessons and practice',
    example_source: 'ElevatED authored curriculum',
    license_requirement: 'CC BY / original authored content',
    notes: 'Grade 5 expansion module added during 3-5 hardening pass.',
  },
  {
    grade: '3',
    subject: 'English Language Arts',
    strand: 'Reading Informational',
    topic: 'Text Structure and Transitions',
    suggested_source_category: 'Self-authored CC BY lessons and practice',
    example_source: 'ElevatED authored curriculum',
    license_requirement: 'CC BY / original authored content',
    notes: 'Grade 3 expansion module added during 3-5 hardening pass.',
  },
  {
    grade: '4',
    subject: 'English Language Arts',
    strand: 'Reading Informational',
    topic: 'Text Structure and Transitions',
    suggested_source_category: 'Self-authored CC BY lessons and practice',
    example_source: 'ElevatED authored curriculum',
    license_requirement: 'CC BY / original authored content',
    notes: 'Grade 4 expansion module added during 3-5 hardening pass.',
  },
  {
    grade: '5',
    subject: 'English Language Arts',
    strand: 'Reading Informational',
    topic: 'Text Structure and Transitions',
    suggested_source_category: 'Self-authored CC BY lessons and practice',
    example_source: 'ElevatED authored curriculum',
    license_requirement: 'CC BY / original authored content',
    notes: 'Grade 5 expansion module added during 3-5 hardening pass.',
  },
  {
    grade: '3',
    subject: 'Science',
    strand: 'Engineering Practices',
    topic: 'Planning Fair Tests',
    suggested_source_category: 'Self-authored CC BY lessons and practice',
    example_source: 'ElevatED authored curriculum',
    license_requirement: 'CC BY / original authored content',
    notes: 'Grade 3 expansion module added during 3-5 hardening pass.',
  },
  {
    grade: '4',
    subject: 'Science',
    strand: 'Engineering Practices',
    topic: 'Planning Fair Tests',
    suggested_source_category: 'Self-authored CC BY lessons and practice',
    example_source: 'ElevatED authored curriculum',
    license_requirement: 'CC BY / original authored content',
    notes: 'Grade 4 expansion module added during 3-5 hardening pass.',
  },
  {
    grade: '5',
    subject: 'Science',
    strand: 'Engineering Practices',
    topic: 'Planning Fair Tests',
    suggested_source_category: 'Self-authored CC BY lessons and practice',
    example_source: 'ElevatED authored curriculum',
    license_requirement: 'CC BY / original authored content',
    notes: 'Grade 5 expansion module added during 3-5 hardening pass.',
  },
];

const expansionStandards = (entry: SkeletonModule): string[] => {
  if (entry.subject === 'Mathematics') {
    return entry.grade === '3' ? ['3.OA.D.8'] : entry.grade === '4' ? ['4.OA.A.3'] : ['5.NBT.B.7'];
  }
  if (entry.subject === 'English Language Arts') {
    return [`CCSS.ELA-LITERACY.RI.${entry.grade}.5`, `CCSS.ELA-LITERACY.W.${entry.grade}.2`];
  }
  return ['3-5-ETS1-3'];
};

const expansionLesson = (entry: SkeletonModule): Lesson => ({
  title: entry.topic,
  summary: `${entry.topic} lesson for grade ${entry.grade} with direct instruction, modeling, guided checks, independent practice, and a summary.`,
  objectives: [
    `Explain the core idea of ${entry.topic.toLowerCase()}`,
    'Use evidence, models, or examples to solve a grade-level task',
    'Explain reasoning clearly and check for a common misconception',
  ],
  grade_band: `Grade ${entry.grade}`,
  subject: entry.subject,
  standards: expansionStandards(entry),
  outline: {
    hook: `Open with a concrete grade ${entry.grade} scenario for ${entry.topic}.`,
    direct_instruction: 'Teach vocabulary, model the strategy, and narrate the reasoning.',
    guided_practice: 'Students complete the guided check and explain their reasoning.',
    independent_practice: 'Students complete an independent task and write a short explanation.',
    check_for_understanding: 'Check for accurate vocabulary, evidence or model use, and a clear explanation.',
    exit_ticket: 'Students answer one aligned item and explain why the answer fits.',
    materials: ['Notebook or digital workspace', 'Pencil', 'Relevant diagram, text excerpt, or data table'],
  },
});

const options = (
  correct: string,
  wrongA: string,
  wrongB: string,
  wrongC: string,
  feedback: string,
): PracticeOption[] => [
  { text: correct, isCorrect: true, feedback },
  { text: wrongA, isCorrect: false, feedback: 'This choice does not match the evidence in the problem.' },
  { text: wrongB, isCorrect: false, feedback: 'Check the key words and compare them with the lesson idea.' },
  { text: wrongC, isCorrect: false, feedback: 'Try again by naming the concept before choosing.' },
];

const normalizeStandards = (lesson: Lesson): string[] => lesson.standards?.length ? lesson.standards : ['LOCAL.REVIEW'];

const mathProfile = (title: string, grade: string) => {
  const t = title.toLowerCase();
  const base = Number(grade);
  if (t.includes('bar') || t.includes('line plot')) {
    return {
      terms: ['Data', 'Scale', 'Category', 'Frequency'],
      context: 'A class survey compares favorite after-school activities.',
      example: `A bar graph shows ${base + 4} votes for reading, ${base + 7} votes for sports, and ${base + 2} votes for art.`,
      task: 'read the scale, compare two categories, and write one sentence about what the graph proves',
      mistake: 'reading the tallest bar but forgetting to use the number scale',
    };
  }
  if (t.includes('table') || t.includes('chart')) {
    return {
      terms: ['Table', 'Row', 'Column', 'Total'],
      context: 'A school garden chart tracks how many seedlings each team planted.',
      example: `Team A planted ${base + 5} seedlings, Team B planted ${base + 8}, and Team C planted ${base + 3}.`,
      task: 'use row and column labels before adding, subtracting, or comparing values',
      mistake: 'using a number from the chart without checking its label',
    };
  }
  if (t.includes('probability')) {
    return {
      terms: ['Outcome', 'Experiment', 'Likely', 'Unlikely'],
      context: 'A student pulls colored cubes from a bag and records the result.',
      example: `The bag has ${base + 3} blue cubes, ${base + 1} red cubes, and ${base} yellow cubes.`,
      task: 'compare possible outcomes and describe which result is more or less likely',
      mistake: 'treating one trial as proof of what will always happen',
    };
  }
  if (t.includes('mean') || t.includes('median') || t.includes('mode')) {
    return {
      terms: ['Mean', 'Median', 'Mode', 'Range'],
      context: 'A reading log shows how many pages students read each night.',
      example: `The page counts are ${base + 4}, ${base + 6}, ${base + 6}, ${base + 8}, and ${base + 11}.`,
      task: 'order the data, find the middle value, and decide which measure answers the question',
      mistake: 'finding the mean before checking whether the data are in order for the median',
    };
  }
  if (t.includes('angle') || t.includes('line')) {
    return {
      terms: ['Point', 'Line segment', 'Ray', 'Angle'],
      context: 'A playground map uses paths, corners, and turns.',
      example: 'Two paths meet at a corner near the slide, and students need to describe the turn accurately.',
      task: 'name the geometric feature and explain how the drawing shows it',
      mistake: 'calling every corner an angle without checking the two rays that form it',
    };
  }
  if (t.includes('area') || t.includes('perimeter')) {
    return {
      terms: ['Area', 'Perimeter', 'Unit square', 'Side length'],
      context: 'A class designs a rectangular garden bed.',
      example: `The bed is ${base + 3} feet long and ${base + 1} feet wide.`,
      task: 'decide whether to count inside squares for area or outside distance for perimeter',
      mistake: 'multiplying when the question asks for the border distance',
    };
  }
  if (t.includes('coordinate')) {
    return {
      terms: ['Coordinate plane', 'X-coordinate', 'Y-coordinate', 'Origin'],
      context: 'A treasure map uses ordered pairs to mark locations.',
      example: `The school garden is at (${base}, ${base + 2}) and the library is at (${base + 3}, ${base + 2}).`,
      task: 'move horizontally first, then vertically, and name the ordered pair',
      mistake: 'switching the x-coordinate and y-coordinate',
    };
  }
  if (t.includes('transformation')) {
    return {
      terms: ['Translate', 'Rotate', 'Reflect', 'Congruent'],
      context: 'A quilt pattern repeats the same shape in different positions.',
      example: 'One triangle slides right, one turns around a point, and one flips across a line.',
      task: 'describe the motion and explain what stayed the same',
      mistake: 'saying a shape changed size when it only moved',
    };
  }
  if (t.includes('volume')) {
    return {
      terms: ['Volume', 'Cubic unit', 'Layer', 'Rectangular prism'],
      context: 'Students pack unit cubes into a box.',
      example: `A box has ${base} cubes in each row, ${base + 1} rows in a layer, and ${base - 1} layers.`,
      task: 'count cubes by rows, layers, and total volume',
      mistake: 'counting only the front face instead of all layers',
    };
  }
  if (t.includes('decimal')) {
    return {
      terms: ['Decimal', 'Tenth', 'Hundredth', 'Place value'],
      context: 'A race time board shows distances and times with decimals.',
      example: `One student runs ${base}.4 laps and another runs ${base}.04 laps.`,
      task: 'compare digits by place value before deciding which number is greater',
      mistake: 'thinking more digits automatically means a larger number',
    };
  }
  if (t.includes('fraction')) {
    return {
      terms: ['Fraction', 'Numerator', 'Denominator', 'Equivalent fraction'],
      context: 'Students share trays of same-size granola bars.',
      example: `One tray shows ${base}/${base + 3} shaded and another shows an equivalent model with twice as many parts.`,
      task: 'compare the size of the parts and explain whether two fractions name the same amount',
      mistake: 'comparing only numerators without checking denominators',
    };
  }
  if (t.includes('multiplication') || t.includes('division')) {
    return {
      terms: ['Factor', 'Product', 'Quotient', 'Remainder'],
      context: 'A teacher arranges supplies into equal groups.',
      example: `${(base + 3) * 4} markers are shared equally among ${base + 1} table groups.`,
      task: 'represent the situation with an equation, array, or equal groups',
      mistake: 'multiplying when the story asks how many are in each group',
    };
  }
  if (t.includes('place value')) {
    return {
      terms: ['Digit', 'Place value', 'Expanded form', 'Period'],
      context: 'A museum attendance board shows large numbers from different days.',
      example: `The number ${base}4,${base + 2}68 has digits whose values depend on their places.`,
      task: 'name the value of each digit and write the number in expanded form',
      mistake: 'naming the digit but not its value',
    };
  }
  return {
    terms: ['Estimate', 'Round', 'Benchmark', 'Reasonableness'],
    context: 'A class plans supplies for a field day.',
    example: `${base + 18} students need snacks, and each box holds ${base + 7} snacks.`,
    task: 'round to friendly numbers, estimate, and compare the estimate with an exact answer',
    mistake: 'rounding every number the same way without thinking about the question',
  };
};

const buildMathMarkdown = (slug: string, lesson: Lesson): string => {
  const grade = gradeOf(lesson);
  const p = mathProfile(lesson.title, grade);
  const standards = normalizeStandards(lesson).join(', ');
  return `# ${lesson.title}

## Learning Goal
- I can explain the main idea of ${sentenceTopic(lesson)} in my own words.
- I can solve a grade ${grade} problem using a model, equation, or labeled diagram.
- I can check whether my answer makes sense and explain my strategy.

## Introduction
${p.context} This is the kind of situation where ${sentenceTopic(lesson)} becomes useful. The goal is not to memorize a trick. The goal is to slow down, name what the problem is asking, choose a representation, and use the numbers carefully.

Strong math work has three parts. First, identify the quantities and labels. Second, choose a model such as a drawing, table, number line, array, or equation. Third, explain why the answer fits the situation. If one of those parts is missing, the answer may be right by luck but hard to trust.

## Key Vocabulary
**${p.terms[0]}**: A key idea in this lesson that helps describe the problem accurately.

**${p.terms[1]}**: A label or tool that helps organize the numbers before solving.

**${p.terms[2]}**: A way to describe the size, position, or relationship shown in the model.

**${p.terms[3]}**: A check that helps you decide whether the final answer is reasonable.

## Learn The Big Idea
When you see a problem about ${sentenceTopic(lesson)}, start by asking, "What is being measured, counted, compared, or changed?" That question keeps the math connected to meaning.

For this lesson, use a three-step routine:

1. Read the question and underline the labels.
2. Build or sketch a model that shows the relationship.
3. Write an equation or explanation that matches the model.

The model should not be decoration. It should help you see where the answer comes from. A table can show repeated structure. A diagram can show parts and wholes. An equation can show the operation. A sentence can explain the reasoning so another person can follow it.

## Worked Example
${p.example}

Task: ${p.task}.

Step 1: Name the quantities. Write down each number with its label so the numbers do not float by themselves.

Step 2: Choose a model. For grade ${grade}, a clear model is often more useful than mental math because it shows the relationship. Sketch it simply and label the important parts.

Step 3: Solve. Use the model to decide which operation or comparison is needed. Then compute carefully.

Step 4: Check. Ask whether the answer is the right kind of quantity. If the problem asks for a comparison, the answer should compare. If it asks for a total, the answer should combine parts. If it asks for a measurement, the answer should include a unit.

## Guided Check
Try this with a partner or as a self-check:

- What are the labels in the problem?
- Which model would make the relationship easiest to see?
- What operation or comparison does the model suggest?
- How can you tell whether the answer is reasonable?

Explain your thinking in one complete sentence. A strong sentence might begin, "I know this because the model shows..."

## Common Mistake
A common mistake is ${p.mistake}. This mistake usually happens when students move too quickly from the numbers to an operation.

To avoid it, pause before calculating. Say what each number means. Then point to the part of the model where that number appears. If you cannot point to it, the model or equation needs more labels.

## Independent Practice
Create your own problem about ${sentenceTopic(lesson)} using a real classroom, sports, art, shopping, or science situation. Include at least two numbers and one clear question. Then solve it using:

- a labeled model
- an equation
- a sentence that explains why the answer makes sense

Swap with a partner if possible. Your partner should be able to solve the problem without asking what the numbers mean.

## Explain It Like A Mathematician
Before moving on, write a short explanation of the strategy. Use the words "because" and "so" at least once. The word "because" should connect your model to the operation or comparison. The word "so" should connect the computation to the final answer.

If the explanation is hard to write, that is useful information. It usually means one label is missing, one step happened too quickly, or the model does not show the relationship clearly enough yet. Revise the model first, then revise the sentence.

## Summary
${lesson.title} is strongest when the numbers stay connected to meaning. Good mathematicians label quantities, choose a useful representation, solve with care, and check the answer against the situation.

Remember the routine: name the quantities, model the relationship, solve, and explain. That routine will help you with today's topic and with harder problems later in the year.

<!-- generated_by: harden_grades_3_5_curriculum.ts; source_slug: ${slug}; standards: ${standards} -->`;
};

const elaProfile = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('biograph')) {
    return {
      textType: 'biography',
      passage: 'When Maya noticed that the town library had no ramp, she wrote letters, gathered neighbors, and helped the town council understand why access mattered.',
      terms: ['Biography', 'Chronology', 'Trait', 'Evidence'],
      skill: 'connect a person\'s actions to traits and impact',
      prompt: 'What trait does Maya show, and which detail proves it?',
    };
  }
  if (t.includes('nonfiction')) {
    return {
      textType: 'nonfiction article',
      passage: 'City gardeners sometimes plant native flowers because they need less water and give local insects familiar food sources.',
      terms: ['Main idea', 'Key detail', 'Text feature', 'Explanation'],
      skill: 'identify the main idea and explain how details support it',
      prompt: 'What is the main idea, and which detail supports it best?',
    };
  }
  if (t.includes('chapter')) {
    return {
      textType: 'chapter book scene',
      passage: 'Jonah wanted to quit the robotics club after the wheel snapped again, but he stayed after school and tested three new designs.',
      terms: ['Character', 'Motivation', 'Conflict', 'Inference'],
      skill: 'infer character motivation from actions and dialogue',
      prompt: 'What can you infer about Jonah, and what action supports that inference?',
    };
  }
  if (t.includes('myth') || t.includes('legend')) {
    return {
      textType: 'myth or legend',
      passage: 'The river spirit warned the villagers that the bridge would stand only if every family cared for the stones.',
      terms: ['Myth', 'Legend', 'Theme', 'Symbol'],
      skill: 'explain how a traditional story teaches a lesson',
      prompt: 'What lesson does the story suggest, and how does the bridge help show it?',
    };
  }
  if (t.includes('short stor')) {
    return {
      textType: 'short story',
      passage: 'At first Lena hid her sketchbook, but by the end of the contest she placed her drawing on the front table.',
      terms: ['Plot', 'Theme', 'Character change', 'Evidence'],
      skill: 'track how a character changes across a story',
      prompt: 'How does Lena change, and which detail shows the change?',
    };
  }
  if (t.includes('presentation') || t.includes('summar')) {
    return {
      textType: 'presentation or summary',
      passage: 'A strong speaker states the topic, shares two important facts, and ends by telling listeners why the idea matters.',
      terms: ['Summary', 'Main point', 'Audience', 'Supporting detail'],
      skill: 'summarize clearly for an audience',
      prompt: 'Which details should stay in a short summary, and which can be left out?',
    };
  }
  if (t.includes('root') || t.includes('prefix') || t.includes('suffix')) {
    return {
      textType: 'vocabulary study',
      passage: 'The word preview has the prefix pre-, which means before, so preview can mean to see before.',
      terms: ['Root', 'Prefix', 'Suffix', 'Context clue'],
      skill: 'use word parts and context to infer meaning',
      prompt: 'How does the prefix help you understand the word?',
    };
  }
  return {
    textType: 'writing and grammar task',
    passage: 'A clear paragraph begins with a focused idea, adds related details, and uses punctuation to help the reader follow the thinking.',
    terms: ['Topic sentence', 'Detail', 'Transition', 'Revision'],
    skill: 'write and revise a paragraph so ideas are clear',
    prompt: 'Which sentence gives the clearest focus for the paragraph?',
  };
};

const buildElaMarkdown = (slug: string, lesson: Lesson): string => {
  const grade = gradeOf(lesson);
  const p = elaProfile(lesson.title);
  const standards = normalizeStandards(lesson).join(', ');
  return `# ${lesson.title}

## Learning Goal
- I can read a grade ${grade} ${p.textType} closely.
- I can use evidence from the text to support an answer.
- I can explain my thinking in clear speaking or writing.

## Introduction
Strong readers do more than finish the words on the page. They notice what the author is doing, choose evidence carefully, and explain how that evidence supports an idea. In grade ${grade}, that means answers should include both a claim and a detail from the text.

Today's focus is ${sentenceTopic(lesson)}. You will practice the same routine that works across ELA: read once for the general meaning, reread for important details, then explain your answer with evidence. This routine helps whether you are reading a story, article, biography, poem, or your own draft.

## Key Vocabulary
**${p.terms[0]}**: A word that names the kind of reading or writing move used in this lesson.

**${p.terms[1]}**: A feature that helps readers organize or interpret information.

**${p.terms[2]}**: A detail you can notice and explain, not just copy.

**${p.terms[3]}**: A sentence, phrase, action, or example from the text that supports your thinking.

## Text Focus
Read this short practice passage:

> ${p.passage}

First read for the gist. Ask, "What is mostly happening or being explained?" Then reread and mark two details that seem important. A detail is useful when it helps answer the question, not just when it sounds interesting.

## Model The Skill
The target skill is to ${p.skill}. A strong answer does three things:

1. It answers the question directly.
2. It uses a specific detail from the passage.
3. It explains how the detail proves the idea.

Question: ${p.prompt}

Model response:

"The passage shows the main idea through a specific action or explanation. One important detail is that the text says, '${p.passage.split(' ').slice(0, 12).join(' ')}...' This detail matters because it gives readers evidence instead of only an opinion."

The model is not long, but it is complete. It makes a claim, points to evidence, and explains the evidence.

## Guided Practice
Use this evidence frame:

- My answer is ___.
- The text says ___.
- This proves or shows ___ because ___.

Now reread the passage and choose a different detail. Ask whether the detail truly supports the answer. If it does not, choose a stronger one. In ELA, the best evidence is not always the longest quote. The best evidence is the detail that most directly proves your point.

## Common Mistake
A common mistake is writing an answer that sounds reasonable but has no text evidence. Another common mistake is copying a detail without explaining it. Evidence and explanation need to work together.

Weak answer: "The character is responsible."

Stronger answer: "The character is responsible because the passage shows a specific action. That action proves responsibility because the character keeps working even when the task is difficult."

## Independent Practice
Find a paragraph in your current reading book or article. Write one question about ${sentenceTopic(lesson)}. Then answer it using the three-part frame: answer, evidence, explanation.

If you are writing instead of reading, choose one sentence from your own draft. Explain what job that sentence does and revise it to make the job clearer.

## Discussion Check
Share your answer with a partner or tutor. The listener should ask, "Where do you see that in the text?" Point to the exact word, phrase, sentence, or story event that supports your answer. Then explain why that detail is stronger than a less connected detail.

This check matters because ELA evidence is not just something copied from a page. Evidence has a job. It must prove the answer. When you can defend your evidence choice, your reading and writing become more precise.

## Summary
The most important habit in ${lesson.title} is using evidence on purpose. Read for meaning, reread for details, and explain how the evidence supports your answer. A strong grade ${grade} response is clear enough that another reader can see exactly where your thinking came from.

<!-- generated_by: harden_grades_3_5_curriculum.ts; source_slug: ${slug}; standards: ${standards} -->`;
};

const scienceProfile = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('geosphere') || t.includes('hydrosphere')) {
    return ['a hillside after heavy rain', 'water can move soil and change landforms', 'geosphere', 'hydrosphere', 'erosion', 'model'];
  }
  if (t.includes('resources')) {
    return ['a classroom comparing paper, metal, water, and sunlight', 'natural resources come from Earth and can be used in different ways', 'natural resource', 'renewable', 'nonrenewable', 'conservation'];
  }
  if (t.includes('solar')) {
    return ['a scale model of the Sun, Earth, and Moon', 'objects in space have patterns and very different sizes and distances', 'orbit', 'rotation', 'scale', 'model'];
  }
  if (t.includes('weather') || t.includes('climate')) {
    return ['a week of temperature, cloud, and precipitation data', 'weather is daily condition while climate is a longer pattern', 'weather', 'climate', 'precipitation', 'data'];
  }
  if (t.includes('criteria') || t.includes('constraints')) {
    return ['a team designing a bridge from limited materials', 'engineers use criteria and constraints to judge designs', 'criterion', 'constraint', 'prototype', 'tradeoff'];
  }
  if (t.includes('prototype') || t.includes('iteration')) {
    return ['a paper tower that improves after each test', 'testing helps engineers improve a design', 'prototype', 'test', 'iteration', 'redesign'];
  }
  if (t.includes('adaptation')) {
    return ['birds with different beaks collecting different foods', 'body structures and behaviors can help organisms survive', 'adaptation', 'trait', 'habitat', 'survival'];
  }
  if (t.includes('ecosystem') || t.includes('food')) {
    return ['a pond food web with algae, insects, fish, and birds', 'energy moves through ecosystems as organisms eat and are eaten', 'ecosystem', 'producer', 'consumer', 'food web'];
  }
  if (t.includes('heredity')) {
    return ['young plants that look similar to parent plants but not exactly the same', 'organisms inherit traits and also show variation', 'inherited trait', 'variation', 'offspring', 'parent'];
  }
  if (t.includes('human body')) {
    return ['a runner breathing hard after exercise', 'body systems work together to meet needs', 'organ', 'system', 'function', 'interaction'];
  }
  if (t.includes('energy')) {
    return ['a metal spoon warming in a cup of hot cocoa', 'energy can transfer from warmer objects to cooler objects', 'energy', 'transfer', 'temperature', 'conduction'];
  }
  if (t.includes('forces')) {
    return ['a cart that moves when one push is stronger than the opposite push', 'balanced and unbalanced forces affect motion', 'force', 'motion', 'balanced force', 'unbalanced force'];
  }
  if (t.includes('matter')) {
    return ['ice melting into water and water evaporating', 'matter is made of particles and can change state', 'matter', 'particle', 'state', 'change'];
  }
  return ['a drum, a flashlight, and a ripple tank', 'waves transfer energy through patterns of motion', 'wave', 'amplitude', 'wavelength', 'energy'];
};

const buildScienceMarkdown = (slug: string, lesson: Lesson): string => {
  const grade = gradeOf(lesson);
  const [phenomenon, bigIdea, termA, termB, termC, termD] = scienceProfile(lesson.title);
  const standards = normalizeStandards(lesson).join(', ');
  return `# ${lesson.title}

## Learning Goal
- I can describe an observable phenomenon connected to ${sentenceTopic(lesson)}.
- I can use evidence from a model, data table, or investigation.
- I can write a claim with evidence and reasoning.

## Introduction
Science starts with something we can observe. For this lesson, imagine ${phenomenon}. A scientist would not stop at saying, "That is interesting." A scientist would ask what pattern can be observed, what evidence can be collected, and what explanation best fits the evidence.

The big idea is that ${bigIdea}. In grade ${grade}, your job is to connect observations to explanations. That means using claim, evidence, and reasoning instead of guessing.

## Key Vocabulary
**${termA}**: A core science idea that helps name what is being studied.

**${termB}**: A related idea that helps explain the pattern or system.

**${termC}**: Evidence or a process scientists can observe, measure, or model.

**${termD}**: A tool for explaining how the parts of the system work together.

## Phenomenon To Explain
Look closely at the phenomenon: ${phenomenon}. Record three observations before making an explanation.

Good observations are specific:

- "The water moved soil downhill" is stronger than "It changed."
- "The cart sped up when the push was stronger" is stronger than "The cart moved."
- "The data were higher on warmer days" is stronger than "The weather was different."

Specific observations become useful evidence.

## Build The Explanation
Use this science routine:

1. **Claim:** Say what you think is happening.
2. **Evidence:** Name the observation, data point, or model feature that supports the claim.
3. **Reasoning:** Explain why the evidence supports the claim using science vocabulary.

Example claim:

"The phenomenon shows ${bigIdea}."

Example evidence:

"One observation is that the system changes when a part of it changes."

Example reasoning:

"This supports the claim because ${termA} and ${termB} are connected in the system. When the evidence changes, it helps reveal the process."

## Investigation Model
A simple classroom investigation can make the idea clearer. Set up a safe model using classroom materials, a drawing, a data table, or a teacher-approved video. Change only one variable at a time. Record what happens before and after the change.

Data table:

| Trial | What changed? | What did we observe? |
| --- | --- | --- |
| 1 | No change | Record the starting observation |
| 2 | One variable changed | Record the new observation |
| 3 | Repeat or compare | Look for a pattern |

The pattern matters more than a single result. Scientists look for evidence that repeats or fits with a model.

## Common Mistake
A common mistake is making a claim without evidence. Another mistake is listing evidence without explaining what it means. A complete science answer needs all three parts: claim, evidence, and reasoning.

Weak answer: "It happened because of science."

Stronger answer: "The model shows a pattern. The evidence is ___. This supports the claim because ___."

## Independent Practice
Write a short CER response:

- Claim: What is happening in the phenomenon?
- Evidence: What observation or data supports your claim?
- Reasoning: Which vocabulary term explains why the evidence matters?

Then draw a quick model. Label at least three parts. Your model should help another student understand the explanation without rereading the whole lesson.

## Revise The Model
Scientists often improve models after they explain them. Look at your drawing or table and ask three questions. Did I label the important parts? Did I show the direction of a process, force, flow, or change when direction matters? Did I include the evidence that supports my claim?

If the model does not answer those questions yet, revise it. Revision is not a sign that the first model was bad. It is part of scientific thinking. A better model makes the explanation easier to test, discuss, and improve.

## Summary
${lesson.title} is about using evidence to explain a pattern in the natural or designed world. Start with careful observations, collect or study evidence, and connect that evidence to a science idea. When your claim, evidence, and reasoning fit together, your explanation becomes stronger than a guess.

<!-- generated_by: harden_grades_3_5_curriculum.ts; source_slug: ${slug}; standards: ${standards} -->`;
};

const updateLesson = async (
  sourceFile: string,
  slug: string,
  lesson: Lesson,
  markdown: string,
): Promise<void> => {
  if (lesson.content_markdown_file) {
    const markdownPath = path.join(ROOT, 'data/lessons', lesson.content_markdown_file);
    if (APPLY) {
      await fs.mkdir(path.dirname(markdownPath), { recursive: true });
      await fs.writeFile(markdownPath, `${markdown.trim()}\n`);
    }
  } else {
    lesson.content_markdown = markdown.trim();
  }

  lesson.summary = `${lesson.title} lesson for grade ${gradeOf(lesson)} with direct instruction, a model, guided checks, independent practice, and a summary.`;
  lesson.objectives = [
    `Explain the core idea of ${sentenceTopic(lesson)}`,
    'Use evidence, models, or examples to solve a grade-level task',
    'Explain reasoning clearly and check for a common misconception',
  ];
  lesson.outline = {
    hook: `Open with the lesson phenomenon or scenario from the full markdown body for ${lesson.title}.`,
    direct_instruction: `Teach the key vocabulary, model the central strategy, and explain the worked example in the full markdown body.`,
    guided_practice: 'Students answer the guided check questions and explain their reasoning with labels or evidence.',
    independent_practice: 'Students complete the independent practice task and write a short explanation.',
    check_for_understanding: 'Look for accurate vocabulary, a useful model or evidence choice, and a reasonableness check.',
    exit_ticket: 'Students answer one aligned practice question and explain why the correct answer fits.',
    materials: ['Notebook or digital workspace', 'Pencil', 'Relevant diagram, text excerpt, or data table'],
  };
};

const buildPractice = (slug: string, lesson: Lesson): PracticeItem[] => {
  const grade = gradeOf(lesson);
  const standards = normalizeStandards(lesson);
  const skill = skillName(slug);
  const title = cleanTitle(lesson.title);
  const subject = lesson.subject;

  if (subject === 'Mathematics') {
    const p = mathProfile(title, grade);
    return [
      {
        prompt: `In ${title}, why should a student label the numbers before solving?`,
        type: 'multiple_choice',
        difficulty: 1,
        explanation: 'Labels show what each number represents and help the student choose the correct operation.',
        skills: [skill],
        standards,
        tags: ['practice', 'reasoning', 'grade-3-5-hardening'],
        options: options('Labels connect each number to its meaning.', 'Labels make the answer longer.', 'Labels replace the need to calculate.', 'Labels are only useful for word problems with money.', 'Correct. Labels protect the meaning of the quantities.'),
      },
      {
        prompt: `A student working on ${title} gets an answer but cannot explain the model. What should the student do next?`,
        type: 'multiple_choice',
        difficulty: 2,
        explanation: 'The student should connect the answer back to a labeled model or equation.',
        skills: [skill],
        standards,
        tags: ['practice', 'modeling', 'grade-3-5-hardening'],
        options: options('Connect the answer to a labeled model or equation.', 'Erase the model and keep only the answer.', 'Choose a larger number.', 'Round every number to the nearest ten.', 'Correct. A model makes the reasoning visible.'),
      },
      {
        prompt: `${p.example} Which first step best supports the task: ${p.task}?`,
        type: 'multiple_choice',
        difficulty: 2,
        explanation: 'The first step is to identify the quantities and labels before choosing a model.',
        skills: [skill],
        standards,
        tags: ['practice', 'strategy', 'grade-3-5-hardening'],
        options: options('Identify the quantities and labels.', 'Guess the operation from the biggest number.', 'Write only the final answer.', 'Ignore the context and calculate quickly.', 'Correct. The labels tell what the numbers mean.'),
      },
      {
        prompt: `Which explanation is strongest for a ${title} solution?`,
        type: 'multiple_choice',
        difficulty: 3,
        explanation: 'A strong explanation names the model, the operation or comparison, and the reason the answer fits.',
        skills: [skill],
        standards,
        tags: ['practice', 'explanation', 'grade-3-5-hardening'],
        options: options('I used the labeled model to choose the operation, and the answer fits the question.', 'I got the answer because it looked right.', 'I used the first operation I remembered.', 'I copied the biggest number from the problem.', 'Correct. This answer explains both strategy and meaning.'),
      },
    ];
  }

  if (subject === 'English Language Arts') {
    const p = elaProfile(title);
    return [
      {
        prompt: `In this passage, which detail would be best evidence for ${p.skill}? "${p.passage}"`,
        type: 'multiple_choice',
        difficulty: 2,
        explanation: 'The strongest evidence is the detail that directly supports the reading or writing claim.',
        skills: [skill],
        standards,
        tags: ['practice', 'evidence', 'grade-3-5-hardening'],
        options: options(p.passage.split(' ').slice(0, 10).join(' '), 'The passage has words.', 'The paragraph is short.', 'The title sounds interesting.', 'Correct. This choice uses an actual detail from the passage.'),
      },
      {
        prompt: `What makes a grade ${grade} response to ${title} complete?`,
        type: 'multiple_choice',
        difficulty: 1,
        explanation: 'A complete ELA response answers the question, uses evidence, and explains the evidence.',
        skills: [skill],
        standards,
        tags: ['practice', 'constructed-response', 'grade-3-5-hardening'],
        options: options('It gives an answer, evidence, and explanation.', 'It repeats the question only.', 'It uses the longest sentence from the passage without explanation.', 'It gives an opinion with no text detail.', 'Correct. Claim, evidence, and explanation work together.'),
      },
      {
        prompt: `A student quotes a detail for ${title} but does not explain it. What is missing?`,
        type: 'multiple_choice',
        difficulty: 2,
        explanation: 'The student needs commentary explaining how the evidence proves the answer.',
        skills: [skill],
        standards,
        tags: ['practice', 'analysis', 'grade-3-5-hardening'],
        options: options('An explanation of how the evidence supports the answer.', 'A new unrelated quote.', 'A harder vocabulary word.', 'A drawing instead of any writing.', 'Correct. Evidence needs explanation.'),
      },
      {
        prompt: `Which sentence starter best supports ${title}?`,
        type: 'multiple_choice',
        difficulty: 2,
        explanation: 'This sentence starter links the answer to text evidence.',
        skills: [skill],
        standards,
        tags: ['practice', 'writing', 'grade-3-5-hardening'],
        options: options('The text shows this when...', 'I do not need the text because...', 'The answer is right because I like it.', 'There is no detail to use.', 'Correct. The starter points back to evidence.'),
      },
    ];
  }

  const [phenomenon, bigIdea, termA, termB] = scienceProfile(title);
  return [
    {
      prompt: `Which observation best starts an investigation of ${title}?`,
      type: 'multiple_choice',
      difficulty: 1,
      explanation: 'A useful science observation is specific and connected to the phenomenon.',
      skills: [skill],
      standards,
      tags: ['practice', 'phenomenon', 'grade-3-5-hardening'],
      options: options(`A specific observation about ${phenomenon}.`, 'I like science.', 'The lesson has a title.', 'The answer is probably simple.', 'Correct. Science explanations start with specific observations.'),
    },
    {
      prompt: `For ${title}, what belongs in the evidence part of a CER response?`,
      type: 'multiple_choice',
      difficulty: 2,
      explanation: 'Evidence should be an observation, data point, or model feature.',
      skills: [skill],
      standards,
      tags: ['practice', 'cer', 'grade-3-5-hardening'],
      options: options('An observation, data point, or model feature.', 'A guess with no support.', 'Only the vocabulary word.', 'A sentence about liking the topic.', 'Correct. Evidence is something observed, measured, or shown.'),
    },
    {
      prompt: `Which claim best matches this science idea: ${bigIdea}?`,
      type: 'multiple_choice',
      difficulty: 2,
      explanation: 'The best claim states the science relationship clearly.',
      skills: [skill],
      standards,
      tags: ['practice', 'claim', 'grade-3-5-hardening'],
      options: options(`${termA} and ${termB} are connected in a system or process.`, 'Nothing in the system changes.', 'The evidence does not matter.', 'The model should not be labeled.', 'Correct. The claim names a science relationship.'),
    },
    {
      prompt: `Why should a model for ${title} include labels?`,
      type: 'multiple_choice',
      difficulty: 2,
      explanation: 'Labels show how parts of the model connect to the explanation.',
      skills: [skill],
      standards,
      tags: ['practice', 'modeling', 'grade-3-5-hardening'],
      options: options('Labels show what each part represents and how the parts connect.', 'Labels make the model decorative.', 'Labels replace evidence.', 'Labels are only for art class.', 'Correct. Labels make the science reasoning clear.'),
    },
  ];
};

const processLessonFile = async (
  relativePath: string,
  subject: 'Mathematics' | 'English Language Arts' | 'Science',
): Promise<{ lessons: number; markdownWords: number[] }> => {
  const data = await readJson<LessonConfig>(relativePath);
  const markdownWords: number[] = [];
  let lessons = 0;

  for (const [slug, lesson] of Object.entries(data)) {
    if (lesson.subject !== subject || !TARGET_GRADES.has(gradeOf(lesson))) continue;

    const markdown =
      subject === 'Mathematics'
        ? buildMathMarkdown(slug, lesson)
        : subject === 'English Language Arts'
          ? buildElaMarkdown(slug, lesson)
          : buildScienceMarkdown(slug, lesson);
    await updateLesson(relativePath, slug, lesson, markdown);
    markdownWords.push(wordCount(markdown));
    lessons += 1;
  }

  await writeJson(relativePath, data);
  return { lessons, markdownWords };
};

const processPracticeFile = async (
  lessonRelativePath: string,
  practiceRelativePath: string,
  subject: 'Mathematics' | 'English Language Arts' | 'Science',
): Promise<number> => {
  const lessons = await readJson<LessonConfig>(lessonRelativePath);
  const practice = await readJson<Record<string, PracticeItem[]>>(practiceRelativePath);
  let modules = 0;

  for (const [slug, lesson] of Object.entries(lessons)) {
    if (lesson.subject !== subject || !TARGET_GRADES.has(gradeOf(lesson))) continue;
    practice[slug] = buildPractice(slug, lesson);
    modules += 1;
  }

  await writeJson(practiceRelativePath, practice);
  return modules;
};

const ensureExpansionSources = async (): Promise<number> => {
  const skeleton = await readJson<SkeletonModule[]>('data/curriculum/ElevatED_K12_Curriculum_Skeleton.json');
  const skeletonKeys = new Set(skeleton.map((entry) => buildModuleSlug(entry)));
  let added = 0;

  for (const entry of EXPANSION_MODULES) {
    const slug = buildModuleSlug(entry);
    if (!skeletonKeys.has(slug)) {
      skeleton.push(entry);
      skeletonKeys.add(slug);
      added += 1;
    }
  }
  await writeJson('data/curriculum/ElevatED_K12_Curriculum_Skeleton.json', skeleton);

  const mathLessons = await readJson<LessonConfig>('data/lessons/authored_launch_lessons.json');
  const elaLessons = await readJson<LessonConfig>('data/lessons/ela_authored_launch_lessons.json');
  const scienceLessons = await readJson<LessonConfig>('data/lessons/science_authored_launch_lessons.json');

  for (const entry of EXPANSION_MODULES) {
    const slug = buildModuleSlug(entry);
    const target =
      entry.subject === 'Mathematics'
        ? mathLessons
        : entry.subject === 'English Language Arts'
          ? elaLessons
          : scienceLessons;
    target[slug] = target[slug] ?? expansionLesson(entry);
  }

  await writeJson('data/lessons/authored_launch_lessons.json', mathLessons);
  await writeJson('data/lessons/ela_authored_launch_lessons.json', elaLessons);
  await writeJson('data/lessons/science_authored_launch_lessons.json', scienceLessons);

  return added;
};

const ensureExpansionQuizzes = async (): Promise<number> => {
  const quizzes = await readJson<Record<string, QuizDefinition>>('data/assessments/module_quizzes_authored.json');
  const lessonSources = {
    Mathematics: await readJson<LessonConfig>('data/lessons/authored_launch_lessons.json'),
    'English Language Arts': await readJson<LessonConfig>('data/lessons/ela_authored_launch_lessons.json'),
    Science: await readJson<LessonConfig>('data/lessons/science_authored_launch_lessons.json'),
  };
  let upserted = 0;

  for (const entry of EXPANSION_MODULES) {
    const slug = buildModuleSlug(entry);
    const lesson = lessonSources[entry.subject as keyof typeof lessonSources][slug];
    if (!lesson) continue;
    const questions = buildPractice(slug, lesson).map((question, index) => ({
      ...question,
      tags: [...question.tags, 'module-quiz'],
      difficulty: Math.min(3, question.difficulty + (index === 3 ? 1 : 0)),
    }));
    quizzes[slug] = {
      title: `${lesson.title} Checkpoint`,
      description: `Baseline quiz for grade ${entry.grade} ${entry.subject}: ${lesson.title}.`,
      estimatedDuration: 10,
      standards: normalizeStandards(lesson),
      questions,
    };
    upserted += 1;
  }

  await writeJson('data/assessments/module_quizzes_authored.json', quizzes);
  return upserted;
};

const main = async () => {
  console.log(`${APPLY ? 'Applying' : 'Previewing'} grade 3-5 curriculum hardening...`);

  const expansionModulesAdded = await ensureExpansionSources();

  const lessonResults = [
    await processLessonFile('data/lessons/authored_launch_lessons.json', 'Mathematics'),
    await processLessonFile('data/lessons/ela_authored_launch_lessons.json', 'English Language Arts'),
    await processLessonFile('data/lessons/science_authored_launch_lessons.json', 'Science'),
  ];

  const practiceResults = [
    await processPracticeFile(
      'data/lessons/authored_launch_lessons.json',
      'data/practice/authored_practice_items.json',
      'Mathematics',
    ),
    await processPracticeFile(
      'data/lessons/ela_authored_launch_lessons.json',
      'data/practice/ela_authored_practice_items.json',
      'English Language Arts',
    ),
    await processPracticeFile(
      'data/lessons/science_authored_launch_lessons.json',
      'data/practice/science_authored_practice_items.json',
      'Science',
    ),
  ];

  const expansionQuizzes = await ensureExpansionQuizzes();

  const words = lessonResults.flatMap((result) => result.markdownWords);
  const avgWords = words.length ? Math.round(words.reduce((sum, value) => sum + value, 0) / words.length) : 0;
  const minWords = words.length ? Math.min(...words) : 0;
  const maxWords = words.length ? Math.max(...words) : 0;

  console.log(`Expansion modules added to skeleton: ${expansionModulesAdded}`);
  console.log(`Expansion quiz definitions upserted: ${expansionQuizzes}`);
  console.log(`Lessons hardened: ${lessonResults.reduce((sum, result) => sum + result.lessons, 0)}`);
  console.log(`Practice modules rewritten: ${practiceResults.reduce((sum, value) => sum + value, 0)}`);
  console.log(`Markdown word count: avg ${avgWords}, min ${minWords}, max ${maxWords}`);

  if (!APPLY) {
    console.log('No files were written. Re-run with --apply to update source files.');
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
