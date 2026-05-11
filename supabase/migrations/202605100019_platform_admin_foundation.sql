-- Platform Admin / Founder Admin operations and health foundation.
-- Non-destructive: adds platform-only admin review fields, admin audit/notes,
-- and SECURITY DEFINER RPCs that verify public.is_propflow_admin() before any
-- platform-wide read or mutation. Customer workspace RLS remains workspace-scoped.

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Platform admin identity and review fields.
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists is_propflow_admin boolean not null default false;
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists platform_review_status text not null default 'not_reviewed';
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspended_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists suspension_reason text;

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check check (account_status in ('active','suspended','restricted'));
alter table public.profiles drop constraint if exists profiles_platform_review_status_check;
alter table public.profiles add constraint profiles_platform_review_status_check check (platform_review_status in ('not_reviewed','under_review','approved','denied','suspicious','suspended'));

alter table public.workspaces add column if not exists account_status text not null default 'active';
alter table public.workspaces add column if not exists platform_review_status text not null default 'not_reviewed';
alter table public.workspaces add column if not exists platform_reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.workspaces add column if not exists platform_reviewed_at timestamptz;
alter table public.workspaces add column if not exists platform_admin_notes text;
alter table public.workspaces add column if not exists suspended_at timestamptz;
alter table public.workspaces add column if not exists suspended_by uuid references public.profiles(id) on delete set null;
alter table public.workspaces add column if not exists suspension_reason text;

alter table public.workspaces drop constraint if exists workspaces_account_status_check;
alter table public.workspaces add constraint workspaces_account_status_check check (account_status in ('active','under_review','suspended','restricted','denied'));
alter table public.workspaces drop constraint if exists workspaces_platform_review_status_check;
alter table public.workspaces add constraint workspaces_platform_review_status_check check (platform_review_status in ('not_reviewed','under_review','approved','denied','suspicious','suspended'));

-- Customer profile self-updates must never be able to set the platform admin flag.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid() and is_propflow_admin = false);

create or replace function public.is_propflow_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_propflow_admin = true
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.account_status, p.status, 'active') <> 'suspended'
      and coalesce(p.status, 'active') <> 'suspended'
  ), false);
$$;

-- -----------------------------------------------------------------------------
-- Platform admin audit logs and notes.
-- -----------------------------------------------------------------------------
create table if not exists public.platform_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  workspace_id uuid references public.workspaces(id) on delete set null,
  severity text not null default 'info',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (severity in ('info','warning','critical'))
);

create table if not exists public.platform_admin_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  subscription_id uuid references public.workspace_subscriptions(id) on delete set null,
  note_type text not null default 'general',
  severity text not null default 'info',
  title text not null,
  body text,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (severity in ('info','warning','critical'))
);

create index if not exists platform_admin_audit_logs_created_idx on public.platform_admin_audit_logs (created_at desc);
create index if not exists platform_admin_audit_logs_workspace_idx on public.platform_admin_audit_logs (workspace_id, created_at desc);
create index if not exists platform_admin_notes_workspace_idx on public.platform_admin_notes (workspace_id, created_at desc) where archived_at is null;
create index if not exists platform_admin_notes_user_idx on public.platform_admin_notes (user_id, created_at desc) where archived_at is null;

drop trigger if exists platform_admin_notes_updated_at on public.platform_admin_notes;
create trigger platform_admin_notes_updated_at
before update on public.platform_admin_notes
for each row execute function public.set_updated_at();

alter table public.platform_admin_audit_logs enable row level security;
alter table public.platform_admin_notes enable row level security;

drop policy if exists platform_admin_audit_logs_select_admin on public.platform_admin_audit_logs;
create policy platform_admin_audit_logs_select_admin
on public.platform_admin_audit_logs
for select
using (public.is_propflow_admin());

drop policy if exists platform_admin_audit_logs_insert_admin on public.platform_admin_audit_logs;
create policy platform_admin_audit_logs_insert_admin
on public.platform_admin_audit_logs
for insert
with check (public.is_propflow_admin() and actor_user_id = auth.uid());

drop policy if exists platform_admin_notes_select_admin on public.platform_admin_notes;
create policy platform_admin_notes_select_admin
on public.platform_admin_notes
for select
using (public.is_propflow_admin());

