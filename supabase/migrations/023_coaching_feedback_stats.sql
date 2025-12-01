-- 023_coaching_feedback_stats.sql
-- Aggregate coaching feedback for ranking and quality signals.

begin;

create or replace view public.parent_coaching_feedback_stats as
select
  f.suggestion_id,
  f.reason,
  count(*) as total,
  count(*) filter (where sp.grade between 3 and 5) as g3_5_count,
  count(*) filter (where sp.grade between 6 and 8) as g6_8_count,
  count(*) filter (where sp.grade is null or sp.grade < 3 or sp.grade > 8) as other_count,
  min(f.created_at) as first_feedback_at,
  max(f.created_at) as last_feedback_at
from public.parent_coaching_feedback f
left join public.student_profiles sp on sp.id = f.student_id
group by f.suggestion_id, f.reason;

commit;
