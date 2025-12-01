import { authenticatedFetch, handleApiResponse } from '../lib/apiClient';

export type TutorReportStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';

export type TutorAdminReport = {
  id: number;
  student_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  answer: string | null;
  reason: string | null;
  status: TutorReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
};

type TutorReportListResponse = {
  reports: TutorAdminReport[];
};

export const fetchTutorReports = async (status?: TutorReportStatus, limit = 50): Promise<TutorAdminReport[]> => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (limit) params.set('limit', String(limit));

  const response = await authenticatedFetch(`/api/v1/admins/tutor-reports?${params.toString()}`);
  const payload = await handleApiResponse<TutorReportListResponse>(response);
  return payload.reports ?? [];
};

export const updateTutorReportStatus = async (id: number, status: TutorReportStatus): Promise<TutorAdminReport> => {
  const response = await authenticatedFetch('/api/v1/admins/tutor-reports/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });

  const payload = await handleApiResponse<{ report: TutorAdminReport }>(response);
  return payload.report;
};
