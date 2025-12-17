-- 045_subscriptions_unique_parent.sql
-- Add a unique constraint on parent_id to support upsert operations.
-- The existing partial unique index (subscriptions_active_unique) remains for
-- enforcing one active subscription per parent, but a plain unique constraint
-- is needed for ON CONFLICT to work properly.

begin;

-- Add unique constraint on parent_id
-- This allows only one subscription record per parent (active or canceled)
alter table public.subscriptions
add constraint subscriptions_parent_id_unique unique (parent_id);

commit;
