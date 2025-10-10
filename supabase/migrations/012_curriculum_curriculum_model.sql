-- 012_curriculum_curriculum_model.sql
-- Introduces modular content tables, provenance tracking, and revised RLS for lessons.

begin;

-- Shared enums -------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'lesson_visibility'
  ) then
    create type lesson_visibility as enum ('draft', 'private', 'public');
  end if;
end
$$;

-- Content sources ----------------------------------------------------------

create table if not exists public.content_sources (
  id bigserial primary key,
  name text not null unique,
  summary text,
  license text not null,
  license_url text,
  attribution_text text,
  notes text,
  created_by uuid references public.profiles (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_sources enable row level security;

create trigger content_sources_set_updated_at
before update on public.content_sources
for each row
execute procedure public.set_updated_at();

drop policy if exists "content_sources_owner_select" on public.content_sources;
drop policy if exists "content_sources_owner_all" on public.content_sources;

create policy "content_sources_owner_select"
on public.content_sources
for select
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

create policy "content_sources_owner_all"
on public.content_sources
for all
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
)
with check (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

-- Modules ------------------------------------------------------------------

create table if not exists public.modules (
  id bigserial primary key,
  source_id bigint references public.content_sources (id) on delete set null,
  title text not null,
  slug text not null unique,
  summary text,
  description text,
  subject text not null,
  grade_band text not null,
  strand text,
  topic text,
  subtopic text,
  suggested_source_category text,
  example_source text,
  license_requirement text,
  notes text,
  visibility lesson_visibility not null default 'draft',
  open_track boolean not null default false,
  created_by uuid references public.profiles (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.modules enable row level security;

create index if not exists modules_subject_idx on public.modules (subject);
create index if not exists modules_grade_band_idx on public.modules (grade_band);
create index if not exists modules_strand_idx on public.modules (strand);
create index if not exists modules_topic_idx on public.modules (topic);

create trigger modules_set_updated_at
before update on public.modules
for each row
execute procedure public.set_updated_at();

drop policy if exists "modules_owner_select" on public.modules;
drop policy if exists "modules_owner_all" on public.modules;

create policy "modules_owner_select"
on public.modules
for select
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

create policy "modules_owner_all"
on public.modules
for all
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
)
with check (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

-- Assets -------------------------------------------------------------------

create table if not exists public.assets (
  id bigserial primary key,
  module_id bigint references public.modules (id) on delete cascade,
  lesson_id bigint references public.lessons (id) on delete cascade,
  source_id bigint references public.content_sources (id) on delete set null,
  title text,
  description text,
  url text not null,
  kind text not null default 'link',
  license text not null,
  license_url text,
  attribution_text text,
  tags text[] not null default '{}',
  created_by uuid references public.profiles (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assets_url_check check (char_length(url) > 0),
  constraint assets_license_check check (char_length(license) > 0),
  unique (module_id, url)
);

alter table public.assets enable row level security;

create index if not exists assets_module_idx on public.assets (module_id);
create index if not exists assets_lesson_idx on public.assets (lesson_id);
create index if not exists assets_source_idx on public.assets (source_id);

create trigger assets_set_updated_at
before update on public.assets
for each row
execute procedure public.set_updated_at();

drop policy if exists "assets_owner_select" on public.assets;
drop policy if exists "assets_owner_all" on public.assets;

create policy "assets_owner_select"
on public.assets
for select
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

create policy "assets_owner_all"
on public.assets
for all
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
)
with check (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

-- Standards ----------------------------------------------------------------

create table if not exists public.standards (
  id bigserial primary key,
  framework text not null,
  code text not null,
  description text,
  subject text,
  grade_band text,
  created_by uuid references public.profiles (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (framework, code)
);

alter table public.standards enable row level security;

create index if not exists standards_framework_idx on public.standards (framework);
create index if not exists standards_subject_idx on public.standards (subject);

create trigger standards_set_updated_at
before update on public.standards
for each row
execute procedure public.set_updated_at();

drop policy if exists "standards_owner_select" on public.standards;
drop policy if exists "standards_owner_all" on public.standards;

create policy "standards_owner_select"
on public.standards
for select
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

create policy "standards_owner_all"
on public.standards
for all
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
)
with check (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

-- Module standards ---------------------------------------------------------

create table if not exists public.module_standards (
  id bigserial primary key,
  module_id bigint not null references public.modules (id) on delete cascade,
  standard_id bigint not null references public.standards (id) on delete cascade,
  alignment_strength text,
  created_by uuid references public.profiles (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, standard_id)
);

alter table public.module_standards enable row level security;

create index if not exists module_standards_module_idx on public.module_standards (module_id);
create index if not exists module_standards_standard_idx on public.module_standards (standard_id);

create trigger module_standards_set_updated_at
before update on public.module_standards
for each row
execute procedure public.set_updated_at();

drop policy if exists "module_standards_owner_select" on public.module_standards;
drop policy if exists "module_standards_owner_all" on public.module_standards;

create policy "module_standards_owner_select"
on public.module_standards
for select
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

create policy "module_standards_owner_all"
on public.module_standards
for all
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
)
with check (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

-- Lessons adjustments ------------------------------------------------------

alter table public.lessons
  add column if not exists module_id bigint references public.modules (id) on delete set null,
  add column if not exists visibility lesson_visibility not null default 'draft',
  add column if not exists open_track boolean not null default false,
  add column if not exists attribution_block text not null default '',
  add column if not exists created_by uuid references public.profiles (id);

create index if not exists lessons_module_idx on public.lessons (module_id);
create index if not exists lessons_visibility_idx on public.lessons (visibility);

update public.lessons
set visibility = case
  when is_published = true then 'public'::lesson_visibility
  else visibility
end;

drop policy if exists "lessons_published_read" on public.lessons;
drop policy if exists "lessons_service_write" on public.lessons;
drop policy if exists "lessons_authenticated_published_read" on public.lessons;
drop policy if exists "lessons_service_read" on public.lessons;

create policy "lessons_public_select"
on public.lessons
for select
using (
  visibility = 'public'
  or auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

create policy "lessons_owner_mutate"
on public.lessons
for all
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
)
with check (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

-- Enforce attribution when lessons use assets and auto-flag open-track CC BY-SA.

create or replace function public.ensure_lesson_attribution()
returns trigger
language plpgsql
as $$
declare
  lesson_record record;
begin
  if new.lesson_id is null then
    return new;
  end if;

  select id, attribution_block
  into lesson_record
  from public.lessons
  where id = new.lesson_id;

  if lesson_record.id is null then
    raise exception 'Lesson % not found for asset', new.lesson_id;
  end if;

  if lesson_record.attribution_block is null or btrim(lesson_record.attribution_block) = '' then
    raise exception 'Lesson % must have attribution before linking assets', new.lesson_id;
  end if;

  if new.license = 'CC BY-SA' then
    update public.lessons
    set open_track = true
    where id = new.lesson_id;
  end if;

  return new;
end;
$$;

drop trigger if exists assets_check_lesson_attribution on public.assets;

create trigger assets_check_lesson_attribution
before insert or update on public.assets
for each row
execute procedure public.ensure_lesson_attribution();

-- Assessments updates ------------------------------------------------------

alter table public.assessments
  add column if not exists module_id bigint references public.modules (id) on delete set null;

drop policy if exists "assessments_all_read" on public.assessments;
drop policy if exists "assessments_service_write" on public.assessments;

create policy "assessments_owner_select"
on public.assessments
for select
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

create policy "assessments_owner_all"
on public.assessments
for all
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
)
with check (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

-- Adaptive rules simplified ------------------------------------------------

alter table public.adaptive_rules
  add column if not exists condition_json jsonb not null default '{}'::jsonb,
  add column if not exists recommendation_json jsonb not null default '{}'::jsonb,
  add column if not exists active boolean not null default true,
  add column if not exists label text,
  add column if not exists created_by uuid references public.profiles (id),
  add column if not exists created_at timestamptz not null default now();

update public.adaptive_rules
set condition_json = coalesce(nullif(params, '{}'::jsonb), '{}'::jsonb),
    recommendation_json = jsonb_build_object('type', 'lesson_sequence'),
    active = is_active,
    label = coalesce(label, name)
where condition_json = '{}'::jsonb
  and recommendation_json = '{}'::jsonb;

update public.adaptive_rules
set label = coalesce(label, concat('Rule ', id::text))
where label is null;

alter table public.adaptive_rules
  drop column if exists params,
  drop column if exists is_active,
  drop column if exists name;

alter table public.adaptive_rules
  alter column label set not null;

drop policy if exists "adaptive_rules_authenticated_read" on public.adaptive_rules;
drop policy if exists "adaptive_rules_service_write" on public.adaptive_rules;

create policy "adaptive_rules_owner_select"
on public.adaptive_rules
for select
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

create policy "adaptive_rules_owner_all"
on public.adaptive_rules
for all
using (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
)
with check (
  auth.role() = 'service_role'
  or (created_by is not null and created_by = auth.uid())
);

-- Seed core content sources ------------------------------------------------

insert into public.content_sources (name, license, license_url, attribution_text)
values
  ('OpenStax', 'CC BY', 'https://openstax.org/legal', 'OpenStax, licensed CC BY'),
  ('OpenSciEd MS', 'CC BY', 'https://www.openscied.org/about/licensing/', 'OpenSciEd middle school curriculum'),
  ('Project Gutenberg', 'Public Domain', 'https://www.gutenberg.org/policy/permission.html', 'Project Gutenberg public-domain texts'),
  ('NASA', 'Public Domain', 'https://www.nasa.gov/multimedia/guidelines/index.html', 'NASA multimedia, public domain unless noted'),
  ('NOAA', 'Public Domain', 'https://www.photolib.noaa.gov/about/media_use.html', 'NOAA public-domain resources'),
  ('NARA', 'Public Domain', 'https://www.archives.gov/legal/gaog', 'National Archives and Records Administration'),
  ('LOC', 'Public Domain', 'https://loc.gov/legal/', 'Library of Congress public-domain collections'),
  ('Siyavula', 'CC BY', 'https://www.siyavula.com/read/?page_id=949', 'Siyavula Education open textbooks'),
  ('C3 Teachers', 'CC BY-SA', 'https://c3teachers.org/license/', 'C3 Teachers inquiries licensed CC BY-SA')
on conflict (name) do update
  set license = excluded.license,
      license_url = excluded.license_url,
      attribution_text = excluded.attribution_text,
      updated_at = now();

commit;
