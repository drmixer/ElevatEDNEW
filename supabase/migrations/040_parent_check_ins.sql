-- Parent check-ins: allow parents to send short snippets and let students acknowledge

do $$
begin
  if not exists (select 1 from pg_type where typname = 'parent_check_in_status') then
    create type public.parent_check_in_status as enum ('sent', 'delivered', 'seen');
  end if;
end
$$;

create table if not exists public.parent_check_ins (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles (id) on delete cascade,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  message text not null,
  topic text,
  status public.parent_check_in_status not null default 'sent',
  delivered_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb
);

create index if not exists parent_check_ins_parent_id_idx on public.parent_check_ins (parent_id);
create index if not exists parent_check_ins_student_id_idx on public.parent_check_ins (student_id);
create index if not exists parent_check_ins_status_idx on public.parent_check_ins (status);
create index if not exists parent_check_ins_created_at_idx on public.parent_check_ins (created_at desc);

alter table public.parent_check_ins enable row level security;

-- Parents can read their own check-ins
create policy "parents_read_own_check_ins"
on public.parent_check_ins
for select
using (parent_id = auth.uid());

-- Students can read their own incoming check-ins
create policy "students_read_own_check_ins"
on public.parent_check_ins
for select
using (student_id = auth.uid());

-- Parents can create check-ins for their linked students
create policy "parents_create_check_ins_for_child"
on public.parent_check_ins
for insert
with check (
  parent_id = auth.uid()
  and exists (
    select 1 from public.student_profiles sp
    where sp.id = student_id and sp.parent_id = auth.uid()
  )
);

-- Students can update status fields when they receive/acknowledge
create policy "students_update_check_ins"
on public.parent_check_ins
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

grant select, insert, update on public.parent_check_ins to authenticated;
