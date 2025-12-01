import { describe, expect, it } from 'vitest';

import {
  computeSubjectStatus,
  computeSubjectStatuses,
  onTrackBadge,
  onTrackDescription,
  onTrackLabel,
} from '../onTrack';
import type { Subject, SubjectMastery } from '../../types';

describe('onTrack helpers', () => {
  it('classifies on-track when pacing and mastery are healthy', () => {
    const status = computeSubjectStatus({ subject: 'math', mastery: 80, lessonsThisWeek: 2 });
    expect(status.status).toBe('on_track');
    expect(onTrackLabel(status.status)).toBe('On-track');
  });

  it('flags at-risk when pacing is low or mastery <70', () => {
    const status = computeSubjectStatus({ subject: 'english', mastery: 68, lessonsThisWeek: 2 });
    expect(status.status).toBe('at_risk');
  });

  it('flags off-track when no lessons or very low mastery', () => {
    const status = computeSubjectStatus({ subject: 'science', mastery: 50, lessonsThisWeek: 0 });
    expect(status.status).toBe('off_track');
    expect(onTrackDescription(status.status)).toContain('No recent lessons');
  });

  it('spreads lessons across subjects when per-subject count missing', () => {
    const mastery: SubjectMastery[] = [
      { subject: 'math', mastery: 75 },
      { subject: 'english', mastery: 65 },
    ];
    const statuses = computeSubjectStatuses({
      masteryBySubject: mastery,
      lessonsCompletedWeek: 4,
    });
    expect(statuses).toHaveLength(2);
    expect(statuses[0].drivers.join(' ')).toContain('2/2 lessons');
  });

  it('uses per-subject lessons and diagnostic freshness when provided', () => {
    const lessonsBySubject = new Map<Subject, number>([
      ['math', 1],
      ['english', 3],
    ]);
    const mastery: SubjectMastery[] = [
      { subject: 'math', mastery: 80 },
      { subject: 'english', mastery: 80 },
    ];
    const statuses = computeSubjectStatuses({
      masteryBySubject: mastery,
      lessonsCompletedWeek: 4,
      lessonsBySubject,
      diagnosticCompletedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(statuses[0].drivers.some((d) => d.includes('Diagnostic'))).toBe(true);
    expect(statuses[1].drivers[0]).toContain('3/2 lessons');
  });

  it('returns stable badge classes', () => {
    expect(onTrackBadge('on_track')).toContain('emerald');
    expect(onTrackBadge('at_risk')).toContain('amber');
    expect(onTrackBadge('off_track')).toContain('rose');
  });
});
