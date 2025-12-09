import supabase from '../lib/supabaseClient';
import type { PrivacyRequest, PrivacyRequestType } from '../types';

type PrivacyRequestRow = {
  id: number;
  requester_id: string;
  student_id: string;
  request_type: PrivacyRequestType;
  status: PrivacyRequest['status'];
  contact_email?: string | null;
  reason?: string | null;
  admin_notes?: string | null;
  handled_by?: string | null;
  updated_at: string;
  resolved_at?: string | null;
  created_at: string;
};

const mapPrivacyRequest = (row: PrivacyRequestRow): PrivacyRequest => ({
  id: row.id,
  requesterId: row.requester_id,
  studentId: row.student_id,
  requestType: row.request_type,
  status: row.status,
  contactEmail: row.contact_email ?? null,
  reason: row.reason ?? null,
  adminNotes: row.admin_notes ?? null,
  handledBy: row.handled_by ?? null,
  updatedAt: row.updated_at ?? row.created_at,
  resolvedAt: row.resolved_at ?? null,
  createdAt: row.created_at,
});

export const submitPrivacyRequest = async (payload: {
  requesterId: string;
  studentId: string;
  requestType: PrivacyRequestType;
  reason?: string;
  contactEmail?: string;
  metadata?: Record<string, unknown>;
}): Promise<PrivacyRequest> => {
  const { data, error } = await supabase
    .from('privacy_requests')
    .insert({
      student_id: payload.studentId,
      requester_id: payload.requesterId,
      request_type: payload.requestType,
      reason: payload.reason?.trim() || null,
      contact_email: payload.contactEmail?.trim() || null,
      metadata: {
        source: 'family_dashboard',
        ...(payload.metadata ?? {}),
      },
    })
    .select(
      'id, requester_id, student_id, request_type, status, contact_email, reason, admin_notes, handled_by, resolved_at, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    console.error('[Privacy] Failed to submit privacy request', error);
    throw error ?? new Error('Unable to submit request right now.');
  }

  return mapPrivacyRequest(data as PrivacyRequestRow);
};

export const listPrivacyRequests = async (options?: {
  studentId?: string | null;
  requesterId?: string | null;
}): Promise<PrivacyRequest[]> => {
  let query = supabase
    .from('privacy_requests')
    .select(
      'id, requester_id, student_id, request_type, status, contact_email, reason, admin_notes, handled_by, resolved_at, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(20);

  if (options?.studentId) {
    query = query.eq('student_id', options.studentId);
  }

  if (options?.requesterId) {
    query = query.eq('requester_id', options.requesterId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Privacy] Failed to load privacy requests', error);
    throw error;
  }

  return (data ?? []).map((row) => mapPrivacyRequest(row as PrivacyRequestRow));
};
