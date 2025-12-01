-- 026_assignment_guardrails_audit.sql
-- Add audit metadata for parent goals and assignments; prep for guardrail enforcement.

begin;

alter table public.parent_child_goals
  add column if not exists updated_by uuid references public.parent_profiles (id) on delete set null,
  add column if not exists updated_source text;

alter table public.student_assignments
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.parent_profiles (id) on delete set null,
  add column if not exists checkpoint_score numeric(5,2),
  add column if not exists tutor_chat_count integer,
  add column if not exists audit_source text,
  add column if not exists evidence jsonb not null default '{}'::jsonb;

drop trigger if exists student_assignments_set_updated_at on public.student_assignments;
create trigger student_assignments_set_updated_at
before update on public.student_assignments
for each row
execute procedure public.set_updated_at();

commit;
