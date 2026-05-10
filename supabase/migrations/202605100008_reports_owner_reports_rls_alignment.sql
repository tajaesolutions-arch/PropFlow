-- Reports / Owner Reports Supabase alignment.
-- Creates workspace-scoped owner report metadata records without enabling PDF/CSV generation.
-- RLS keeps draft/internal reports hidden from Property Owner users and denies Cleaner/Maintenance access.

create extension if not exists "pgcrypto";

create table if not exists public.owner_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null default 'Owner report',
  report_type text not null default 'owner_statement' check (
    report_type in (
      'owner_statement',
      'revenue_report',
      'expense_report',
      'occupancy_report',
      'maintenance_cost_report',
      'cleaning_cost_report',
      'property_performance',
      'booking_summary'
    )
  ),
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (
    status in ('draft','released','published','sent','delivered','completed','archived')
  ),
  summary text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.owner_reports add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.owner_reports add column if not exists property_id uuid references public.properties(id) on delete cascade;
alter table public.owner_reports add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.owner_reports add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.owner_reports add column if not exists title text not null default 'Owner report';
alter table public.owner_reports add column if not exists report_type text not null default 'owner_statement';
alter table public.owner_reports add column if not exists start_date date;
alter table public.owner_reports add column if not exists end_date date;
alter table public.owner_reports add column if not exists status text not null default 'draft';
alter table public.owner_reports add column if not exists summary text;
alter table public.owner_reports add column if not exists notes text;
alter table public.owner_reports add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.owner_reports add column if not exists created_at timestamptz not null default now();
alter table public.owner_reports add column if not exists updated_at timestamptz not null default now();

update public.owner_reports
set report_type = case report_type
  when 'owner_report' then 'owner_statement'
  when 'revenue' then 'revenue_report'
  when 'expenses' then 'expense_report'
  when 'expense' then 'expense_report'
  when 'maintenance_report' then 'maintenance_cost_report'
  when 'cleaning_report' then 'cleaning_cost_report'
  else report_type
end
where report_type in ('owner_report','revenue','expenses','expense','maintenance_report','cleaning_report');

update public.owner_reports
set report_type = 'owner_statement'
where report_type is null
   or report_type not in ('owner_statement','revenue_report','expense_report','occupancy_report','maintenance_cost_report','cleaning_cost_report','property_performance','booking_summary');

update public.owner_reports
set status = 'released'
where status = 'ready';

update public.owner_reports
set status = 'draft'
where status is null
   or status not in ('draft','released','published','sent','delivered','completed','archived');

alter table public.owner_reports drop constraint if exists owner_reports_report_type_check;
alter table public.owner_reports add constraint owner_reports_report_type_check
  check (report_type in ('owner_statement','revenue_report','expense_report','occupancy_report','maintenance_cost_report','cleaning_cost_report','property_performance','booking_summary'));

alter table public.owner_reports drop constraint if exists owner_reports_status_check;
alter table public.owner_reports add constraint owner_reports_status_check
  check (status in ('draft','released','published','sent','delivered','completed','archived'));

alter table public.owner_reports drop constraint if exists owner_reports_date_range_check;
alter table public.owner_reports add constraint owner_reports_date_range_check
  check (start_date is null or end_date is null or end_date >= start_date);

create index if not exists owner_reports_workspace_created_idx
  on public.owner_reports (workspace_id, created_at desc);

create index if not exists owner_reports_workspace_property_idx
  on public.owner_reports (workspace_id, property_id, status);

create index if not exists owner_reports_workspace_owner_idx
  on public.owner_reports (workspace_id, owner_id, status);

create index if not exists owner_reports_workspace_contact_idx
  on public.owner_reports (workspace_id, contact_id, status);

drop trigger if exists owner_reports_updated_at on public.owner_reports;
create trigger owner_reports_updated_at
before update on public.owner_reports
for each row
execute function public.set_updated_at();

create or replace function public.optional_owner_report_owner_is_workspace_member(
  target_workspace_id uuid,
  target_owner_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_owner_id is null
    or exists (
      select 1
      from public.workspace_members wm
      join public.profiles p on p.id = wm.user_id
      join public.workspaces w on w.id = wm.workspace_id
      where wm.workspace_id = target_workspace_id
        and wm.user_id = target_owner_id
        and wm.status = 'active'
        and p.status = 'active'
        and w.status = 'active'
        and wm.roles @> array['property_owner']::text[]
        and not wm.roles && array['propflow_admin']::text[]
    );
$$;

create or replace function public.optional_owner_report_contact_is_workspace_owner(
  target_workspace_id uuid,
  target_contact_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_contact_id is null
    or exists (
      select 1
      from public.contacts c
      where c.id = target_contact_id
        and c.workspace_id = target_workspace_id
        and c.contact_type = 'owner'
    );
$$;

create or replace function public.owner_report_context_is_scoped(
  target_workspace_id uuid,
  target_property_id uuid,
  target_owner_id uuid,
  target_contact_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select (target_property_id is null or public.property_belongs_to_workspace(target_workspace_id, target_property_id))
    and public.optional_owner_report_owner_is_workspace_member(target_workspace_id, target_owner_id)
    and public.optional_owner_report_contact_is_workspace_owner(target_workspace_id, target_contact_id);
$$;

grant execute on function public.optional_owner_report_owner_is_workspace_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.optional_owner_report_contact_is_workspace_owner(uuid, uuid) to authenticated, service_role;
grant execute on function public.owner_report_context_is_scoped(uuid, uuid, uuid, uuid) to authenticated, service_role;

alter table public.owner_reports enable row level security;

drop policy if exists owner_reports_select_authorized on public.owner_reports;
create policy owner_reports_select_authorized
on public.owner_reports
for select
to authenticated
using (
  public.owner_report_context_is_scoped(workspace_id, property_id, owner_id, contact_id)
  and (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
    or (
      status in ('released','published','sent','delivered','completed')
      and (
        owner_id = auth.uid()
        or (
          property_id is not null
          and exists (
            select 1
            from public.properties p
            where p.id = property_id
              and p.workspace_id = workspace_id
              and p.assigned_owner_id = auth.uid()
          )
        )
        or (
          property_id is not null
          and exists (
            select 1
            from public.property_assignments pa
            where pa.workspace_id = workspace_id
              and pa.property_id = property_id
              and pa.user_id = auth.uid()
          )
        )
      )
    )
  )
);

drop policy if exists owner_reports_insert_authorized on public.owner_reports;
create policy owner_reports_insert_authorized
on public.owner_reports
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
  and public.owner_report_context_is_scoped(workspace_id, property_id, owner_id, contact_id)
);

drop policy if exists owner_reports_update_authorized on public.owner_reports;
create policy owner_reports_update_authorized
on public.owner_reports
for update
to authenticated
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
)
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  and public.owner_report_context_is_scoped(workspace_id, property_id, owner_id, contact_id)
);

drop policy if exists owner_reports_delete_authorized on public.owner_reports;
create policy owner_reports_delete_authorized
on public.owner_reports
for delete
to authenticated
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
);
