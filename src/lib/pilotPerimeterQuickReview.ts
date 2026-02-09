import type { PerimeterDimensions } from './lessonVisuals';

export type PilotQuickReview = {
  title: string;
  prompt: string;
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

const format = (value: number, unit: string) => `${value} ${unit}`;

const buildOptions = (correct: number, distractors: number[], unit: string): string[] => {
  const unique = new Set<number>();
  unique.add(correct);
  for (const value of distractors) {
    if (!Number.isFinite(value)) continue;
    const rounded = Math.max(1, Math.round(value));
    if (rounded === correct) continue;
    unique.add(rounded);
    if (unique.size >= 3) break;
  }

  let delta = 2;
  while (unique.size < 3) {
    unique.add(correct + delta);
    delta += 2;
  }

  const values = Array.from(unique);
  return values.slice(0, 3).map((value) => format(value, unit));
};

export const getPerimeterQuickReview = (dims: PerimeterDimensions | null): PilotQuickReview => {
  if (!dims) {
    return {
      title: 'Quick Review',
      prompt: 'What does perimeter measure?',
      options: [
        'The distance around the outside of a shape',
        'The space inside a shape',
        'The number of corners on a shape',
      ],
      correctIndex: 0,
      explanation: 'Perimeter means you go all the way around the outside edges.',
    };
  }

  const unit = unitAbbrev(dims.unit);

  if (dims.shape === 'square') {
    const side = dims.a;
    const total = side * 4;
    const options = buildOptions(total, [side * 2, total + side, total - side], unit);
    return {
      title: 'Quick Review',
      prompt: `A square has side length ${side} ${unit}. What is the perimeter?`,
      options,
      correctIndex: 0,
      explanation: `${side} + ${side} + ${side} + ${side} = ${format(total, unit)}.`,
    };
  }

  if (dims.shape === 'rectangle') {
    const a = dims.a;
    const b = dims.b;
    const total = 2 * a + 2 * b;
    const options = buildOptions(total, [a + b, 2 * a + b, a + 2 * b], unit);
    return {
      title: 'Quick Review',
      prompt: `A rectangle is ${a} ${unit} by ${b} ${unit}. What is the perimeter?`,
      options,
      correctIndex: 0,
      explanation: `${a} + ${b} + ${a} + ${b} = ${format(total, unit)}.`,
    };
  }

  const a = dims.a;
  const b = dims.b;
  const c = dims.c;
  const total = a + b + c;
  const options = buildOptions(total, [a + b, b + c, total - 2], unit);
  return {
    title: 'Quick Review',
    prompt: `A triangle has sides ${a} ${unit}, ${b} ${unit}, and ${c} ${unit}. What is the perimeter?`,
    options,
    correctIndex: 0,
    explanation: `${a} + ${b} + ${c} = ${format(total, unit)}.`,
  };
};
