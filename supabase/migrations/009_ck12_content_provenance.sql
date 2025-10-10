-- 009_ck12_content_provenance.sql
-- Adds OER provenance columns, topic prerequisites graph, and import auditing.

begin;

-- Extend subjects with optional provenance metadata.
alter table public.subjects
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists license text,
  add column if not exists attribution text;

-- Track external references and provenance for topics.
alter table public.topics
  add column if not exists external_id text,
  add column if not exists slug text,
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists license text,
  add column if not exists attribution text;

update public.topics
set slug = lower(regexp_replace(name, '[^a-z0-9]+', '-', 'g'))
where slug is null;

update public.topics
set slug = concat('topic-', id::text)
where slug = '';

with numbered_topics as (
  select
    id,
    slug,
    row_number() over (partition by subject_id, slug order by id) as rn
  from public.topics
)
update public.topics t
set slug = concat(t.slug, '-', (nt.rn - 1)::text)
from numbered_topics nt
where t.id = nt.id
  and nt.rn > 1;

alter table public.topics
  alter column slug set not null;

drop index if exists public.topics_subject_slug_idx;

create unique index if not exists topics_subject_slug_idx
on public.topics (subject_id, slug);

-- Expose only published topics to authenticated users while allowing service-role visibility.
drop policy if exists "topics_all_read" on public.topics;

create policy "topics_published_read"
on public.topics
for select
using (
  auth.role() = 'service_role'
  or (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.lessons l
      where l.topic_id = public.topics.id
        and l.is_published = true
    )
  )
);

-- Extend lessons with OER metadata.
alter table public.lessons
  add column if not exists external_id text,
  add column if not exists slug text,
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists license text,
  add column if not exists attribution text,
  add column if not exists media jsonb not null default '[]'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.lessons
set slug = lower(regexp_replace(title, '[^a-z0-9]+', '-', 'g'))
where slug is null;

update public.lessons
set slug = concat('lesson-', id::text)
where slug = '';

with numbered_lessons as (
  select
    id,
    topic_id,
    slug,
    row_number() over (partition by topic_id, slug order by id) as rn
  from public.lessons
)
update public.lessons l
set slug = concat(l.slug, '-', (nl.rn - 1)::text)
from numbered_lessons nl
where l.id = nl.id
  and nl.rn > 1;

alter table public.lessons
  alter column slug set not null;

drop index if exists public.lessons_topic_slug_idx;

create unique index if not exists lessons_topic_slug_idx
on public.lessons (topic_id, slug);

drop policy if exists "lessons_published_read" on public.lessons;

create policy "lessons_authenticated_published_read"
on public.lessons
for select
using (auth.role() = 'authenticated' and is_published = true);

create policy "lessons_service_read"
on public.lessons
for select
using (auth.role() = 'service_role');

create table if not exists public.topic_prerequisites (
  id bigserial primary key,
  topic_id bigint not null references public.topics (id) on delete cascade,
  prerequisite_id bigint not null references public.topics (id) on delete cascade,
  constraint topic_prerequisites_unique unique (topic_id, prerequisite_id),
  constraint topic_prerequisites_no_self_loop check (topic_id <> prerequisite_id)
);

create index if not exists topic_prerequisites_topic_idx
  on public.topic_prerequisites (topic_id);

create index if not exists topic_prerequisites_prerequisite_idx
  on public.topic_prerequisites (prerequisite_id);

alter table public.topic_prerequisites enable row level security;

create policy "topic_prerequisites_authenticated_read"
on public.topic_prerequisites
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "topic_prerequisites_service_write"
on public.topic_prerequisites
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Import auditing table.
create table if not exists public.import_runs (
  id bigserial primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  totals jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  triggered_by uuid references auth.users (id)
);

alter table public.import_runs enable row level security;

create policy "import_runs_authenticated_read"
on public.import_runs
for select
using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "import_runs_service_write"
on public.import_runs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
