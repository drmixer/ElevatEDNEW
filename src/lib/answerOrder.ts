import type { LessonPracticeOption } from '../types';

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const pickTargetIndex = (seed: number, length: number): number => {
  if (length <= 1) return 0;
  const rand = mulberry32(seed ^ 0x9E3779B9);
  return Math.floor(rand() * length);
};

export const shuffleStringsWithCorrectIndex = (
  options: string[],
  correctIndex: number,
  seed: number,
): { options: string[]; correctIndex: number } => {
  const safeOptions = options.map((option) => (option ?? '').toString().trim()).filter(Boolean);
  if (safeOptions.length < 3) {
    return {
      options: safeOptions,
      correctIndex: Math.max(0, Math.min(correctIndex, safeOptions.length - 1)),
    };
  }

  const safeCorrectIndex = Math.max(0, Math.min(correctIndex, safeOptions.length - 1));
  const correctText = safeOptions[safeCorrectIndex] ?? safeOptions[0] ?? '';
  const wrongs = safeOptions.filter((_, index) => index !== safeCorrectIndex);
  const rand = mulberry32(seed);

  for (let index = wrongs.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rand() * (index + 1));
    [wrongs[index], wrongs[swapIndex]] = [wrongs[swapIndex], wrongs[index]];
  }

  const targetIndex = pickTargetIndex(seed, safeOptions.length);
  const arranged: string[] = new Array(safeOptions.length);
  arranged[targetIndex] = correctText;
  let wrongIndex = 0;
  for (let index = 0; index < arranged.length; index += 1) {
    if (index === targetIndex) continue;
    arranged[index] = wrongs[wrongIndex] ?? wrongs[0] ?? '';
    wrongIndex += 1;
  }

  return { options: arranged, correctIndex: targetIndex };
};

export const shufflePracticeOptions = <T extends LessonPracticeOption>(
  options: T[],
  seed: number,
): T[] => {
  const next = options.slice();
  const correct = next.find((option) => option.isCorrect);
  const wrongs = next.filter((option) => !option.isCorrect);
  if (!correct || wrongs.length < 2) return next;

  const rand = mulberry32(seed);
  const shuffledWrongs = wrongs.slice();
  for (let index = shuffledWrongs.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rand() * (index + 1));
    [shuffledWrongs[index], shuffledWrongs[swapIndex]] = [shuffledWrongs[swapIndex], shuffledWrongs[index]];
  }

  const targetIndex = pickTargetIndex(seed, next.length);
  const arranged: T[] = new Array(next.length);
  arranged[targetIndex] = correct;
  let wrongIndex = 0;
  for (let index = 0; index < arranged.length; index += 1) {
    if (index === targetIndex) continue;
    arranged[index] = shuffledWrongs[wrongIndex] ?? shuffledWrongs[0] ?? correct;
    wrongIndex += 1;
  }

  return arranged;
};
