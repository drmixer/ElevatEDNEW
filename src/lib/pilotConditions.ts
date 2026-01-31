const parseGrade = (gradeBand: string | null | undefined): number | null => {
  const match = (gradeBand ?? '').toString().match(/\d+/);
  if (!match) return null;
  const value = Number.parseInt(match[0] ?? '', 10);
  return Number.isFinite(value) ? value : null;
};

const normalize = (value: string | null | undefined): string => (value ?? '').toString().trim().toLowerCase();

export const isGrade2MathPerimeterPilot = (input: {
  subject?: string | null;
  gradeBand?: string | null;
  lessonTitle?: string | null;
}): boolean => {
  const subject = normalize(input.subject);
  const grade = parseGrade(input.gradeBand);
  const title = normalize(input.lessonTitle);
  return subject.includes('math') && grade === 2 && title.includes('perimeter');
};

