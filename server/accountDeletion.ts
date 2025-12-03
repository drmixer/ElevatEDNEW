import type { SupabaseClient } from '@supabase/supabase-js';
import { cancelParentSubscriptionForDeletion } from './billing.js';

type DeletionScope = 'parent_only' | 'parent_and_students' | 'students_only';

type PendingRequest = {
  id: number;
  requester_id: string;
  scope: DeletionScope;
  include_student_ids: string[];
  reason: string | null;
  contact_email: string | null;
  metadata: Record<string, unknown> | null;
};

const deleteUserAndProfile = async (serviceSupabase: SupabaseClient, userId: string) => {
  // Remove auth user; ignore errors so we can still clear profiles/rows.
  try {
    await serviceSupabase.auth.admin.deleteUser(userId);
  } catch (error) {
    console.warn('[account-deletion] failed to delete auth user', { userId, error });
  }

  const { error: deleteProfileError } = await serviceSupabase.from('profiles').delete().eq('id', userId);
  if (deleteProfileError) {
    throw new Error(`Failed to delete profile ${userId}: ${deleteProfileError.message}`);
  }
};

export const processPendingAccountDeletionRequests = async (
  serviceSupabase: SupabaseClient,
): Promise<{ processed: number; errors: Array<{ id: number; error: string }> }> => {
  const { data: pending, error } = await serviceSupabase
    .from('account_deletion_requests')
    .select('id, requester_id, scope, include_student_ids, reason, contact_email, metadata')
    .eq('status', 'pending')
    .limit(25);

  if (error) {
    console.error('[account-deletion] failed to load pending requests', error);
    throw error;
  }

  const errors: Array<{ id: number; error: string }> = [];

  for (const request of pending as PendingRequest[]) {
    const meta = { ...(request.metadata ?? {}) } as Record<string, unknown>;
    try {
      if (request.scope === 'parent_only' || request.scope === 'parent_and_students') {
        await cancelParentSubscriptionForDeletion(serviceSupabase, request.requester_id);
        await deleteUserAndProfile(serviceSupabase, request.requester_id);
      }

      const studentIdsToDelete = request.scope === 'students_only' || request.scope === 'parent_and_students'
        ? request.include_student_ids ?? []
        : [];

      for (const studentId of studentIdsToDelete) {
        await deleteUserAndProfile(serviceSupabase, studentId);
      }

      await serviceSupabase
        .from('account_deletion_requests')
        .update({ status: 'completed', metadata: { ...meta, processed_at: new Date().toISOString() } })
        .eq('id', request.id);
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : 'unknown error';
      errors.push({ id: request.id, error: message });
      await serviceSupabase
        .from('account_deletion_requests')
        .update({ metadata: { ...meta, last_error: message, last_error_at: new Date().toISOString() } })
        .eq('id', request.id);
    }
  }

  return { processed: (pending ?? []).length - errors.length, errors };
};

export default processPendingAccountDeletionRequests;
