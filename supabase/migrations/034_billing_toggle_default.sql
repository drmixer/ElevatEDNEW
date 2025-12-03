-- 034_billing_toggle_default.sql
-- Seed a billing toggle so admins can disable subscription requirements.

begin;

-- Ensure platform_config exists in case earlier migrations were skipped in this environment.
do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'platform_config' and table_schema = 'public') then
    create table public.platform_config (
      key text primary key,
      value jsonb,
      updated_at timestamptz default now()
    );
  end if;
end $$;

insert into public.platform_config (key, value)
values ('billing.require_subscription', 'false')
on conflict (key) do nothing;

commit;
