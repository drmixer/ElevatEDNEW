import type { LessonPracticeOption, LessonPracticeQuestion } from '../types';
import { shufflePracticeOptions } from './answerOrder';
import type { Grade2MathPilotTopic } from './pilotConditions';
import { extractPerimeterDimensionsFromText, getPracticeQuestionVisual } from './lessonVisuals';
import {
  getDeterministicPerimeterCheckpoint,
  type PilotCheckpointIntent,
  type PilotCheckpointPayload,
} from './pilotPerimeterCheckpoints';
import { getPerimeterQuickReview, type PilotQuickReview } from './pilotPerimeterQuickReview';

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

type TopicPrompt = {
  prompt: string;
  correct: string;
  wrong: string[];
  explanation: string;
  hint?: string;
  steps?: string[];
};

const extractPositiveIntegers = (text: string | null | undefined): number[] => {
  const matches = (text ?? '').toString().match(/\b\d+\b/g) ?? [];
  return matches
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 999);
};

const coerceThreeDigit = (value: number): number => {
  if (value >= 100 && value <= 999) return value;
  if (value >= 10 && value <= 99) return 100 + value;
  return 347;
};

const toPlaceValuePrompt = (text: string | null | undefined, seed: number): TopicPrompt[] => {
  const values = extractPositiveIntegers(text);
  const threeDigit = coerceThreeDigit(values.find((value) => value >= 100 && value <= 999) ?? (300 + (seed % 100)));
  const hundredsDigit = Math.floor(threeDigit / 100);
  const tensDigit = Math.floor((threeDigit % 100) / 10);
  const onesDigit = threeDigit % 10;
  const compareA = threeDigit;
  const compareB = threeDigit + 7;

  return [
    {
      prompt: `In the number ${threeDigit}, what value does the digit ${tensDigit} represent?`,
      correct: `${tensDigit * 10}`,
      wrong: [`${tensDigit}`, `${tensDigit * 100}`, `${onesDigit * 10}`],
      explanation: `The ${tensDigit} is in the tens place, so it represents ${tensDigit * 10}.`,
      hint: 'Look at the place of the digit: ones, tens, or hundreds.',
      steps: [`Number: ${threeDigit}`, `${tensDigit} is in the tens place`, `${tensDigit} tens = ${tensDigit * 10}`],
    },
    {
      prompt: `Which expanded form matches ${threeDigit}?`,
      correct: `${hundredsDigit * 100} + ${tensDigit * 10} + ${onesDigit}`,
      wrong: [
        `${hundredsDigit} + ${tensDigit} + ${onesDigit}`,
        `${hundredsDigit * 10} + ${tensDigit * 100} + ${onesDigit}`,
        `${hundredsDigit * 100} + ${tensDigit} + ${onesDigit * 10}`,
      ],
      explanation: 'Expanded form shows each digit by its place value.',
      hint: 'Split the number into hundreds, tens, and ones.',
      steps: [
        `Hundreds: ${hundredsDigit * 100}`,
        `Tens: ${tensDigit * 10}`,
        `Ones: ${onesDigit}`,
      ],
    },
    {
      prompt: `Which comparison is true?`,
      correct: `${compareA} < ${compareB}`,
      wrong: [`${compareA} > ${compareB}`, `${compareA} = ${compareB}`, `${compareA + 1} < ${compareA}`],
      explanation: `Compare hundreds first, then tens and ones. ${compareB} is greater than ${compareA}.`,
      hint: 'Compare from left to right: hundreds, tens, ones.',
    },
    {
      prompt: `Start at ${Math.floor(compareA / 10) * 10}. Which number is 3 tens more?`,
      correct: `${Math.floor(compareA / 10) * 10 + 30}`,
      wrong: [
        `${Math.floor(compareA / 10) * 10 + 3}`,
        `${Math.floor(compareA / 10) * 10 + 13}`,
        `${Math.floor(compareA / 10) * 10 - 30}`,
      ],
      explanation: 'Three tens means adding 30.',
      hint: 'Each ten is 10, so 3 tens is 30.',
      steps: [`Start value: ${Math.floor(compareA / 10) * 10}`, `3 tens = 30`, `Add: +30`],
    },
  ];
};

