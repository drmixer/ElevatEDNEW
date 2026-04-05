export type PracticeQuestionOptionInput = {
  text: string | null | undefined;
  isCorrect?: boolean | null;
};

export type PracticeQuestionQualityInput = {
  prompt: string | null | undefined;
  options?: PracticeQuestionOptionInput[] | null;
  type?: string | null;
};

export type PracticeQuestionQualityResult = {
  shouldBlock: boolean;
  isGeneric: boolean;
  reasons: string[];
};

export type AssessmentQuestionQualityInput = PracticeQuestionQualityInput;
export type AssessmentQuestionQualityResult = PracticeQuestionQualityResult;

const PLACEHOLDER_PROMPT_PATTERN =
  /(\b(lorem ipsum|placeholder|tbd|todo)\b|_{3,}|\[\s*insert\b|\{\{[^}]+\}\})/i;

const GENERIC_PROMPT_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: 'generic_best_describes', pattern: /^which of the following best describes\b/i },
  { code: 'generic_first_step', pattern: /^when working with .+ what is the first step\b/i },
  { code: 'generic_important_to_learn', pattern: /^why is .+ important to learn\b/i },
  { code: 'generic_scientific_method', pattern: /^what is the scientific method used when studying\b/i },
  { code: 'generic_stuck_prompt', pattern: /^what should you do if you get stuck\b/i },
  { code: 'generic_reason_we_study', pattern: /^what is one reason we study\b/i },
  { code: 'generic_historians_typically', pattern: /^when analyzing .+ historians typically\b/i },
  { code: 'generic_help_you_today', pattern: /^how can learning about .+ help you today\b/i },
  { code: 'generic_subject_class_step', pattern: /^in .+ class, which step best\b/i },
  { code: 'generic_skill_studying', pattern: /^what is an important skill when studying\b/i },
  { code: 'generic_benefit_learning', pattern: /^what is one benefit of learning about\b/i },
  { code: 'generic_apply_learning', pattern: /^how might you apply what you learn about\b/i },
  { code: 'generic_mastering_approach', pattern: /^what is a good approach to mastering\b/i },
  { code: 'generic_purpose_topic', pattern: /^what is the purpose of .+\b/i },
  { code: 'generic_explore_topics', pattern: /^why is it important to explore topics like\b/i },
  { code: 'generic_main_concept', pattern: /\bmain concept\b/i },
  { code: 'generic_key_strategy', pattern: /\bkey strategy\b/i },
];

const GENERIC_OPTION_PATTERNS = [
  /\bonly (scientists|historians|adults|professionals) need\b/i,
  /\bno (practical applications|real value|connection to today)\b/i,
  /\bnever use in real life\b/i,
  /\bgive up immediately\b/i,
  /\bskip (reading|all the hard parts)\b/i,
  /\bmake things up\b/i,
  /\baccepting everything without question\b/i,
  /\bhas no practical applications\b/i,
];

const SUPPORTED_ASSESSMENT_TYPES = new Set([
  'multiple_choice',
  'true_false',
  'short_answer',
  'essay',
  'fill_blank',
]);

const normalizeText = (value: string | null | undefined): string =>
  (value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const isMultipleChoice = (type: string | null | undefined): boolean => {
  if (!type) return true;
  const normalized = type.trim().toLowerCase();
  return normalized === 'multiple_choice' || normalized === 'true_false';
};

export const assessPracticeQuestionQuality = (
  input: PracticeQuestionQualityInput,
): PracticeQuestionQualityResult => {
  const reasons: string[] = [];
  const prompt = normalizeText(input.prompt);
  const promptLower = prompt.toLowerCase();

  if (!prompt.length) {
    reasons.push('empty_prompt');
  } else {
    if (PLACEHOLDER_PROMPT_PATTERN.test(prompt)) {
      reasons.push('placeholder_prompt');
    }

    for (const entry of GENERIC_PROMPT_PATTERNS) {
      if (entry.pattern.test(promptLower)) {
        reasons.push(entry.code);
      }
    }
  }

  const options = (input.options ?? [])
    .map((option) => ({
      text: normalizeText(option.text),
      isCorrect: Boolean(option.isCorrect),
    }))
    .filter((option) => option.text.length > 0);

  if (isMultipleChoice(input.type)) {
    if (options.length < 2) {
      reasons.push('insufficient_options');
    }
    if (!options.some((option) => option.isCorrect)) {
      reasons.push('missing_correct_option');
    }
  }

  const genericOptionCount = options.reduce((count, option) => {
    if (GENERIC_OPTION_PATTERNS.some((pattern) => pattern.test(option.text.toLowerCase()))) {
      return count + 1;
    }
    return count;
  }, 0);

  if (genericOptionCount >= 2) {
    reasons.push('generic_distractors');
  }

  const isGeneric = reasons.some((reason) => reason.startsWith('generic_') || reason === 'placeholder_prompt');
  const shouldBlock =
    isGeneric ||
    reasons.includes('empty_prompt') ||
    reasons.includes('insufficient_options') ||
    reasons.includes('missing_correct_option');

  return { shouldBlock, isGeneric, reasons };
};

export const assessAssessmentQuestionQuality = (
  input: AssessmentQuestionQualityInput,
): AssessmentQuestionQualityResult => {
  const result = assessPracticeQuestionQuality(input);
  const normalizedType = normalizeText(input.type).toLowerCase();
  const reasons = [...result.reasons];

  if (normalizedType.length > 0 && !SUPPORTED_ASSESSMENT_TYPES.has(normalizedType)) {
    reasons.push('unsupported_assessment_type');
  }

  return {
    ...result,
    shouldBlock: result.shouldBlock || reasons.includes('unsupported_assessment_type'),
    reasons: Array.from(new Set(reasons)),
  };
};

export const incrementQuestionQualityReasonCounts = (
  counts: Record<string, number>,
  reasons: string[],
): void => {
  for (const reason of reasons) {
    counts[reason] = (counts[reason] ?? 0) + 1;
  }
};
