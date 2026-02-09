import type { LessonPracticeQuestion } from '../types';
import { getPracticeQuestionVisual } from './lessonVisuals';

const normalize = (value: string | null | undefined): string => (value ?? '').toString().trim().toLowerCase();

const includesAny = (value: string, needles: string[]): boolean => needles.some((needle) => value.includes(needle));

const parseGrade = (gradeBand: string | null | undefined): number | null => {
  const match = (gradeBand ?? '').toString().match(/\d+/);
  if (!match) return null;
  const value = Number.parseInt(match[0] ?? '', 10);
  return Number.isFinite(value) ? value : null;
};

const extractPositiveIntegers = (text: string | null | undefined): number[] => {
  const matches = (text ?? '').toString().match(/\b\d+\b/g) ?? [];
  return matches
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 999);
};

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

export type K5MathAdaptationTopic =
  | 'place_value'
  | 'addition_subtraction'
  | 'multiplication_division'
  | 'fractions'
  | 'measurement'
  | 'geometry_perimeter_area'
  | 'data_graphing';

export type K5MathQuickReview = {
  title: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: K5MathAdaptationTopic;
};

export type K5MathCheckpointIntent = 'define' | 'compute' | 'scenario';

export type K5MathCheckpointPayload = {
  visual?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type K5MathTopicTemplate = {
  hint: string;
  steps: string[];
};

const TOPIC_INDEX: Record<K5MathAdaptationTopic, number> = {
  place_value: 1,
  addition_subtraction: 2,
  multiplication_division: 3,
  fractions: 4,
  measurement: 5,
  geometry_perimeter_area: 6,
  data_graphing: 7,
};

const TOPIC_KEYWORDS: Array<{ topic: K5MathAdaptationTopic; needles: string[] }> = [
  {
    topic: 'fractions',
    needles: ['fraction', 'numerator', 'denominator', 'equivalent', 'unit fraction'],
  },
  {
    topic: 'multiplication_division',
    needles: ['multiply', 'multiplication', 'divide', 'division', 'product', 'quotient', 'array', 'factor'],
  },
  {
    topic: 'place_value',
    needles: ['place value', 'hundreds', 'tens', 'ones', 'expanded form', 'compare numbers', 'digit value'],
  },
  {
    topic: 'geometry_perimeter_area',
    needles: ['perimeter', 'area', 'rectangle', 'square', 'triangle', 'polygon'],
  },
  {
    topic: 'measurement',
    needles: ['measure', 'measurement', 'length', 'weight', 'mass', 'volume', 'time', 'money', 'ruler', 'inch', 'centimeter'],
  },
  {
    topic: 'data_graphing',
    needles: ['data', 'bar graph', 'line plot', 'table', 'chart', 'graph', 'survey'],
  },
  {
    topic: 'addition_subtraction',
    needles: ['add', 'subtract', 'sum', 'difference', 'more than', 'fewer than'],
  },
];

const TOPIC_TEMPLATES: Record<K5MathAdaptationTopic, K5MathTopicTemplate> = {
  place_value: {
    hint: 'Read each digit by place from left to right.',
    steps: [
      'Find the target digit.',
      'Name its place value.',
      'Convert the digit to its value in that place.',
    ],
  },
  addition_subtraction: {
    hint: 'Look for clue words like "more" for add and "left" for subtract.',
    steps: [
      'Choose the operation from the context.',
      'Compute carefully using place value.',
      'Check if the answer matches the story.',
    ],
  },
  multiplication_division: {
    hint: 'Use equal groups to decide between multiplication and division.',
    steps: [
      'Identify number of groups and amount in each group.',
      'Multiply for total or divide for groups/each.',
      'Estimate to verify the result is reasonable.',
    ],
  },
  fractions: {
    hint: 'Denominator = total equal parts, numerator = selected parts.',
    steps: [
      'Count all equal parts first.',
      'Count the shaded/selected parts.',
      'Write numerator over denominator and simplify if needed.',
    ],
  },
  measurement: {
    hint: 'Match the attribute to the tool and unit that measure it.',
    steps: [
      'Decide what attribute is measured (length, mass, time, etc.).',
      'Pick the best measuring tool.',
      'Use or convert units with the same attribute.',
    ],
  },
  geometry_perimeter_area: {
    hint: 'Perimeter is around; area is the inside space.',
    steps: [
      'Identify whether the question asks for perimeter or area.',
      'Use the matching formula or counting strategy.',
      'Include units (and square units for area).',
    ],
  },
  data_graphing: {
    hint: 'Read the title, labels, and scale before comparing values.',
    steps: [
      'Find the category labels.',
      'Read each value using the graph scale.',
      'Compare values and answer with evidence from the graph.',
    ],
  },
};

const getDefaultTopicForGrade = (grade: number): K5MathAdaptationTopic => {
  if (grade <= 1) return 'addition_subtraction';
  if (grade === 2) return 'place_value';
  if (grade === 3) return 'multiplication_division';
  if (grade === 4) return 'fractions';
  return 'geometry_perimeter_area';
};

const resolveTopic = (input: {
  subject: string | null | undefined;
  gradeBand: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
  topic?: K5MathAdaptationTopic | null;
}): K5MathAdaptationTopic | null => {
  if (input.topic) return input.topic;
  const subject = normalize(input.subject);
  const grade = parseGrade(input.gradeBand);
  if (!subject.includes('math') || grade == null || grade < 0 || grade > 5) return null;

  const text = normalize([input.lessonTitle, input.lessonContent, input.questionPrompt].filter(Boolean).join(' '));
  for (const entry of TOPIC_KEYWORDS) {
    if (includesAny(text, entry.needles)) {
      return entry.topic;
    }
  }

  return getDefaultTopicForGrade(grade);
};

const toQuestionSeed = (lessonId?: number): number => {
  if (!Number.isFinite(lessonId)) return 1;
  return Math.max(1, Math.floor(lessonId as number));
};

export const getK5MathAdaptationTopic = (input: {
  subject: string | null | undefined;
  gradeBand: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
}): K5MathAdaptationTopic | null => resolveTopic(input);

export const isK5MathAdaptiveLesson = (input: {
  subject: string | null | undefined;
  gradeBand: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
}): boolean => Boolean(resolveTopic(input));

export const getDeterministicK5MathHint = (input: {
  subject: string | null | undefined;
  gradeBand: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
  topic?: K5MathAdaptationTopic | null;
}): string | null => {
  const topic = resolveTopic(input);
  if (!topic) return null;
  return TOPIC_TEMPLATES[topic].hint;
};

export const getDeterministicK5MathSteps = (input: {
  subject: string | null | undefined;
  gradeBand: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
  topic?: K5MathAdaptationTopic | null;
}): string[] | null => {
  const topic = resolveTopic(input);
  if (!topic) return null;
  return TOPIC_TEMPLATES[topic].steps.slice(0, 4);
};

export const getDeterministicK5MathQuickReview = (input: {
  lessonId?: number;
  subject: string | null | undefined;
  gradeBand: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
  topic?: K5MathAdaptationTopic | null;
}): K5MathQuickReview | null => {
  const topic = resolveTopic(input);
  if (!topic) return null;

  const seed = toQuestionSeed(input.lessonId);
  const values = extractPositiveIntegers([input.lessonContent, input.questionPrompt, input.lessonTitle].filter(Boolean).join(' '));
  const rand = mulberry32(seed + 13);

  if (topic === 'place_value') {
    const number = values.find((value) => value >= 100 && value <= 999) ?? (200 + Math.floor(rand() * 700));
    const tens = Math.floor((number % 100) / 10);
    return {
      title: 'Quick Review',
      prompt: `In ${number}, what value does the digit ${tens} represent?`,
      options: [`${tens * 10}`, `${tens}`, `${tens * 100}`],
      correctIndex: 0,
      explanation: 'The tens digit represents groups of ten.',
      topic,
    };
  }

  if (topic === 'addition_subtraction') {
    return {
      title: 'Quick Review',
      prompt: 'A story asks "how many are left." Which operation fits best?',
      options: ['Subtraction', 'Addition', 'Multiplication'],
      correctIndex: 0,
      explanation: '"Left" means we remove or compare amounts, so subtract.',
      topic,
    };
  }

  if (topic === 'multiplication_division') {
    const groupCount = values[0] ?? (3 + Math.floor(rand() * 4));
    const groupSize = values[1] ?? (4 + Math.floor(rand() * 4));
    return {
      title: 'Quick Review',
      prompt: `${groupCount} groups of ${groupSize} means which equation?`,
      options: [`${groupCount} x ${groupSize}`, `${groupCount} + ${groupSize}`, `${groupCount} - ${groupSize}`],
      correctIndex: 0,
      explanation: 'Equal groups are modeled with multiplication.',
      topic,
    };
  }

  if (topic === 'fractions') {
    const denominator = Math.max(2, Math.min(12, values[0] ?? (4 + Math.floor(rand() * 5))));
    const numerator = Math.max(1, Math.min(denominator - 1, values[1] ?? Math.floor(denominator / 2)));
    return {
      title: 'Quick Review',
      prompt: `If ${numerator} of ${denominator} equal parts are shaded, which fraction matches?`,
      options: [`${numerator}/${denominator}`, `${denominator}/${numerator}`, `${numerator + denominator}/${denominator}`],
      correctIndex: 0,
      explanation: 'The numerator counts selected parts and the denominator counts all equal parts.',
      topic,
    };
  }

  if (topic === 'measurement') {
    return {
      title: 'Quick Review',
      prompt: 'Which tool is best for measuring the length of a notebook?',
      options: ['A ruler', 'A thermometer', 'A scale'],
      correctIndex: 0,
      explanation: 'A ruler is used for measuring length.',
      topic,
    };
  }

  if (topic === 'data_graphing') {
    return {
      title: 'Quick Review',
      prompt: 'Before answering graph questions, what should you read first?',
      options: ['The title, labels, and scale', 'Only the first bar', 'Only the biggest number'],
      correctIndex: 0,
      explanation: 'Title, labels, and scale tell you what values the graph represents.',
      topic,
    };
  }

  return {
    title: 'Quick Review',
    prompt: 'Which statement about area is true?',
    options: ['Area measures space inside a shape', 'Area measures distance around a shape', 'Area is always measured in inches only'],
    correctIndex: 0,
    explanation: 'Area describes the amount of space inside a shape in square units.',
    topic,
  };
};

const toOptionSet = (correct: string, wrongs: string[]): string[] => [correct, ...wrongs.slice(0, 3)];

export const getDeterministicK5MathCheckpoint = (input: {
  subject: string | null | undefined;
  gradeBand: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  topic?: K5MathAdaptationTopic | null;
  intent: K5MathCheckpointIntent;
  seed: number;
}): K5MathCheckpointPayload | null => {
  const topic = resolveTopic({
    subject: input.subject,
    gradeBand: input.gradeBand,
    lessonTitle: input.lessonTitle,
    lessonContent: input.lessonContent,
    topic: input.topic,
  });
  if (!topic) return null;

  const values = extractPositiveIntegers([input.lessonTitle, input.lessonContent].filter(Boolean).join(' '));
  const rand = mulberry32(input.seed);

  if (topic === 'place_value') {
    const number = values.find((value) => value >= 100 && value <= 999) ?? (300 + Math.floor(rand() * 500));
    const hundreds = Math.floor(number / 100);
    const tens = Math.floor((number % 100) / 10);
    if (input.intent === 'compute') {
      return {
        question: `In ${number}, what value does the digit ${hundreds} represent?`,
        options: toOptionSet(`${hundreds * 100}`, [`${hundreds}`, `${hundreds * 10}`, `${tens * 100}`]),
        correctIndex: 0,
        explanation: `${hundreds} is in the hundreds place, so it represents ${hundreds * 100}.`,
      };
    }
    if (input.intent === 'scenario') {
      const bigger = number + 12;
      return {
        question: `Which number is greater: ${number} or ${bigger}?`,
        options: toOptionSet(`${bigger}`, [`${number}`, 'They are equal', `${number - 1}`]),
        correctIndex: 0,
        explanation: 'Compare digits from left to right by place value.',
      };
    }
    return {
      question: 'Place value tells what each digit is worth based on where it is.',
      options: toOptionSet('True', ['False', 'Only in one-digit numbers', 'Only when measuring length']),
      correctIndex: 0,
      explanation: 'A digit value changes with its place.',
    };
  }

  if (topic === 'addition_subtraction') {
    const a = values[0] ?? (20 + Math.floor(rand() * 20));
    const b = values[1] ?? (10 + Math.floor(rand() * 15));
    if (input.intent === 'compute') {
      return {
        question: `What is ${a} + ${b}?`,
        options: toOptionSet(`${a + b}`, [`${a - b}`, `${a + b + 10}`, `${a + b - 1}`]),
        correctIndex: 0,
        explanation: 'Add by combining both amounts.',
      };
    }
    if (input.intent === 'scenario') {
      const left = a + b - 7;
      return {
        question: `A class had ${a} books, got ${b} more, then donated 7. How many are left?`,
        options: toOptionSet(`${left}`, [`${a + b}`, `${Math.max(0, a - b)}`, `${left + 7}`]),
        correctIndex: 0,
        explanation: 'Add first, then subtract what was donated.',
      };
    }
    return {
      question: 'If a story asks "how many fewer," subtraction is usually the best operation.',
      options: toOptionSet('True', ['False', 'Only for geometry', 'Only with fractions']),
      correctIndex: 0,
      explanation: '"Fewer" compares amounts by finding the difference.',
    };
  }

  if (topic === 'multiplication_division') {
    const groups = values[0] ?? (3 + Math.floor(rand() * 4));
    const each = values[1] ?? (4 + Math.floor(rand() * 4));
    if (input.intent === 'compute') {
      return {
        question: `What is ${groups} x ${each}?`,
        options: toOptionSet(`${groups * each}`, [`${groups + each}`, `${groups * each - each}`, `${groups * each + 1}`]),
        correctIndex: 0,
        explanation: 'Multiplication gives the total of equal groups.',
      };
    }
    if (input.intent === 'scenario') {
      return {
        question: `${groups * each} stickers are shared equally into ${groups} groups. How many in each group?`,
        options: toOptionSet(`${each}`, [`${groups}`, `${groups + each}`, `${groups * each}`]),
        correctIndex: 0,
        explanation: 'Division finds how many are in each equal group.',
      };
    }
    return {
      question: 'Equal groups can be modeled with multiplication and division.',
      options: toOptionSet('True', ['False', 'Only with decimals', 'Only in geometry']),
      correctIndex: 0,
      explanation: 'Multiplication and division are operations for equal groups.',
    };
  }

  if (topic === 'fractions') {
    const denominator = Math.max(2, Math.min(12, values[0] ?? (4 + Math.floor(rand() * 5))));
    const numerator = Math.max(1, Math.min(denominator - 1, values[1] ?? Math.floor(denominator / 2)));
    if (input.intent === 'compute') {
      return {
        question: `Which fraction is equivalent to ${numerator}/${denominator}?`,
        options: toOptionSet(`${numerator * 2}/${denominator * 2}`, [
          `${numerator + 1}/${denominator + 1}`,
          `${denominator}/${numerator}`,
          `${numerator}/${Math.max(1, denominator - 1)}`,
        ]),
        correctIndex: 0,
        explanation: 'Equivalent fractions scale numerator and denominator by the same number.',
      };
    }
    if (input.intent === 'scenario') {
      return {
        question: `If ${numerator} out of ${denominator} equal pieces are shaded, which fraction matches?`,
        options: toOptionSet(`${numerator}/${denominator}`, [
          `${denominator}/${numerator}`,
          `${numerator + denominator}/${denominator}`,
          `${numerator}/${denominator + 1}`,
        ]),
        correctIndex: 0,
        explanation: 'Numerator is shaded parts; denominator is total equal parts.',
      };
    }
    return {
      question: 'In a fraction, the denominator tells the total number of equal parts.',
      options: toOptionSet('True', ['False', 'It is always the shaded part', 'It tells the operation only']),
      correctIndex: 0,
      explanation: 'Denominator names the total equal parts in the whole.',
    };
  }

  if (topic === 'measurement') {
    const a = values[0] ?? (12 + Math.floor(rand() * 8));
    const b = values[1] ?? (6 + Math.floor(rand() * 6));
    if (input.intent === 'compute') {
      return {
        question: `A ribbon is ${a} cm and another is ${b} cm. What is the total length?`,
        options: toOptionSet(`${a + b} cm`, [`${Math.max(1, a - b)} cm`, `${a * b} cm`, `${a + b + 2} cm`]),
        correctIndex: 0,
        explanation: 'Add lengths when joining pieces.',
      };
    }
    if (input.intent === 'scenario') {
      return {
        question: 'Which tool is best for measuring the length of a notebook?',
        options: toOptionSet('A ruler', ['A scale', 'A thermometer', 'A clock']),
        correctIndex: 0,
        explanation: 'A ruler measures distance or length.',
      };
    }
    return {
      question: 'Length measures how far it is from one end of an object to the other.',
      options: toOptionSet('True', ['False', 'Only with money', 'Only in science labs']),
      correctIndex: 0,
      explanation: 'Length is the distance across an object.',
    };
  }

  if (topic === 'data_graphing') {
    const a = values[0] ?? 4;
    const b = values[1] ?? 7;
    if (input.intent === 'compute') {
      return {
        question: `A bar graph shows category A = ${a} and B = ${b}. How many more is B than A?`,
        options: toOptionSet(`${Math.max(0, b - a)}`, [`${a + b}`, `${Math.max(0, a - b)}`, `${b}`]),
        correctIndex: 0,
        explanation: 'Compare by subtracting the smaller value from the larger value.',
      };
    }
    if (input.intent === 'scenario') {
      return {
        question: 'What should you read first to interpret a graph accurately?',
        options: toOptionSet('The title, labels, and scale', ['Only the tallest bar', 'Only one category', 'The colors only']),
        correctIndex: 0,
        explanation: 'Title, labels, and scale define the data meaning.',
      };
    }
    return {
      question: 'Graph labels and scales help you compare data correctly.',
      options: toOptionSet('True', ['False', 'Only in science graphs', 'Only for line plots']),
      correctIndex: 0,
      explanation: 'Without labels and scale, comparisons are unreliable.',
    };
  }

  if (input.intent === 'compute') {
    return {
      question: 'A rectangle is 8 units long and 3 units wide. What is the perimeter?',
      options: toOptionSet('22 units', ['11 units', '24 units', '16 units']),
      correctIndex: 0,
      explanation: 'Perimeter adds all sides: 8 + 3 + 8 + 3 = 22.',
    };
  }

  if (input.intent === 'scenario') {
    return {
      question: 'Which statement correctly compares area and perimeter?',
      options: toOptionSet('Perimeter is around the shape, area is inside the shape.', [
        'Area is around and perimeter is inside.',
        'They always mean the same thing.',
        'Both are measured only in inches.',
      ]),
      correctIndex: 0,
      explanation: 'Perimeter measures boundary distance; area measures inside space.',
    };
  }

  return {
    question: 'Area measures the amount of space inside a shape.',
    options: toOptionSet('True', ['False', 'Only circles have area', 'Area has no units']),
    correctIndex: 0,
    explanation: 'Area describes the inside region, usually in square units.',
  };
};

export const getK5MathCheckpointHint = (input: {
  subject: string | null | undefined;
  gradeBand: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  topic?: K5MathAdaptationTopic | null;
  intent: K5MathCheckpointIntent;
}): string | null => {
  const topic = resolveTopic({
    subject: input.subject,
    gradeBand: input.gradeBand,
    lessonTitle: input.lessonTitle,
    lessonContent: input.lessonContent,
    topic: input.topic,
  });
  if (!topic) return null;

  if (input.intent === 'compute') {
    if (topic === 'fractions') return 'Make sure numerator and denominator are scaled by the same number.';
    if (topic === 'geometry_perimeter_area') return 'Check whether you need around (perimeter) or inside (area).';
    if (topic === 'data_graphing') return 'Read both values from the graph, then compare or subtract carefully.';
  }

  if (input.intent === 'scenario') {
    if (topic === 'multiplication_division') return 'Use equal-group clues to choose multiplication or division.';
    if (topic === 'measurement') return 'Pick the tool and unit that match what is being measured.';
  }

  return TOPIC_TEMPLATES[topic].hint;
};

export const getDeterministicK5MathChallengeQuestion = (input: {
  lessonId?: number;
  subject: string | null | undefined;
  gradeBand: string | null | undefined;
  lessonTitle?: string | null;
  lessonContent?: string | null;
  questionPrompt?: string | null;
  topic?: K5MathAdaptationTopic | null;
}): LessonPracticeQuestion | null => {
  const topic = resolveTopic(input);
  if (!topic) return null;

  const seed = toQuestionSeed(input.lessonId);
  const values = extractPositiveIntegers([input.lessonTitle, input.lessonContent, input.questionPrompt].filter(Boolean).join(' '));
  const rand = mulberry32(seed + 97);
  const topicIndex = TOPIC_INDEX[topic] ?? 0;
  const questionId = 970_000 + seed * 20 + topicIndex;

  const byTopic = (): Omit<LessonPracticeQuestion, 'id' | 'visual'> => {
    if (topic === 'place_value') {
      const number = values.find((value) => value >= 100 && value <= 999) ?? (300 + Math.floor(rand() * 600));
      const hundreds = Math.floor(number / 100);
      const tens = Math.floor((number % 100) / 10);
      const ones = number % 10;
      return {
        prompt: `Challenge: Which expanded form matches ${number}?`,
        type: 'multiple_choice',
        explanation: 'Expanded form writes each digit by its place value.',
        hint: 'Split the number into hundreds, tens, and ones.',
        steps: [`${hundreds} hundreds`, `${tens} tens`, `${ones} ones`],
        options: [
          { id: questionId * 10 + 1, text: `${hundreds * 100} + ${tens * 10} + ${ones}`, isCorrect: true, feedback: 'Correct.' },
          { id: questionId * 10 + 2, text: `${hundreds} + ${tens} + ${ones}`, isCorrect: false, feedback: 'Those are digits, not place values.' },
          { id: questionId * 10 + 3, text: `${hundreds * 10} + ${tens * 100} + ${ones}`, isCorrect: false, feedback: 'Hundreds and tens are switched.' },
          { id: questionId * 10 + 4, text: `${hundreds * 100} + ${tens} + ${ones * 10}`, isCorrect: false, feedback: 'Tens and ones values are mixed up.' },
        ],
        skillIds: [],
      };
    }

    if (topic === 'addition_subtraction') {
      const a = values[0] ?? (20 + Math.floor(rand() * 25));
      const b = values[1] ?? (10 + Math.floor(rand() * 20));
      const c = values[2] ?? (5 + Math.floor(rand() * 10));
      const answer = a + b - c;
      return {
        prompt: `Challenge: Mia had ${a} points, earned ${b} more, then spent ${c}. How many points now?`,
        type: 'multiple_choice',
        explanation: `Add then subtract: ${a} + ${b} - ${c} = ${answer}.`,
        hint: 'Work in order: first combine, then remove.',
        steps: [`${a} + ${b} = ${a + b}`, `${a + b} - ${c} = ${answer}`],
        options: [
          { id: questionId * 10 + 1, text: `${answer}`, isCorrect: true, feedback: 'Correct.' },
          { id: questionId * 10 + 2, text: `${a + b}`, isCorrect: false, feedback: 'That misses the final subtraction step.' },
          { id: questionId * 10 + 3, text: `${Math.max(0, a - b + c)}`, isCorrect: false, feedback: 'Recheck operation order and signs.' },
          { id: questionId * 10 + 4, text: `${answer + 10}`, isCorrect: false, feedback: 'Close, but recompute carefully.' },
        ],
        skillIds: [],
      };
    }

    if (topic === 'multiplication_division') {
      const groups = values[0] ?? (4 + Math.floor(rand() * 4));
      const each = values[1] ?? (3 + Math.floor(rand() * 4));
      const total = groups * each;
      return {
        prompt: `Challenge: ${groups} boxes each hold ${each} markers. How many markers are there in all?`,
        type: 'multiple_choice',
        explanation: `Equal groups means multiply: ${groups} x ${each} = ${total}.`,
        hint: 'Use multiplication for equal groups.',
        steps: [`Groups: ${groups}`, `Each group: ${each}`, `Total: ${groups} x ${each} = ${total}`],
        options: [
          { id: questionId * 10 + 1, text: `${total}`, isCorrect: true, feedback: 'Correct.' },
          { id: questionId * 10 + 2, text: `${groups + each}`, isCorrect: false, feedback: 'Adding counts only one of each, not all groups.' },
          { id: questionId * 10 + 3, text: `${Math.max(1, total - each)}`, isCorrect: false, feedback: 'Recheck repeated groups.' },
          { id: questionId * 10 + 4, text: `${total + groups}`, isCorrect: false, feedback: 'That overcounts one full group.' },
        ],
        skillIds: [],
      };
    }

    if (topic === 'fractions') {
      const denominator = Math.max(2, Math.min(12, values[0] ?? (6 + Math.floor(rand() * 3))));
      const numerator = Math.max(1, Math.min(denominator - 1, values[1] ?? 2));
      return {
        prompt: `Challenge: Which fraction is equivalent to ${numerator}/${denominator}?`,
        type: 'multiple_choice',
        explanation: 'Equivalent fractions multiply or divide numerator and denominator by the same number.',
        hint: 'Scale top and bottom by the same factor.',
        steps: [
          `Start with ${numerator}/${denominator}`,
          `Multiply numerator and denominator by 2`,
          `Equivalent fraction: ${(numerator * 2)}/${(denominator * 2)}`,
        ],
        options: [
          { id: questionId * 10 + 1, text: `${numerator * 2}/${denominator * 2}`, isCorrect: true, feedback: 'Correct.' },
          { id: questionId * 10 + 2, text: `${numerator + 1}/${denominator + 2}`, isCorrect: false, feedback: 'Both parts changed by different amounts.' },
          { id: questionId * 10 + 3, text: `${numerator}/${Math.max(1, denominator - 1)}`, isCorrect: false, feedback: 'Only denominator changed.' },
          { id: questionId * 10 + 4, text: `${denominator}/${numerator}`, isCorrect: false, feedback: 'That is the reciprocal.' },
        ],
        skillIds: [],
      };
    }

    if (topic === 'measurement') {
      const a = values[0] ?? (12 + Math.floor(rand() * 8));
      const b = values[1] ?? (7 + Math.floor(rand() * 6));
      const total = a + b;
      return {
        prompt: `Challenge: A rope is ${a} cm. You add ${b} cm more. What is the new length?`,
        type: 'multiple_choice',
        explanation: `Add the lengths: ${a} + ${b} = ${total} cm.`,
        hint: 'Length gets larger when we add more.',
        steps: [`Start: ${a} cm`, `Add: ${b} cm`, `Total: ${total} cm`],
        options: [
          { id: questionId * 10 + 1, text: `${total} cm`, isCorrect: true, feedback: 'Correct.' },
          { id: questionId * 10 + 2, text: `${Math.max(1, a - b)} cm`, isCorrect: false, feedback: 'That subtracts instead of adding.' },
          { id: questionId * 10 + 3, text: `${a * b} cm`, isCorrect: false, feedback: 'Multiplication is not needed here.' },
          { id: questionId * 10 + 4, text: `${total + 1} cm`, isCorrect: false, feedback: 'Recheck the sum.' },
        ],
        skillIds: [],
      };
    }

    if (topic === 'data_graphing') {
      return {
        prompt: 'Challenge: Which is the most accurate way to compare categories on a bar graph?',
        type: 'multiple_choice',
        explanation: 'Accurate comparisons use bar heights and the graph scale.',
        hint: 'Read the axis scale before comparing bars.',
        steps: ['Check title and labels.', 'Read the scale values.', 'Compare bar heights using that scale.'],
        options: [
          { id: questionId * 10 + 1, text: 'Use labeled values and the graph scale for each bar.', isCorrect: true, feedback: 'Correct.' },
          { id: questionId * 10 + 2, text: 'Pick the darkest bar color as the largest.', isCorrect: false, feedback: 'Color does not determine value.' },
          { id: questionId * 10 + 3, text: 'Use only the first category as a reference.', isCorrect: false, feedback: 'You need all relevant categories.' },
          { id: questionId * 10 + 4, text: 'Ignore labels and estimate randomly.', isCorrect: false, feedback: 'Labels and scale are essential evidence.' },
        ],
        skillIds: [],
      };
    }

    return {
      prompt: 'Challenge: A rectangle is 7 units long and 4 units wide. What is its perimeter?',
      type: 'multiple_choice',
      explanation: 'Perimeter of a rectangle is the sum of all sides: 7 + 4 + 7 + 4 = 22 units.',
      hint: 'A rectangle has two lengths and two widths.',
      steps: ['Length + width = 11', 'Double it for both pairs of sides: 11 x 2', 'Perimeter = 22'],
      options: [
        { id: questionId * 10 + 1, text: '22 units', isCorrect: true, feedback: 'Correct.' },
        { id: questionId * 10 + 2, text: '11 units', isCorrect: false, feedback: 'That is only one length + one width.' },
        { id: questionId * 10 + 3, text: '28 units', isCorrect: false, feedback: 'That multiplies side lengths, not perimeter.' },
        { id: questionId * 10 + 4, text: '14 units', isCorrect: false, feedback: 'Recheck all four sides.' },
      ],
      skillIds: [],
    };
  };

  const question = byTopic();
  const visual = getPracticeQuestionVisual({
    lessonTitle: input.lessonTitle ?? null,
    subject: input.subject ?? 'math',
    gradeBand: input.gradeBand ?? null,
    prompt: question.prompt,
  });

  return {
    ...question,
    id: questionId,
    visual,
  };
};
