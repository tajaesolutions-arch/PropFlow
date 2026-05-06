-- PropFlow notification provider foundation.
-- Adds user/workspace notification preferences and delivery logs.
-- This migration does not configure or expose Resend/Twilio secrets.

create extension if not exists "pgcrypto";

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  in_app_enabled boolean not null default true,
  booking_reminders boolean not null default true,
  cleaning_assignments boolean not null default true,
  maintenance_assignments boolean not null default true,
  payment_alerts boolean not null default true,
  owner_reports boolean not null default true,
  team_invites boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  channel text not null check (channel in ('email','sms','whatsapp','in_app')),
  provider text not null default 'internal' check (provider in ('resend','twilio','internal')),
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_preferences_workspace_user_idx
  on public.notification_preferences (workspace_id, user_id);

create index if not exists notification_delivery_logs_workspace_idx
  on public.notification_delivery_logs (workspace_id, created_at desc);

create index if not exists notification_delivery_logs_notification_idx
  on public.notification_delivery_logs (notification_id);

drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.notification_delivery_logs enable row level security;

drop policy if exists "notification_preferences_select_self_or_manager" on public.notification_preferences;
create policy "notification_preferences_select_self_or_manager"
on public.notification_preferences
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
);

drop policy if exists "notification_preferences_insert_self_or_manager" on public.notification_preferences;
create policy "notification_preferences_insert_self_or_manager"
on public.notification_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
);

drop policy if exists "notification_preferences_update_self_or_manager" on public.notification_preferences;
create policy "notification_preferences_update_self_or_manager"
on public.notification_preferences
for update
to authenticated
using (
  user_id = auth.uid()
  or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
)
with check (
  user_id = auth.uid()
  or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
);

drop policy if exists "notification_delivery_logs_select_manager_or_recipient" on public.notification_delivery_logs;
create policy "notification_delivery_logs_select_manager_or_recipient"
on public.notification_delivery_logs
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
);

drop policy if exists "notification_delivery_logs_insert_manager" on public.notification_delivery_logs;
create policy "notification_delivery_logs_insert_manager"
on public.notification_delivery_logs
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
);
