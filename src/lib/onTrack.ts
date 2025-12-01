import type { Subject, SubjectMastery } from '../types';

export type OnTrackStatus = 'on_track' | 'at_risk' | 'off_track';

export type SubjectStatus = {
  subject: Subject;
  status: OnTrackStatus;
  drivers: string[];
  recommendation: string;
};

const LESSON_PACE: Record<Subject, number> = {
  math: 2,
  english: 2,
  science: 1,
  social_studies: 1,
  study_skills: 1,
};

const subjectLabel = (subject: Subject): string => subject.replace(/_/g, ' ');

const describeDrivers = (
  subject: Subject,
  mastery: number | null | undefined,
  lessonsThisWeek: number | null | undefined,
  diagnosticCompletedAt?: string | Date | null,
) => {
  const drivers: string[] = [];
  const recommended = LESSON_PACE[subject] ?? 1;
  const lessons = lessonsThisWeek ?? 0;
  if (lessons === 0) {
    drivers.push('No lessons this week');
  } else if (lessons < recommended) {
    drivers.push(`Pacing below target (${lessons}/${recommended} lessons)`);
  } else {
    drivers.push(`On pacing (${lessons}/${recommended} lessons)`);
  }

  if (mastery == null || Number.isNaN(mastery)) {
    drivers.push('Mastery pending');
  } else if (mastery < 55) {
    drivers.push(`Mastery low (${Math.round(mastery)}%)`);
  } else if (mastery < 70) {
    drivers.push(`Mastery needs attention (${Math.round(mastery)}%)`);
  } else {
    drivers.push(`Mastery healthy (${Math.round(mastery)}%)`);
  }

  if (diagnosticCompletedAt) {
    const completed = new Date(diagnosticCompletedAt);
    const ageDays = Math.floor((Date.now() - completed.getTime()) / (1000 * 60 * 60 * 24));
    if (Number.isFinite(ageDays)) {
      drivers.push(ageDays > 90 ? `Diagnostic stale (${ageDays} days)` : `Diagnostic ${ageDays} days ago`);
    }
  } else {
    drivers.push('Diagnostic missing');
  }

  return drivers;
};

export const computeSubjectStatus = ({
  subject,
  mastery,
  lessonsThisWeek,
  diagnosticCompletedAt,
}: {
  subject: Subject;
  mastery: number | null | undefined;
  lessonsThisWeek: number | null | undefined;
  diagnosticCompletedAt?: string | Date | null;
}): SubjectStatus => {
  const drivers = describeDrivers(subject, mastery, lessonsThisWeek, diagnosticCompletedAt);
  const recommended = LESSON_PACE[subject] ?? 1;
  const lessons = lessonsThisWeek ?? 0;
  const masteryValue = mastery ?? null;
  const diagnosticStale =
    diagnosticCompletedAt &&
    Number.isFinite(new Date(diagnosticCompletedAt).getTime()) &&
    new Date(diagnosticCompletedAt).getTime() < Date.now() - 90 * 24 * 60 * 60 * 1000;

  let status: OnTrackStatus = 'on_track';
  if (lessons === 0) {
    status = 'off_track';
  } else if (lessons < recommended || (masteryValue !== null && masteryValue < 70)) {
    status = 'at_risk';
  }
  if (masteryValue !== null && masteryValue < 55) {
    status = 'off_track';
  }
  if (diagnosticStale) {
    status = 'off_track';
  }

  const recommendation =
    status === 'on_track'
      ? 'Keep pace and check in at the end of the week.'
      : status === 'at_risk'
        ? 'Aim for one more lesson and a quick checkpoint review.'
        : 'Schedule a lesson and review recent checkpoints together.';

  return {
    subject,
    status,
    drivers,
    recommendation,
  };
};

export const computeSubjectStatuses = ({
  masteryBySubject,
  lessonsCompletedWeek,
  lessonsBySubject,
  diagnosticCompletedAt,
}: {
  masteryBySubject: SubjectMastery[];
  lessonsCompletedWeek: number | null | undefined;
  lessonsBySubject?: Map<Subject, number>;
  diagnosticCompletedAt?: string | Date | null;
}): SubjectStatus[] => {
  if (!masteryBySubject?.length) return [];
  const totalLessons = lessonsCompletedWeek ?? 0;
  const perSubjectLessons = Math.floor(totalLessons / Math.max(masteryBySubject.length, 1));

  return masteryBySubject.map((entry) =>
    computeSubjectStatus({
      subject: entry.subject,
      mastery: entry.mastery,
      lessonsThisWeek: lessonsBySubject?.get(entry.subject) ?? perSubjectLessons,
      diagnosticCompletedAt,
    }),
  );
};

export const onTrackLabel = (status: OnTrackStatus): string => {
  if (status === 'on_track') return 'On-track';
  if (status === 'at_risk') return 'At-risk';
  return 'Off-track';
};

export const onTrackBadge = (status: OnTrackStatus): string => {
  if (status === 'on_track') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'at_risk') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-rose-100 text-rose-700 border-rose-200';
};

export const onTrackBorder = (status: OnTrackStatus): string => {
  if (status === 'on_track') return 'border-emerald-200';
  if (status === 'at_risk') return 'border-amber-200';
  return 'border-rose-200';
};

export const onTrackTone = (status: OnTrackStatus): string => {
  if (status === 'on_track') return 'text-emerald-700';
  if (status === 'at_risk') return 'text-amber-700';
  return 'text-rose-700';
};

export const onTrackDescription = (status: OnTrackStatus): string => {
  if (status === 'on_track') {
    return 'Diagnostic recent, pacing on target, and mastery above 70%.';
  }
  if (status === 'at_risk') {
    return 'Below pacing or mastery trending under 70%. Add one more lesson this week.';
  }
  return 'No recent lessons or mastery low; schedule a lesson and checkpoint review.';
};

export const formatSubjectStatusTooltip = (status: OnTrackStatus, subject: Subject): string => {
  const base = onTrackDescription(status);
  return `${subjectLabel(subject)}: ${base}`;
};
