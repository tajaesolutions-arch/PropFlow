-- PropFlow plan limit enforcement.
-- Frontend plan limits are for UX only; these database/backend helpers are enforcement.
-- Keep this migration and src/lib/planLimits.js in sync until plan config is centralized.

create extension if not exists "pgcrypto";

create or replace function public.normalize_workspace_plan(plan text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lower(replace(coalesce(plan, ''), '-', '_')) = 'enterprise' then 'business'
    when lower(replace(coalesce(plan, ''), '-', '_')) in ('starter','pro','business') then lower(replace(coalesce(plan, ''), '-', '_'))
    else 'starter'
  end;
$$;

create or replace function public.workspace_subscription_status(target_workspace_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when lower(coalesce(ws.status, '')) in ('active','trialing') then lower(ws.status)
      when lower(coalesce(ws.status, '')) in ('past_due','pastdue','payment_failed')
        and ws.grace_period_ends_at is not null
        and ws.grace_period_ends_at > now() then 'grace_period'
      when lower(coalesce(ws.status, '')) = 'unpaid'
        and ws.grace_period_ends_at is not null
        and ws.grace_period_ends_at > now() then 'grace_period'
      when lower(coalesce(ws.status, '')) in ('past_due','pastdue','payment_failed') then 'past_due'
      when lower(coalesce(ws.status, '')) in ('grace','grace_period')
        and (ws.grace_period_ends_at is null or ws.grace_period_ends_at > now()) then 'grace_period'
      when lower(coalesce(ws.status, '')) in ('unpaid','restricted') then 'unpaid'
      when lower(coalesce(ws.status, '')) in ('canceled','cancelled') then 'canceled'
      when lower(coalesce(ws.status, '')) in ('incomplete','incomplete_expired','paused','suspended') then 'incomplete'
      when lower(coalesce(ws.status, '')) in ('not_configured','none','no_subscription') then 'no_subscription'
      else 'no_subscription'
    end
    from public.workspace_subscriptions ws
    where ws.workspace_id = target_workspace_id
    limit 1
  ), 'no_subscription');
$$;

