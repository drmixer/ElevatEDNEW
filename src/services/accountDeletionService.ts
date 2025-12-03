import supabase from '../lib/supabaseClient';
import type { AccountDeletionRequest, AccountDeletionScope } from '../types';

type AccountDeletionRow = {
  id: number;
  requester_id: string;
  scope: AccountDeletionScope;
  include_student_ids: string[];
  reason: string | null;
  contact_email: string | null;
  status: AccountDeletionRequest['status'];
  created_at: string;
};

const mapAccountDeletionRow = (row: AccountDeletionRow): AccountDeletionRequest => ({
  id: row.id,
  requesterId: row.requester_id,
  scope: row.scope,
  includeStudentIds: row.include_student_ids ?? [],
  reason: row.reason ?? null,
  contactEmail: row.contact_email ?? null,
  status: row.status,
  createdAt: row.created_at,
});

export const submitAccountDeletionRequest = async (payload: {
  requesterId: string;
  scope: AccountDeletionScope;
  studentIds?: string[];
  reason?: string;
  contactEmail?: string;
  metadata?: Record<string, unknown>;
}): Promise<AccountDeletionRequest> => {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .insert({
      requester_id: payload.requesterId,
      scope: payload.scope,
      include_student_ids: payload.studentIds ?? [],
      reason: payload.reason?.trim() || null,
      contact_email: payload.contactEmail?.trim() || null,
      metadata: payload.metadata ?? {},
    })
    .select('id, requester_id, scope, include_student_ids, reason, contact_email, status, created_at')
    .single();

  if (error || !data) {
    console.error('[AccountDeletion] Failed to submit request', error);
    throw error ?? new Error('Unable to submit deletion request right now.');
  }

  return mapAccountDeletionRow(data as AccountDeletionRow);
};

export const listAccountDeletionRequests = async (requesterId: string): Promise<AccountDeletionRequest[]> => {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('id, requester_id, scope, include_student_ids, reason, contact_email, status, created_at')
    .eq('requester_id', requesterId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[AccountDeletion] Failed to list requests', error);
    throw error;
  }

  return (data ?? []).map((row) => mapAccountDeletionRow(row as AccountDeletionRow));
};

export default submitAccountDeletionRequest;
