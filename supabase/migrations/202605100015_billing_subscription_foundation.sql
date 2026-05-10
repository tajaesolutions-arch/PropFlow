-- Billing / Subscription / Stripe-ready foundation.
-- Non-destructive alignment for workspace subscription state, billing audit events,
-- plan limits, RLS helpers, and grace-period/recovery access checks.

create extension if not exists "pgcrypto";

create table if not exists public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan text not null default 'starter',
  status text not null default 'trialing',
  billing_provider text not null default 'stripe',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  payment_failed_at timestamptz,
  grace_period_started_at timestamptz,
  grace_period_ends_at timestamptz,
  restricted_at timestamptz,
  restored_at timestamptz,
  last_webhook_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_subscriptions add column if not exists plan text not null default 'starter';
alter table public.workspace_subscriptions add column if not exists status text not null default 'trialing';
alter table public.workspace_subscriptions add column if not exists billing_provider text not null default 'stripe';
alter table public.workspace_subscriptions add column if not exists stripe_customer_id text;
alter table public.workspace_subscriptions add column if not exists stripe_subscription_id text;
alter table public.workspace_subscriptions add column if not exists stripe_price_id text;
alter table public.workspace_subscriptions add column if not exists trial_started_at timestamptz;
alter table public.workspace_subscriptions add column if not exists trial_ends_at timestamptz;
alter table public.workspace_subscriptions add column if not exists current_period_start timestamptz;
alter table public.workspace_subscriptions add column if not exists current_period_end timestamptz;
alter table public.workspace_subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.workspace_subscriptions add column if not exists canceled_at timestamptz;
alter table public.workspace_subscriptions add column if not exists payment_failed_at timestamptz;
alter table public.workspace_subscriptions add column if not exists grace_period_started_at timestamptz;
alter table public.workspace_subscriptions add column if not exists grace_period_ends_at timestamptz;
alter table public.workspace_subscriptions add column if not exists restricted_at timestamptz;
alter table public.workspace_subscriptions add column if not exists restored_at timestamptz;
alter table public.workspace_subscriptions add column if not exists last_webhook_event_id text;
alter table public.workspace_subscriptions add column if not exists last_stripe_event_id text;
alter table public.workspace_subscriptions add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.workspace_subscriptions add column if not exists created_by uuid references public.profiles(id);
alter table public.workspace_subscriptions add column if not exists created_at timestamptz not null default now();
alter table public.workspace_subscriptions add column if not exists updated_at timestamptz not null default now();

update public.workspace_subscriptions
set billing_provider = coalesce(nullif(billing_provider, ''), 'stripe'),
    plan = coalesce(nullif(plan, ''), 'starter'),
    status = case when status = 'incomplete_expired' then 'incomplete' else coalesce(nullif(status, ''), 'trialing') end,
    last_webhook_event_id = coalesce(last_webhook_event_id, last_stripe_event_id)
where billing_provider is null or plan is null or status is null or status = 'incomplete_expired' or last_webhook_event_id is null;

alter table public.workspace_subscriptions drop constraint if exists workspace_subscriptions_plan_check;
alter table public.workspace_subscriptions add constraint workspace_subscriptions_plan_check
  check (plan in ('starter','pro','business','enterprise'));

alter table public.workspace_subscriptions drop constraint if exists workspace_subscriptions_status_check;
alter table public.workspace_subscriptions add constraint workspace_subscriptions_status_check
  check (status in ('trialing','active','past_due','unpaid','incomplete','canceled','cancelled','paused','restricted','grace_period','not_configured'));

alter table public.workspace_subscriptions drop constraint if exists workspace_subscriptions_billing_provider_check;
alter table public.workspace_subscriptions add constraint workspace_subscriptions_billing_provider_check
  check (billing_provider = 'stripe');