const toAdditionSubtractionPrompt = (text: string | null | undefined, seed: number): TopicPrompt[] => {
  const values = extractPositiveIntegers(text);
  const rand = mulberry32(seed + 17);
  const addA = values[0] ?? (10 + Math.floor(rand() * 20));
  const addB = values[1] ?? (5 + Math.floor(rand() * 15));
  const subA = Math.max(addA + addB, values[2] ?? addA + addB + 8);
  const subB = values[3] ?? addA;
  const storyTotal = addA + addB;
  const storyLeft = Math.max(0, storyTotal - subB);

  return [
    {
      prompt: 'When a word problem asks "how many more," which operation usually helps most?',
      correct: 'Subtraction',
      wrong: ['Addition', 'Multiplication', 'Division'],
      explanation: '"How many more" means finding the difference between two numbers.',
      hint: 'Difference means subtract.',
    },
    {
      prompt: `What is ${addA} + ${addB}?`,
      correct: `${addA + addB}`,
      wrong: [`${addA + addB + 10}`, `${Math.max(0, addA - addB)}`, `${addA + addB - 1}`],
      explanation: `Add the numbers: ${addA} + ${addB} = ${addA + addB}.`,
      hint: 'Break apart one addend into tens and ones.',
      steps: [`${addA} + ${addB}`, `Add tens and ones`, `Total = ${addA + addB}`],
    },
    {
      prompt: `What is ${subA} - ${subB}?`,
      correct: `${subA - subB}`,
      wrong: [`${subA + subB}`, `${subA - subB + 10}`, `${Math.max(0, subA - subB - 2)}`],
      explanation: `Subtract to find what is left: ${subA} - ${subB} = ${subA - subB}.`,
      hint: 'Think: start with the larger number and count back.',
      steps: [`Start at ${subA}`, `Take away ${subB}`, `Result = ${subA - subB}`],
    },
    {
      prompt: `Kai has ${storyTotal} stickers and gives away ${subB}. How many stickers are left?`,
      correct: `${storyLeft}`,
      wrong: [`${storyTotal + subB}`, `${Math.max(0, storyLeft - 1)}`, `${storyTotal}`],
      explanation: `Giving away means subtract: ${storyTotal} - ${subB} = ${storyLeft}.`,
      hint: 'Use subtraction when the amount goes down.',
    },
  ];
};

const toMeasurementPrompt = (text: string | null | undefined, seed: number): TopicPrompt[] => {
  const values = extractPositiveIntegers(text);
  const rand = mulberry32(seed + 31);
  const lengthA = values[0] ?? (8 + Math.floor(rand() * 8));
  const lengthB = values[1] ?? (6 + Math.floor(rand() * 7));
  const lengthC = values[2] ?? (4 + Math.floor(rand() * 6));
  const total = lengthA + lengthB;

  return [
    {
      prompt: 'What does length measure?',
      correct: 'How long something is from one end to the other',
      wrong: [
        'How heavy something is',
        'How much space is inside a shape',
        'How many corners a shape has',
      ],
      explanation: 'Length tells how long an object is.',
      hint: 'Think about using a ruler.',
    },
    {
      prompt: `A ribbon is ${lengthA} cm and another ribbon is ${lengthB} cm. What is the total length?`,
      correct: `${total} cm`,
      wrong: [`${Math.max(1, lengthA - lengthB)} cm`, `${lengthA * lengthB} cm`, `${total + 2} cm`],
      explanation: `Add the lengths: ${lengthA} + ${lengthB} = ${total} cm.`,
      hint: 'Join the pieces and add their lengths.',
      steps: [`First ribbon: ${lengthA} cm`, `Second ribbon: ${lengthB} cm`, `Total: ${total} cm`],
    },
    {
      prompt: `Which object is longer: ${lengthA} cm or ${lengthC} cm?`,
      correct: `${Math.max(lengthA, lengthC)} cm`,
      wrong: [`${Math.min(lengthA, lengthC)} cm`, `${lengthA + lengthC} cm`, `${Math.abs(lengthA - lengthC)} cm`],
      explanation: 'Compare the two lengths directly; the greater number is longer.',
      hint: 'Bigger number means longer length.',
    },
    {
      prompt: `Which tool is best for measuring the length of a book?`,
      correct: 'A ruler marked in centimeters or inches',
      wrong: ['A thermometer', 'A clock', 'A scale'],
      explanation: 'A ruler is used to measure length.',
      hint: 'Use the tool with unit marks for distance.',
    },
  ];
};

