const parseGrade = (gradeBand: string | null | undefined): number | null => {
  const match = (gradeBand ?? '').toString().match(/\d+/);
  if (!match) return null;
  const value = Number.parseInt(match[0] ?? '', 10);
  return Number.isFinite(value) ? value : null;
};

const normalize = (value: string | null | undefined): string => (value ?? '').toString().trim().toLowerCase();

export type Grade2MathPilotTopic =
  | 'perimeter'
  | 'place_value'
  | 'addition_subtraction'
  | 'measurement';

const includesAny = (value: string, needles: string[]): boolean =>
  needles.some((needle) => value.includes(needle));

export const getGrade2MathPilotTopic = (input: {
  subject?: string | null;
  gradeBand?: string | null;
  lessonTitle?: string | null;
}): Grade2MathPilotTopic | null => {
  const subject = normalize(input.subject);
  const grade = parseGrade(input.gradeBand);
  const title = normalize(input.lessonTitle);

  if (!subject.includes('math') || grade !== 2) {
    return null;
  }

  if (includesAny(title, ['perimeter', 'around a shape', 'around the shape', 'side length'])) {
    return 'perimeter';
  }

  if (includesAny(title, ['place value', 'hundreds', 'tens', 'ones', 'expanded form', 'compare numbers'])) {
    return 'place_value';
  }

  if (includesAny(title, ['add', 'subtract', 'sum', 'difference', 'word problem', 'fact fluency'])) {
    return 'addition_subtraction';
  }

  if (includesAny(title, ['measure', 'measurement', 'length', 'ruler', 'inch', 'centimeter', 'time', 'money'])) {
    return 'measurement';
  }

  return null;
};

export const isGrade2MathAdaptivePilot = (input: {
  subject?: string | null;
  gradeBand?: string | null;
  lessonTitle?: string | null;
}): boolean => getGrade2MathPilotTopic(input) !== null;

export const isGrade2MathPerimeterPilot = (input: {
  subject?: string | null;
  gradeBand?: string | null;
  lessonTitle?: string | null;
}): boolean => {
  return getGrade2MathPilotTopic(input) === 'perimeter';
};
