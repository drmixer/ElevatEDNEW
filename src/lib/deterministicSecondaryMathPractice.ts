import type { LessonPracticeQuestion } from '../types';

const normalize = (value: string | null | undefined): string => (value ?? '').toString().trim().toLowerCase();

const includesAny = (value: string, needles: string[]): boolean => needles.some((needle) => value.includes(needle));

const extractIntegers = (text: string | null | undefined): number[] => {
  const matches = (text ?? '').toString().match(/-?\d+/g) ?? [];
  return matches
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value >= -999 && value <= 999);
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

type SecondaryMathTopic =
  | 'ratio_proportion'
  | 'expressions_equations'
  | 'integers'
  | 'geometry'
  | 'functions'
  | 'statistics_probability';

const TOPIC_INDEX: Record<SecondaryMathTopic, number> = {
  ratio_proportion: 1,
  expressions_equations: 2,
  integers: 3,
  geometry: 4,
  functions: 5,
  statistics_probability: 6,
};

const resolveTopic = (input: {
  lessonTitle?: string | null;
  lessonContent?: string | null;
}): SecondaryMathTopic => {
  const text = normalize([input.lessonTitle, input.lessonContent].filter(Boolean).join(' '));

  if (includesAny(text, ['ratio', 'rate', 'proportion', 'unit rate', 'percent'])) {
    return 'ratio_proportion';
  }
  if (includesAny(text, ['function', 'input', 'output', 'ordered pair', 'table', 'linear'])) {
    return 'functions';
  }
  if (includesAny(text, ['integer', 'negative', 'positive', 'absolute value'])) {
    return 'integers';
  }
  if (includesAny(text, ['angle', 'triangle', 'area', 'perimeter', 'circle', 'geometry', 'transform'])) {
    return 'geometry';
  }
  if (includesAny(text, ['mean', 'median', 'mode', 'probability', 'data', 'distribution', 'sample'])) {
    return 'statistics_probability';
  }
  return 'expressions_equations';
};