drop policy if exists platform_admin_notes_insert_admin on public.platform_admin_notes;
create policy platform_admin_notes_insert_admin
on public.platform_admin_notes
for insert
with check (public.is_propflow_admin() and created_by = auth.uid());

drop policy if exists platform_admin_notes_update_admin on public.platform_admin_notes;
create policy platform_admin_notes_update_admin
on public.platform_admin_notes
for update
using (public.is_propflow_admin())
with check (public.is_propflow_admin());

-- -----------------------------------------------------------------------------
-- Internal helpers.
-- -----------------------------------------------------------------------------
create or replace function public.platform_admin_assert()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_propflow_admin() then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.platform_admin_log(
  p_action text,
  p_target_type text,
  p_target_id uuid default null,
  p_workspace_id uuid default null,
  p_severity text default 'info',
  p_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.platform_admin_assert();

  if p_severity not in ('info','warning','critical') then
    raise exception 'invalid_admin_audit_severity' using errcode = '22023';
  end if;

  insert into public.platform_admin_audit_logs (
    actor_user_id, action, target_type, target_id, workspace_id, severity, message, metadata
  ) values (
    auth.uid(), left(trim(p_action), 120), left(trim(p_target_type), 80), p_target_id, p_workspace_id,
    p_severity, nullif(left(coalesce(p_message, ''), 2000), ''), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.platform_workspace_owner_ids(p_workspace_id uuid)
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select wm.user_id
  from public.workspace_members wm
  join public.profiles p on p.id = wm.user_id
  where wm.workspace_id = p_workspace_id
    and wm.status = 'active'
    and coalesce(p.account_status, p.status, 'active') = 'active'
    and coalesce(p.status, 'active') = 'active'
    and wm.roles && array['workspace_owner','property_manager']::text[];
$$;

create or replace function public.platform_admin_notify_workspace(p_workspace_id uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  for v_user_id in select * from public.platform_workspace_owner_ids(p_workspace_id) loop
    insert into public.notifications (
      workspace_id, recipient_user_id, actor_user_id, type, message, status, metadata,
      event_type, title, body, priority, action_url
    ) values (
      p_workspace_id, v_user_id, auth.uid(), 'workspace_activity', coalesce(p_body, p_title), 'unread',
      jsonb_build_object('source', 'platform_admin'), 'workspace_activity', p_title, p_body, 'high', '/notifications'
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Platform overview and list RPCs. These return safe summary fields only.
-- -----------------------------------------------------------------------------
create or replace function public.get_platform_admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.platform_admin_assert();

  select jsonb_build_object(
    'total_workspaces', (select count(*) from public.workspaces),
    'active_workspaces', (select count(*) from public.workspaces where coalesce(account_status, status, 'active') = 'active' and coalesce(status, 'active') = 'active'),
    'suspended_workspaces', (select count(*) from public.workspaces where coalesce(account_status, status, 'active') in ('suspended','restricted') or coalesce(status, 'active') = 'suspended'),
    'workspaces_under_review', (select count(*) from public.workspaces where platform_review_status = 'under_review' or account_status = 'under_review'),
    'total_profiles', (select count(*) from public.profiles),
    'total_users', (select count(*) from public.profiles),
    'active_users', (select count(*) from public.profiles where coalesce(account_status, status, 'active') = 'active' and coalesce(status, 'active') = 'active'),
    'suspended_users', (select count(*) from public.profiles where coalesce(account_status, status, 'active') in ('suspended','restricted') or coalesce(status, 'active') = 'suspended'),
    'total_workspace_members', (select count(*) from public.workspace_members),
    'total_properties', (select count(*) from public.properties where archived_at is null),
    'total_bookings', (select count(*) from public.bookings),
    'total_leases', (select count(*) from public.leases where archived_at is null),
    'total_direct_booking_pages', (select count(*) from public.direct_booking_pages where archived_at is null),
    'total_direct_booking_requests', (select count(*) from public.direct_booking_requests where archived_at is null),
    'total_calendar_import_feeds', (select count(*) from public.calendar_import_feeds where archived_at is null),
    'total_files', (select count(*) from public.file_uploads where archived_at is null),
    'total_expenses', (select count(*) from public.expenses where archived_at is null),
    'total_notifications', (select count(*) from public.notifications where archived_at is null),
    'total_subscriptions', (select count(*) from public.workspace_subscriptions),
    'active_subscriptions', (select count(*) from public.workspace_subscriptions where status = 'active'),
    'trialing_subscriptions', (select count(*) from public.workspace_subscriptions where status = 'trialing'),
    'past_due_subscriptions', (select count(*) from public.workspace_subscriptions where status in ('past_due','unpaid','grace_period')),
    'restricted_subscriptions', (select count(*) from public.workspace_subscriptions where status = 'restricted' or restricted_at is not null),
    'created_last_7_days', jsonb_build_object(
      'workspaces', (select count(*) from public.workspaces where created_at >= now() - interval '7 days'),
      'users', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
      'properties', (select count(*) from public.properties where created_at >= now() - interval '7 days'),
      'bookings', (select count(*) from public.bookings where created_at >= now() - interval '7 days')
    ),
    'created_last_30_days', jsonb_build_object(
      'workspaces', (select count(*) from public.workspaces where created_at >= now() - interval '30 days'),
      'users', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
      'properties', (select count(*) from public.properties where created_at >= now() - interval '30 days'),
      'bookings', (select count(*) from public.bookings where created_at >= now() - interval '30 days')
    ),
    'subscription_status_counts', coalesce((
      select jsonb_object_agg(status, count)
      from (select status, count(*)::integer from public.workspace_subscriptions group by status) s
    ), '{}'::jsonb),
    'recent_audit_logs', coalesce((
      select jsonb_agg(to_jsonb(log_row) order by log_row.created_at desc)
      from (
        select id, actor_user_id, action, target_type, target_id, workspace_id, severity, message, metadata, created_at
        from public.platform_admin_audit_logs
        order by created_at desc
        limit 25
      ) log_row
    ), '[]'::jsonb),
    'recent_admin_notes', coalesce((
      select jsonb_agg(to_jsonb(note_row) order by note_row.created_at desc)
      from (
        select id, workspace_id, user_id, subscription_id, note_type, severity, title, body, created_by, created_at, updated_at
        from public.platform_admin_notes
        where archived_at is null
        order by created_at desc
        limit 25
      ) note_row
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_platform_workspaces()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.platform_admin_assert();

  return coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc)
    from (
      select
        w.id,
        w.name,
        w.name as business_name,
        w.company_code as code,
        w.company_code,
        w.country,
        w.default_currency,
        w.business_email,
        w.phone,
        w.website,
        coalesce(w.account_status, w.status, 'active') as account_status,
        w.status,
        w.platform_review_status,
        w.created_at,
        w.created_by,
        w.suspended_at,
        w.suspension_reason,
        coalesce(member_counts.owner_admin_count, 0) as owner_admin_count,
        coalesce(member_counts.member_count, 0) as member_count,
        coalesce(property_counts.property_count, 0) as property_count,
        coalesce(booking_counts.booking_count, 0) as booking_count,
        coalesce(lease_counts.lease_count, 0) as lease_count,
        coalesce(file_counts.file_count, 0) as file_count,
        ws.id as subscription_id,
        ws.plan as subscription_plan,
        ws.status as subscription_status,
        ws.trial_ends_at,
        ws.grace_period_ends_at,
        ws.restricted_at,
        greatest(
          w.updated_at,
          coalesce(property_counts.last_activity_at, w.updated_at),
          coalesce(booking_counts.last_activity_at, w.updated_at),
          coalesce(lease_counts.last_activity_at, w.updated_at),
          coalesce(file_counts.last_activity_at, w.updated_at)
        ) as last_activity_at
      from public.workspaces w
      left join lateral (
        select
          count(*)::integer as member_count,
          count(*) filter (where roles && array['workspace_owner','property_manager']::text[])::integer as owner_admin_count
        from public.workspace_members wm
        where wm.workspace_id = w.id and wm.status <> 'revoked'
      ) member_counts on true
      left join lateral (
        select count(*)::integer as property_count, max(updated_at) as last_activity_at
        from public.properties p where p.workspace_id = w.id and p.archived_at is null
      ) property_counts on true
      left join lateral (
        select count(*)::integer as booking_count, max(updated_at) as last_activity_at
        from public.bookings b where b.workspace_id = w.id
      ) booking_counts on true
      left join lateral (
        select count(*)::integer as lease_count, max(updated_at) as last_activity_at
        from public.leases l where l.workspace_id = w.id and l.archived_at is null
      ) lease_counts on true
      left join lateral (
        select count(*)::integer as file_count, max(created_at) as last_activity_at
        from public.file_uploads f where f.workspace_id = w.id and f.archived_at is null
      ) file_counts on true
      left join lateral (
        select s.* from public.workspace_subscriptions s where s.workspace_id = w.id order by s.updated_at desc limit 1
      ) ws on true
    ) row_data
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_platform_users()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.platform_admin_assert();

  return coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc)
    from (
      select
        p.id,
        p.full_name,
        p.email,
        coalesce(p.account_status, p.status, 'active') as account_status,
        p.platform_review_status,
        p.is_propflow_admin,
        p.created_at,
        null::timestamptz as last_sign_in_at,
        coalesce(role_counts.workspace_count, 0) as workspace_count,
        coalesce(role_counts.role_summary, '') as role_summary,
        p.suspended_at,
        p.suspension_reason
      from public.profiles p
      left join lateral (
        select
          count(distinct wm.workspace_id)::integer as workspace_count,
          string_agg(distinct role_value, ', ' order by role_value) as role_summary
        from public.workspace_members wm
        cross join lateral unnest(wm.roles) role_value
        where wm.user_id = p.id and wm.status <> 'revoked'
      ) role_counts on true
    ) row_data
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_platform_workspace_detail(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace public.workspaces%rowtype;
  v_result jsonb;
begin
  perform public.platform_admin_assert();

  select * into v_workspace from public.workspaces where id = p_workspace_id;
  if v_workspace.id is null then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'workspace', jsonb_build_object(
      'id', v_workspace.id,
      'name', v_workspace.name,
      'company_code', v_workspace.company_code,
      'country', v_workspace.country,
      'default_currency', v_workspace.default_currency,
      'business_email', v_workspace.business_email,
      'phone', v_workspace.phone,
      'website', v_workspace.website,
      'status', v_workspace.status,
      'account_status', v_workspace.account_status,
      'platform_review_status', v_workspace.platform_review_status,
      'platform_reviewed_at', v_workspace.platform_reviewed_at,
      'platform_admin_notes', v_workspace.platform_admin_notes,
      'suspended_at', v_workspace.suspended_at,
      'suspension_reason', v_workspace.suspension_reason,
      'created_at', v_workspace.created_at,
      'created_by', v_workspace.created_by
    ),
    'subscription', (
      select to_jsonb(s) - 'metadata'
      from public.workspace_subscriptions s
      where s.workspace_id = p_workspace_id
      order by s.updated_at desc
      limit 1
    ),
    'member_summary', jsonb_build_object(
      'total', (select count(*) from public.workspace_members where workspace_id = p_workspace_id and status <> 'revoked'),
      'active', (select count(*) from public.workspace_members where workspace_id = p_workspace_id and status = 'active'),
      'owner_admins', (select count(*) from public.workspace_members where workspace_id = p_workspace_id and status = 'active' and roles && array['workspace_owner','property_manager']::text[])
    ),
    'property_summary', jsonb_build_object(
      'total', (select count(*) from public.properties where workspace_id = p_workspace_id and archived_at is null),
      'active', (select count(*) from public.properties where workspace_id = p_workspace_id and archived_at is null and status = 'active'),
      'archived', (select count(*) from public.properties where workspace_id = p_workspace_id and archived_at is not null)
    ),
    'recent_activity_counts', jsonb_build_object(
      'bookings_30d', (select count(*) from public.bookings where workspace_id = p_workspace_id and created_at >= now() - interval '30 days'),
      'leases_30d', (select count(*) from public.leases where workspace_id = p_workspace_id and created_at >= now() - interval '30 days'),
      'direct_booking_requests_30d', (select count(*) from public.direct_booking_requests where workspace_id = p_workspace_id and created_at >= now() - interval '30 days'),
      'files_30d', (select count(*) from public.file_uploads where workspace_id = p_workspace_id and created_at >= now() - interval '30 days'),
      'expenses_30d', (select count(*) from public.expenses where workspace_id = p_workspace_id and created_at >= now() - interval '30 days')
    ),
    'recent_admin_notes', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at desc)
      from (
        select id, workspace_id, user_id, subscription_id, note_type, severity, title, body, created_by, created_at, updated_at
        from public.platform_admin_notes
        where workspace_id = p_workspace_id and archived_at is null
        order by created_at desc
        limit 10
      ) n
    ), '[]'::jsonb),
    'recent_billing_events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at desc)
      from (
        select id, workspace_id, subscription_id, event_type, status, message, created_at
        from public.billing_events
        where workspace_id = p_workspace_id
        order by created_at desc
        limit 10
      ) e
    ), '[]'::jsonb),
    'calendar_import_status', jsonb_build_object(
      'feeds', (select count(*) from public.calendar_import_feeds where workspace_id = p_workspace_id and archived_at is null),
      'failed_syncs_7d', (select count(*) from public.calendar_import_sync_runs where workspace_id = p_workspace_id and status = 'failed' and created_at >= now() - interval '7 days'),
      'open_conflicts', (select count(*) from public.calendar_import_conflicts where workspace_id = p_workspace_id and resolved_at is null)
    ),
    'health_flags', jsonb_build_object(
      'no_subscription', not exists (select 1 from public.workspace_subscriptions where workspace_id = p_workspace_id),
      'billing_past_due', exists (select 1 from public.workspace_subscriptions where workspace_id = p_workspace_id and status in ('past_due','unpaid','grace_period','restricted')),
      'no_owner_admin', not exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and status = 'active' and roles && array['workspace_owner','property_manager']::text[]),
      'too_many_failed_syncs', (select count(*) from public.calendar_import_sync_runs where workspace_id = p_workspace_id and status = 'failed' and created_at >= now() - interval '7 days') >= 3,
      'storage_errors_detected', false,
      'pending_invites', exists (select 1 from public.workspace_invites where workspace_id = p_workspace_id and status = 'pending'),
      'suspicious_empty_workspace', (select count(*) from public.properties where workspace_id = p_workspace_id and archived_at is null) = 0 and v_workspace.created_at < now() - interval '14 days'
    )
  ) into v_result;

  perform public.platform_admin_log('workspace_reviewed', 'workspace', p_workspace_id, p_workspace_id, 'info', 'Workspace detail reviewed', '{}'::jsonb);

  return v_result;
