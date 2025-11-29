import { describe, expect, test } from 'vitest';

import { loadStructuredFile } from '../utils/files.js';

type QuizOption = {
  text: string;
  isCorrect: boolean;
};

type QuizQuestion = {
  prompt: string;
  options: QuizOption[];
};

type QuizDefinition = {
  questions: QuizQuestion[];
};

type ModuleQuizMapping = Record<string, QuizDefinition>;

describe('module baseline quizzes dataset', () => {
  test('baseline quizzes include expected modules and question counts', async () => {
    const mapping = await loadStructuredFile<ModuleQuizMapping>('data/assessments/module_quizzes.json');
    const moduleSlugs = Object.keys(mapping);

    expect(moduleSlugs.length).toBeGreaterThanOrEqual(2);
    moduleSlugs.forEach((slug) => expect(slug).toMatch(/^\d{1,2}-[a-z0-9-]+$/));

    Object.entries(mapping).forEach(([, quiz]) => {
      expect(quiz.questions.length).toBeGreaterThanOrEqual(3);
      quiz.questions.forEach((question) => {
        expect(question.prompt.trim().length).toBeGreaterThan(0);
        expect(
          question.options.length >= 2 &&
          question.options.some((option) => option.isCorrect),
        ).toBe(true);
      });
    });
  });
});
