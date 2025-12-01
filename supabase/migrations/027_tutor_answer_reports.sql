-- 027_tutor_answer_reports.sql
-- Student-facing "Report this answer" intake for tutor chats.

begin;

create table public.tutor_answer_reports (
  id bigserial primary key,
  student_id uuid not null default auth.uid() references public.student_profiles (id) on delete cascade,
  conversation_id text not null,
  message_id text,
  answer text not null,
  reason text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index tutor_answer_reports_student_idx on public.tutor_answer_reports (student_id);
create index tutor_answer_reports_conversation_idx on public.tutor_answer_reports (conversation_id);

alter table public.tutor_answer_reports enable row level security;

create policy "tutor_answer_reports_student_write"
on public.tutor_answer_reports
for insert
with check (student_id = auth.uid());

create policy "tutor_answer_reports_student_read"
on public.tutor_answer_reports
for select
using (student_id = auth.uid());

create policy "tutor_answer_reports_service_all"
on public.tutor_answer_reports
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
