-- 006_subscriptions_notifications.sql
-- Subscriptions, payments, notifications, and guardian relationships.

begin;

create type guardian_link_status as enum ('pending', 'active', 'revoked');

create table public.guardian_child_links (
  id bigserial primary key,
  parent_id uuid not null references public.parent_profiles (id) on delete cascade,
  student_id uuid not null references public.student_profiles (id) on delete cascade,
  relationship text,
  status guardian_link_status not null default 'pending',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

create index guardian_links_parent_idx on public.guardian_child_links (parent_id);
create index guardian_links_student_idx on public.guardian_child_links (student_id);
create index guardian_links_status_idx on public.guardian_child_links (status);

alter table public.guardian_child_links enable row level security;

create policy "guardian_links_parent_rw"
on public.guardian_child_links
for all
using (parent_id = auth.uid())
with check (parent_id = auth.uid());

create policy "guardian_links_student_read"
on public.guardian_child_links
for select
using (student_id = auth.uid());

create policy "guardian_links_service_write"
on public.guardian_child_links
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create or replace function public.is_guardian(target_student uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.student_profiles sp
    where sp.id = target_student
      and sp.parent_id = auth.uid()
  )
  or exists (
    select 1
    from public.guardian_child_links gcl
    where gcl.student_id = target_student
      and gcl.parent_id = auth.uid()
      and gcl.status = 'active'
  );
$$;

drop policy if exists "parent_reads_child" on public.student_profiles;
create policy "parent_reads_child"
on public.student_profiles
for select
using (public.is_guardian(id));

drop policy if exists "parent_progress_read" on public.student_progress;
create policy "parent_progress_read"
on public.student_progress
for select
using (public.is_guardian(student_id));

drop policy if exists "attempts_parent_read" on public.student_assessment_attempts;
create policy "attempts_parent_read"
on public.student_assessment_attempts
for select
using (public.is_guardian(student_id));

drop policy if exists "responses_parent_read" on public.student_assessment_responses;
create policy "responses_parent_read"
on public.student_assessment_responses
for select
using (
  attempt_id in (
    select saa.id
    from public.student_assessment_attempts saa
    where public.is_guardian(saa.student_id)
  )
);

drop policy if exists "practice_sessions_parent_read" on public.practice_sessions;
create policy "practice_sessions_parent_read"
on public.practice_sessions
for select
using (public.is_guardian(student_id));

drop policy if exists "practice_events_parent_read" on public.practice_events;
create policy "practice_events_parent_read"
on public.practice_events
for select
using (
  session_id in (
    select ps.id
    from public.practice_sessions ps
    where public.is_guardian(ps.student_id)
  )
);

drop policy if exists "student_assignments_parent_read" on public.student_assignments;
create policy "student_assignments_parent_read"
on public.student_assignments
for select
using (public.is_guardian(student_id));

drop policy if exists "assignments_student_parent_read" on public.assignments;
create policy "assignments_student_parent_read"
on public.assignments
for select
using (
  creator_id = auth.uid()
  or auth.role() = 'service_role'
  or exists (
    select 1
    from public.student_assignments sa
    where sa.assignment_id = assignments.id
      and (
        sa.student_id = auth.uid()
        or public.is_guardian(sa.student_id)
      )
  )
);

drop policy if exists "student_mastery_parent_read" on public.student_mastery;
create policy "student_mastery_parent_read"
on public.student_mastery
for select
using (public.is_guardian(student_id));

drop policy if exists "mastery_events_parent_read" on public.student_mastery_events;
create policy "mastery_events_parent_read"
on public.student_mastery_events
for select
using (public.is_guardian(student_id));

drop policy if exists "student_badges_parent_read" on public.student_badges;
create policy "student_badges_parent_read"
on public.student_badges
for select
using (public.is_guardian(student_id));

drop policy if exists "xp_events_parent_read" on public.xp_events;
create policy "xp_events_parent_read"
on public.xp_events
for select
using (public.is_guardian(student_id));

drop policy if exists "streak_logs_parent_read" on public.streak_logs;
create policy "streak_logs_parent_read"
on public.streak_logs
for select
using (public.is_guardian(student_id));

create table public.subscriptions (
  id bigserial primary key,
  parent_id uuid not null references public.parent_profiles (id) on delete cascade,
  plan_id bigint not null references public.plans (id) on delete restrict,
  status subscription_status not null default 'trialing',
  billing_anchor timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscriptions_active_unique
on public.subscriptions (parent_id)
where status in ('trialing', 'active', 'past_due');

create index subscriptions_plan_idx on public.subscriptions (plan_id);

alter table public.subscriptions enable row level security;

create policy "subscriptions_parent_read"
on public.subscriptions
for select
using (parent_id = auth.uid());

create policy "subscriptions_parent_update"
on public.subscriptions
for update
using (parent_id = auth.uid())
with check (parent_id = auth.uid());

create policy "subscriptions_service_write"
on public.subscriptions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute procedure public.set_updated_at();

create table public.subscription_history (
  id bigserial primary key,
  subscription_id bigint not null references public.subscriptions (id) on delete cascade,
  event_type text not null,
  previous_status subscription_status,
  new_status subscription_status,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index subscription_history_subscription_idx on public.subscription_history (subscription_id);

alter table public.subscription_history enable row level security;

create policy "subscription_history_parent_read"
on public.subscription_history
for select
using (
  subscription_id in (
    select id from public.subscriptions where parent_id = auth.uid()
  )
);

create policy "subscription_history_service_write"
on public.subscription_history
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.payments (
  id bigserial primary key,
  subscription_id bigint references public.subscriptions (id) on delete set null,
  parent_id uuid not null references public.parent_profiles (id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'usd',
  status payment_status not null,
  description text,
  external_id text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index payments_parent_idx on public.payments (parent_id);
create index payments_status_idx on public.payments (status);

alter table public.payments enable row level security;

create policy "payments_parent_read"
on public.payments
for select
using (parent_id = auth.uid());

create policy "payments_service_write"
on public.payments
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.billing_events (
  id bigserial primary key,
  subscription_id bigint references public.subscriptions (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index billing_events_subscription_idx on public.billing_events (subscription_id);

alter table public.billing_events enable row level security;

create policy "billing_events_parent_read"
on public.billing_events
for select
using (
  subscription_id in (
    select id from public.subscriptions where parent_id = auth.uid()
  )
);

create policy "billing_events_service_write"
on public.billing_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table public.notifications (
  id bigserial primary key,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  notification_type text not null,
  title text,
  body text,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id);
create index notifications_type_idx on public.notifications (notification_type);
create index notifications_is_read_idx on public.notifications (is_read);

alter table public.notifications enable row level security;

create policy "notifications_recipient_rw"
on public.notifications
for all
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy "notifications_service_write"
on public.notifications
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
