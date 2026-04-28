import { describe, expect, it } from 'vitest';

import {
  buildScienceDailyPlan,
  buildScienceModuleMap,
  chooseScienceAssignment,
  type ScienceEvidence,
  type ScienceSkeletonModule,
} from '../../shared/scienceHomeschool';

const rows: ScienceSkeletonModule[] = [
  { grade: 3, subject: 'Science', strand: 'Earth & Space', topic: 'Weather & Seasons' },
  { grade: 3, subject: 'Science', strand: 'Life Science', topic: 'Plant Growth' },
  { grade: 4, subject: 'Science', strand: 'Physical Science', topic: 'Forces and Motion' },
  { grade: 4, subject: 'Science', strand: 'Engineering Practices', topic: 'Bridge Design' },
];

describe('scienceHomeschool', () => {
  it('builds a grades 3-8 science module map by strand', () => {
    const map = buildScienceModuleMap(rows);

    expect(map.modules.map((module) => module.slug)).toEqual([
      '3-science-earth-and-space-weather-and-seasons',
      '3-science-life-science-plant-growth',
      '4-science-physical-science-forces-and-motion',
      '4-science-engineering-practices-bridge-design',
    ]);
    expect(map.modules[0].strand).toBe('earth_space');
    expect(map.modules[1].strand).toBe('life_science');
  });

  it('starts with a diagnostic when there is no recent science evidence', () => {
    const scienceMap = buildScienceModuleMap(rows);
    const decision = chooseScienceAssignment({ scienceMap });

    expect(decision.action).toBe('diagnose');
    expect(decision.reasonCode).toBe('no_recent_evidence');
    expect(decision.recommendedModuleSlug).toBe('3-science-earth-and-space-weather-and-seasons');
  });

  it('repairs weak science evidence before advancing', () => {
    const scienceMap = buildScienceModuleMap(rows);
    const recentEvidence: ScienceEvidence[] = [
      {
        moduleSlug: '3-science-life-science-plant-growth',
        scorePct: 62,
        completedAt: '2026-04-27T12:00:00.000Z',
      },
    ];

    const decision = chooseScienceAssignment({ scienceMap, recentEvidence });

    expect(decision.action).toBe('repair');
    expect(decision.reasonCode).toBe('weak_science_evidence');
    expect(decision.recommendedModuleSlug).toBe('3-science-life-science-plant-growth');
  });

  it('builds a science daily plan with required CER evidence blocks', () => {
    const scienceMap = buildScienceModuleMap(rows);
    const plan = buildScienceDailyPlan({ scienceMap, studentId: 'student-1', date: '2026-04-27' });

    expect(plan.studentId).toBe('student-1');
    expect(plan.date).toBe('2026-04-27');
    expect(plan.subjects[0].subject).toBe('science');
    expect(plan.blocks.map((block) => block.kind)).toEqual(['diagnostic', 'guided_practice', 'reflection']);
    expect(plan.blocks.every((block) => block.required)).toBe(true);
  });
});
