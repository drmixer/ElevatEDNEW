import { describe, expect, it } from 'vitest';

import { resolveCheckpointIntent } from '../checkpointIntent';
import { getDeterministicPerimeterCheckpoint } from '../pilotPerimeterCheckpoints';
import type { LessonSection } from '../../types/lesson';

const perimeterSections: LessonSection[] = [
  {
    id: 'intro',
    title: 'Introduction',
    type: 'concept',
    content: 'Imagine you are putting a border around a garden or a ribbon around a picture frame. That outside distance is called the perimeter.',
  },
  {
    id: 'what-is-perimeter',
    title: 'What Is Perimeter?',
    type: 'concept',
    content: 'Perimeter is the distance around the shape. Count every side one time.',
  },
  {
    id: 'square-example',
    title: 'Square Example',
    type: 'example',
    content: 'Suppose a square sandbox has sides that are each 3 feet long. Add 3 + 3 + 3 + 3 = 12.',
  },
  {
    id: 'rectangle-example',
    title: 'Rectangle Example',
    type: 'example',
    content: 'Suppose a rectangle is 4 feet long and 2 feet wide. Add 4 + 2 + 4 + 2 = 12.',
  },
  {
    id: 'triangle-example',
    title: 'Triangle Example',
    type: 'example',
    content: 'Suppose a triangle has side lengths of 2 feet, 3 feet, and 4 feet. Add 2 + 3 + 4 = 9.',
  },
];

describe('resolveCheckpointIntent', () => {
  it('assigns varied intents across the perimeter launch lesson sections', () => {
    expect(
      perimeterSections.map((_, sectionIndex) =>
        resolveCheckpointIntent({
          sections: perimeterSections,
          sectionIndex,
          topic: 'geometry_perimeter_area',
          lessonTitle: 'Perimeter (intro) Launch Lesson',
        }),
      ),
    ).toEqual(['scenario', 'define', 'compute', 'scenario', 'compute']);
  });

  it('keeps story-based perimeter sections from collapsing to a repeated define question', () => {
    const payload = getDeterministicPerimeterCheckpoint({
      sectionContent: perimeterSections[0]?.content ?? '',
      intent: 'scenario',
      seed: 14370001,
    });

    expect(payload?.question.toLowerCase()).toMatch(/outside edge|what are you measuring|what is being traced/);
    expect(payload?.options.join(' ').toLowerCase()).toContain('perimeter');
  });
});
