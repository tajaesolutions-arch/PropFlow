-- iCal / Calendar Import foundation.
-- Non-destructive workspace/property-scoped import tables, RLS, conflict logs,
-- and public direct-booking unavailable range alignment. This migration does not
-- add channel-manager APIs, two-way sync, payment automation, or guest checkout.

create extension if not exists "pgcrypto";


-- Extend notification validation for calendar import manager alerts.
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
    'leases',
    'calendar_imports',
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
    'billing_trial_ending',
    'billing_grace_period_started',
    'billing_grace_period_warning',
    'billing_access_restricted',
    'billing_access_restored',
    'billing_provider_not_configured',
    'lease_created',
    'lease_expiring_soon',
    'lease_archived',
    'lease_document_linked',
    'ical_sync_failed',
    'ical_sync_conflicts_found',
    'ical_feed_paused',
    'ical_feed_archived',
    'ical_import_converted_to_booking',
    'workspace_activity'
  );
$$;

create table if not exists public.calendar_import_feeds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  provider_type text not null default 'manual_ical',
  name text not null,
  feed_url text not null,
  status text not null default 'active',
  timezone text,
  import_as text not null default 'booking_block',
  auto_create_bookings boolean not null default false,
  auto_create_cleaning_tasks boolean not null default false,
  last_sync_status text,
  last_sync_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error text,
  created_by uuid references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_import_feeds add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.calendar_import_feeds add column if not exists property_id uuid references public.properties(id) on delete cascade;
alter table public.calendar_import_feeds add column if not exists provider_type text not null default 'manual_ical';
alter table public.calendar_import_feeds add column if not exists name text;
alter table public.calendar_import_feeds add column if not exists feed_url text;
alter table public.calendar_import_feeds add column if not exists status text not null default 'active';
alter table public.calendar_import_feeds add column if not exists timezone text;
alter table public.calendar_import_feeds add column if not exists import_as text not null default 'booking_block';
alter table public.calendar_import_feeds add column if not exists auto_create_bookings boolean not null default false;
alter table public.calendar_import_feeds add column if not exists auto_create_cleaning_tasks boolean not null default false;
alter table public.calendar_import_feeds add column if not exists last_sync_status text;
alter table public.calendar_import_feeds add column if not exists last_sync_at timestamptz;
alter table public.calendar_import_feeds add column if not exists last_successful_sync_at timestamptz;
alter table public.calendar_import_feeds add column if not exists last_error text;
alter table public.calendar_import_feeds add column if not exists created_by uuid references public.profiles(id);
alter table public.calendar_import_feeds add column if not exists archived_at timestamptz;
alter table public.calendar_import_feeds add column if not exists created_at timestamptz not null default now();
alter table public.calendar_import_feeds add column if not exists updated_at timestamptz not null default now();

create table if not exists public.calendar_import_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  feed_id uuid references public.calendar_import_feeds(id) on delete cascade,
  external_uid text not null,
  external_sequence text,
  external_etag text,
  event_type text not null default 'booking_block',
  status text not null default 'imported',
  title text,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default true,
  source_platform text,
  imported_booking_id uuid references public.bookings(id) on delete set null,
  raw_event jsonb not null default '{}'::jsonb,
  conflict_summary text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_import_events add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.calendar_import_events add column if not exists property_id uuid references public.properties(id) on delete cascade;
alter table public.calendar_import_events add column if not exists feed_id uuid references public.calendar_import_feeds(id) on delete cascade;
alter table public.calendar_import_events add column if not exists external_uid text;
alter table public.calendar_import_events add column if not exists external_sequence text;
alter table public.calendar_import_events add column if not exists external_etag text;
alter table public.calendar_import_events add column if not exists event_type text not null default 'booking_block';
alter table public.calendar_import_events add column if not exists status text not null default 'imported';
alter table public.calendar_import_events add column if not exists title text;
alter table public.calendar_import_events add column if not exists description text;
alter table public.calendar_import_events add column if not exists location text;
alter table public.calendar_import_events add column if not exists starts_at timestamptz;
alter table public.calendar_import_events add column if not exists ends_at timestamptz;
alter table public.calendar_import_events add column if not exists all_day boolean not null default true;
alter table public.calendar_import_events add column if not exists source_platform text;
alter table public.calendar_import_events add column if not exists imported_booking_id uuid references public.bookings(id) on delete set null;
alter table public.calendar_import_events add column if not exists raw_event jsonb not null default '{}'::jsonb;
alter table public.calendar_import_events add column if not exists conflict_summary text;
alter table public.calendar_import_events add column if not exists archived_at timestamptz;
alter table public.calendar_import_events add column if not exists created_at timestamptz not null default now();
alter table public.calendar_import_events add column if not exists updated_at timestamptz not null default now();