end;
$$;

create or replace function public.platform_admin_update_workspace_status(p_workspace_id uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 2000), '');
  v_review_status text;
  v_audit_action text;
begin
  perform public.platform_admin_assert();

  if v_status not in ('active','under_review','suspended','restricted','denied') then
    raise exception 'invalid_workspace_status' using errcode = '22023';
  end if;

  if v_status in ('suspended','restricted','denied') and v_reason is null then
    raise exception 'workspace_status_reason_required' using errcode = '23502';
  end if;

  v_review_status := case
    when v_status = 'active' then 'approved'
    when v_status = 'under_review' then 'under_review'
    when v_status = 'denied' then 'denied'
    else 'suspended'
  end;

  update public.workspaces
  set account_status = v_status,
      status = case when v_status in ('suspended','restricted','denied') then 'suspended' when v_status = 'active' then 'active' else status end,
      platform_review_status = v_review_status,
      platform_reviewed_by = auth.uid(),
      platform_reviewed_at = now(),
      suspended_at = case when v_status in ('suspended','restricted','denied') then now() else null end,
      suspended_by = case when v_status in ('suspended','restricted','denied') then auth.uid() else null end,
      suspension_reason = case when v_status in ('suspended','restricted','denied') then v_reason else null end,
      updated_at = now()
  where id = p_workspace_id;

  if not found then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  v_audit_action := case when v_status = 'active' then 'workspace_reactivated' when v_status = 'under_review' then 'workspace_reviewed' else 'workspace_suspended' end;

  perform public.platform_admin_log(
    v_audit_action,
    'workspace',
    p_workspace_id,
    p_workspace_id,
    case when v_status in ('suspended','restricted','denied') then 'critical' when v_status = 'under_review' then 'warning' else 'info' end,
    coalesce(v_reason, 'Workspace status changed to ' || v_status),
    jsonb_build_object('status', v_status)
  );

  if v_status in ('active','suspended','restricted') then
    perform public.platform_admin_notify_workspace(
      p_workspace_id,
      case when v_status = 'active' then 'Workspace reactivated' else 'Workspace access updated' end,
      case when v_status = 'active' then 'PropFlow has reactivated your workspace.' else 'PropFlow has updated this workspace status to ' || v_status || '. Reason: ' || coalesce(v_reason, 'Not provided') end
    );
  end if;

  return public.get_platform_workspace_detail(p_workspace_id);