create unique index if not exists workspace_subscriptions_workspace_key on public.workspace_subscriptions (workspace_id);
create unique index if not exists workspace_subscriptions_stripe_customer_key on public.workspace_subscriptions (stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists workspace_subscriptions_stripe_subscription_key on public.workspace_subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists workspace_subscriptions_status_idx on public.workspace_subscriptions (status);

drop trigger if exists workspace_subscriptions_updated_at on public.workspace_subscriptions;
create trigger workspace_subscriptions_updated_at
before update on public.workspace_subscriptions
for each row execute function public.set_updated_at();

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subscription_id uuid references public.workspace_subscriptions(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  provider text not null default 'stripe',
  provider_event_id text,
  status text not null default 'recorded',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.billing_events add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.billing_events add column if not exists subscription_id uuid references public.workspace_subscriptions(id) on delete set null;
alter table public.billing_events add column if not exists actor_user_id uuid references public.profiles(id) on delete set null;
alter table public.billing_events add column if not exists event_type text;
alter table public.billing_events add column if not exists provider text not null default 'stripe';
alter table public.billing_events add column if not exists provider_event_id text;
alter table public.billing_events add column if not exists status text not null default 'recorded';
alter table public.billing_events add column if not exists message text;
alter table public.billing_events add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.billing_events add column if not exists created_at timestamptz not null default now();

update public.billing_events
set event_type = 'provider_not_configured'
where event_type is null;

alter table public.billing_events alter column event_type set not null;
alter table public.billing_events alter column provider set not null;
alter table public.billing_events alter column status set not null;
alter table public.billing_events alter column metadata set not null;
alter table public.billing_events alter column created_at set not null;

alter table public.billing_events drop constraint if exists billing_events_event_type_check;
alter table public.billing_events add constraint billing_events_event_type_check check (event_type in (
  'trial_started','trial_ending','checkout_started','checkout_completed','subscription_created','subscription_updated',
  'subscription_canceled','payment_succeeded','payment_failed','grace_period_started','grace_period_ended',
  'access_restricted','access_restored','billing_portal_opened','provider_not_configured'
));
alter table public.billing_events drop constraint if exists billing_events_provider_check;
alter table public.billing_events add constraint billing_events_provider_check check (provider = 'stripe');

create index if not exists billing_events_workspace_id_idx on public.billing_events (workspace_id);
create index if not exists billing_events_subscription_id_idx on public.billing_events (subscription_id);
create index if not exists billing_events_event_type_idx on public.billing_events (event_type);
create index if not exists billing_events_provider_event_id_idx on public.billing_events (provider_event_id);
create index if not exists billing_events_created_at_idx on public.billing_events (created_at desc);
create unique index if not exists billing_events_provider_event_unique_idx on public.billing_events (provider, provider_event_id) where provider_event_id is not null;

create table if not exists public.billing_plan_limits (
  id uuid primary key default gen_random_uuid(),
  plan text not null unique,
  max_properties integer,
  max_team_members integer,
  max_file_storage_mb integer,
  includes_owner_reports boolean default true,
  includes_inventory boolean default true,
  includes_accountant_dashboard boolean default false,
  includes_direct_booking boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.billing_plan_limits drop constraint if exists billing_plan_limits_plan_check;
alter table public.billing_plan_limits add constraint billing_plan_limits_plan_check
  check (plan in ('starter','pro','business','enterprise'));

drop trigger if exists billing_plan_limits_updated_at on public.billing_plan_limits;
create trigger billing_plan_limits_updated_at
before update on public.billing_plan_limits
for each row execute function public.set_updated_at();

insert into public.billing_plan_limits (plan, max_properties, max_team_members, max_file_storage_mb, includes_owner_reports, includes_inventory, includes_accountant_dashboard, includes_direct_booking)
values
  ('starter', 3, 3, 1024, true, false, false, false),
  ('pro', 15, 10, 10240, true, true, false, false),
  ('business', 50, 30, 51200, true, true, true, true),
  ('enterprise', null, null, null, true, true, true, true)
on conflict (plan) do update set
  max_properties = excluded.max_properties,
  max_team_members = excluded.max_team_members,
  max_file_storage_mb = excluded.max_file_storage_mb,
  includes_owner_reports = excluded.includes_owner_reports,
  includes_inventory = excluded.includes_inventory,
  includes_accountant_dashboard = excluded.includes_accountant_dashboard,
  includes_direct_booking = excluded.includes_direct_booking;

create or replace function public.can_view_billing(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','accountant']);
$$;

create or replace function public.can_manage_billing(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner']);
$$;

create or replace function public.workspace_billing_is_restricted(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_subscriptions ws
    where ws.workspace_id = target_workspace_id
      and (
        ws.status = 'restricted'
        or (ws.grace_period_ends_at is not null and ws.grace_period_ends_at < now() and ws.status in ('past_due','unpaid','grace_period'))
      )
  );
$$;

create or replace function public.workspace_billing_recovery_allowed(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.can_view_billing(target_workspace_id);
$$;

alter table public.workspace_subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_plan_limits enable row level security;

drop policy if exists "workspace_subscriptions_select_owner_admin" on public.workspace_subscriptions;
drop policy if exists "workspace_subscriptions_insert_owner" on public.workspace_subscriptions;
drop policy if exists "workspace_subscriptions_update_owner_safe" on public.workspace_subscriptions;

drop policy if exists workspace_subscriptions_select_billing_roles on public.workspace_subscriptions;
create policy workspace_subscriptions_select_billing_roles
on public.workspace_subscriptions
for select
to authenticated
using (public.can_view_billing(workspace_id));

drop policy if exists workspace_subscriptions_insert_trial_owner on public.workspace_subscriptions;
create policy workspace_subscriptions_insert_trial_owner
on public.workspace_subscriptions
for insert
to authenticated
with check (
  public.can_manage_billing(workspace_id)
  and created_by = auth.uid()
  and plan in ('starter','pro','business','enterprise')
  and status = 'trialing'
  and billing_provider = 'stripe'
  and stripe_customer_id is null
  and stripe_subscription_id is null
  and stripe_price_id is null
  and payment_failed_at is null
  and grace_period_started_at is null
  and grace_period_ends_at is null
  and restricted_at is null
  and restored_at is null
);

-- No authenticated customer update policy is created. Stripe/customer/payment fields
-- must be changed through trusted server-side paths using service credentials.

drop policy if exists billing_events_select_billing_roles on public.billing_events;
create policy billing_events_select_billing_roles
on public.billing_events
for select
to authenticated
using (public.can_view_billing(workspace_id));

drop policy if exists billing_events_insert_safe_client_events on public.billing_events;
create policy billing_events_insert_safe_client_events
on public.billing_events
for insert
to authenticated
with check (
  public.can_view_billing(workspace_id)
  and actor_user_id = auth.uid()
  and provider = 'stripe'
  and provider_event_id is null
  and event_type in ('provider_not_configured','trial_started','checkout_started','billing_portal_opened')
  and (metadata is null or not (metadata ?| array['secret','token','api_key','apikey','service_role','stripe_secret_key','webhook_secret']))
);

drop policy if exists billing_plan_limits_select_authenticated on public.billing_plan_limits;
create policy billing_plan_limits_select_authenticated
on public.billing_plan_limits
for select
to authenticated
using (auth.uid() is not null);

-- Plan limit writes are intentionally reserved for trusted backend/admin SQL.
