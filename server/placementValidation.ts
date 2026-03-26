import { HttpError } from './httpError.js';
import { assessAssessmentQuestionQuality } from '../shared/questionQuality.js';

export type PlacementQuestionOption = {
  id: number;
  text: string;
  isCorrect: boolean;
  feedback?: string | null;
};

export type PlacementQuestion = {
  bankQuestionId: number;
  prompt: string;
  type: string;
  options: PlacementQuestionOption[];
  strand?: string | null;
  targetStandards?: string[];
  metadata?: Record<string, unknown> | null;
};

type InvalidReason = { bankQuestionId: number; reason: string };

export type PlacementValidationResult = {
  questions: PlacementQuestion[];
  invalidReasons: InvalidReason[];
  filteredOutCount: number;
};

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[().,:;!?'"[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isPlaceholderOptionText = (value: string): boolean => {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  const exact = new Set([
    'common misconception',
    'partially correct idea',
    'off topic choice',
    'off-topic choice',
    'mostly correct',
    'correct grade level',
  ]);
  if (exact.has(normalized)) return true;
  if (normalized.startsWith('correct answer')) return true;
  return false;
};

export const validatePlacementQuestions = (
  questions: PlacementQuestion[],
  options?: { assessmentId?: number },
): PlacementValidationResult => {
  const supportedTypes = new Set(['multiple_choice', 'true_false']);
  const invalidReasons: InvalidReason[] = [];

  const validated = (questions ?? [])
    .map((question) => {
      if (!question.prompt || !question.prompt.trim().length) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'empty_prompt' });
        return null;
      }

      const normalizedType = question.type?.toLowerCase().trim();
      if (!normalizedType || !supportedTypes.has(normalizedType)) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'unsupported_type' });
        return null;
      }

      const rawOptions = Array.isArray(question.options) ? question.options : [];
      const trimmedOptions = rawOptions
        .map((option) => ({
          ...option,
          text: typeof option.text === 'string' ? option.text.trim() : '',
        }))
        .filter((option) => option.text.length > 0);

      if (trimmedOptions.some((option) => isPlaceholderOptionText(option.text))) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'placeholder_options' });
        return null;
      }

      const deduped: PlacementQuestionOption[] = [];
      const seen = new Set<string>();
      for (const option of trimmedOptions) {
        const key = normalizeText(option.text);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(option);
      }

      const capped = deduped.slice(0, 6);
      if (capped.length < 2) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'insufficient_options' });
        return null;
      }

      const correctCount = capped.filter((option) => option.isCorrect).length;
      if (correctCount < 1 || correctCount >= capped.length) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'invalid_correctness' });
        return null;
      }

      const targetStandards = Array.isArray(question.targetStandards)
        ? question.targetStandards.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        : [];
      if (!targetStandards.length) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'missing_standard_codes' });
        return null;
      }

      const placementLevel =
        typeof question.metadata?.placement_level === 'number'
          ? question.metadata.placement_level
          : typeof question.metadata?.placementLevel === 'number'
            ? question.metadata.placementLevel
            : typeof question.metadata?.target_level === 'number'
              ? question.metadata.target_level
              : typeof question.metadata?.placement_level === 'string'
                ? Number.parseInt(question.metadata.placement_level, 10)
                : typeof question.metadata?.placementLevel === 'string'
                  ? Number.parseInt(question.metadata.placementLevel, 10)
                  : typeof question.metadata?.target_level === 'string'
                    ? Number.parseInt(question.metadata.target_level, 10)
                    : null;

      if (!Number.isFinite(placementLevel)) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'missing_placement_level' });
        return null;
      }

      if (!question.strand || !question.strand.trim().length) {
        invalidReasons.push({ bankQuestionId: question.bankQuestionId, reason: 'missing_strand' });
        return null;
      }

      const quality = assessAssessmentQuestionQuality({
        prompt: question.prompt,
        type: normalizedType,
        options: capped.map((option) => ({
          text: option.text,
          isCorrect: option.isCorrect,
        })),
      });
      if (quality.shouldBlock) {
        invalidReasons.push({
          bankQuestionId: question.bankQuestionId,
          reason: `quality_${quality.reasons[0] ?? 'blocked'}`,
        });
        return null;
      }

      return {
        ...question,
        type: normalizedType,
        options: capped,
        targetStandards,
        metadata: question.metadata ?? {},
      } satisfies PlacementQuestion;
    })
    .filter((question): question is PlacementQuestion => Boolean(question));

  const filteredOutCount = Math.max(0, (questions?.length ?? 0) - validated.length);

  if (!validated.length) {
    throw new HttpError(409, 'Placement assessment content is incomplete.', 'placement_content_invalid', {
      assessmentId: options?.assessmentId ?? null,
      invalidCount: invalidReasons.length,
      reasons: invalidReasons.slice(0, 20),
    });
  }

  return { questions: validated, invalidReasons, filteredOutCount };
};
