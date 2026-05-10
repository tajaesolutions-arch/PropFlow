-- Notifications / provider settings / in-app notification foundation.
-- Non-destructive alignment for workspace/user-scoped preferences, real in-app
-- notifications, provider-safe delivery logs, and non-secret provider status.
-- No Resend/Twilio/API/service-role secrets are stored by this migration.

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Shared validation helpers.
-- -----------------------------------------------------------------------------
create or replace function public.valid_notification_event_group(candidate text)
returns boolean
language sql
immutable
as $$
  select candidate in (
    'bookings',
    'cleaning',
    'maintenance',
    'owner_reports',
    'finance',
    'inventory',
    'files',
    'team',
    'billing',
    'workspace_activity'
  );
$$;

create or replace function public.valid_notification_event_type(candidate text)
returns boolean
language sql
immutable
as $$
  select candidate in (
    'booking_created',
    'booking_updated',
    'booking_checkin_due',
    'booking_checkout_due',
    'cleaning_task_assigned',
    'cleaning_task_due_soon',
    'cleaning_task_completed',
    'cleaning_task_issue_reported',
    'maintenance_work_order_created',
    'maintenance_work_order_assigned',
    'maintenance_work_order_urgent',
    'maintenance_work_order_completed',
    'owner_report_ready',
    'owner_report_released',
    'expense_created',
    'low_stock_alert',
    'file_uploaded',
    'team_invite_created',
    'team_invite_accepted',
    'member_suspended',
    'member_reactivated',
    'billing_payment_failed',
    'billing_grace_period_warning',
    'workspace_activity'
  );
$$;

