-- PropFlow in-app notifications hardening.
-- This migration does not create a duplicate notifications table. It aligns the
-- existing public.notifications table with workspace-scoped in-app notification
-- fields, indexes, and stricter role-safe RLS policies.

create extension if not exists "pgcrypto";

-- Column alignment for the existing notifications table.
alter table public.notifications add column if not exists recipient_role text;
alter table public.notifications add column if not exists entity_type text;
alter table public.notifications add column if not exists entity_id uuid;
alter table public.notifications add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.notifications add column if not exists priority text not null default 'normal';
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.notifications
set created_by = coalesce(created_by, actor_user_id)
where created_by is null;

-- Keep legacy and preferred event names valid while this app layer transitions.
create or replace function public.valid_notification_event_type(candidate text)
returns boolean
language sql
immutable
as $$
  select candidate in (
    'property_created',
    'booking_created',
    'booking_updated',
    'booking_checkin_due',
    'booking_checkout_due',
    'cleaning_task_assigned',
    'cleaning_task_due_soon',
    'cleaning_task_completed',
    'cleaning_task_issue_reported',
    'maintenance_issue_reported',
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
    'team_member_invited',
    'team_invite_accepted',
    'member_suspended',
    'member_reactivated',
    'payment_failed',
    'billing_payment_failed',
    'billing_trial_ending',
    'billing_grace_period_started',
    'billing_grace_period_warning',
    'billing_access_restricted',
    'workspace_billing_restricted',
    'billing_access_restored',
    'billing_provider_not_configured',
    'ical_sync_failed',
    'ical_sync_conflicts_found',
    'ical_feed_paused',
    'ical_feed_archived',
    'ical_import_converted_to_booking',
    'lease_created',
    'lease_expiring_soon',
    'lease_archived',
    'lease_document_linked',
    'workspace_activity'
  );
$$;

alter table public.notifications drop constraint if exists notifications_priority_check;
alter table public.notifications add constraint notifications_priority_check
  check (priority in ('low','normal','high','urgent'));

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check
  check (public.valid_notification_event_type(event_type));

alter table public.notifications drop constraint if exists notifications_recipient_role_check;
alter table public.notifications add constraint notifications_recipient_role_check
  check (recipient_role is null or recipient_role in ('workspace_owner','property_manager','host','accountant','property_owner','cleaner','maintenance'));

alter table public.notifications drop constraint if exists notifications_entity_type_check;
alter table public.notifications add constraint notifications_entity_type_check
  check (entity_type is null or entity_type in ('property','booking','cleaning_task','maintenance_work_order','owner_report','expense','file_upload','workspace_invite','billing','workspace'));

create index if not exists notifications_workspace_id_idx on public.notifications (workspace_id);
create index if not exists notifications_recipient_user_id_idx on public.notifications (recipient_user_id);
create index if not exists notifications_recipient_role_idx on public.notifications (recipient_role);
create index if not exists notifications_read_at_idx on public.notifications (read_at);
create index if not exists notifications_created_at_desc_idx on public.notifications (created_at desc);
create index if not exists notifications_type_idx on public.notifications (type);
create index if not exists notifications_priority_idx on public.notifications (priority);

