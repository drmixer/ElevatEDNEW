import type { LessonSection } from '../types/lesson';
import { extractPerimeterDimensionsFromText } from './lessonVisuals';

export type CheckpointIntent = 'define' | 'compute' | 'scenario';

const DEFAULT_INTENTS: CheckpointIntent[] = ['define', 'compute', 'scenario'];

const isPerimeterSection = (section: LessonSection | undefined | null): boolean => {
  const text = `${section?.title ?? ''}\n${section?.content ?? ''}`.toLowerCase();
  return /\bperimeter\b|\brectangle\b|\bsquare\b|\btriangle\b/.test(text);
};

const isPerimeterStorySection = (section: LessonSection | undefined | null): boolean => {
  const text = `${section?.title ?? ''}\n${section?.content ?? ''}`.toLowerCase();
  return /\bintroduction\b|\breal-world\b|\breal world\b|\bgarden\b|\bribbon\b|\bfence\b|\bframe\b|\bborder\b/.test(text);
};

const isPerimeterConceptSection = (section: LessonSection | undefined | null): boolean => {
  const text = `${section?.title ?? ''}\n${section?.content ?? ''}`.toLowerCase();
  return /\bwhat is perimeter\b|\bperimeter is\b|\boutside edge\b|\bcount every side\b/.test(text);
};

const perimeterExampleOrdinal = (sections: LessonSection[], sectionIndex: number): number => {
  let ordinal = -1;
  for (let index = 0; index <= sectionIndex; index += 1) {
    if (extractPerimeterDimensionsFromText(sections[index]?.content ?? '')) {
      ordinal += 1;
    }
  }
  return ordinal;
};

export const resolveCheckpointIntent = (input: {
  sections: LessonSection[];
  sectionIndex: number;
  topic?: string | null;
  lessonTitle?: string | null;
}): CheckpointIntent => {
  const sectionIndex = Math.max(0, Math.min(input.sectionIndex, input.sections.length - 1));
  const currentSection = input.sections[sectionIndex];
  const lessonText = `${input.lessonTitle ?? ''}\n${currentSection?.title ?? ''}`.toLowerCase();
  const defaultIntent = DEFAULT_INTENTS[sectionIndex % DEFAULT_INTENTS.length] ?? 'define';

  const isPerimeterTopic =
    input.topic === 'geometry_perimeter_area' ||
    /\bperimeter\b/.test(lessonText) ||
    isPerimeterSection(currentSection);

  if (!isPerimeterTopic || !currentSection) {
    return defaultIntent;
  }

  const dims = extractPerimeterDimensionsFromText(currentSection.content ?? '');
  if (dims) {
    const ordinal = perimeterExampleOrdinal(input.sections, sectionIndex);
    return ordinal % 2 === 0 ? 'compute' : 'scenario';
  }

  if (isPerimeterStorySection(currentSection)) {
    return 'scenario';
  }

  if (isPerimeterConceptSection(currentSection)) {
    return 'define';
  }

  return defaultIntent;
};
