import { describe, expect, it } from 'vitest';

import { getGrade2MathPilotTopic, isGrade2MathAdaptivePilot, isGrade2MathPerimeterPilot } from '../pilotConditions';

describe('pilotConditions', () => {
  it('detects perimeter pilot lessons', () => {
    const topic = getGrade2MathPilotTopic({
      subject: 'Mathematics',
      gradeBand: '2',
      lessonTitle: 'Perimeter of Rectangles',
    });
    expect(topic).toBe('perimeter');
    expect(isGrade2MathPerimeterPilot({ subject: 'Mathematics', gradeBand: '2', lessonTitle: 'Perimeter Basics' })).toBe(true);
  });

  it('detects place value pilot lessons', () => {
    const topic = getGrade2MathPilotTopic({
      subject: 'Mathematics',
      gradeBand: '2',
      lessonTitle: 'Place Value: Hundreds Tens Ones',
    });
    expect(topic).toBe('place_value');
  });

  it('detects addition and subtraction pilot lessons', () => {
    const topic = getGrade2MathPilotTopic({
      subject: 'Mathematics',
      gradeBand: '2',
      lessonTitle: 'Add and Subtract Within 100',
    });
    expect(topic).toBe('addition_subtraction');
  });

  it('detects measurement pilot lessons', () => {
    const topic = getGrade2MathPilotTopic({
      subject: 'Mathematics',
      gradeBand: '2',
      lessonTitle: 'Length Measurement With a Ruler',
    });
    expect(topic).toBe('measurement');
    expect(isGrade2MathAdaptivePilot({ subject: 'Mathematics', gradeBand: '2', lessonTitle: 'Length Measurement' })).toBe(true);
  });

  it('does not enable pilot outside grade 2 math', () => {
    expect(getGrade2MathPilotTopic({ subject: 'Science', gradeBand: '2', lessonTitle: 'Perimeter' })).toBeNull();
    expect(isGrade2MathAdaptivePilot({ subject: 'Mathematics', gradeBand: '3', lessonTitle: 'Perimeter' })).toBe(false);
  });
});