end;
$$;

create or replace function public.platform_admin_update_user_status(p_user_id uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 2000), '');
  v_is_admin boolean;
  v_admin_count integer;
begin
  perform public.platform_admin_assert();

  if v_status not in ('active','suspended','restricted') then
    raise exception 'invalid_user_status' using errcode = '22023';
  end if;

  if v_status in ('suspended','restricted') and v_reason is null then
    raise exception 'user_status_reason_required' using errcode = '23502';
  end if;

  select is_propflow_admin into v_is_admin from public.profiles where id = p_user_id;
  if v_is_admin is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  if v_is_admin and v_status in ('suspended','restricted') then
    select count(*)::integer into v_admin_count
    from public.profiles
    where is_propflow_admin = true
      and id <> p_user_id
      and coalesce(account_status, status, 'active') = 'active'
      and coalesce(status, 'active') = 'active';

    if v_admin_count < 1 then
      raise exception 'cannot_suspend_only_platform_admin' using errcode = '23514';
    end if;
  end if;

  update public.profiles
  set account_status = v_status,
      status = case when v_status = 'suspended' then 'suspended' else 'active' end,
      platform_review_status = case when v_status = 'active' then 'approved' when v_status = 'restricted' then 'under_review' else 'suspended' end,
      suspended_at = case when v_status in ('suspended','restricted') then now() else null end,
      suspended_by = case when v_status in ('suspended','restricted') then auth.uid() else null end,
      suspension_reason = case when v_status in ('suspended','restricted') then v_reason else null end,
      updated_at = now()
  where id = p_user_id;

  perform public.platform_admin_log(
    case when v_status = 'active' then 'user_reactivated' else 'user_suspended' end,
    'user',
    p_user_id,
    null,
    case when v_status = 'active' then 'info' else 'critical' end,
    coalesce(v_reason, 'User status changed to ' || v_status),
    jsonb_build_object('status', v_status)
  );

  insert into public.notifications (
    workspace_id, recipient_user_id, actor_user_id, type, message, status, metadata,
    event_type, title, body, priority, action_url
  )
  select wm.workspace_id, p_user_id, auth.uid(), 'workspace_activity',
         case when v_status = 'active' then 'Your PropFlow account has been reactivated.' else 'Your PropFlow account status is now ' || v_status || '. Reason: ' || coalesce(v_reason, 'Not provided') end,
         'unread', jsonb_build_object('source', 'platform_admin', 'account_status', v_status),
         'workspace_activity',
         case when v_status = 'active' then 'Account reactivated' else 'Account status updated' end,
         case when v_status = 'active' then 'Your PropFlow account has been reactivated.' else 'Your PropFlow account status is now ' || v_status || '. Reason: ' || coalesce(v_reason, 'Not provided') end,
         'high', '/account'
  from public.workspace_members wm
  where wm.user_id = p_user_id and wm.status = 'active'
  limit 1;

  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'status', v_status);