create or replace function public.can_view_notification(target_workspace_id uuid, target_recipient_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_recipient_user_id = auth.uid()
    and public.user_is_active_workspace_member(target_workspace_id, auth.uid());
$$;

create or replace function public.can_create_workspace_notification(target_workspace_id uuid, target_recipient_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager'])
    and (
      target_recipient_user_id is null
      or public.user_is_active_workspace_member(target_workspace_id, target_recipient_user_id)
    );
$$;

create or replace function public.can_manage_notification_provider_settings(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner']);
$$;

create or replace function public.notification_related_records_are_scoped(
  target_workspace_id uuid,
  target_property_id uuid default null,
  target_booking_id uuid default null,
  target_cleaning_task_id uuid default null,
  target_maintenance_work_order_id uuid default null,
  target_expense_id uuid default null,
  target_report_id uuid default null,
  target_file_upload_id uuid default null,
  target_invite_id uuid default null
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select (target_property_id is null or exists (select 1 from public.properties p where p.id = target_property_id and p.workspace_id = target_workspace_id))
    and (target_booking_id is null or exists (select 1 from public.bookings b where b.id = target_booking_id and b.workspace_id = target_workspace_id))
    and (target_cleaning_task_id is null or exists (select 1 from public.cleaning_tasks ct where ct.id = target_cleaning_task_id and ct.workspace_id = target_workspace_id))
    and (target_maintenance_work_order_id is null or exists (select 1 from public.maintenance_work_orders mwo where mwo.id = target_maintenance_work_order_id and mwo.workspace_id = target_workspace_id))
    and (target_expense_id is null or exists (select 1 from public.expenses e where e.id = target_expense_id and e.workspace_id = target_workspace_id))
    and (target_report_id is null or exists (select 1 from public.owner_reports r where r.id = target_report_id and r.workspace_id = target_workspace_id))
    and (target_file_upload_id is null or exists (select 1 from public.file_uploads f where f.id = target_file_upload_id and f.workspace_id = target_workspace_id))
    and (target_invite_id is null or exists (select 1 from public.workspace_invites i where i.id = target_invite_id and i.workspace_id = target_workspace_id));
$$;

-- -----------------------------------------------------------------------------
-- Tables and non-destructive column alignment.
-- -----------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_group text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences add column if not exists event_group text;
alter table public.notification_preferences add column if not exists in_app_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists email_enabled boolean not null default false;
alter table public.notification_preferences alter column email_enabled set default false;
alter table public.notification_preferences add column if not exists sms_enabled boolean not null default false;
alter table public.notification_preferences alter column sms_enabled set default false;
alter table public.notification_preferences add column if not exists whatsapp_enabled boolean not null default false;
alter table public.notification_preferences alter column whatsapp_enabled set default false;
alter table public.notification_preferences add column if not exists created_at timestamptz not null default now();
alter table public.notification_preferences add column if not exists updated_at timestamptz not null default now();

update public.notification_preferences
set event_group = 'workspace_activity'
where event_group is null;

alter table public.notification_preferences alter column event_group set not null;

alter table public.notification_preferences drop constraint if exists notification_preferences_event_group_check;
alter table public.notification_preferences add constraint notification_preferences_event_group_check
  check (public.valid_notification_event_group(event_group));

do $$
begin
  alter table public.notification_preferences drop constraint if exists notification_preferences_workspace_id_user_id_key;
  alter table public.notification_preferences drop constraint if exists notification_preferences_workspace_user_group_key;
  alter table public.notification_preferences add constraint notification_preferences_workspace_user_group_key unique (workspace_id, user_id, event_group);
exception when unique_violation then
  raise notice 'notification_preferences has duplicate workspace/user/event_group rows; resolve duplicates before adding unique constraint.';
end $$;

alter table public.notifications add column if not exists actor_user_id uuid references public.profiles(id) on delete set null;
alter table public.notifications add column if not exists event_type text;
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists body text;
alter table public.notifications add column if not exists priority text not null default 'normal';
alter table public.notifications add column if not exists related_property_id uuid references public.properties(id) on delete set null;
alter table public.notifications add column if not exists related_booking_id uuid references public.bookings(id) on delete set null;
alter table public.notifications add column if not exists related_cleaning_task_id uuid references public.cleaning_tasks(id) on delete set null;
alter table public.notifications add column if not exists related_maintenance_work_order_id uuid references public.maintenance_work_orders(id) on delete set null;
alter table public.notifications add column if not exists related_expense_id uuid references public.expenses(id) on delete set null;
alter table public.notifications add column if not exists related_report_id uuid references public.owner_reports(id) on delete set null;
alter table public.notifications add column if not exists related_file_upload_id uuid references public.file_uploads(id) on delete set null;
alter table public.notifications add column if not exists related_invite_id uuid references public.workspace_invites(id) on delete set null;
alter table public.notifications add column if not exists action_url text;
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists archived_at timestamptz;
alter table public.notifications add column if not exists updated_at timestamptz not null default now();

update public.notifications
set event_type = coalesce(event_type, nullif(type, ''), 'workspace_activity'),
    title = coalesce(title, nullif(type, ''), 'Workspace notification'),
    body = coalesce(body, message)
where event_type is null or title is null;

alter table public.notifications alter column event_type set not null;
alter table public.notifications alter column title set not null;

alter table public.notifications drop constraint if exists notifications_status_check;
alter table public.notifications add constraint notifications_status_check check (status in ('unread','read','archived'));
alter table public.notifications drop constraint if exists notifications_priority_check;
alter table public.notifications add constraint notifications_priority_check check (priority in ('low','normal','high','urgent'));
alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (public.valid_notification_event_type(event_type));
alter table public.notifications drop constraint if exists notifications_related_records_scoped_check;
alter table public.notifications add constraint notifications_related_records_scoped_check check (
  public.notification_related_records_are_scoped(
    workspace_id,
    related_property_id,
    related_booking_id,
    related_cleaning_task_id,
    related_maintenance_work_order_id,
    related_expense_id,
    related_report_id,
    related_file_upload_id,
    related_invite_id
  )
);

create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  channel text not null,
  provider text,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  recipient_address text,
  status text not null default 'queued',
  error_message text,
  provider_message_id text,
  attempted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_delivery_logs add column if not exists provider text;
alter table public.notification_delivery_logs alter column provider drop not null;
alter table public.notification_delivery_logs add column if not exists recipient_address text;
alter table public.notification_delivery_logs add column if not exists provider_message_id text;
alter table public.notification_delivery_logs add column if not exists attempted_at timestamptz;
alter table public.notification_delivery_logs add column if not exists sent_at timestamptz;
alter table public.notification_delivery_logs add column if not exists updated_at timestamptz not null default now();

alter table public.notification_delivery_logs drop constraint if exists notification_delivery_logs_channel_check;
alter table public.notification_delivery_logs add constraint notification_delivery_logs_channel_check check (channel in ('in_app','email','sms','whatsapp'));
alter table public.notification_delivery_logs drop constraint if exists notification_delivery_logs_status_check;
alter table public.notification_delivery_logs add constraint notification_delivery_logs_status_check check (status in ('queued','skipped','sent','failed','provider_not_configured'));

create table if not exists public.notification_provider_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  channel text not null,
  enabled boolean not null default false,
  configured boolean not null default false,
  from_name text,
  from_email text,
  reply_to text,
  sender_phone_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, channel),
  constraint notification_provider_settings_channel_check check (channel in ('email','sms','whatsapp')),
  constraint notification_provider_settings_provider_check check (provider in ('resend','twilio'))
);

-- -----------------------------------------------------------------------------
-- Indexes and updated_at triggers.
-- -----------------------------------------------------------------------------
create index if not exists notification_preferences_workspace_idx on public.notification_preferences (workspace_id);
create index if not exists notification_preferences_user_idx on public.notification_preferences (user_id);
create index if not exists notification_preferences_workspace_user_idx on public.notification_preferences (workspace_id, user_id);

create index if not exists notifications_workspace_idx on public.notifications (workspace_id);
create index if not exists notifications_recipient_user_idx on public.notifications (recipient_user_id);
create index if not exists notifications_event_type_idx on public.notifications (event_type);
create index if not exists notifications_status_idx on public.notifications (status);
create index if not exists notifications_priority_idx on public.notifications (priority);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

create index if not exists notification_delivery_logs_workspace_idx on public.notification_delivery_logs (workspace_id);
create index if not exists notification_delivery_logs_recipient_user_idx on public.notification_delivery_logs (recipient_user_id);
create index if not exists notification_delivery_logs_channel_idx on public.notification_delivery_logs (channel);
create index if not exists notification_delivery_logs_status_idx on public.notification_delivery_logs (status);
create index if not exists notification_delivery_logs_provider_idx on public.notification_delivery_logs (provider);
create index if not exists notification_delivery_logs_created_at_idx on public.notification_delivery_logs (created_at desc);

create index if not exists notification_provider_settings_workspace_idx on public.notification_provider_settings (workspace_id);
create index if not exists notification_provider_settings_channel_idx on public.notification_provider_settings (channel);
create index if not exists notification_provider_settings_provider_idx on public.notification_provider_settings (provider);

drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists notifications_updated_at on public.notifications;
create trigger notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

drop trigger if exists notification_delivery_logs_updated_at on public.notification_delivery_logs;
create trigger notification_delivery_logs_updated_at
before update on public.notification_delivery_logs
for each row execute function public.set_updated_at();

drop trigger if exists notification_provider_settings_updated_at on public.notification_provider_settings;
create trigger notification_provider_settings_updated_at
before update on public.notification_provider_settings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS policies.
-- -----------------------------------------------------------------------------
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_delivery_logs enable row level security;
alter table public.notification_provider_settings enable row level security;

drop policy if exists "notification_preferences_select_self_or_manager" on public.notification_preferences;
drop policy if exists notification_preferences_select_self_or_manager on public.notification_preferences;
create policy notification_preferences_select_self_or_owner
on public.notification_preferences
for select
to authenticated
using (
  (user_id = auth.uid() and public.user_is_active_workspace_member(workspace_id, auth.uid()))
  or public.has_workspace_role(workspace_id, array['workspace_owner'])
);

drop policy if exists "notification_preferences_insert_self_or_manager" on public.notification_preferences;
drop policy if exists notification_preferences_insert_self_or_manager on public.notification_preferences;
create policy notification_preferences_insert_self
on public.notification_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.user_is_active_workspace_member(workspace_id, auth.uid())
  and public.valid_notification_event_group(event_group)
);

drop policy if exists "notification_preferences_update_self_or_manager" on public.notification_preferences;
drop policy if exists notification_preferences_update_self_or_manager on public.notification_preferences;
create policy notification_preferences_update_self
on public.notification_preferences
for update
to authenticated
using (user_id = auth.uid() and public.user_is_active_workspace_member(workspace_id, auth.uid()))
with check (
  user_id = auth.uid()
  and public.user_is_active_workspace_member(workspace_id, auth.uid())
  and public.valid_notification_event_group(event_group)
);

drop policy if exists notifications_select_recipient_or_manager on public.notifications;
create policy notifications_select_recipient
on public.notifications
for select
to authenticated
using (public.can_view_notification(workspace_id, recipient_user_id));

drop policy if exists notifications_manage_manager on public.notifications;
create policy notifications_insert_workspace_manager
on public.notifications
for insert
to authenticated
with check (
  public.can_create_workspace_notification(workspace_id, recipient_user_id)
  and actor_user_id = auth.uid()
  and public.valid_notification_event_type(event_type)
  and public.notification_related_records_are_scoped(
    workspace_id,
    related_property_id,
    related_booking_id,
    related_cleaning_task_id,
    related_maintenance_work_order_id,
    related_expense_id,
    related_report_id,
    related_file_upload_id,
    related_invite_id
  )
);

create policy notifications_update_own_status
on public.notifications
for update
to authenticated
using (recipient_user_id = auth.uid() and public.user_is_active_workspace_member(workspace_id, auth.uid()))
with check (recipient_user_id = auth.uid() and public.user_is_active_workspace_member(workspace_id, auth.uid()));

create or replace function public.prevent_unsafe_notification_recipient_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_workspace_role(old.workspace_id, array['workspace_owner','property_manager']) then
    return new;
  end if;

  if old.recipient_user_id = auth.uid()
    and new.id = old.id
    and new.workspace_id = old.workspace_id
    and new.recipient_user_id is not distinct from old.recipient_user_id
    and new.actor_user_id is not distinct from old.actor_user_id
    and new.event_type = old.event_type
    and new.type is not distinct from old.type
    and new.title = old.title
    and new.body is not distinct from old.body
    and new.message is not distinct from old.message
    and new.priority = old.priority
    and new.related_property_id is not distinct from old.related_property_id
    and new.related_booking_id is not distinct from old.related_booking_id
    and new.related_cleaning_task_id is not distinct from old.related_cleaning_task_id
    and new.related_maintenance_work_order_id is not distinct from old.related_maintenance_work_order_id
    and new.related_expense_id is not distinct from old.related_expense_id
    and new.related_report_id is not distinct from old.related_report_id
    and new.related_file_upload_id is not distinct from old.related_file_upload_id
    and new.related_invite_id is not distinct from old.related_invite_id
    and new.action_url is not distinct from old.action_url
    and new.metadata = old.metadata
    and new.created_at = old.created_at
    and new.status in ('unread','read','archived') then
      return new;
  end if;

  raise exception 'Notification recipients can update only their own read/archive status.' using errcode = '42501';
end;
$$;

drop trigger if exists prevent_unsafe_notification_recipient_update on public.notifications;
create trigger prevent_unsafe_notification_recipient_update
before update on public.notifications
for each row execute function public.prevent_unsafe_notification_recipient_update();

drop policy if exists "notification_delivery_logs_select_manager_or_recipient" on public.notification_delivery_logs;
drop policy if exists notification_delivery_logs_select_manager_or_recipient on public.notification_delivery_logs;
create policy notification_delivery_logs_select_owner_or_recipient
on public.notification_delivery_logs
for select
to authenticated
using (
  public.has_workspace_role(workspace_id, array['workspace_owner'])
  or (recipient_user_id = auth.uid() and public.user_is_active_workspace_member(workspace_id, auth.uid()))
);

drop policy if exists "notification_delivery_logs_insert_manager" on public.notification_delivery_logs;
drop policy if exists notification_delivery_logs_insert_manager on public.notification_delivery_logs;
create policy notification_delivery_logs_insert_manager
on public.notification_delivery_logs
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  and (recipient_user_id is null or public.user_is_active_workspace_member(workspace_id, recipient_user_id))
);

create policy notification_delivery_logs_update_owner
on public.notification_delivery_logs
for update
to authenticated
using (public.has_workspace_role(workspace_id, array['workspace_owner']))
with check (public.has_workspace_role(workspace_id, array['workspace_owner']));

create policy notification_provider_settings_select_manager
on public.notification_provider_settings
for select
to authenticated
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));

create policy notification_provider_settings_insert_owner
on public.notification_provider_settings
for insert
to authenticated
with check (public.can_manage_notification_provider_settings(workspace_id));

create policy notification_provider_settings_update_owner
on public.notification_provider_settings
for update
to authenticated
using (public.can_manage_notification_provider_settings(workspace_id))
with check (public.can_manage_notification_provider_settings(workspace_id));
