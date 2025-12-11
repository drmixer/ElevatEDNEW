import type { Subject } from '../types';

type CuratedAlternate = {
  id: string;
  subject: 'math' | 'ela';
  keywords: string[];
  explanation: string;
};

const curatedAlternates: CuratedAlternate[] = [
  {
    id: 'fractions-number-line',
    subject: 'math',
    keywords: ['fraction', 'decimal', 'ratio', 'equivalent', 'number line'],
    explanation:
      'Picture a number line from 0 to 1. Fractions mark a spot on that line (1/2 sits halfway). To compare, line up each fraction on the same line or turn them into “pieces out of 100” (e.g., 1/4 = 25/100). Quick check: which is bigger—1/3 or 3/8? Draw a line and mark them.',
  },
  {
    id: 'linear-equations-balance',
    subject: 'math',
    keywords: ['equation', 'variable', 'slope', 'line', 'solve'],
    explanation:
      'Treat each equation like a balance scale. Whatever you do to one side, you must do to the other. Move constants to the right, variables to the left, then divide to isolate the variable. Quick check: solve 3x + 6 = 21—subtract 6 on both sides, then divide by 3.',
  },
  {
    id: 'main-idea',
    subject: 'ela',
    keywords: ['main idea', 'central idea', 'theme', 'summary'],
    explanation:
      'Ask: who or what is this mostly about, and what is the most important thing said about it? Look for repeated words or ideas. Quick check: after a paragraph, finish the sentence “This is mainly about…, and it shows that…”.',
  },
  {
    id: 'text-evidence',
    subject: 'ela',
    keywords: ['evidence', 'quote', 'cite', 'paragraph', 'support'],
    explanation:
      'Use the RACE move: Restate the question, Answer it, Cite one short quote, Explain how the quote proves your answer. Quick check: write one sentence that includes a quote and your explanation joined by “because”.',
  },
];

export const findCuratedAlternate = (subject?: Subject | string | null, focus?: string | null): string | null => {
  if (!subject && !focus) return null;
  const normalizedSubject = (subject ?? '').toString().toLowerCase();
  const focusText = (focus ?? '').toLowerCase();
  const subjectKey =
    normalizedSubject.includes('math') || focusText.includes('math')
      ? 'math'
      : normalizedSubject.includes('ela') || normalizedSubject.includes('english') || focusText.includes('reading')
        ? 'ela'
        : null;
  const candidates = curatedAlternates.filter((entry) => !subjectKey || entry.subject === subjectKey);
  const match = candidates.find((entry) =>
    entry.keywords.some((keyword) => focusText.includes(keyword) || normalizedSubject.includes(keyword)),
  );
  return match?.explanation ?? null;
};