end;
$$;

create or replace function public.platform_admin_create_note(
  p_workspace_id uuid default null,
  p_user_id uuid default null,
  p_subscription_id uuid default null,
  p_note_type text default 'general',
  p_severity text default 'info',
  p_title text default null,
  p_body text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_note_type text := left(regexp_replace(lower(trim(coalesce(p_note_type, 'general'))), '[^a-z0-9_\-]+', '_', 'g'), 60);
  v_severity text := lower(trim(coalesce(p_severity, 'info')));
  v_title text := nullif(left(trim(coalesce(p_title, '')), 180), '');
  v_body text := nullif(left(trim(coalesce(p_body, '')), 4000), '');
begin
  perform public.platform_admin_assert();

  if v_severity not in ('info','warning','critical') then
    raise exception 'invalid_note_severity' using errcode = '22023';
  end if;

  if v_title is null then
    raise exception 'admin_note_title_required' using errcode = '23502';
  end if;

  if p_workspace_id is null and p_user_id is null and p_subscription_id is null then
    raise exception 'admin_note_target_required' using errcode = '23502';
  end if;

  insert into public.platform_admin_notes (
    workspace_id, user_id, subscription_id, note_type, severity, title, body, created_by
  ) values (
    p_workspace_id, p_user_id, p_subscription_id, coalesce(nullif(v_note_type, ''), 'general'), v_severity, v_title, v_body, auth.uid()
  ) returning id into v_id;

  perform public.platform_admin_log(
    'admin_note_created',
    case when p_workspace_id is not null then 'workspace' when p_user_id is not null then 'user' else 'subscription' end,
    coalesce(p_workspace_id, p_user_id, p_subscription_id),
    p_workspace_id,
    v_severity,
    v_title,
    jsonb_build_object('note_id', v_id, 'note_type', v_note_type)
  );

  return (select to_jsonb(n) from public.platform_admin_notes n where n.id = v_id);
end;
$$;

create or replace function public.get_platform_health_report()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.platform_admin_assert();

  select jsonb_build_object(
    'admin_rpc_status', 'ready',
    'database_status', 'reachable',
    'billing_restricted_workspaces', (select count(*) from public.workspace_subscriptions where status = 'restricted' or restricted_at is not null),
    'provider_not_configured_delivery_logs', (select count(*) from public.notification_delivery_logs where status = 'provider_not_configured'),
    'provider_not_configured_billing_events', (select count(*) from public.billing_events where event_type = 'provider_not_configured'),
    'failed_ical_syncs', (select count(*) from public.calendar_import_sync_runs where status = 'failed'),
    'failed_ical_syncs_7d', (select count(*) from public.calendar_import_sync_runs where status = 'failed' and created_at >= now() - interval '7 days'),
    'open_ical_conflicts', (select count(*) from public.calendar_import_conflicts where resolved_at is null),
    'unread_critical_notifications', (select count(*) from public.notifications where status = 'unread' and priority = 'urgent'),
    'suspended_users', (select count(*) from public.profiles where coalesce(account_status, status, 'active') in ('suspended','restricted') or coalesce(status, 'active') = 'suspended'),
    'suspended_workspaces', (select count(*) from public.workspaces where coalesce(account_status, status, 'active') in ('suspended','restricted') or coalesce(status, 'active') = 'suspended'),
    'admin_audit_critical_30d', (select count(*) from public.platform_admin_audit_logs where severity = 'critical' and created_at >= now() - interval '30 days'),
    'recent_system_warnings', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.created_at desc)
      from (
        select id, action, target_type, target_id, workspace_id, severity, message, created_at
        from public.platform_admin_audit_logs
        where severity in ('warning','critical')
        order by created_at desc
        limit 20
      ) w
    ), '[]'::jsonb)
  ) into v_result;

  perform public.platform_admin_log('health_check_reviewed', 'platform', null, null, 'info', 'Platform health report reviewed', '{}'::jsonb);

  return v_result;
