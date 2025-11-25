import supabase from '../lib/supabaseClient';
import type { ChildGoalTargets, GuardianChildLink } from '../types';

type GoalPayload = ChildGoalTargets & {
  studentId: string;
  parentId: string;
};

export const upsertChildGoals = async (payload: GoalPayload): Promise<void> => {
  const { studentId, parentId, weeklyLessons, practiceMinutes, masteryTargets } = payload;

  const { error } = await supabase.from('parent_child_goals').upsert(
    {
      parent_id: parentId,
      student_id: studentId,
      weekly_lessons_target: weeklyLessons ?? null,
      practice_minutes_target: practiceMinutes ?? null,
      mastery_targets: masteryTargets ?? {},
    },
    { onConflict: 'parent_id,student_id' },
  );

  if (error) {
    console.error('[Parent] Failed to save goals', error);
    throw error;
  }
};

export const fetchGuardianLinks = async (parentId: string): Promise<GuardianChildLink[]> => {
  if (!parentId) return [];
  const { data, error } = await supabase
    .from('guardian_child_links')
    .select('id, student_id, parent_id, relationship, status, invited_at, accepted_at, metadata')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Parent] Failed to fetch guardian links', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as number,
    studentId: row.student_id as string,
    parentId: row.parent_id as string,
    relationship: (row.relationship as string | null) ?? null,
    status: row.status as GuardianChildLink['status'],
    invitedAt: (row.invited_at as string | null) ?? null,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  }));
};

export const linkGuardianWithCode = async (
  code: string,
  relationship?: string | null,
): Promise<GuardianChildLink | null> => {
  if (!code.trim()) {
    throw new Error('Provide a valid family code to link.');
  }
  const { data, error } = await supabase.rpc('link_guardian_with_code', {
    link_code: code.trim(),
    relationship: relationship?.trim() || null,
  });

  if (error) {
    console.error('[Parent] Failed to link guardian with code', error);
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id as number,
    studentId: data.student_id as string,
    parentId: data.parent_id as string,
    relationship: (data.relationship as string | null) ?? null,
    status: data.status as GuardianChildLink['status'],
    invitedAt: (data.invited_at as string | null) ?? null,
    acceptedAt: (data.accepted_at as string | null) ?? null,
    metadata: (data.metadata as Record<string, unknown> | null) ?? null,
  };
};

export const revokeGuardianLink = async (linkId: number, parentId: string): Promise<void> => {
  const { error } = await supabase
    .from('guardian_child_links')
    .update({ status: 'revoked' })
    .eq('id', linkId)
    .eq('parent_id', parentId);

  if (error) {
    console.error('[Parent] Failed to revoke guardian link', error);
    throw error;
  }
};