create or replace function public.notification_role_allowed(target_workspace_id uuid, target_role text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_role is not null
    and public.has_workspace_role(target_workspace_id, array[target_role]);
$$;

create or replace function public.notification_property_assigned_to_current_user(target_workspace_id uuid, target_property_id uuid, target_role text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_property_id is not null
    and target_role is not null
    and exists (
      select 1
      from public.property_assignments pa
      where pa.workspace_id = target_workspace_id
        and pa.property_id = target_property_id
        and pa.user_id = auth.uid()
        and pa.assignment_role = target_role
    );
$$;

create or replace function public.can_view_notification(
  target_workspace_id uuid,
  target_recipient_user_id uuid,
  target_recipient_role text default null,
  target_event_type text default null,
  target_related_property_id uuid default null,
  target_related_cleaning_task_id uuid default null,
  target_related_maintenance_work_order_id uuid default null,
  target_related_report_id uuid default null
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_propflow_admin()
    or (
      public.user_is_active_workspace_member(target_workspace_id, auth.uid())
      and (
        target_recipient_user_id = auth.uid()
        or public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host'])
        or (
          public.has_workspace_role(target_workspace_id, array['accountant'])
          and (target_event_type like 'billing_%' or target_event_type in ('payment_failed','workspace_billing_restricted','expense_created','owner_report_ready','owner_report_released'))
        )
        or (
          public.has_workspace_role(target_workspace_id, array['property_owner'])
          and (
            target_recipient_role = 'property_owner'
            or public.notification_property_assigned_to_current_user(target_workspace_id, target_related_property_id, 'property_owner')
            or exists (
              select 1 from public.owner_reports r
              where r.id = target_related_report_id
                and r.workspace_id = target_workspace_id
                and r.owner_id = auth.uid()
            )
          )
        )
        or (
          public.has_workspace_role(target_workspace_id, array['cleaner'])
          and (
            target_recipient_role = 'cleaner'
            or exists (
              select 1 from public.cleaning_tasks ct
              where ct.id = target_related_cleaning_task_id
                and ct.workspace_id = target_workspace_id
                and ct.assigned_cleaner_id = auth.uid()
            )
          )
        )
        or (
          public.has_workspace_role(target_workspace_id, array['maintenance'])
          and (
            target_recipient_role = 'maintenance'
            or exists (
              select 1 from public.maintenance_work_orders mwo
              where mwo.id = target_related_maintenance_work_order_id
                and mwo.workspace_id = target_workspace_id
                and mwo.assigned_maintenance_id = auth.uid()
            )
          )
        )
      )
    );
$$;

create or replace function public.can_create_workspace_notification(
  target_workspace_id uuid,
  target_recipient_user_id uuid,
  target_event_type text default null,
  target_related_cleaning_task_id uuid default null,
  target_related_maintenance_work_order_id uuid default null
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
    )
  or (
    target_event_type in ('cleaning_task_completed','cleaning_task_issue_reported')
    and exists (
      select 1 from public.cleaning_tasks ct
      where ct.id = target_related_cleaning_task_id
        and ct.workspace_id = target_workspace_id
        and ct.assigned_cleaner_id = auth.uid()
    )
    and (target_recipient_user_id is null or public.user_is_active_workspace_member(target_workspace_id, target_recipient_user_id))
  )
  or (
    target_event_type = 'maintenance_work_order_completed'
    and exists (
      select 1 from public.maintenance_work_orders mwo
      where mwo.id = target_related_maintenance_work_order_id
        and mwo.workspace_id = target_workspace_id
        and mwo.assigned_maintenance_id = auth.uid()
    )
    and (target_recipient_user_id is null or public.user_is_active_workspace_member(target_workspace_id, target_recipient_user_id))
  );
$$;

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
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.created_by := coalesce(new.created_by, new.actor_user_id);

  if new.status = 'read' and new.read_at is null then
    new.read_at := now();
  elsif new.status = 'unread' then
    new.read_at := null;
  end if;

  if new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.prevent_unsafe_notification_recipient_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.recipient_user_id = auth.uid()
    and new.id = old.id
    and new.workspace_id = old.workspace_id
    and new.recipient_user_id is not distinct from old.recipient_user_id
    and new.recipient_role is not distinct from old.recipient_role
    and new.actor_user_id is not distinct from old.actor_user_id
    and new.created_by is not distinct from old.created_by
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
    and new.entity_type is not distinct from old.entity_type
    and new.entity_id is not distinct from old.entity_id
    and new.action_url is not distinct from old.action_url
    and new.metadata = old.metadata
    and new.created_at = old.created_at
    and new.status in ('unread','read','archived') then
      return new;
  end if;

  raise exception 'Notification recipients can update only their own read/archive status.' using errcode = '42501';
end;
$$;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_recipient_or_manager on public.notifications;
drop policy if exists "notifications_select_recipient_or_manager" on public.notifications;
drop policy if exists notifications_select_recipient on public.notifications;
drop policy if exists "notifications_select_recipient" on public.notifications;
drop policy if exists notifications_select_authorized on public.notifications;
drop policy if exists "notifications_select_authorized" on public.notifications;
create policy notifications_select_authorized
on public.notifications
for select
to authenticated
using (
  public.can_view_notification(
    workspace_id,
    recipient_user_id,
    recipient_role,
    event_type,
    related_property_id,
    related_cleaning_task_id,
    related_maintenance_work_order_id,
    related_report_id
  )
);

drop policy if exists notifications_manage_manager on public.notifications;
drop policy if exists "notifications_manage_manager" on public.notifications;
drop policy if exists notifications_insert_workspace_manager on public.notifications;
drop policy if exists "notifications_insert_workspace_manager" on public.notifications;
create policy notifications_insert_workspace_manager
on public.notifications
for insert
to authenticated
with check (
  public.can_create_workspace_notification(
    workspace_id,
    recipient_user_id,
    event_type,
    related_cleaning_task_id,
    related_maintenance_work_order_id
  )
  and coalesce(actor_user_id, created_by) = auth.uid()
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
drop policy if exists "notifications_update_own_status" on public.notifications;
drop policy if exists notifications_update_recipient_or_manager on public.notifications;
drop policy if exists "notifications_update_recipient_or_manager" on public.notifications;
create policy notifications_update_own_status
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
  and public.user_is_active_workspace_member(workspace_id, auth.uid())
)
with check (
  recipient_user_id = auth.uid()
  and public.user_is_active_workspace_member(workspace_id, auth.uid())
);
