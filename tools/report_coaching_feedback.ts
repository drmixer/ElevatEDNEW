import 'dotenv/config';

import { createServiceRoleClient } from './utils/supabase.js';

type FeedbackStat = {
  suggestion_id: string;
  reason: string;
  total: number;
  g3_5_count: number;
  g6_8_count: number;
  other_count: number;
  first_feedback_at: string | null;
  last_feedback_at: string | null;
};

const main = async () => {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('parent_coaching_feedback_stats')
    .select('*')
    .order('total', { ascending: false });

  if (error) {
    throw new Error(`Failed to load coaching feedback stats: ${error.message}`);
  }

  const stats = (data as FeedbackStat[]) ?? [];
  if (!stats.length) {
    console.log('No coaching feedback recorded yet.');
    return;
  }

  console.log('Coaching feedback by suggestion (top 15):');
  stats.slice(0, 15).forEach((row) => {
    console.log(
      `${row.suggestion_id} • ${row.reason} • total=${row.total} (g3-5: ${row.g3_5_count}, g6-8: ${row.g6_8_count}, other: ${row.other_count}) last=${row.last_feedback_at}`,
    );
  });
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
