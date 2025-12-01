import supabase from '../lib/supabaseClient';
import type { ConcernCategory, ConcernReport } from '../types';

type ConcernReportRow = {
  id: number;
  case_id: string;
  requester_id: string;
  student_id?: string | null;
  category: ConcernCategory;
  status: ConcernReport['status'];
  description: string;
  contact_email?: string | null;
  screenshot_url?: string | null;
  route: ConcernReport['route'];
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const selectColumns =
  'id, case_id, requester_id, student_id, category, status, description, contact_email, screenshot_url, route, metadata, created_at, updated_at';

const mapConcernReport = (row: ConcernReportRow): ConcernReport => ({
  id: row.id,
  caseId: row.case_id,
  requesterId: row.requester_id,
  studentId: row.student_id ?? null,
  category: row.category,
  status: row.status,
  description: row.description,
  contactEmail: row.contact_email ?? null,
  screenshotUrl: row.screenshot_url ?? null,
  route: row.route,
  metadata: row.metadata ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const submitConcernReport = async (payload: {
  requesterId: string;
  studentId?: string | null;
  category: ConcernCategory;
  description: string;
  contactEmail?: string;
  screenshotUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<ConcernReport> => {
  const { data, error } = await supabase
    .from('concern_reports')
    .insert({
      requester_id: payload.requesterId,
      student_id: payload.studentId ?? null,
      category: payload.category,
      description: payload.description.trim(),
      contact_email: payload.contactEmail?.trim() || null,
      screenshot_url: payload.screenshotUrl?.trim() || null,
      metadata: {
        source: 'parent_dashboard',
        ...(payload.metadata ?? {}),
      },
    })
    .select(selectColumns)
    .single();

  if (error || !data) {
    console.error('[Concerns] Failed to submit report', error);
    throw error ?? new Error('Unable to submit your concern right now.');
  }

  return mapConcernReport(data as ConcernReportRow);
};

export const listConcernReports = async (options?: {
  requesterId?: string | null;
  studentId?: string | null;
  limit?: number;
}): Promise<ConcernReport[]> => {
  let query = supabase
    .from('concern_reports')
    .select(selectColumns)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 10);

  if (options?.requesterId) {
    query = query.eq('requester_id', options.requesterId);
  }

  if (options?.studentId) {
    query = query.eq('student_id', options.studentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Concerns] Failed to load reports', error);
    throw error;
  }

  return (data ?? []).map((row) => mapConcernReport(row as ConcernReportRow));
};