end;
$$;

revoke all on function public.is_propflow_admin() from public;
revoke all on function public.get_platform_admin_overview() from public;
revoke all on function public.get_platform_workspaces() from public;
revoke all on function public.get_platform_users() from public;
revoke all on function public.get_platform_workspace_detail(uuid) from public;
revoke all on function public.platform_admin_update_workspace_status(uuid, text, text) from public;
revoke all on function public.platform_admin_update_user_status(uuid, text, text) from public;
revoke all on function public.platform_admin_create_note(uuid, uuid, uuid, text, text, text, text) from public;
revoke all on function public.get_platform_health_report() from public;
revoke all on function public.is_propflow_admin() from anon;
revoke all on function public.get_platform_admin_overview() from anon;
revoke all on function public.get_platform_workspaces() from anon;
revoke all on function public.get_platform_users() from anon;
revoke all on function public.get_platform_workspace_detail(uuid) from anon;
revoke all on function public.platform_admin_update_workspace_status(uuid, text, text) from anon;
revoke all on function public.platform_admin_update_user_status(uuid, text, text) from anon;
revoke all on function public.platform_admin_create_note(uuid, uuid, uuid, text, text, text, text) from anon;
revoke all on function public.get_platform_health_report() from anon;

grant execute on function public.is_propflow_admin() to authenticated;
grant execute on function public.get_platform_admin_overview() to authenticated;
grant execute on function public.get_platform_workspaces() to authenticated;
grant execute on function public.get_platform_users() to authenticated;
grant execute on function public.get_platform_workspace_detail(uuid) to authenticated;
grant execute on function public.platform_admin_update_workspace_status(uuid, text, text) to authenticated;
grant execute on function public.platform_admin_update_user_status(uuid, text, text) to authenticated;
grant execute on function public.platform_admin_create_note(uuid, uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.get_platform_health_report() to authenticated;

grant select, insert on public.platform_admin_audit_logs to authenticated;
grant select, insert, update on public.platform_admin_notes to authenticated;
