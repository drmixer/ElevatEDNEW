import supabase from '../lib/supabaseClient';
import type { ParentCheckIn, ParentCheckInStatus } from '../types';

const mapRow = (row: Record<string, unknown>): ParentCheckIn => ({
  id: String(row.id),
  parentId: String(row.parent_id),
  studentId: String(row.student_id),
  message: String(row.message),
  topic: row.topic ? String(row.topic) : null,
  status: (row.status as ParentCheckInStatus) ?? 'sent',
  deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
  seenAt: row.seen_at ? String(row.seen_at) : null,
  createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
});

export const createParentCheckIn = async (input: {
  studentId: string;
  message: string;
  topic?: string | null;
  parentId?: string | null;
}): Promise<ParentCheckIn> => {
  const parentId = input.parentId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
  if (!parentId) {
    throw new Error('You must be signed in to send a check-in');
  }
  const payload = {
    parent_id: parentId,
    student_id: input.studentId,
    message: input.message,
    topic: input.topic ?? null,
  };
  const { data, error } = await supabase.from('parent_check_ins').insert(payload).select().single();
  if (error) {
    throw new Error(error.message ?? 'Unable to send check-in');
  }
  return mapRow(data as Record<string, unknown>);
};

export const listParentCheckIns = async (options?: {
  studentId?: string;
  limit?: number;
}): Promise<ParentCheckIn[]> => {
  const query = supabase
    .from('parent_check_ins')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 30);
  if (options?.studentId) {
    query.eq('student_id', options.studentId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message ?? 'Unable to load check-ins');
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
};

export const listStudentCheckIns = async (
  studentId: string,
  limit = 10,
): Promise<ParentCheckIn[]> => {
  const { data, error } = await supabase
    .from('parent_check_ins')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(error.message ?? 'Unable to fetch check-ins');
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
};

export const markCheckInsDelivered = async (ids: string[]): Promise<void> => {
  if (!ids.length) return;
  const { error } = await supabase
    .from('parent_check_ins')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .in('id', ids)
    .neq('status', 'seen');
  if (error) {
    throw new Error(error.message ?? 'Unable to mark delivered');
  }
};

export const acknowledgeCheckIn = async (id: string): Promise<ParentCheckIn> => {
  const { data, error } = await supabase
    .from('parent_check_ins')
    .update({ status: 'seen', seen_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    throw new Error(error.message ?? 'Unable to acknowledge check-in');
  }
  return mapRow(data as Record<string, unknown>);
};

export const describeCheckInStatus = (status: ParentCheckInStatus): string => {
  switch (status) {
    case 'seen':
      return 'Seen';
    case 'delivered':
      return 'Delivered';
    default:
      return 'Sent';
  }
};
