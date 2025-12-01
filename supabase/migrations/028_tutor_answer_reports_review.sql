-- 028_tutor_answer_reports_review.sql
-- Add review queue metadata for tutor answer reports.

begin;

create type tutor_report_status as enum ('open', 'in_review', 'resolved', 'dismissed');

alter table public.tutor_answer_reports
  add column if not exists status tutor_report_status not null default 'open',
  add column if not exists reviewed_by uuid references public.admin_profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists tutor_answer_reports_status_idx on public.tutor_answer_reports (status);
create index if not exists tutor_answer_reports_reviewed_by_idx on public.tutor_answer_reports (reviewed_by);

drop policy if exists "tutor_answer_reports_admin_read" on public.tutor_answer_reports;
create policy "tutor_answer_reports_admin_read"
on public.tutor_answer_reports
for select
using (public.is_platform_admin());

drop policy if exists "tutor_answer_reports_admin_update" on public.tutor_answer_reports;
create policy "tutor_answer_reports_admin_update"
on public.tutor_answer_reports
for update
using (public.is_platform_admin())
with check (public.is_platform_admin());

commit;
