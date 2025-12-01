import { createServiceRoleClient } from '../scripts/utils/supabase.js';

export type CoachingFeedbackRow = {
  suggestion_id: string;
  reason: string;
  total: number;
  g3_5_count: number;
  g6_8_count: number;
  other_count: number;
  last_feedback_at: string | null;
};

export const fetchCoachingFeedbackStats = async (): Promise<CoachingFeedbackRow[]> => {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('parent_coaching_feedback_stats')
    .select('*')
    .order('total', { ascending: false });

  if (error) {
    throw new Error(error.message ?? 'Unable to fetch coaching feedback stats');
  }

  return (data as CoachingFeedbackRow[]) ?? [];
};

export default fetchCoachingFeedbackStats;