const toPromptsByTopic = (
  topic: Grade2MathPilotTopic,
  input: { lessonTitle: string; lessonContent?: string; seed: number },
): TopicPrompt[] => {
  if (topic === 'place_value') return toPlaceValuePrompt(input.lessonContent ?? input.lessonTitle, input.seed);
  if (topic === 'addition_subtraction') return toAdditionSubtractionPrompt(input.lessonContent ?? input.lessonTitle, input.seed);
  if (topic === 'measurement') return toMeasurementPrompt(input.lessonContent ?? input.lessonTitle, input.seed);
  return [];
};

export const generateGrade2MathPracticeQuestions = (input: {
  lessonId: number;
  lessonTitle: string;
  lessonContent?: string;
  subject: string;
  gradeBand: string;
  topic: Grade2MathPilotTopic;
}): LessonPracticeQuestion[] => {
  if (input.topic === 'perimeter') {
    return [];
  }

  const prompts = toPromptsByTopic(input.topic, {
    lessonTitle: input.lessonTitle,
    lessonContent: input.lessonContent,
    seed: input.lessonId,
  });

  return prompts.map((item, index) => {
    const optionsRaw: Array<{ text: string; isCorrect: boolean; feedback?: string | null }> = [
      { text: item.correct, isCorrect: true, feedback: 'Correct.' },
      ...item.wrong.map((text) => ({ text, isCorrect: false, feedback: 'Try checking the meaning of the numbers and words.' })),
    ];
    const options = shufflePracticeOptions(optionsRaw, input.lessonId * 1_000 + index);
    const visual = getPracticeQuestionVisual({
      lessonTitle: input.lessonTitle,
      subject: input.subject,
      gradeBand: input.gradeBand,
      prompt: item.prompt,
    });

    return {
      id: 940_000 + input.lessonId * 10 + index,
      prompt: item.prompt,
      type: 'multiple_choice',
      explanation: item.explanation,
      hint: item.hint ?? null,
      steps: item.steps ?? null,
      visual,
      options: options.map((option, optionIndex) => ({
        id: 9_400_000 + input.lessonId * 100 + index * 10 + optionIndex,
        text: option.text,
        isCorrect: option.isCorrect,
        feedback: option.feedback ?? null,
      })),
      skillIds: [],
    };
  });
};

export const getGrade2MathQuickReview = (input: {
  topic: Grade2MathPilotTopic;
  sectionContent?: string | null;
  questionPrompt?: string | null;
}): PilotQuickReview => {
  if (input.topic === 'perimeter') {
    const dims = extractPerimeterDimensionsFromText(input.sectionContent ?? input.questionPrompt ?? '');
    return getPerimeterQuickReview(dims);
  }

  if (input.topic === 'place_value') {
    const values = extractPositiveIntegers(input.sectionContent ?? input.questionPrompt ?? '');
    const number = coerceThreeDigit(values.find((value) => value >= 100 && value <= 999) ?? 428);
    const tens = Math.floor((number % 100) / 10);
    return {
      title: 'Quick Review',
      prompt: `In ${number}, what value does the digit ${tens} represent?`,
      options: [`${tens * 10}`, `${tens}`, `${tens * 100}`],
      correctIndex: 0,
      explanation: `${tens} is in the tens place, so it represents ${tens * 10}.`,
    };
  }

  if (input.topic === 'addition_subtraction') {
    return {
      title: 'Quick Review',
      prompt: 'A problem says "how many more." Which operation should you use?',
      options: ['Subtraction', 'Addition', 'Multiplication'],
      correctIndex: 0,
      explanation: '"How many more" asks for the difference, so subtract.',
    };
  }

  return {
    title: 'Quick Review',
    prompt: 'Which tool is best for measuring the length of a pencil?',
    options: ['A ruler', 'A clock', 'A scale'],
    correctIndex: 0,
    explanation: 'A ruler is used to measure length.',
  };
};

const toOptionSet = (
  correct: string,
  wrongs: string[],
): string[] => [correct, ...wrongs.slice(0, 3)];

