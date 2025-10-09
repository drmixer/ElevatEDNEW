-- Supabase schema and RLS policies for ElevatED

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null check (role in ('student', 'parent')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  grade integer not null default 1 check (grade between 1 and 12),
  xp integer not null default 0,
  level integer not null default 1,
  badges jsonb not null default '[]'::jsonb,
  streak_days integer not null default 0,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  learning_path jsonb not null default '[]'::jsonb,
  assessment_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.parent_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'premium')),
  notifications jsonb not null default '{
    "weeklyReports": true,
    "missedSessions": true,
    "lowScores": true,
    "majorProgress": true
  }',
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute procedure public.set_updated_at();

drop trigger if exists student_profiles_set_updated_at on public.student_profiles;
create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row
execute procedure public.set_updated_at();

drop trigger if exists parent_profiles_set_updated_at on public.parent_profiles;
create trigger parent_profiles_set_updated_at
before update on public.parent_profiles
for each row
execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.parent_profiles enable row level security;

drop policy if exists "Users can select own profile" on public.profiles;
create policy "Users can select own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Students can manage their row" on public.student_profiles;
create policy "Students can manage their row"
on public.student_profiles
for all
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists "Parents can manage their row" on public.parent_profiles;
create policy "Parents can manage their row"
on public.parent_profiles
for all
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
as $$
declare
  new_role text;
  new_full_name text;
begin
  new_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  new_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.email);

  insert into public.profiles (id, email, full_name, role, avatar_url)
  values (new.id, new.email, new_full_name, new_role, new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        avatar_url = excluded.avatar_url;

  if new_role = 'student' then
    insert into public.student_profiles (profile_id, grade)
    values (new.id, coalesce((new.raw_user_meta_data->>'grade')::integer, 1))
    on conflict (profile_id) do nothing;
  elsif new_role = 'parent' then
    insert into public.parent_profiles (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();
