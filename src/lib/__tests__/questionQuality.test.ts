import { describe, expect, it } from 'vitest';
import { assessAssessmentQuestionQuality, assessPracticeQuestionQuality } from '../../../shared/questionQuality';

describe('assessPracticeQuestionQuality', () => {
  it('blocks known generic prompt templates', () => {
    const result = assessPracticeQuestionQuality({
      prompt: 'Which of the following best describes fractions?',
      type: 'multiple_choice',
      options: [
        { text: 'A mathematical concept that helps us solve problems', isCorrect: true },
        { text: 'Something only scientists use', isCorrect: false },
      ],
    });

    expect(result.shouldBlock).toBe(true);
    expect(result.isGeneric).toBe(true);
    expect(result.reasons).toContain('generic_best_describes');
  });

  it('passes concrete contextual prompts', () => {
    const result = assessPracticeQuestionQuality({
      prompt: 'A rectangle has side lengths 4 cm and 7 cm. What is its perimeter?',
      type: 'multiple_choice',
      options: [
        { text: '22 cm', isCorrect: true },
        { text: '11 cm', isCorrect: false },
        { text: '28 cm', isCorrect: false },
      ],
    });

    expect(result.shouldBlock).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it('blocks placeholder or malformed items', () => {
    const placeholder = assessPracticeQuestionQuality({
      prompt: 'TODO: insert question text here',
      type: 'multiple_choice',
      options: [{ text: 'Only one option', isCorrect: true }],
    });

    expect(placeholder.shouldBlock).toBe(true);
    expect(placeholder.reasons).toContain('placeholder_prompt');
    expect(placeholder.reasons).toContain('insufficient_options');
  });

  it('blocks generic scientific-method prompts and classroom-skill prompts', () => {
    const sciencePrompt = assessPracticeQuestionQuality({
      prompt: 'What is the scientific method used when studying chemistry?',
      type: 'multiple_choice',
      options: [
        { text: 'A step-by-step process for testing ideas', isCorrect: true },
        { text: 'A random guess', isCorrect: false },
      ],
    });
    const subjectClassPrompt = assessPracticeQuestionQuality({
      prompt: 'In Social Studies class, which step best evaluates information about this topic?',
      type: 'multiple_choice',
      options: [
        { text: 'Check whether the source is reliable', isCorrect: true },
        { text: 'Pick the longest answer', isCorrect: false },
      ],
    });

    expect(sciencePrompt.shouldBlock).toBe(true);
    expect(sciencePrompt.reasons).toContain('generic_scientific_method');
    expect(subjectClassPrompt.shouldBlock).toBe(true);
    expect(subjectClassPrompt.reasons).toContain('generic_subject_class_step');
  });
});

describe('assessAssessmentQuestionQuality', () => {
  it('blocks generic assessment prompts', () => {
    const result = assessAssessmentQuestionQuality({
      prompt: 'Why is fractions important to learn?',
      type: 'multiple_choice',
      options: [
        { text: 'It helps us solve real-world problems', isCorrect: true },
        { text: 'It has no practical applications', isCorrect: false },
      ],
    });

    expect(result.shouldBlock).toBe(true);
    expect(result.reasons).toContain('generic_important_to_learn');
  });

  it('blocks unsupported assessment types', () => {
    const result = assessAssessmentQuestionQuality({
      prompt: 'Write a paragraph about how fractions are used in recipes.',
      type: 'project',
      options: [],
    });

    expect(result.shouldBlock).toBe(true);
    expect(result.reasons).toContain('unsupported_assessment_type');
  });

  it('allows short-answer assessment questions without options', () => {
    const result = assessAssessmentQuestionQuality({
      prompt: 'Explain how you found the area of a 3 by 5 rectangle.',
      type: 'short_answer',
      options: [],
    });

    expect(result.shouldBlock).toBe(false);
  });
});