export const getDeterministicGrade2MathCheckpoint = (input: {
  topic: Grade2MathPilotTopic;
  sectionContent: string;
  intent: PilotCheckpointIntent;
  seed: number;
}): PilotCheckpointPayload | null => {
  if (input.topic === 'perimeter') {
    return getDeterministicPerimeterCheckpoint({
      sectionContent: input.sectionContent,
      intent: input.intent,
      seed: input.seed,
    });
  }

  const values = extractPositiveIntegers(input.sectionContent);
  const rand = mulberry32(input.seed);

  if (input.topic === 'place_value') {
    const number = coerceThreeDigit(values.find((value) => value >= 100 && value <= 999) ?? 365);
    const hundreds = Math.floor(number / 100);
    const ones = number % 10;

    if (input.intent === 'compute') {
      return {
        question: `In ${number}, what is the value of the digit ${hundreds}?`,
        options: toOptionSet(`${hundreds * 100}`, [`${hundreds}`, `${hundreds * 10}`, `${ones * 100}`]),
        correctIndex: 0,
        explanation: `${hundreds} is in the hundreds place, so it represents ${hundreds * 100}.`,
      };
    }

    if (input.intent === 'scenario') {
      const bigger = number + 9;
      return {
        question: `You compare ${number} and ${bigger}. Which is greater?`,
        options: toOptionSet(`${bigger}`, [`${number}`, 'They are equal', `${number - 1}`]),
        correctIndex: 0,
        explanation: 'Compare hundreds, then tens, then ones to find the larger number.',
      };
    }

    return {
      question: 'Place value helps us understand what each digit means in a number.',
      options: toOptionSet('True', ['False', 'Only for one-digit numbers', 'Only for measuring length']),
      correctIndex: 0,
      explanation: 'Each digit has a value based on its place.',
    };
  }

  if (input.topic === 'addition_subtraction') {
    const a = values[0] ?? (8 + Math.floor(rand() * 20));
    const b = values[1] ?? (4 + Math.floor(rand() * 12));
    if (input.intent === 'compute') {
      const add = a + b;
      return {
        question: `What is ${a} + ${b}?`,
        options: toOptionSet(`${add}`, [`${add + 10}`, `${Math.max(0, a - b)}`, `${add - 1}`]),
        correctIndex: 0,
        explanation: `Add both numbers: ${a} + ${b} = ${add}.`,
      };
    }

    if (input.intent === 'scenario') {
      const total = a + b;
      return {
        question: `Riley has ${a} stickers and gets ${b} more. How many stickers now?`,
        options: toOptionSet(`${total}`, [`${Math.max(0, a - b)}`, `${a}`, `${total + 1}`]),
        correctIndex: 0,
        explanation: 'When you get more, add the amounts.',
      };
    }

    return {
      question: 'When a word problem asks "how many more," you usually subtract.',
      options: toOptionSet('True', ['False', 'Only when numbers are equal', 'Only in geometry']),
      correctIndex: 0,
      explanation: '"How many more" asks for a difference, which means subtraction.',
    };
  }

  const a = values[0] ?? (7 + Math.floor(rand() * 8));
  const b = values[1] ?? (4 + Math.floor(rand() * 6));
  if (input.intent === 'compute') {
    const total = a + b;
    return {
      question: `A ribbon is ${a} cm and another is ${b} cm. What is the total length?`,
      options: toOptionSet(`${total} cm`, [`${Math.max(1, a - b)} cm`, `${a * b} cm`, `${total + 2} cm`]),
      correctIndex: 0,
      explanation: `Add the lengths: ${a} + ${b} = ${total} cm.`,
    };
  }

  if (input.intent === 'scenario') {
    return {
      question: 'Which tool is best for measuring the length of a notebook?',
      options: toOptionSet('A ruler', ['A clock', 'A thermometer', 'A scale']),
      correctIndex: 0,
      explanation: 'A ruler measures length.',
    };
  }

  return {
    question: 'Length tells how long something is.',
    options: toOptionSet('True', ['False', 'Only for circles', 'Only for money']),
    correctIndex: 0,
    explanation: 'Length measures distance from one end to another.',
  };
};

const makeChallengeQuestion = (input: {
  prompt: string;
  explanation: string;
  hint: string;
  steps: string[];
  options: LessonPracticeOption[];
}): LessonPracticeQuestion => ({
  id: -1,
  prompt: input.prompt,
  type: 'multiple_choice',
  explanation: input.explanation,
  hint: input.hint,
  steps: input.steps,
  visual: getPracticeQuestionVisual({
    lessonTitle: 'Grade 2 Math',
    subject: 'math',
    gradeBand: '2',
    prompt: input.prompt,
  }),
  options: input.options,
  skillIds: [],
});

