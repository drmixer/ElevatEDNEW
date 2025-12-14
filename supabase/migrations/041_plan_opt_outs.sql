create table if not exists public.plan_opt_outs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  lesson_id text not null,
  week_start date not null,
  type text not null check (type in ('mix_in', 'elective')),
  created_at timestamptz not null default now()
);

create index if not exists plan_opt_outs_student_week_idx on public.plan_opt_outs (student_id, week_start);
create index if not exists plan_opt_outs_type_idx on public.plan_opt_outs (type);

alter table public.plan_opt_outs enable row level security;

create policy plan_opt_outs_self_access
  on public.plan_opt_outs
  for select using (auth.uid() = student_id);

create policy plan_opt_outs_guardian_access
  on public.plan_opt_outs
  for select using (public.is_guardian(plan_opt_outs.student_id));

create policy plan_opt_outs_guardian_write
  on public.plan_opt_outs
  for insert with check (
    auth.uid() = student_id or public.is_guardian(student_id)
  );

grant select, insert on public.plan_opt_outs to authenticated;
