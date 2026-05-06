-- PropFlow billing foundation.
-- Safe, non-destructive workspace subscription state for Stripe-backed billing.
-- Apply after the base workspace/auth migrations.

create extension if not exists "pgcrypto";

create table if not exists public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'starter' check (plan in ('starter','pro','business','enterprise')),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused','restricted')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  payment_failed_at timestamptz,
  grace_period_ends_at timestamptz,
  restricted_at timestamptz,
  cancel_at_period_end boolean not null default false,
  last_stripe_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workspace_subscriptions_workspace_key
  on public.workspace_subscriptions (workspace_id);

create unique index if not exists workspace_subscriptions_stripe_customer_key
  on public.workspace_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists workspace_subscriptions_stripe_subscription_key
  on public.workspace_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

drop trigger if exists workspace_subscriptions_updated_at on public.workspace_subscriptions;
create trigger workspace_subscriptions_updated_at
before update on public.workspace_subscriptions
for each row
execute function public.set_updated_at();

alter table public.workspace_subscriptions enable row level security;

drop policy if exists "workspace_subscriptions_select_owner_admin" on public.workspace_subscriptions;
create policy "workspace_subscriptions_select_owner_admin"
on public.workspace_subscriptions
for select
to authenticated
using (
  public.has_workspace_role(workspace_id, array['workspace_owner'])
);

drop policy if exists "workspace_subscriptions_insert_owner" on public.workspace_subscriptions;
create policy "workspace_subscriptions_insert_owner"
on public.workspace_subscriptions
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner'])
);

drop policy if exists "workspace_subscriptions_update_owner_safe" on public.workspace_subscriptions;
create policy "workspace_subscriptions_update_owner_safe"
on public.workspace_subscriptions
for update
to authenticated
using (
  public.has_workspace_role(workspace_id, array['workspace_owner'])
)
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner'])
);
