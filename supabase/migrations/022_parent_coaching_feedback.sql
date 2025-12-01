-- 022_parent_coaching_feedback.sql
-- Track parent feedback on coaching suggestions for ranking and quality signals.

begin;

create table if not exists public.parent_coaching_feedback (
  id bigserial primary key,
  parent_id uuid not null references public.parent_profiles (id) on delete cascade,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  suggestion_id text not null,
  reason text not null check (reason in ('done', 'not_relevant', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists parent_coaching_feedback_parent_idx on public.parent_coaching_feedback (parent_id);
create index if not exists parent_coaching_feedback_student_idx on public.parent_coaching_feedback (student_id);
create index if not exists parent_coaching_feedback_suggestion_idx on public.parent_coaching_feedback (suggestion_id);

alter table public.parent_coaching_feedback enable row level security;

drop policy if exists "parent_coaching_feedback_parent_rw" on public.parent_coaching_feedback;
create policy "parent_coaching_feedback_parent_rw"
on public.parent_coaching_feedback
for all
using (parent_id = auth.uid())
with check (parent_id = auth.uid());

drop policy if exists "parent_coaching_feedback_service" on public.parent_coaching_feedback;
create policy "parent_coaching_feedback_service"
on public.parent_coaching_feedback
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
