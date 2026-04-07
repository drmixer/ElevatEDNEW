-- Lock down platform_config so it is no longer publicly accessible.
-- Runtime config is read by authenticated server-backed flows, while writes remain service/admin mediated.

begin;

alter table public.platform_config enable row level security;

drop policy if exists "platform_config_authenticated_read" on public.platform_config;
drop policy if exists "platform_config_service_write" on public.platform_config;

create policy "platform_config_authenticated_read"
on public.platform_config
for select
to authenticated
using (true);

create policy "platform_config_service_write"
on public.platform_config
for all
to service_role
using (true)
with check (true);

commit;