export const getGrade2MathChallengeQuestion = (input: {
  topic: Grade2MathPilotTopic;
}): LessonPracticeQuestion | null => {
  if (input.topic === 'perimeter') {
    return makeChallengeQuestion({
      prompt: 'Challenge: A rectangle is 6 ft long and 3 ft wide. What is the perimeter?',
      explanation: 'Add all the sides: 6 + 3 + 6 + 3 = 18 ft.',
      hint: 'A rectangle has 2 long sides and 2 short sides. Add all 4 sides.',
      steps: ['6 + 3 = 9', '9 + 6 = 15', '15 + 3 = 18'],
      options: [
        { id: 1, text: '18 ft', isCorrect: true, feedback: 'Yes — 6 + 3 + 6 + 3 = 18.' },
        { id: 2, text: '9 ft', isCorrect: false, feedback: 'That adds only one long + one short side.' },
        { id: 3, text: '12 ft', isCorrect: false, feedback: 'That is 2 × 6, but you also need the 3s.' },
        { id: 4, text: '15 ft', isCorrect: false, feedback: 'Check: you need 6 + 3 + 6 + 3.' },
      ],
    });
  }

  if (input.topic === 'place_value') {
    return makeChallengeQuestion({
      prompt: 'Challenge: Which number has 5 hundreds, 2 tens, and 9 ones?',
      explanation: '5 hundreds = 500, 2 tens = 20, and 9 ones = 9, so the number is 529.',
      hint: 'Build the number by place: hundreds, tens, then ones.',
      steps: ['500 + 20 + 9', '500 + 20 = 520', '520 + 9 = 529'],
      options: [
        { id: 1, text: '529', isCorrect: true, feedback: 'Correct.' },
        { id: 2, text: '592', isCorrect: false, feedback: 'Check the tens and ones places.' },
        { id: 3, text: '259', isCorrect: false, feedback: 'Check the hundreds place.' },
        { id: 4, text: '5029', isCorrect: false, feedback: 'This has an extra place value.' },
      ],
    });
  }

  if (input.topic === 'addition_subtraction') {
    return makeChallengeQuestion({
      prompt: 'Challenge: Lena has 28 marbles, gets 17 more, then gives away 9. How many marbles does she have now?',
      explanation: 'First add: 28 + 17 = 45. Then subtract: 45 - 9 = 36.',
      hint: 'Do it in two steps: add first, then subtract.',
      steps: ['28 + 17 = 45', '45 - 9 = 36'],
      options: [
        { id: 1, text: '36', isCorrect: true, feedback: 'Correct.' },
        { id: 2, text: '45', isCorrect: false, feedback: 'You stopped after the first step.' },
        { id: 3, text: '26', isCorrect: false, feedback: 'Recheck both operations.' },
        { id: 4, text: '54', isCorrect: false, feedback: 'Try adding and subtracting carefully.' },
      ],
    });
  }

  return makeChallengeQuestion({
    prompt: 'Challenge: A string is 14 cm long. You tape on another 9 cm piece. What is the new total length?',
    explanation: 'Add the lengths: 14 + 9 = 23 cm.',
    hint: 'Combine both pieces by adding.',
    steps: ['14 + 9', '14 + 6 = 20', '20 + 3 = 23'],
    options: [
      { id: 1, text: '23 cm', isCorrect: true, feedback: 'Correct.' },
      { id: 2, text: '5 cm', isCorrect: false, feedback: 'That is the difference, not the total.' },
      { id: 3, text: '149 cm', isCorrect: false, feedback: 'You combined digits instead of adding.' },
      { id: 4, text: '24 cm', isCorrect: false, feedback: 'Check your addition.' },
    ],
  });
};

export const getGrade2MathCheckpointHint = (input: {
  topic: Grade2MathPilotTopic;
  intent: PilotCheckpointIntent;
  sectionContent: string;
}): string => {
  if (input.topic === 'perimeter') {
    const text = input.sectionContent ?? '';
    if (input.intent === 'define') return 'Perimeter means the distance around the outside of a shape.';
    if (/\bsquare\b/i.test(text)) return 'A square has 4 equal sides. Add the same side length 4 times.';
    if (/\brectangle\b/i.test(text)) return 'A rectangle has 2 long sides and 2 short sides. Add all 4 sides.';
    if (/\btriangle\b/i.test(text)) return 'A triangle has 3 sides. Add all 3 side lengths.';
    return 'Perimeter means add all the side lengths.';
  }

  if (input.topic === 'place_value') {
    return 'Check each digit by its place: hundreds, tens, and ones.';
  }

  if (input.topic === 'addition_subtraction') {
    return input.intent === 'scenario'
      ? 'Look for clues: "more" often means add, and "left" or "difference" often means subtract.'
      : 'Line up the numbers and solve one step at a time.';
  }

  return 'Use the right measurement idea: compare lengths or add lengths depending on the question.';
};
