export type MathAdaptiveVariantKind =
  | 'repair_lesson'
  | 'guided_repair_practice'
  | 'challenge_task'
  | 'exit_ticket';

export type MathAdaptiveVariantPracticeItem = {
  prompt: string;
  answer: string;
  explanation: string;
};

export type MathAdaptiveVariant = {
  id: string;
  moduleSlug: string;
  kind: MathAdaptiveVariantKind;
  title: string;
  estimatedMinutes: number;
  purpose: string;
  markdown: string;
  practiceItems: MathAdaptiveVariantPracticeItem[];
  masteryCheck: string;
};

export type MathAdaptiveVariantCatalog = {
  version: number;
  scope: {
    subject: 'Mathematics';
    grades: number[];
    concepts: string[];
  };
  variants: MathAdaptiveVariant[];
};

export const findMathAdaptiveVariant = (
  catalog: MathAdaptiveVariantCatalog | null | undefined,
  moduleSlug: string,
  kind: MathAdaptiveVariantKind,
): MathAdaptiveVariant | null =>
  catalog?.variants.find((variant) => variant.moduleSlug === moduleSlug && variant.kind === kind) ?? null;

export const findMathAdaptiveVariantById = (
  catalog: MathAdaptiveVariantCatalog | null | undefined,
  variantId: string,
): MathAdaptiveVariant | null =>
  catalog?.variants.find((variant) => variant.id === variantId) ?? null;
