-- 030_phase0_foundations.sql
-- Phase 0 foundations: personalization catalogs, preferences, adaptive paths, and XP ledger.

begin;

-- Extend student profiles with grade band and persona/avatar handles to support personalization.
alter table public.student_profiles
  add column if not exists grade_band text,
  add column if not exists avatar_id text default 'avatar-starter',
  add column if not exists tutor_persona_id text;

update public.student_profiles
set avatar_id = coalesce(student_avatar_id, avatar_id, 'avatar-starter')
where avatar_id is null;

update public.student_profiles
set grade_band = case
    when grade_level between 1 and 2 then 'K-2'
    when grade_level between 3 and 5 then '3-5'
    when grade_level between 6 and 8 then '6-8'
    when grade_level between 9 and 12 then '9-12'
    else grade_band
  end
where grade_band is null
  and grade_level is not null;

-- Enumerations for path + entry typing.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'learning_path_status') then
    create type learning_path_status as enum ('draft', 'active', 'paused', 'completed');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'path_entry_type') then
    create type path_entry_type as enum ('lesson', 'practice', 'quiz', 'assessment', 'review');
  end if;
end$$;

-- Avatar + tutor persona catalogs.
create table if not exists public.avatars (
  id text primary key,
  name text not null,
  image_url text,
  category text not null default 'student',
  is_default boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.avatars enable row level security;

drop policy if exists "avatars_all_read" on public.avatars;
create policy "avatars_all_read"
on public.avatars
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

drop policy if exists "avatars_service_write" on public.avatars;
create policy "avatars_service_write"
on public.avatars
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table if not exists public.tutor_personas (
  id text primary key,
  name text not null,
  tone text,
  constraints text,
  prompt_snippet text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.tutor_personas enable row level security;

drop policy if exists "tutor_personas_all_read" on public.tutor_personas;
create policy "tutor_personas_all_read"
on public.tutor_personas
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

drop policy if exists "tutor_personas_service_write" on public.tutor_personas;
create policy "tutor_personas_service_write"
on public.tutor_personas
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Student preferences for avatar/persona + AI settings.
create table if not exists public.student_preferences (
  student_id uuid primary key references public.student_profiles (id) on delete cascade,
  avatar_id text references public.avatars (id) on delete set null,
  tutor_persona_id text references public.tutor_personas (id) on delete set null,
  opt_in_ai boolean not null default true,
  goal_focus text,
  theme text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger student_preferences_set_updated_at
before update on public.student_preferences
for each row
execute procedure public.set_updated_at();

alter table public.student_preferences enable row level security;

drop policy if exists "student_preferences_student_read" on public.student_preferences;
create policy "student_preferences_student_read"
on public.student_preferences
for select
using (student_id = auth.uid());

drop policy if exists "student_preferences_guardian_read" on public.student_preferences;
create policy "student_preferences_guardian_read"
on public.student_preferences
for select
using (public.is_guardian(student_id));

drop policy if exists "student_preferences_student_write" on public.student_preferences;
create policy "student_preferences_student_write"
on public.student_preferences
for insert
with check (student_id = auth.uid());

drop policy if exists "student_preferences_student_update" on public.student_preferences;
create policy "student_preferences_student_update"
on public.student_preferences
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists "student_preferences_service_write" on public.student_preferences;
create policy "student_preferences_service_write"
on public.student_preferences
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Student-level adaptive paths + ordered entries.
create table if not exists public.student_paths (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  status learning_path_status not null default 'active',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists student_paths_student_status_idx
  on public.student_paths (student_id, status);

create trigger student_paths_set_updated_at
before update on public.student_paths
for each row
execute procedure public.set_updated_at();

alter table public.student_paths enable row level security;

drop policy if exists "student_paths_student_read" on public.student_paths;
create policy "student_paths_student_read"
on public.student_paths
for select
using (student_id = auth.uid());

drop policy if exists "student_paths_guardian_read" on public.student_paths;
create policy "student_paths_guardian_read"
on public.student_paths
for select
using (public.is_guardian(student_id));

drop policy if exists "student_paths_student_write" on public.student_paths;
create policy "student_paths_student_write"
on public.student_paths
for insert
with check (student_id = auth.uid());

drop policy if exists "student_paths_student_update" on public.student_paths;
create policy "student_paths_student_update"
on public.student_paths
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists "student_paths_service_write" on public.student_paths;
create policy "student_paths_service_write"
on public.student_paths
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table if not exists public.student_path_entries (
  id bigserial primary key,
  path_id bigint not null references public.student_paths (id) on delete cascade,
  position int not null,
  type path_entry_type not null,
  module_id bigint references public.modules (id) on delete set null,
  lesson_id bigint references public.lessons (id) on delete set null,
  assessment_id bigint references public.assessments (id) on delete set null,
  status progress_status not null default 'not_started',
  score numeric(5, 2),
  time_spent_s int,
  target_standard_codes text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_path_entries_position unique (path_id, position)
);

create index if not exists student_path_entries_path_idx
  on public.student_path_entries (path_id, status, type);

create index if not exists student_path_entries_lesson_idx
  on public.student_path_entries (lesson_id);

create index if not exists student_path_entries_assessment_idx
  on public.student_path_entries (assessment_id);

create trigger student_path_entries_set_updated_at
before update on public.student_path_entries
for each row
execute procedure public.set_updated_at();

alter table public.student_path_entries enable row level security;

drop policy if exists "path_entries_student_read" on public.student_path_entries;
create policy "path_entries_student_read"
on public.student_path_entries
for select
using (
  exists (
    select 1
    from public.student_paths sp
    where sp.id = path_id
      and sp.student_id = auth.uid()
  )
);

drop policy if exists "path_entries_guardian_read" on public.student_path_entries;
create policy "path_entries_guardian_read"
on public.student_path_entries
for select
using (
  exists (
    select 1
    from public.student_paths sp
    where sp.id = path_id
      and public.is_guardian(sp.student_id)
  )
);

drop policy if exists "path_entries_student_write" on public.student_path_entries;
create policy "path_entries_student_write"
on public.student_path_entries
for insert
with check (
  exists (
    select 1
    from public.student_paths sp
    where sp.id = path_id
      and sp.student_id = auth.uid()
  )
);

drop policy if exists "path_entries_student_update" on public.student_path_entries;
create policy "path_entries_student_update"
on public.student_path_entries
for update
using (
  exists (
    select 1
    from public.student_paths sp
    where sp.id = path_id
      and sp.student_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.student_paths sp
    where sp.id = path_id
      and sp.student_id = auth.uid()
  )
);

drop policy if exists "path_entries_service_write" on public.student_path_entries;
create policy "path_entries_service_write"
on public.student_path_entries
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Event log + XP ledger for adaptive loop/awards.
create table if not exists public.student_events (
  id bigserial primary key,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  points_awarded int not null default 0,
  path_entry_id bigint references public.student_path_entries (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists student_events_student_idx
  on public.student_events (student_id, created_at desc);

create index if not exists student_events_entry_idx
  on public.student_events (path_entry_id);

alter table public.student_events enable row level security;

drop policy if exists "student_events_student_read" on public.student_events;
create policy "student_events_student_read"
on public.student_events
for select
using (student_id = auth.uid());

drop policy if exists "student_events_guardian_read" on public.student_events;
create policy "student_events_guardian_read"
on public.student_events
for select
using (public.is_guardian(student_id));

drop policy if exists "student_events_student_write" on public.student_events;
create policy "student_events_student_write"
on public.student_events
for insert
with check (student_id = auth.uid());

drop policy if exists "student_events_service_write" on public.student_events;
create policy "student_events_service_write"
on public.student_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table if not exists public.xp_ledger (
  student_id uuid primary key references public.student_profiles (id) on delete cascade,
  xp_total integer not null default 0,
  streak_days integer not null default 0,
  last_awarded_at timestamptz,
  badge_ids bigint[] not null default '{}'::bigint[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger xp_ledger_set_updated_at
before update on public.xp_ledger
for each row
execute procedure public.set_updated_at();

alter table public.xp_ledger enable row level security;

drop policy if exists "xp_ledger_student_read" on public.xp_ledger;
create policy "xp_ledger_student_read"
on public.xp_ledger
for select
using (student_id = auth.uid());

drop policy if exists "xp_ledger_guardian_read" on public.xp_ledger;
create policy "xp_ledger_guardian_read"
on public.xp_ledger
for select
using (public.is_guardian(student_id));

drop policy if exists "xp_ledger_service_write" on public.xp_ledger;
create policy "xp_ledger_service_write"
on public.xp_ledger
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Seed starter avatars and tutor personas with palette + tone metadata.
insert into public.avatars (id, name, image_url, category, is_default, metadata)
values
  ('avatar-starter', 'Starter Spark', null, 'student', true, '{
    "description": "Default companion for new learners.",
    "palette": { "background": "#E0F2FE", "accent": "#0EA5E9", "text": "#0F172A" },
    "icon": "✨",
    "tags": ["friendly", "default"]
  }'),
  ('avatar-trailblazer', 'Trailblazer', null, 'student', false, '{
    "description": "Earn 500 XP to unlock this explorer.",
    "palette": { "background": "#ECFDF3", "accent": "#10B981", "text": "#064E3B" },
    "icon": "🧭",
    "minXp": 500,
    "tags": ["adventure"]
  }'),
  ('avatar-streak-ember', 'Streak Ember', null, 'student', false, '{
    "description": "Stay active 7 days in a row to glow bright.",
    "palette": { "background": "#FEF3C7", "accent": "#F59E0B", "text": "#78350F" },
    "icon": "🔥",
    "requiredStreak": 7,
    "tags": ["streak"]
  }'),
  ('avatar-aurora-wave', 'Aurora Wave', null, 'student', false, '{
    "description": "Hit 800 XP to light up this calm gradient.",
    "palette": { "background": "#EEF2FF", "accent": "#6366F1", "text": "#1E1B4B" },
    "icon": "🌅",
    "minXp": 800,
    "tags": ["calm"]
  }'),
  ('avatar-summit-owl', 'Summit Owl', null, 'student', false, '{
    "description": "1200 XP shows your steady focus and patience.",
    "palette": { "background": "#F8FAFC", "accent": "#475569", "text": "#0F172A" },
    "icon": "🦉",
    "minXp": 1200,
    "tags": ["focus"]
  }'),
  ('avatar-prism-pop', 'Prism Pop', null, 'student', false, '{
    "description": "Earn 1000 XP for this bright, artsy set.",
    "palette": { "background": "#FFF7ED", "accent": "#FB923C", "text": "#7C2D12" },
    "icon": "🎨",
    "minXp": 1000,
    "tags": ["playful"]
  }'),
  ('avatar-comet-scout', 'Comet Scout', null, 'student', false, '{
    "description": "Keep a 14-day streak or reach 1600 XP to trail the stars.",
    "palette": { "background": "#F5F3FF", "accent": "#A855F7", "text": "#312E81" },
    "icon": "☄️",
    "minXp": 1600,
    "requiredStreak": 14,
    "tags": ["streak", "momentum"]
  }'),
  ('avatar-guardian-crest', 'Guardian Crest', null, 'student', false, '{
    "description": "Reach 2000 XP to unlock this confident shield.",
    "palette": { "background": "#EFF6FF", "accent": "#2563EB", "text": "#0B2548" },
    "icon": "🛡️",
    "minXp": 2000,
    "tags": ["confidence"]
  }'),
  ('tutor-calm-coach', 'Calm Coach', null, 'tutor', false, '{
    "description": "Steady, patient tutor who keeps you encouraged without rushing.",
    "palette": { "background": "#E0F2FE", "accent": "#0284C7", "text": "#0B172A" },
    "icon": "🌊",
    "tone": "calm"
  }'),
  ('tutor-step-guide', 'Step-by-Step Guide', null, 'tutor', false, '{
    "description": "Breaks work into small steps and checks understanding often.",
    "palette": { "background": "#EEF2FF", "accent": "#6366F1", "text": "#312E81" },
    "icon": "🧭",
    "tone": "structured"
  }'),
  ('tutor-hype-coach', 'Hype Coach', null, 'tutor', false, '{
    "description": "High-energy motivator who keeps responses short and upbeat.",
    "palette": { "background": "#FFF1F2", "accent": "#EC4899", "text": "#4A044E" },
    "icon": "✨",
    "tone": "bold"
  }'),
  ('tutor-quiet-expert', 'Quiet Expert', null, 'tutor', false, '{
    "description": "Concise helper who gets to the point with minimal fluff.",
    "palette": { "background": "#F8FAFC", "accent": "#94A3B8", "text": "#0F172A" },
    "icon": "📘",
    "tone": "concise"
  }')
on conflict (id) do update
set name = excluded.name,
    image_url = excluded.image_url,
    category = excluded.category,
    is_default = excluded.is_default,
    metadata = excluded.metadata;

insert into public.tutor_personas (id, name, tone, constraints, prompt_snippet, metadata)
values
  ('persona-calm-coach', 'Calm Coach', 'calm', 'Keeps responses supportive and paced; avoids overwhelming detail.', 'Use a calm, encouraging tone with short check-ins and patient pacing.', '{}'::jsonb),
  ('persona-structured-guide', 'Structured Guide', 'structured', 'Prefers ordered steps and confirmation checks each step.', 'Break problems into numbered steps and ask the learner to try after each small chunk.', '{}'::jsonb),
  ('persona-hype-coach', 'Hype Coach', 'bold', 'Stays positive and concise; celebrates small wins; avoids lecturing.', 'Keep energy high, be brief, and reinforce effort after each attempt.', '{}'::jsonb),
  ('persona-quiet-expert', 'Quiet Expert', 'concise', 'Avoids fluff; prefers direct hints and quick feedback.', 'Provide minimal but precise hints; summarize the core idea without extra adjectives.', '{}'::jsonb)
on conflict (id) do update
set name = excluded.name,
    tone = excluded.tone,
    constraints = excluded.constraints,
    prompt_snippet = excluded.prompt_snippet,
    metadata = excluded.metadata;

commit;