create table if not exists public.calendar_import_sync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  feed_id uuid references public.calendar_import_feeds(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  events_found integer not null default 0,
  events_created integer not null default 0,
  events_updated integer not null default 0,
  events_ignored integer not null default 0,
  conflicts_found integer not null default 0,
  error_message text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.calendar_import_sync_runs add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.calendar_import_sync_runs add column if not exists feed_id uuid references public.calendar_import_feeds(id) on delete cascade;
alter table public.calendar_import_sync_runs add column if not exists property_id uuid references public.properties(id) on delete set null;
alter table public.calendar_import_sync_runs add column if not exists status text not null default 'pending';
alter table public.calendar_import_sync_runs add column if not exists started_at timestamptz;
alter table public.calendar_import_sync_runs add column if not exists completed_at timestamptz;
alter table public.calendar_import_sync_runs add column if not exists events_found integer not null default 0;
alter table public.calendar_import_sync_runs add column if not exists events_created integer not null default 0;
alter table public.calendar_import_sync_runs add column if not exists events_updated integer not null default 0;
alter table public.calendar_import_sync_runs add column if not exists events_ignored integer not null default 0;
alter table public.calendar_import_sync_runs add column if not exists conflicts_found integer not null default 0;
alter table public.calendar_import_sync_runs add column if not exists error_message text;
alter table public.calendar_import_sync_runs add column if not exists created_by uuid references public.profiles(id);
alter table public.calendar_import_sync_runs add column if not exists created_at timestamptz not null default now();

create table if not exists public.calendar_import_conflicts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  feed_id uuid references public.calendar_import_feeds(id) on delete cascade,
  imported_event_id uuid references public.calendar_import_events(id) on delete cascade,
  conflict_type text not null,
  severity text not null default 'warning',
  message text not null,
  related_booking_id uuid references public.bookings(id) on delete set null,
  related_lease_id uuid references public.leases(id) on delete set null,
  status text not null default 'open',
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.calendar_import_conflicts add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.calendar_import_conflicts add column if not exists property_id uuid references public.properties(id) on delete cascade;
alter table public.calendar_import_conflicts add column if not exists feed_id uuid references public.calendar_import_feeds(id) on delete cascade;
alter table public.calendar_import_conflicts add column if not exists imported_event_id uuid references public.calendar_import_events(id) on delete cascade;
alter table public.calendar_import_conflicts add column if not exists conflict_type text;
alter table public.calendar_import_conflicts add column if not exists severity text not null default 'warning';
alter table public.calendar_import_conflicts add column if not exists message text;
alter table public.calendar_import_conflicts add column if not exists related_booking_id uuid references public.bookings(id) on delete set null;
alter table public.calendar_import_conflicts add column if not exists related_lease_id uuid references public.leases(id) on delete set null;
alter table public.calendar_import_conflicts add column if not exists status text not null default 'open';
alter table public.calendar_import_conflicts add column if not exists resolved_by uuid references public.profiles(id);
alter table public.calendar_import_conflicts add column if not exists resolved_at timestamptz;
alter table public.calendar_import_conflicts add column if not exists created_at timestamptz not null default now();

-- Canonical constraints. Existing data is not dropped; invalid legacy rows are left unvalidated for operators to clean safely.
alter table public.calendar_import_feeds drop constraint if exists calendar_import_feeds_provider_type_check;
alter table public.calendar_import_feeds drop constraint if exists calendar_import_feeds_status_check;
alter table public.calendar_import_feeds drop constraint if exists calendar_import_feeds_import_as_check;
alter table public.calendar_import_feeds drop constraint if exists calendar_import_feeds_last_sync_status_check;
alter table public.calendar_import_feeds drop constraint if exists calendar_import_feeds_feed_url_protocol_check;
alter table public.calendar_import_feeds add constraint calendar_import_feeds_provider_type_check check (provider_type in ('airbnb_ical','vrbo_ical','booking_com_ical','google_calendar_ical','outlook_ical','manual_ical','other_ical')) not valid;
alter table public.calendar_import_feeds add constraint calendar_import_feeds_status_check check (status in ('active','paused','error','archived')) not valid;
alter table public.calendar_import_feeds add constraint calendar_import_feeds_import_as_check check (import_as in ('booking_block','unavailable_block','owner_block','maintenance_block','unknown')) not valid;
alter table public.calendar_import_feeds add constraint calendar_import_feeds_last_sync_status_check check (last_sync_status is null or last_sync_status in ('pending','running','success','partial_success','failed','skipped','provider_not_configured')) not valid;
alter table public.calendar_import_feeds add constraint calendar_import_feeds_feed_url_protocol_check check (feed_url ~* '^https?://') not valid;

do $$
begin
  alter table public.calendar_import_feeds add constraint calendar_import_feeds_workspace_property_feed_url_key unique (workspace_id, property_id, feed_url);
exception when duplicate_object then null;
end $$;

alter table public.calendar_import_events drop constraint if exists calendar_import_events_dates_check;
alter table public.calendar_import_events drop constraint if exists calendar_import_events_event_type_check;
alter table public.calendar_import_events drop constraint if exists calendar_import_events_status_check;
alter table public.calendar_import_events add constraint calendar_import_events_dates_check check (starts_at < ends_at) not valid;
alter table public.calendar_import_events add constraint calendar_import_events_event_type_check check (event_type in ('booking_block','unavailable_block','owner_block','maintenance_block','unknown')) not valid;
alter table public.calendar_import_events add constraint calendar_import_events_status_check check (status in ('imported','changed','cancelled','ignored','conflict','archived')) not valid;

do $$
begin
  alter table public.calendar_import_events add constraint calendar_import_events_workspace_feed_external_uid_key unique (workspace_id, feed_id, external_uid);
exception when duplicate_object then null;
end $$;

alter table public.calendar_import_sync_runs drop constraint if exists calendar_import_sync_runs_status_check;
alter table public.calendar_import_sync_runs add constraint calendar_import_sync_runs_status_check check (status in ('pending','running','success','partial_success','failed','skipped','provider_not_configured')) not valid;

alter table public.calendar_import_conflicts drop constraint if exists calendar_import_conflicts_type_check;
alter table public.calendar_import_conflicts drop constraint if exists calendar_import_conflicts_severity_check;
alter table public.calendar_import_conflicts drop constraint if exists calendar_import_conflicts_status_check;
alter table public.calendar_import_conflicts add constraint calendar_import_conflicts_type_check check (conflict_type in ('overlaps_internal_booking','overlaps_direct_booking','overlaps_lease','invalid_dates','duplicate_external_uid','missing_property','unsupported_event')) not valid;
alter table public.calendar_import_conflicts add constraint calendar_import_conflicts_severity_check check (severity in ('info','warning','error')) not valid;
alter table public.calendar_import_conflicts add constraint calendar_import_conflicts_status_check check (status in ('open','acknowledged','resolved','ignored')) not valid;

create index if not exists calendar_import_feeds_workspace_id_idx on public.calendar_import_feeds (workspace_id);
create index if not exists calendar_import_feeds_property_id_idx on public.calendar_import_feeds (property_id);
create index if not exists calendar_import_feeds_provider_type_idx on public.calendar_import_feeds (provider_type);
create index if not exists calendar_import_feeds_status_idx on public.calendar_import_feeds (status);
create index if not exists calendar_import_feeds_last_sync_at_idx on public.calendar_import_feeds (last_sync_at);
create index if not exists calendar_import_feeds_created_at_idx on public.calendar_import_feeds (created_at);

create index if not exists calendar_import_events_workspace_id_idx on public.calendar_import_events (workspace_id);
create index if not exists calendar_import_events_property_id_idx on public.calendar_import_events (property_id);
create index if not exists calendar_import_events_feed_id_idx on public.calendar_import_events (feed_id);
create index if not exists calendar_import_events_status_idx on public.calendar_import_events (status);
create index if not exists calendar_import_events_starts_at_idx on public.calendar_import_events (starts_at);
create index if not exists calendar_import_events_ends_at_idx on public.calendar_import_events (ends_at);
create index if not exists calendar_import_events_external_uid_idx on public.calendar_import_events (external_uid);
create index if not exists calendar_import_events_created_at_idx on public.calendar_import_events (created_at);

create index if not exists calendar_import_sync_runs_workspace_id_idx on public.calendar_import_sync_runs (workspace_id);
create index if not exists calendar_import_sync_runs_property_id_idx on public.calendar_import_sync_runs (property_id);
create index if not exists calendar_import_sync_runs_feed_id_idx on public.calendar_import_sync_runs (feed_id);
create index if not exists calendar_import_sync_runs_status_idx on public.calendar_import_sync_runs (status);
create index if not exists calendar_import_sync_runs_created_at_idx on public.calendar_import_sync_runs (created_at);

create index if not exists calendar_import_conflicts_workspace_id_idx on public.calendar_import_conflicts (workspace_id);
create index if not exists calendar_import_conflicts_property_id_idx on public.calendar_import_conflicts (property_id);
create index if not exists calendar_import_conflicts_feed_id_idx on public.calendar_import_conflicts (feed_id);
create index if not exists calendar_import_conflicts_imported_event_id_idx on public.calendar_import_conflicts (imported_event_id);
create index if not exists calendar_import_conflicts_status_idx on public.calendar_import_conflicts (status);
create index if not exists calendar_import_conflicts_created_at_idx on public.calendar_import_conflicts (created_at);

drop trigger if exists calendar_import_feeds_updated_at on public.calendar_import_feeds;
create trigger calendar_import_feeds_updated_at before update on public.calendar_import_feeds for each row execute function public.set_updated_at();

drop trigger if exists calendar_import_events_updated_at on public.calendar_import_events;
create trigger calendar_import_events_updated_at before update on public.calendar_import_events for each row execute function public.set_updated_at();

create or replace function public.can_manage_calendar_imports(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host']);
$$;

create or replace function public.can_view_calendar_imports(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host']);
$$;

create or replace function public.calendar_import_property_is_scoped(target_workspace_id uuid, target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.property_belongs_to_workspace(target_workspace_id, target_property_id);
$$;

create or replace function public.calendar_import_feed_is_scoped(target_workspace_id uuid, target_property_id uuid, target_feed_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_feed_id is null
    or exists (
      select 1 from public.calendar_import_feeds feed
      where feed.id = target_feed_id
        and feed.workspace_id = target_workspace_id
        and feed.property_id = target_property_id
    );
$$;

create or replace function public.can_resolve_calendar_import_conflict(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_calendar_imports(target_workspace_id);
$$;

grant execute on function public.can_manage_calendar_imports(uuid) to authenticated, service_role;
grant execute on function public.can_view_calendar_imports(uuid) to authenticated, service_role;
grant execute on function public.calendar_import_property_is_scoped(uuid,uuid) to authenticated, service_role;
grant execute on function public.calendar_import_feed_is_scoped(uuid,uuid,uuid) to authenticated, service_role;
grant execute on function public.can_resolve_calendar_import_conflict(uuid) to authenticated, service_role;

alter table public.calendar_import_feeds enable row level security;
alter table public.calendar_import_events enable row level security;
alter table public.calendar_import_sync_runs enable row level security;
alter table public.calendar_import_conflicts enable row level security;

drop policy if exists calendar_import_feeds_select_manager on public.calendar_import_feeds;
create policy calendar_import_feeds_select_manager
on public.calendar_import_feeds
for select
to authenticated
using (
  public.can_view_calendar_imports(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
  and archived_at is null
);

drop policy if exists calendar_import_feeds_insert_manager on public.calendar_import_feeds;
create policy calendar_import_feeds_insert_manager
on public.calendar_import_feeds
for insert
to authenticated
with check (
  public.can_manage_calendar_imports(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
  and created_by = auth.uid()
  and archived_at is null
);

drop policy if exists calendar_import_feeds_update_manager on public.calendar_import_feeds;
create policy calendar_import_feeds_update_manager
on public.calendar_import_feeds
for update
to authenticated
using (
  public.can_manage_calendar_imports(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
)
with check (
  public.can_manage_calendar_imports(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
);

drop policy if exists calendar_import_events_select_manager on public.calendar_import_events;
create policy calendar_import_events_select_manager
on public.calendar_import_events
for select
to authenticated
using (
  public.can_view_calendar_imports(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
  and archived_at is null
);

drop policy if exists calendar_import_events_insert_manager on public.calendar_import_events;
create policy calendar_import_events_insert_manager
on public.calendar_import_events
for insert
to authenticated
with check (
  public.can_manage_calendar_imports(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
  and public.calendar_import_feed_is_scoped(workspace_id, property_id, feed_id)
);

drop policy if exists calendar_import_events_update_manager on public.calendar_import_events;
create policy calendar_import_events_update_manager
on public.calendar_import_events
for update
to authenticated
using (
  public.can_manage_calendar_imports(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
)
with check (
  public.can_manage_calendar_imports(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
  and public.calendar_import_feed_is_scoped(workspace_id, property_id, feed_id)
);

drop policy if exists calendar_import_sync_runs_select_manager on public.calendar_import_sync_runs;
create policy calendar_import_sync_runs_select_manager
on public.calendar_import_sync_runs
for select
to authenticated
using (public.can_view_calendar_imports(workspace_id));

drop policy if exists calendar_import_sync_runs_insert_manager on public.calendar_import_sync_runs;
create policy calendar_import_sync_runs_insert_manager
on public.calendar_import_sync_runs
for insert
to authenticated
with check (
  public.can_manage_calendar_imports(workspace_id)
  and created_by = auth.uid()
  and (property_id is null or public.calendar_import_property_is_scoped(workspace_id, property_id))
);

drop policy if exists calendar_import_sync_runs_update_manager on public.calendar_import_sync_runs;
create policy calendar_import_sync_runs_update_manager
on public.calendar_import_sync_runs
for update
to authenticated
using (public.can_manage_calendar_imports(workspace_id))
with check (
  public.can_manage_calendar_imports(workspace_id)
  and (property_id is null or public.calendar_import_property_is_scoped(workspace_id, property_id))
);

drop policy if exists calendar_import_conflicts_select_manager on public.calendar_import_conflicts;
create policy calendar_import_conflicts_select_manager
on public.calendar_import_conflicts
for select
to authenticated
using (
  public.can_view_calendar_imports(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
);

drop policy if exists calendar_import_conflicts_insert_manager on public.calendar_import_conflicts;
create policy calendar_import_conflicts_insert_manager
on public.calendar_import_conflicts
for insert
to authenticated
with check (
  public.can_manage_calendar_imports(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
  and public.calendar_import_feed_is_scoped(workspace_id, property_id, feed_id)
);

drop policy if exists calendar_import_conflicts_update_manager on public.calendar_import_conflicts;
create policy calendar_import_conflicts_update_manager
on public.calendar_import_conflicts
for update
to authenticated
using (
  public.can_resolve_calendar_import_conflict(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
)
with check (
  public.can_resolve_calendar_import_conflict(workspace_id)
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
  and (resolved_by is null or resolved_by = auth.uid())
);

-- Public direct-booking availability includes imported iCal blocks but exposes only dates.
create or replace function public.get_public_direct_booking_unavailable_ranges(target_slug text)
returns table (check_in date, check_out date)
language sql
security definer
set search_path = public
as $$
  select booking.check_in, booking.check_out
  from public.direct_booking_pages page
  join public.bookings booking on booking.property_id = page.property_id and booking.workspace_id = page.workspace_id
  where page.slug = lower(trim(target_slug))
    and page.status = 'published'
    and page.archived_at is null
    and booking.status not in ('cancelled')
    and booking.check_out >= current_date
  union
  select import.starts_at::date as check_in, import.ends_at::date as check_out
  from public.direct_booking_pages page
  join public.calendar_import_events import on import.property_id = page.property_id and import.workspace_id = page.workspace_id
  where page.slug = lower(trim(target_slug))
    and page.status = 'published'
    and page.archived_at is null
    and import.archived_at is null
    and import.status not in ('cancelled','ignored','archived')
    and import.event_type in ('booking_block','unavailable_block','owner_block','maintenance_block','unknown')
    and import.ends_at::date >= current_date
  order by check_in asc;
$$;

grant execute on function public.get_public_direct_booking_unavailable_ranges(text) to anon, authenticated;
