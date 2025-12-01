import supabase from '../lib/supabaseClient';

export type CoachingFeedbackReason = 'done' | 'not_relevant' | 'dismissed';

export const recordCoachingFeedback = async ({
  parentId,
  studentId,
  suggestionId,
  reason,
}: {
  parentId: string;
  studentId: string;
  suggestionId: string;
  reason: CoachingFeedbackReason;
}): Promise<void> => {
  const { error } = await supabase.from('parent_coaching_feedback').insert({
    parent_id: parentId,
    student_id: studentId,
    suggestion_id: suggestionId,
    reason,
  });

  if (error) {
    throw new Error(error.message ?? 'Unable to record feedback');
  }
};

export default recordCoachingFeedback;
