import type { SupabaseClient } from '@supabase/supabase-js';

import { HttpError } from './httpError.js';

const REPORT_STATUSES = ['open', 'in_review', 'resolved', 'dismissed'] as const;
export type TutorReportStatus = (typeof REPORT_STATUSES)[number];

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
