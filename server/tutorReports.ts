import type { SupabaseClient } from '@supabase/supabase-js';

import { HttpError } from './httpError.js';

const REPORT_STATUSES = ['open', 'in_review', 'resolved', 'dismissed'] as const;
export type TutorReportStatus = (typeof REPORT_STATUSES)[number];
export type TutorUsefulnessSummary = {
  windowDays: number;
  answeredInLesson: number;
  retriedAfterHint: number;
  answersReported: number;
  aiDirectAnswers: number;
  fallbackAnswers: number;
  problemGroundedAnswers: number;
  retryRatePct: number | null;
};

export const parseReportStatus = (input?: string | null): TutorReportStatus | undefined => {
  if (!input) return undefined;
  if (REPORT_STATUSES.includes(input as TutorReportStatus)) {
    return input as TutorReportStatus;
  }
  throw new HttpError(400, 'Invalid tutor report status.', 'invalid_status');
};

export const listTutorReports = async (
  serviceSupabase: SupabaseClient,
  { status, limit = 50 }: { status?: TutorReportStatus; limit?: number } = {},
) => {
  const query = serviceSupabase
    .from('tutor_answer_reports')
    .select('id, student_id, conversation_id, message_id, answer, reason, status, reviewed_by, reviewed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));

  if (status) {
    query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    throw new HttpError(500, 'Unable to load tutor reports.', 'tutor_report_list_failed', error);
  }
  return data ?? [];
};

export const getTutorUsefulnessSummary = async (
  serviceSupabase: SupabaseClient,
  { windowDays = 30 }: { windowDays?: number } = {},
): Promise<TutorUsefulnessSummary> => {
  const since = new Date(Date.now() - Math.max(1, windowDays) * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await serviceSupabase
    .from('student_events')
    .select('event_type, payload, created_at')
    .in('event_type', ['tutor_answered_in_lesson', 'tutor_retried_after_hint', 'tutor_answer_reported'])
    .gte('created_at', since);

  if (error) {
    throw new HttpError(500, 'Unable to load tutor usefulness summary.', 'tutor_usefulness_summary_failed', error);
  }

  let answeredInLesson = 0;
  let retriedAfterHint = 0;
  let answersReported = 0;
  let aiDirectAnswers = 0;
  let fallbackAnswers = 0;
  let problemGroundedAnswers = 0;

  for (const row of (data ?? []) as Array<{ event_type?: string | null; payload?: Record<string, unknown> | null }>) {
    const eventType = (row.event_type ?? '').toLowerCase();
    const payload = (row.payload ?? {}) as Record<string, unknown>;

    if (eventType === 'tutor_answered_in_lesson') {
      answeredInLesson += 1;
      if (payload.delivery_mode === 'ai_direct') aiDirectAnswers += 1;
      if (payload.delivery_mode === 'deterministic_fallback') fallbackAnswers += 1;
      if (payload.grounded_to_problem === true) problemGroundedAnswers += 1;
    } else if (eventType === 'tutor_retried_after_hint') {
      retriedAfterHint += 1;
    } else if (eventType === 'tutor_answer_reported') {
      answersReported += 1;
    }
  }

  return {
    windowDays,
    answeredInLesson,
    retriedAfterHint,
    answersReported,
    aiDirectAnswers,
    fallbackAnswers,
    problemGroundedAnswers,
    retryRatePct: answeredInLesson > 0 ? Math.round((retriedAfterHint / answeredInLesson) * 1000) / 10 : null,
  };
};

export const updateTutorReportStatus = async (
  serviceSupabase: SupabaseClient,
  id: number,
  status: TutorReportStatus,
  reviewerId: string,
) => {
  const { data, error } = await serviceSupabase
    .from('tutor_answer_reports')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: status === 'open' ? null : new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, status, reviewed_by, reviewed_at')
    .maybeSingle();

  if (error) {
    throw new HttpError(500, 'Unable to update tutor report.', 'tutor_report_update_failed', error);
  }
  if (!data) {
    throw new HttpError(404, 'Tutor report not found.', 'tutor_report_not_found');
  }
  return data;
};
