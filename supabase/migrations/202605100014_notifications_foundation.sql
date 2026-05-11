-- PropFlow notifications foundation.
-- Non-destructive alignment for in-app notifications, notification preferences,
-- provider-safe delivery logs, and non-secret notification provider settings.
--
-- Security rules:
-- - No Resend, Twilio, API, webhook, or service-role secrets are stored here.
-- - Every customer-facing record is workspace-scoped.
-- - Users can read their own notifications and manage their own preferences.
-- - Workspace operators can create/manage operational notifications by role.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Validation helpers.
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

create or replace function public.can_view_notification(
  target_workspace_id uuid,
  target_recipient_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select (
    target_recipient_user_id = auth.uid()
    and public.user_is_active_workspace_member(target_workspace_id, auth.uid())
  )
  or (
    target_recipient_user_id is null
    and public.user_is_active_workspace_member(target_workspace_id, auth.uid())
  )
  or public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager']);
$$;

create or replace function public.can_create_workspace_notification(
  target_workspace_id uuid,
  target_recipient_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host'])
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
  select (target_property_id is null or exists (
      select 1 from public.properties p
      where p.id = target_property_id and p.workspace_id = target_workspace_id
    ))
    and (target_booking_id is null or exists (
      select 1 from public.bookings b
      where b.id = target_booking_id and b.workspace_id = target_workspace_id
    ))
    and (target_cleaning_task_id is null or exists (
      select 1 from public.cleaning_tasks ct
      where ct.id = target_cleaning_task_id and ct.workspace_id = target_workspace_id
    ))
    and (target_maintenance_work_order_id is null or exists (
      select 1 from public.maintenance_work_orders mwo
      where mwo.id = target_maintenance_work_order_id and mwo.workspace_id = target_workspace_id
    ))
    and (target_expense_id is null or exists (
      select 1 from public.expenses e
      where e.id = target_expense_id and e.workspace_id = target_workspace_id
    ))
    and (target_report_id is null or exists (
      select 1 from public.owner_reports r
      where r.id = target_report_id and r.workspace_id = target_workspace_id
    ))
    and (target_file_upload_id is null or exists (
      select 1 from public.file_uploads f
      where f.id = target_file_upload_id and f.workspace_id = target_workspace_id
    ))
    and (target_invite_id is null or exists (
      select 1 from public.workspace_invites i
      where i.id = target_invite_id and i.workspace_id = target_workspace_id
    ));
$$;

-- -----------------------------------------------------------------------------
-- Tables and column alignment.
-- -----------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_group text not null default 'workspace_activity',
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  booking_reminders boolean not null default true,
  cleaning_assignments boolean not null default true,
  maintenance_assignments boolean not null default true,
  payment_alerts boolean not null default true,
  owner_reports boolean not null default true,
  team_invites boolean not null default true,
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
alter table public.notification_preferences add column if not exists booking_reminders boolean not null default true;
alter table public.notification_preferences add column if not exists cleaning_assignments boolean not null default true;
alter table public.notification_preferences add column if not exists maintenance_assignments boolean not null default true;
alter table public.notification_preferences add column if not exists payment_alerts boolean not null default true;
alter table public.notification_preferences add column if not exists owner_reports boolean not null default true;
alter table public.notification_preferences add column if not exists team_invites boolean not null default true;
alter table public.notification_preferences add column if not exists created_at timestamptz not null default now();
alter table public.notification_preferences add column if not exists updated_at timestamptz not null default now();

update public.notification_preferences
set event_group = 'workspace_activity'
where event_group is null or event_group = '';

alter table public.notification_preferences alter column event_group set default 'workspace_activity';
alter table public.notification_preferences alter column event_group set not null;

alter table public.notification_preferences drop constraint if exists notification_preferences_event_group_check;
alter table public.notification_preferences add constraint notification_preferences_event_group_check
  check (public.valid_notification_event_group(event_group));

with ranked_preferences as (
  select id,
         row_number() over (
           partition by workspace_id, user_id, event_group
           order by updated_at desc nulls last, created_at desc nulls last, id desc
         ) as row_number
  from public.notification_preferences
)
delete from public.notification_preferences np
using ranked_preferences rp
where np.id = rp.id
  and rp.row_number > 1;

alter table public.notification_preferences drop constraint if exists notification_preferences_workspace_id_user_id_key;
alter table public.notification_preferences drop constraint if exists notification_preferences_workspace_user_group_key;
alter table public.notification_preferences add constraint notification_preferences_workspace_user_group_key
  unique (workspace_id, user_id, event_group);

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
set event_type = coalesce(nullif(event_type, ''), nullif(type, ''), 'workspace_activity'),
    type = coalesce(nullif(type, ''), nullif(event_type, ''), 'workspace_activity'),
    title = coalesce(nullif(title, ''), nullif(type, ''), 'Workspace notification'),
    body = coalesce(body, nullif(message, ''), nullif(title, ''), 'Workspace notification'),
    message = coalesce(nullif(message, ''), body, title, 'Workspace notification'),
    read_at = case when status = 'read' and read_at is null then now() else read_at end,
    archived_at = case when status = 'archived' and archived_at is null then now() else archived_at end
where event_type is null
   or event_type = ''
   or type is null
   or type = ''
   or title is null
   or title = ''
   or body is null
   or message is null
   or message = ''
   or (status = 'read' and read_at is null)
   or (status = 'archived' and archived_at is null);

alter table public.notifications alter column event_type set default 'workspace_activity';
alter table public.notifications alter column event_type set not null;
alter table public.notifications alter column title set default 'Workspace notification';
alter table public.notifications alter column title set not null;
alter table public.notifications alter column priority set default 'normal';

alter table public.notifications drop constraint if exists notifications_status_check;
alter table public.notifications add constraint notifications_status_check
  check (status in ('unread','read','archived'));
alter table public.notifications drop constraint if exists notifications_priority_check;
alter table public.notifications add constraint notifications_priority_check
  check (priority in ('low','normal','high','urgent'));
alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check
  check (public.valid_notification_event_type(event_type));
alter table public.notifications drop constraint if exists notifications_related_records_scoped_check;

create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  channel text not null,
  provider text,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  recipient_address text,
  status text not null default 'queued',
  error_message text,
  provider_message_id text,
  attempted_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_delivery_logs add column if not exists provider text;
alter table public.notification_delivery_logs alter column provider drop not null;
alter table public.notification_delivery_logs add column if not exists recipient_address text;
alter table public.notification_delivery_logs add column if not exists provider_message_id text;
alter table public.notification_delivery_logs add column if not exists attempted_at timestamptz;
alter table public.notification_delivery_logs add column if not exists sent_at timestamptz;
alter table public.notification_delivery_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.notification_delivery_logs add column if not exists updated_at timestamptz not null default now();

alter table public.notification_delivery_logs drop constraint if exists notification_delivery_logs_channel_check;
alter table public.notification_delivery_logs drop constraint if exists notification_delivery_logs_status_check;
alter table public.notification_delivery_logs drop constraint if exists notification_delivery_logs_provider_check;

update public.notification_delivery_logs
set status = 'queued'
where status = 'pending';

alter table public.notification_delivery_logs alter column status set default 'queued';
alter table public.notification_delivery_logs add constraint notification_delivery_logs_channel_check
  check (channel in ('in_app','email','sms','whatsapp'));
alter table public.notification_delivery_logs add constraint notification_delivery_logs_status_check
  check (status in ('queued','skipped','sent','failed','provider_not_configured'));
alter table public.notification_delivery_logs add constraint notification_delivery_logs_provider_check
  check (provider is null or provider in ('internal','resend','twilio'));

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
  unique (workspace_id, provider, channel)
);

alter table public.notification_provider_settings add column if not exists enabled boolean not null default false;
alter table public.notification_provider_settings add column if not exists configured boolean not null default false;
alter table public.notification_provider_settings add column if not exists from_name text;
alter table public.notification_provider_settings add column if not exists from_email text;
alter table public.notification_provider_settings add column if not exists reply_to text;
alter table public.notification_provider_settings add column if not exists sender_phone_label text;
alter table public.notification_provider_settings add column if not exists notes text;
alter table public.notification_provider_settings add column if not exists created_at timestamptz not null default now();
alter table public.notification_provider_settings add column if not exists updated_at timestamptz not null default now();

alter table public.notification_provider_settings drop constraint if exists notification_provider_settings_channel_check;
alter table public.notification_provider_settings add constraint notification_provider_settings_channel_check
  check (channel in ('email','sms','whatsapp'));
alter table public.notification_provider_settings drop constraint if exists notification_provider_settings_provider_check;
alter table public.notification_provider_settings add constraint notification_provider_settings_provider_check
  check (provider in ('resend','twilio'));

-- -----------------------------------------------------------------------------
-- Normalization and update guards.
-- -----------------------------------------------------------------------------
create or replace function public.normalize_notification_payload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.event_type := coalesce(nullif(new.event_type, ''), nullif(new.type, ''), 'workspace_activity');
  new.type := coalesce(nullif(new.type, ''), new.event_type);
  new.title := coalesce(nullif(new.title, ''), initcap(replace(new.event_type, '_', ' ')), 'Workspace notification');
  new.body := coalesce(new.body, nullif(new.message, ''), new.title);
  new.message := coalesce(nullif(new.message, ''), new.body, new.title);
  new.priority := coalesce(nullif(new.priority, ''), 'normal');

  if new.status = 'read' and new.read_at is null then
    new.read_at := now();
  end if;

  if new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_notification_payload on public.notifications;
create trigger normalize_notification_payload
before insert or update on public.notifications
for each row execute function public.normalize_notification_payload();

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

-- -----------------------------------------------------------------------------
-- Indexes and updated_at triggers.
-- -----------------------------------------------------------------------------
create index if not exists notification_preferences_workspace_idx on public.notification_preferences (workspace_id);
create index if not exists notification_preferences_user_idx on public.notification_preferences (user_id);
create index if not exists notification_preferences_workspace_user_idx on public.notification_preferences (workspace_id, user_id);
create index if not exists notification_preferences_workspace_user_group_idx on public.notification_preferences (workspace_id, user_id, event_group);

create index if not exists notifications_workspace_idx on public.notifications (workspace_id);
create index if not exists notifications_recipient_user_idx on public.notifications (recipient_user_id);
create index if not exists notifications_event_type_idx on public.notifications (event_type);
create index if not exists notifications_status_idx on public.notifications (status);
create index if not exists notifications_priority_idx on public.notifications (priority);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
create index if not exists notifications_workspace_recipient_status_idx on public.notifications (workspace_id, recipient_user_id, status, created_at desc);

create index if not exists notification_delivery_logs_workspace_idx on public.notification_delivery_logs (workspace_id);
create index if not exists notification_delivery_logs_workspace_created_idx on public.notification_delivery_logs (workspace_id, created_at desc);
create index if not exists notification_delivery_logs_notification_idx on public.notification_delivery_logs (notification_id);
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
drop policy if exists notification_preferences_select_self_or_owner on public.notification_preferences;
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
drop policy if exists notification_preferences_insert_self on public.notification_preferences;
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
drop policy if exists notification_preferences_update_self on public.notification_preferences;
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
drop policy if exists notifications_select_recipient on public.notifications;
drop policy if exists notifications_select_authorized on public.notifications;
create policy notifications_select_authorized
on public.notifications
for select
to authenticated
using (public.can_view_notification(workspace_id, recipient_user_id));

drop policy if exists notifications_manage_manager on public.notifications;
drop policy if exists notifications_insert_workspace_manager on public.notifications;
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

drop policy if exists notifications_update_own_status on public.notifications;
drop policy if exists notifications_update_recipient_or_manager on public.notifications;
create policy notifications_update_recipient_or_manager
on public.notifications
for update
to authenticated
using (
  (recipient_user_id = auth.uid() and public.user_is_active_workspace_member(workspace_id, auth.uid()))
  or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
)
with check (
  (recipient_user_id = auth.uid() and public.user_is_active_workspace_member(workspace_id, auth.uid()))
  or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
);

drop policy if exists "notification_delivery_logs_select_manager_or_recipient" on public.notification_delivery_logs;
drop policy if exists notification_delivery_logs_select_manager_or_recipient on public.notification_delivery_logs;
drop policy if exists notification_delivery_logs_select_owner_or_recipient on public.notification_delivery_logs;
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

drop policy if exists notification_delivery_logs_update_owner on public.notification_delivery_logs;
create policy notification_delivery_logs_update_owner
on public.notification_delivery_logs
for update
to authenticated
using (public.has_workspace_role(workspace_id, array['workspace_owner']))
with check (public.has_workspace_role(workspace_id, array['workspace_owner']));

drop policy if exists notification_provider_settings_select_manager on public.notification_provider_settings;
create policy notification_provider_settings_select_manager
on public.notification_provider_settings
for select
to authenticated
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));

drop policy if exists notification_provider_settings_insert_owner on public.notification_provider_settings;
create policy notification_provider_settings_insert_owner
on public.notification_provider_settings
for insert
to authenticated
with check (public.can_manage_notification_provider_settings(workspace_id));

drop policy if exists notification_provider_settings_update_owner on public.notification_provider_settings;
create policy notification_provider_settings_update_owner
on public.notification_provider_settings
for update
to authenticated
using (public.can_manage_notification_provider_settings(workspace_id))
with check (public.can_manage_notification_provider_settings(workspace_id));
