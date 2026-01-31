import { extractPerimeterDimensionsFromText } from './lessonVisuals';
import type { PerimeterDimensions } from './lessonVisuals';

export type PilotCheckpointIntent = 'define' | 'compute' | 'scenario';

export type PilotCheckpointPayload = {
  visual?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

const unitAbbrev = (unit: string): string => {
  const u = (unit ?? '').toString().toLowerCase();
  if (u === 'foot' || u === 'feet' || u === 'ft') return 'ft';
  if (u === 'inch' || u === 'inches' || u === 'in') return 'in';
  return u || 'units';
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

const pick = <T,>(items: T[], rand: () => number): T => {
  const idx = Math.max(0, Math.min(items.length - 1, Math.floor(rand() * items.length)));
  return items[idx] as T;
};

const hasNumbers = (text: string): boolean => /\d/.test(text);

const perimeterEqTotal = (text: string): { sum: string; total: number; unit: string } | null => {
  const match = text.match(/Perimeter\s*=\s*([0-9+\s]+)=\s*([0-9]+)\s*([a-zA-Z]+)?/i);
  if (!match) return null;
  const sum = (match[1] ?? '').toString().replace(/\s+/g, ' ').trim();
  const total = Number.parseInt((match[2] ?? '').toString(), 10);
  const unit = (match[3] ?? 'units').toString().trim().toLowerCase();
  if (!Number.isFinite(total) || total <= 0) return null;
  return { sum, total, unit };
};

const buildComputeFromDims = (dims: PerimeterDimensions, intent: PilotCheckpointIntent, rand: () => number): PilotCheckpointPayload => {
  const unit = unitAbbrev(dims.unit);

  if (dims.shape === 'square') {
    const total = dims.a * 4;
    const questionTemplates = [
      `A square has side length ${dims.a} ${unit}. What is the perimeter?`,
      `A square has sides of ${dims.a} ${unit}. What is the perimeter?`,
      `Add the sides: the square’s side is ${dims.a} ${unit}. What is the perimeter?`,
    ];
    const storyTemplates = [
      `A ribbon goes around a square. Each side is ${dims.a} ${unit}. How long is the ribbon?`,
      `A fence goes around a square. Each side is ${dims.a} ${unit}. How much fence is needed?`,
      `String goes around a square. Each side is ${dims.a} ${unit}. How long is the string?`,
    ];

    const distractors = [
      `${Math.max(1, total - dims.a)} ${unit}`,
      `${total + dims.a} ${unit}`,
      `${Math.max(1, total - 2)} ${unit}`,
      `${total + 2} ${unit}`,
    ];
    const options = [`${total} ${unit}`, ...distractors].slice(0, 4);

    return {
      question: intent === 'scenario' ? pick(storyTemplates, rand) : pick(questionTemplates, rand),
      options,
      correctIndex: 0,
      explanation: `Add all 4 sides: ${dims.a} + ${dims.a} + ${dims.a} + ${dims.a} = ${total} ${unit}.`,
    };
  }

  if (dims.shape === 'rectangle') {
    const total = 2 * dims.a + 2 * dims.b;
    const questionTemplates = [
      `A rectangle is ${dims.a} ${unit} by ${dims.b} ${unit}. What is the perimeter?`,
      `A rectangle has sides ${dims.a} ${unit} and ${dims.b} ${unit}. What is the perimeter?`,
      `Add all sides of the rectangle (${dims.a} and ${dims.b}). What is the perimeter?`,
    ];
    const storyTemplates = [
      `A fence goes around a garden that is ${dims.a} ${unit} by ${dims.b} ${unit}. How much fence is needed?`,
      `A ribbon goes around a rectangle that is ${dims.a} ${unit} by ${dims.b} ${unit}. How long is the ribbon?`,
      `String goes around a rectangle that is ${dims.a} ${unit} by ${dims.b} ${unit}. How long is the string?`,
    ];

    const distractors = [
      `${dims.a + dims.b} ${unit}`,
      `${2 * dims.a + dims.b} ${unit}`,
      `${2 * dims.b + dims.a} ${unit}`,
      `${total + 2} ${unit}`,
    ];
    const options = [`${total} ${unit}`, ...distractors].slice(0, 4);

    return {
      question: intent === 'scenario' ? pick(storyTemplates, rand) : pick(questionTemplates, rand),
      options,
      correctIndex: 0,
      explanation: `Add all the sides: ${dims.a} + ${dims.b} + ${dims.a} + ${dims.b} = ${total} ${unit}.`,
    };
  }

  const total = dims.a + dims.b + dims.c;
  const questionTemplates = [
    `A triangle has sides ${dims.a} ${unit}, ${dims.b} ${unit}, and ${dims.c} ${unit}. What is the perimeter?`,
    `Add the 3 sides (${dims.a}, ${dims.b}, and ${dims.c}). What is the perimeter?`,
    `Triangle sides are ${dims.a} ${unit}, ${dims.b} ${unit}, ${dims.c} ${unit}. What is the perimeter?`,
  ];
  const storyTemplates = [
    `String goes around a triangle with sides ${dims.a} ${unit}, ${dims.b} ${unit}, and ${dims.c} ${unit}. How long is the string?`,
    `A ribbon goes around a triangle with sides ${dims.a} ${unit}, ${dims.b} ${unit}, and ${dims.c} ${unit}. How long is the ribbon?`,
    `A fence goes around a triangle with sides ${dims.a} ${unit}, ${dims.b} ${unit}, and ${dims.c} ${unit}. How much fence is needed?`,
  ];

  const distractors = [
    `${dims.a + dims.b} ${unit}`,
    `${total + 2} ${unit}`,
    `${Math.max(1, total - 2)} ${unit}`,
    `${dims.b + dims.c} ${unit}`,
  ];
  const options = [(`${total} ${unit}`), ...distractors].slice(0, 4);

  return {
    question: intent === 'scenario' ? pick(storyTemplates, rand) : pick(questionTemplates, rand),
    options,
    correctIndex: 0,
    explanation: `Add the 3 side lengths: ${dims.a} + ${dims.b} + ${dims.c} = ${total} ${unit}.`,
  };
};

const buildDefine = (rand: () => number): PilotCheckpointPayload => {
  const variants: Array<{ question: string; options: string[]; correctIndex: number; explanation: string }> = [
    {
      question: 'What does perimeter measure?',
      options: [
        'The distance around the outside of a shape',
        'The space inside a shape',
        'The number of corners on a shape',
        'How heavy something is',
      ],
      correctIndex: 0,
      explanation: 'Perimeter means you go all the way around the outside edges.',
    },
    {
      question: 'Perimeter is…',
      options: [
        'the distance around a shape',
        'the space inside a shape',
        'how long one side is',
        'how many corners a shape has',
      ],
      correctIndex: 0,
      explanation: 'Perimeter is the distance around the outside.',
    },
    {
      question: 'To find perimeter, you should…',
      options: [
        'add all the side lengths',
        'multiply the side lengths',
        'count the corners',
        'find the area',
      ],
      correctIndex: 0,
      explanation: 'Perimeter is found by adding the side lengths.',
    },
  ];

  const chosen = pick(variants, rand);
  return {
    question: chosen.question,
    options: chosen.options.slice(0, 4),
    correctIndex: chosen.correctIndex,
    explanation: chosen.explanation,
  };
};

export const getDeterministicPerimeterCheckpoint = (input: {
  sectionContent: string;
  intent: PilotCheckpointIntent;
  seed: number;
}): PilotCheckpointPayload | null => {
  const text = (input.sectionContent ?? '').toString();
  if (!text.trim()) return null;

  const rand = mulberry32(input.seed);

  // Respect "answerable from section content": only compute/scenario when the section includes numbers.
  const effectiveIntent: PilotCheckpointIntent =
    (input.intent === 'compute' || input.intent === 'scenario') && !hasNumbers(text) ? 'define' : input.intent;

  if (effectiveIntent === 'define') {
    return buildDefine(rand);
  }

  const dims = extractPerimeterDimensionsFromText(text);
  if (dims) {
    return buildComputeFromDims(dims, effectiveIntent, rand);
  }

  // If we can't extract a shape but the section includes an explicit equation, ask about the total.
  const eq = perimeterEqTotal(text);
  if (eq) {
    const unit = unitAbbrev(eq.unit);
    const total = eq.total;
    const options = [
      `${total} ${unit}`,
      `${total + 2} ${unit}`,
      `${Math.max(1, total - 2)} ${unit}`,
      `${total + 4} ${unit}`,
    ].slice(0, 4);
    return {
      visual: `Perimeter = ${eq.sum} = ${total} ${unit}`,
      question:
        effectiveIntent === 'scenario'
          ? `A string goes around the shape. How long is the string?`
          : 'In this example, what is the perimeter?',
      options,
      correctIndex: 0,
      explanation: `Perimeter is the total distance around. Here it is ${total} ${unit}.`,
    };
  }

  // Final fallback.
  return buildDefine(rand);
};

