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
    const side = 2;
    const total = side * 4;
    const options = [format(total, unit), format(side * 2, unit), format(total + 2, unit)];
    return {
      title: 'Quick Review',
      prompt: `A square has side length ${side} ${unit}. What is the perimeter?`,
      options,
      correctIndex: 0,
      explanation: `${side} + ${side} + ${side} + ${side} = ${format(total, unit)}.`,
    };
  }

  if (dims.shape === 'rectangle') {
    const a = 3;
    const b = 2;
    const total = 2 * a + 2 * b;
    const options = [format(total, unit), format(a + b, unit), format(2 * a + b, unit)];
    return {
      title: 'Quick Review',
      prompt: `A rectangle is ${a} ${unit} by ${b} ${unit}. What is the perimeter?`,
      options,
      correctIndex: 0,
      explanation: `${a} + ${b} + ${a} + ${b} = ${format(total, unit)}.`,
    };
  }

  const a = 2;
  const b = 3;
  const c = 3;
  const total = a + b + c;
  const options = [format(total, unit), format(a + b, unit), format(total + 2, unit)];
  return {
    title: 'Quick Review',
    prompt: `A triangle has sides ${a} ${unit}, ${b} ${unit}, and ${c} ${unit}. What is the perimeter?`,
    options,
    correctIndex: 0,
    explanation: `${a} + ${b} + ${c} = ${format(total, unit)}.`,
  };
};

