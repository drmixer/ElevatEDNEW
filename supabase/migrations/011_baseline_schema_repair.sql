-- 011_baseline_schema_repair.sql
-- Ensures core enum types and required columns exist for auth/profile tables.

begin;

-- Recreate missing enum types if they were not applied previously.
do
$$
begin
  if not exists (
    select 1 from pg_type where typname = 'user_role'
  ) then
    create type user_role as enum ('parent', 'student');
  end if;
end
$$;

do
$$
begin
  if not exists (
    select 1 from pg_type where typname = 'progress_status'
  ) then
    create type progress_status as enum ('not_started', 'in_progress', 'completed');
  end if;
end
$$;

do
$$
begin
  if not exists (
    select 1 from pg_type where typname = 'subscription_status'
  ) then
    create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
  end if;
end
$$;

do
$$
begin
  if not exists (
    select 1 from pg_type where typname = 'payment_status'
  ) then
    create type payment_status as enum ('succeeded', 'pending', 'failed', 'refunded');
  end if;
end
$$;

-- Grant usage on the enums to the standard Supabase roles.
grant usage on type user_role to authenticated, service_role, anon;
grant usage on type progress_status to authenticated, service_role, anon;
grant usage on type subscription_status to authenticated, service_role, anon;
grant usage on type payment_status to authenticated, service_role, anon;

-- Ensure the profiles table has the required role column.
alter table public.profiles
  add column if not exists role user_role;

update public.profiles
set role = coalesce(role, 'student'::user_role);

alter table public.profiles
  alter column role set not null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
as $$
declare
  meta_role text;
  resolved_role user_role;
  resolved_name text;
begin
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  if meta_role = 'parent' then
    resolved_role := 'parent';
  else
    resolved_role := 'student';
  end if;

  resolved_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, role, email, full_name, avatar_url)
  values (new.id, resolved_role, new.email, resolved_name, new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do update
    set role = excluded.role,
        email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url;

  if resolved_role = 'parent' then
    insert into public.parent_profiles (id, full_name)
    values (new.id, resolved_name)
    on conflict (id) do update
      set full_name = excluded.full_name;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

do
$$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'parent_profiles_id_fkey'
      and conrelid = 'public.parent_profiles'::regclass
  ) then
    alter table public.parent_profiles
      add constraint parent_profiles_id_fkey
      foreign key (id) references public.profiles (id) on delete cascade;
  end if;
end
$$;

-- Ensure student_profiles has the expected FK and indexes.
alter table public.student_profiles
  add column if not exists parent_id uuid references public.parent_profiles (id) on delete cascade;

create index if not exists student_profiles_parent_idx
  on public.student_profiles (parent_id);

create index if not exists student_profiles_current_level_idx
  on public.student_profiles (current_level_id);

-- Ensure plans table exists (baseline safeguard).
create table if not exists public.plans (
  id bigserial primary key,
  slug text unique not null,
  name text not null,
  price_cents integer not null default 0,
  status subscription_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

do
$$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'plans' and policyname = 'plans_all_read'
  ) then
    create policy "plans_all_read"
    on public.plans
    for select
    using (auth.role() = 'authenticated' or auth.role() = 'service_role');
  end if;
end
$$;

do
$$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'plans' and policyname = 'plans_service_write'
  ) then
    create policy "plans_service_write"
    on public.plans
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
  end if;
end
$$;

commit;

-- Refresh the PostgREST schema cache so new objects are visible.
notify pgrst, 'reload schema';