export const getDeterministicSecondaryMathPracticeQuestion = (input: {
  lessonId?: number;
  lessonTitle?: string | null;
  lessonContent?: string | null;
}): LessonPracticeQuestion => {
  const lessonId = Number.isFinite(input.lessonId) ? Math.max(0, Math.floor(input.lessonId as number)) : 0;
  const seed = Math.max(1, lessonId);
  const rand = mulberry32(seed + 211);
  const values = extractIntegers([input.lessonTitle, input.lessonContent].filter(Boolean).join(' '));
  const topic = resolveTopic(input);
  const topicIndex = TOPIC_INDEX[topic];
  const questionId = 990_000 + seed * 20 + topicIndex;

  const toQuestion = (): Omit<LessonPracticeQuestion, 'id' | 'visual'> => {
    if (topic === 'ratio_proportion') {
      const totalMiles = values.find((value) => value > 10) ?? (24 + Math.floor(rand() * 24));
      const totalHours = values.find((value) => value > 1 && value < 10) ?? (3 + Math.floor(rand() * 4));
      const rate = Math.round((totalMiles / totalHours) * 10) / 10;
      return {
        prompt: `Challenge: A car travels ${totalMiles} miles in ${totalHours} hours. What is the unit rate in miles per hour?`,
        type: 'multiple_choice',
        explanation: 'Unit rate means the amount for 1 hour, so divide miles by hours.',
        hint: 'Use division to find the amount for one hour.',
        steps: [`Rate = ${totalMiles} ÷ ${totalHours}`, `Compute the quotient`, `Use miles per hour as the unit`],
        options: [
          { id: questionId * 10 + 1, text: `${rate}`, isCorrect: true, feedback: 'Correct.' },
          { id: questionId * 10 + 2, text: `${totalMiles * totalHours}`, isCorrect: false, feedback: 'That multiplies instead of finding the amount for 1 hour.' },
          { id: questionId * 10 + 3, text: `${totalMiles - totalHours}`, isCorrect: false, feedback: 'Subtraction does not give a unit rate.' },
          { id: questionId * 10 + 4, text: `${totalHours / totalMiles}`, isCorrect: false, feedback: 'That reverses the ratio.' },
        ],
        skillIds: [],
      };
    }

    if (topic === 'functions') {
      const x = values.find((value) => value >= 1 && value <= 6) ?? (2 + Math.floor(rand() * 4));
      const coefficient = values.find((value) => value >= 2 && value <= 5) ?? 2;
      const constant = values.find((value) => value >= 1 && value <= 9 && value !== coefficient) ?? 3;
      const y = coefficient * x + constant;
      return {
        prompt: `Challenge: For the function y = ${coefficient}x + ${constant}, what is the output when x = ${x}?`,
        type: 'multiple_choice',
        explanation: 'Substitute the input for x, then simplify in order.',
        hint: 'Replace x with the given input first.',
        steps: [`y = ${coefficient}(${x}) + ${constant}`, `${coefficient * x} + ${constant}`, `y = ${y}`],
        options: [
          { id: questionId * 10 + 1, text: `${y}`, isCorrect: true, feedback: 'Correct.' },
          { id: questionId * 10 + 2, text: `${coefficient + x + constant}`, isCorrect: false, feedback: 'You added everything instead of multiplying first.' },
          { id: questionId * 10 + 3, text: `${coefficient * (x + constant)}`, isCorrect: false, feedback: 'Only x is multiplied by the coefficient here.' },
          { id: questionId * 10 + 4, text: `${coefficient * x}`, isCorrect: false, feedback: 'That misses the constant term.' },
        ],
        skillIds: [],
      };
    }

    if (topic === 'integers') {
      const a = values.find((value) => value <= -2) ?? -(2 + Math.floor(rand() * 6));
      const b = values.find((value) => value >= 2 && value <= 9) ?? (3 + Math.floor(rand() * 5));
      const sum = a + b;
      return {
        prompt: `Challenge: What is ${a} + ${b}?`,
        type: 'multiple_choice',
        explanation: 'When adding integers with different signs, subtract their absolute values and keep the sign of the number with greater absolute value.',
        hint: 'Compare the absolute values before choosing the sign.',
        steps: [`Compare |${a}| and |${b}|`, `Subtract the smaller absolute value from the larger one`, `Keep the sign of the larger absolute value`],
        options: [
          { id: questionId * 10 + 1, text: `${sum}`, isCorrect: true, feedback: 'Correct.' },
          { id: questionId * 10 + 2, text: `${Math.abs(a) + Math.abs(b)}`, isCorrect: false, feedback: 'That adds absolute values without signs.' },
          { id: questionId * 10 + 3, text: `${b - a}`, isCorrect: false, feedback: 'That changes the operation.' },
          { id: questionId * 10 + 4, text: `${-sum}`, isCorrect: false, feedback: 'Recheck which sign should remain.' },
        ],
        skillIds: [],
      };
    }

    if (topic === 'geometry') {
      const base = values.find((value) => value >= 4 && value <= 20) ?? (6 + Math.floor(rand() * 8));
      const height = values.find((value) => value >= 3 && value <= 15 && value !== base) ?? (4 + Math.floor(rand() * 6));
      const area = base * height;
      return {
        prompt: `Challenge: A rectangle has base ${base} units and height ${height} units. What is its area?`,
        type: 'multiple_choice',
        explanation: 'Area of a rectangle is base times height.',
        hint: 'Area counts the space inside, so multiply the two side lengths.',
        steps: [`Area = base × height`, `${base} × ${height}`, `Area = ${area} square units`],
        options: [
          { id: questionId * 10 + 1, text: `${area}`, isCorrect: true, feedback: 'Correct.' },
          { id: questionId * 10 + 2, text: `${2 * (base + height)}`, isCorrect: false, feedback: 'That is perimeter, not area.' },
          { id: questionId * 10 + 3, text: `${base + height}`, isCorrect: false, feedback: 'Area is multiplicative here.' },
          { id: questionId * 10 + 4, text: `${area + base}`, isCorrect: false, feedback: 'That adds an extra side length.' },
        ],
        skillIds: [],
      };
    }

    if (topic === 'statistics_probability') {
      const data = values.filter((value) => value >= 1 && value <= 20).slice(0, 3);
      const a = data[0] ?? 6;
      const b = data[1] ?? 8;
      const c = data[2] ?? 10;
      const mean = (a + b + c) / 3;
      return {
        prompt: `Challenge: What is the mean of ${a}, ${b}, and ${c}?`,
        type: 'multiple_choice',
        explanation: 'Mean is the sum of the data values divided by the number of values.',
        hint: 'Add first, then divide by how many numbers there are.',
        steps: [`Sum: ${a} + ${b} + ${c} = ${a + b + c}`, `There are 3 numbers`, `Mean = ${(a + b + c)} ÷ 3 = ${mean}`],
        options: [
          { id: questionId * 10 + 1, text: `${mean}`, isCorrect: true, feedback: 'Correct.' },
          { id: questionId * 10 + 2, text: `${a + b + c}`, isCorrect: false, feedback: 'That is the sum, not the mean.' },
          { id: questionId * 10 + 3, text: `${Math.max(a, b, c)}`, isCorrect: false, feedback: 'That is the maximum value.' },
          { id: questionId * 10 + 4, text: `${b}`, isCorrect: false, feedback: 'That only picks the middle listed value.' },
        ],
        skillIds: [],
      };
    }

    const x = values.find((value) => value >= 2 && value <= 12) ?? (3 + Math.floor(rand() * 5));
    const total = values.find((value) => value >= 12 && value <= 40) ?? (18 + Math.floor(rand() * 10));
    const solution = total - x;
    return {
      prompt: `Challenge: Solve x + ${x} = ${total}. What is x?`,
      type: 'multiple_choice',
      explanation: 'Undo the addition by subtracting the known value from the total.',
      hint: 'Use the opposite operation to isolate x.',
      steps: [`x + ${x} = ${total}`, `Subtract ${x} from both sides`, `x = ${solution}`],
      options: [
        { id: questionId * 10 + 1, text: `${solution}`, isCorrect: true, feedback: 'Correct.' },
        { id: questionId * 10 + 2, text: `${total + x}`, isCorrect: false, feedback: 'That moves in the wrong direction.' },
        { id: questionId * 10 + 3, text: `${total}`, isCorrect: false, feedback: 'That does not isolate x.' },
        { id: questionId * 10 + 4, text: `${x}`, isCorrect: false, feedback: 'That reuses the known addend.' },
      ],
      skillIds: [],
    };
  };

  return {
    id: questionId,
    visual: null,
    ...toQuestion(),
  };
};

