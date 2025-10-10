-- Migration: enhance import run auditing for queued ingestion pipeline.
begin;

alter table public.import_runs
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'running', 'success', 'error'));

alter table public.import_runs
  add column if not exists input jsonb;

alter table public.import_runs
  add column if not exists logs jsonb not null default '[]'::jsonb;

create index if not exists import_runs_status_idx
  on public.import_runs (status, started_at desc);

commit;