create or replace function public.workspace_plan(target_workspace_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select public.normalize_workspace_plan((
    select ws.plan
    from public.workspace_subscriptions ws
    where ws.workspace_id = target_workspace_id
    limit 1
  ));
$$;

create or replace function public.workspace_is_billing_restricted(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(public.workspace_subscription_status(target_workspace_id), 'no_subscription') in ('unpaid','canceled','incomplete');
$$;

create or replace function public.workspace_plan_limit(target_workspace_id uuid, limit_key text)
returns integer
language sql
security definer
set search_path = public
as $$
  select case lower(replace(coalesce(limit_key, ''), '-', '_'))
    when 'max_properties' then bpl.max_properties
    when 'properties' then bpl.max_properties
    when 'max_team_members' then bpl.max_team_members
    when 'team_members' then bpl.max_team_members
    when 'max_owner_reports_per_month' then bpl.max_owner_reports_per_month
    when 'owner_reports' then bpl.max_owner_reports_per_month
    else null
  end
  from public.billing_plan_limits bpl
  where bpl.plan = public.workspace_plan(target_workspace_id);
$$;

create or replace function public.workspace_can_use_feature(target_workspace_id uuid, feature_key text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when public.workspace_is_billing_restricted(target_workspace_id) then false
      when lower(replace(coalesce(feature_key, ''), '-', '_')) in ('direct_booking_pages','direct_booking') then coalesce(bpl.includes_direct_booking, false)
      when lower(replace(coalesce(feature_key, ''), '-', '_')) = 'advanced_reports' then coalesce(bpl.includes_advanced_reports, false)
      when lower(replace(coalesce(feature_key, ''), '-', '_')) = 'ai_tools' then bpl.includes_ai_tools in ('true','coming_soon')
      when lower(replace(coalesce(feature_key, ''), '-', '_')) = 'priority_support' then coalesce(bpl.includes_priority_support, false)
      else false
    end
    from public.billing_plan_limits bpl
    where bpl.plan = public.workspace_plan(target_workspace_id)
  ), false);
$$;

create or replace function public.enforce_workspace_property_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  property_limit integer;
  active_property_count integer;
begin
  if public.workspace_is_billing_restricted(new.workspace_id) then
    raise exception 'Your workspace billing needs attention before adding premium records.' using errcode = 'P0001';
  end if;

  property_limit := public.workspace_plan_limit(new.workspace_id, 'max_properties');
  if property_limit is null then
    return new;
  end if;

  select count(*)::integer
    into active_property_count
  from public.properties p
  where p.workspace_id = new.workspace_id
    and coalesce(p.status, 'active') <> 'archived'
    and p.archived_at is null;

  if active_property_count >= property_limit then
    raise exception 'Your current plan has reached the property limit. Upgrade your plan to add more properties.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_workspace_property_plan_limit on public.properties;
create trigger enforce_workspace_property_plan_limit
before insert on public.properties
for each row execute function public.enforce_workspace_property_plan_limit();

create or replace function public.enforce_workspace_team_member_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  team_limit integer;
  active_member_count integer;
begin
  if new.roles && array['propflow_admin']::text[] then
    raise exception 'PropFlow Admin is platform-level only and cannot be assigned as a workspace role.' using errcode = '23514';
  end if;

  if public.workspace_is_billing_restricted(new.workspace_id) then
    raise exception 'Your workspace billing needs attention before adding premium records.' using errcode = 'P0001';
  end if;

  if coalesce(new.status, 'active') <> 'active' then
    return new;
  end if;

  team_limit := public.workspace_plan_limit(new.workspace_id, 'max_team_members');
  if team_limit is null then
    return new;
  end if;

  select count(*)::integer
    into active_member_count
  from public.workspace_members wm
  where wm.workspace_id = new.workspace_id
    and wm.status = 'active';

  if active_member_count >= team_limit then
    raise exception 'Your current plan has reached the team member limit. Upgrade your plan to invite more team members.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_workspace_team_member_plan_limit on public.workspace_members;
create trigger enforce_workspace_team_member_plan_limit
before insert on public.workspace_members
for each row execute function public.enforce_workspace_team_member_plan_limit();

create or replace function public.enforce_workspace_invite_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  team_limit integer;
  active_member_count integer;
  pending_invite_count integer;
begin
  if new.roles && array['propflow_admin']::text[] then
    raise exception 'PropFlow Admin is platform-level only and cannot be assigned as a workspace role.' using errcode = '23514';
  end if;

  if public.workspace_is_billing_restricted(new.workspace_id) then
    raise exception 'Your workspace billing needs attention before adding premium records.' using errcode = 'P0001';
  end if;

  if coalesce(new.status, 'pending') <> 'pending' then
    return new;
  end if;

  team_limit := public.workspace_plan_limit(new.workspace_id, 'max_team_members');
  if team_limit is null then
    return new;
  end if;

  select count(*)::integer
    into active_member_count
  from public.workspace_members wm
  where wm.workspace_id = new.workspace_id
    and wm.status = 'active';

  select count(*)::integer
    into pending_invite_count
  from public.workspace_invites wi
  where wi.workspace_id = new.workspace_id
    and wi.status = 'pending'
    and (wi.expires_at is null or wi.expires_at > now());

  if active_member_count + pending_invite_count >= team_limit then
    raise exception 'Your current plan has reached the team member limit. Upgrade your plan to invite more team members.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_workspace_invite_plan_limit on public.workspace_invites;
create trigger enforce_workspace_invite_plan_limit
before insert on public.workspace_invites
for each row execute function public.enforce_workspace_invite_plan_limit();

create or replace function public.enforce_owner_report_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_limit integer;
  monthly_report_count integer;
  month_start timestamptz;
  next_month_start timestamptz;
begin
  if public.workspace_is_billing_restricted(new.workspace_id) then
    raise exception 'Your workspace billing needs attention before adding premium records.' using errcode = 'P0001';
  end if;

  report_limit := public.workspace_plan_limit(new.workspace_id, 'max_owner_reports_per_month');
  if report_limit is null then
    return new;
  end if;

  month_start := date_trunc('month', now());
  next_month_start := month_start + interval '1 month';

  select count(*)::integer
    into monthly_report_count
  from public.owner_reports reports
  where reports.workspace_id = new.workspace_id
    and reports.created_at >= month_start
    and reports.created_at < next_month_start;

  if monthly_report_count >= report_limit then
    raise exception 'Your current plan has reached the owner report limit for this month. Upgrade your plan or wait until next month.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_owner_report_plan_limit on public.owner_reports;
create trigger enforce_owner_report_plan_limit
before insert on public.owner_reports
for each row execute function public.enforce_owner_report_plan_limit();

create or replace function public.enforce_direct_booking_plan_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activating boolean;
begin
  if tg_op = 'INSERT' then
    activating := true;
  else
    activating := (
      coalesce(old.status, 'draft') in ('archived','paused')
      and coalesce(new.status, 'draft') in ('draft','published')
      and new.archived_at is null
    ) or (
      coalesce(old.status, 'draft') <> 'published'
      and coalesce(new.status, 'draft') = 'published'
    );
  end if;

  if not activating then
    return new;
  end if;

  if public.workspace_is_billing_restricted(new.workspace_id) then
    raise exception 'Your workspace billing needs attention before adding premium records.' using errcode = 'P0001';
  end if;

  if not public.workspace_can_use_feature(new.workspace_id, 'direct_booking_pages') then
    raise exception 'Direct booking pages are not available on this plan.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_direct_booking_plan_access_insert on public.direct_booking_pages;
create trigger enforce_direct_booking_plan_access_insert
before insert on public.direct_booking_pages
for each row execute function public.enforce_direct_booking_plan_access();

drop trigger if exists enforce_direct_booking_plan_access_update on public.direct_booking_pages;
create trigger enforce_direct_booking_plan_access_update
before update of status, archived_at on public.direct_booking_pages
for each row execute function public.enforce_direct_booking_plan_access();

grant execute on function public.normalize_workspace_plan(text) to authenticated, service_role;
grant execute on function public.workspace_subscription_status(uuid) to authenticated, service_role;
grant execute on function public.workspace_plan(uuid) to authenticated, service_role;
grant execute on function public.workspace_is_billing_restricted(uuid) to authenticated, service_role;
grant execute on function public.workspace_plan_limit(uuid, text) to authenticated, service_role;
grant execute on function public.workspace_can_use_feature(uuid, text) to authenticated, service_role;
