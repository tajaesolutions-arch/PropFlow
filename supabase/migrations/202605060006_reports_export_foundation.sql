-- PropFlow reports and export foundation.
-- Adds report request/export tracking without generating files in the database.
-- Uses file_path text instead of file_uploads FK because some live projects do not have file_uploads installed yet.
-- PDF/CSV generation should be implemented later through secure backend jobs.

create extension if not exists "pgcrypto";

create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  report_type text not null check (
    report_type in (
      'owner_statement',
      'revenue',
      'expenses',
      'occupancy',
      'maintenance_cost',
      'cleaning_cost',
      'property_performance',
      'booking_summary'
    )
  ),
  format text not null check (format in ('pdf','csv')),
  status text not null default 'pending' check (
    status in ('pending','processing','completed','failed','cancelled')
  ),
  filters jsonb not null default '{}'::jsonb,
  file_path text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.report_exports add column if not exists file_path text;

create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete cascade,
  report_type text not null default 'owner_statement' check (
    report_type in (
      'owner_statement',
      'revenue',
      'expenses',
      'occupancy',
      'maintenance_cost',
      'cleaning_cost',
      'property_performance',
      'booking_summary'
    )
  ),
  frequency text not null default 'monthly' check (
    frequency in ('weekly','monthly','quarterly')
  ),
  format text not null default 'pdf' check (format in ('pdf','csv')),
  is_enabled boolean not null default false,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_exports_workspace_created_idx
  on public.report_exports (workspace_id, created_at desc);

create index if not exists report_exports_workspace_status_idx
  on public.report_exports (workspace_id, status);

create index if not exists report_schedules_workspace_idx
  on public.report_schedules (workspace_id, is_enabled, next_run_at);

drop trigger if exists report_schedules_updated_at on public.report_schedules;

create trigger report_schedules_updated_at
before update on public.report_schedules
for each row
execute function public.set_updated_at();

alter table public.report_exports enable row level security;
alter table public.report_schedules enable row level security;

drop policy if exists "report_exports_select_authorized" on public.report_exports;
create policy "report_exports_select_authorized"
on public.report_exports
for select
to authenticated
using (
  public.has_workspace_role(
    workspace_id,
    array['workspace_owner','property_manager','host','accountant']
  )
);

drop policy if exists "report_exports_insert_authorized" on public.report_exports;
create policy "report_exports_insert_authorized"
on public.report_exports
for insert
to authenticated
with check (
  public.has_workspace_role(
    workspace_id,
    array['workspace_owner','property_manager','host','accountant']
  )
);

drop policy if exists "report_exports_update_authorized" on public.report_exports;
create policy "report_exports_update_authorized"
on public.report_exports
for update
to authenticated
using (
  public.has_workspace_role(
    workspace_id,
    array['workspace_owner','property_manager']
  )
)
with check (
  public.has_workspace_role(
    workspace_id,
    array['workspace_owner','property_manager']
  )
);

drop policy if exists "report_schedules_select_authorized" on public.report_schedules;
create policy "report_schedules_select_authorized"
on public.report_schedules
for select
to authenticated
using (
  public.has_workspace_role(
    workspace_id,
    array['workspace_owner','property_manager','accountant']
  )
);

drop policy if exists "report_schedules_manage_authorized" on public.report_schedules;
create policy "report_schedules_manage_authorized"
on public.report_schedules
for all
to authenticated
using (
  public.has_workspace_role(
    workspace_id,
    array['workspace_owner','property_manager']
  )
)
with check (
  public.has_workspace_role(
    workspace_id,
    array['workspace_owner','property_manager']
  )
);
