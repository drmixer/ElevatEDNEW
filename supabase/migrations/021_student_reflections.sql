create table public.student_reflections (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  question_id text not null,
  response_text text not null,
  lesson_id text,
  subject text,
  sentiment text,
  share_with_parent boolean not null default false,
  created_at timestamptz not null default now()
);

create index student_reflections_student_id_idx on public.student_reflections (student_id);
create index student_reflections_created_at_idx on public.student_reflections (created_at desc);

alter table public.student_reflections enable row level security;

create policy "students_read_own_reflections"
on public.student_reflections
for select
using (student_id = auth.uid());

create policy "students_write_own_reflections"
on public.student_reflections
for insert
with check (student_id = auth.uid());

create policy "students_update_own_reflections"
on public.student_reflections
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "parents_read_shared_reflections"
on public.student_reflections
for select
using (
  exists (
    select 1
    from public.student_profiles sp
    where sp.id = student_reflections.student_id
      and sp.parent_id = auth.uid()
      and student_reflections.share_with_parent = true
  )
);

grant select, insert, update on public.student_reflections to authenticated;
