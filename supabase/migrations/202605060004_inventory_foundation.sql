-- PropFlow Supplies / Inventory foundation.
-- Non-destructive and safe to re-run in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.supplies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  item_name text not null,
  category text,
  current_quantity numeric(12,2) not null default 0,
  low_stock_threshold numeric(12,2) not null default 0,
  unit text not null default 'unit',
  supplier_name text,
  supplier_contact text,
  estimated_unit_cost numeric(12,2),
  currency text not null default 'USD',
  status text not null default 'in_stock',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint supplies_status_check check (status in ('in_stock','low_stock','out_of_stock','archived')),
  constraint supplies_quantities_nonnegative_check check (current_quantity >= 0 and low_stock_threshold >= 0),
  constraint supplies_estimated_cost_nonnegative_check check (estimated_unit_cost is null or estimated_unit_cost >= 0)
);

alter table public.supplies add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.supplies add column if not exists property_id uuid references public.properties(id) on delete set null;
alter table public.supplies add column if not exists item_name text;
alter table public.supplies add column if not exists category text;
alter table public.supplies add column if not exists current_quantity numeric(12,2) not null default 0;
alter table public.supplies add column if not exists low_stock_threshold numeric(12,2) not null default 0;
alter table public.supplies add column if not exists unit text not null default 'unit';
alter table public.supplies add column if not exists supplier_name text;
alter table public.supplies add column if not exists supplier_contact text;
alter table public.supplies add column if not exists estimated_unit_cost numeric(12,2);
alter table public.supplies add column if not exists currency text not null default 'USD';
alter table public.supplies add column if not exists status text not null default 'in_stock';
alter table public.supplies add column if not exists notes text;
alter table public.supplies add column if not exists created_by uuid references public.profiles(id);
alter table public.supplies add column if not exists created_at timestamptz not null default now();
alter table public.supplies add column if not exists updated_at timestamptz not null default now();
alter table public.supplies add column if not exists archived_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'supplies_status_check' and conrelid = 'public.supplies'::regclass) then
    alter table public.supplies add constraint supplies_status_check check (status in ('in_stock','low_stock','out_of_stock','archived')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'supplies_quantities_nonnegative_check' and conrelid = 'public.supplies'::regclass) then
    alter table public.supplies add constraint supplies_quantities_nonnegative_check check (current_quantity >= 0 and low_stock_threshold >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'supplies_estimated_cost_nonnegative_check' and conrelid = 'public.supplies'::regclass) then
    alter table public.supplies add constraint supplies_estimated_cost_nonnegative_check check (estimated_unit_cost is null or estimated_unit_cost >= 0) not valid;
  end if;
end $$;

-- Keep item_name/workspace_id nullable repair conservative for partially-created tables;
-- new tables get NOT NULL from CREATE TABLE above.

drop trigger if exists supplies_updated_at on public.supplies;
create trigger supplies_updated_at before update on public.supplies for each row execute function public.set_updated_at();

create index if not exists supplies_workspace_idx on public.supplies (workspace_id);
create index if not exists supplies_workspace_property_idx on public.supplies (workspace_id, property_id);
create index if not exists supplies_workspace_status_idx on public.supplies (workspace_id, status);
create index if not exists supplies_workspace_category_idx on public.supplies (workspace_id, category);

alter table public.supplies enable row level security;

-- Workspace Owner, Property Manager, Host, and Accountant can view workspace supplies.
-- Cleaner and Maintenance access is limited to supplies tied to properties available
-- through the existing can_access_property/property_assignments logic. Workspace-level
-- supplies with no property_id are intentionally limited to operational/accounting roles.
drop policy if exists supplies_select_authorized on public.supplies;
create policy supplies_select_authorized on public.supplies
for select using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
  or (property_id is not null and public.can_access_property(workspace_id, property_id))
);

-- Workspace Owner, Property Manager, and Host can create supplies only in workspaces
-- where they hold one of those roles. RLS blocks cross-workspace inserts.
drop policy if exists supplies_insert_manager on public.supplies;
create policy supplies_insert_manager on public.supplies
for insert with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
);

-- Workspace Owner, Property Manager, and Host can update active supply fields.
-- This policy intentionally excludes archived rows and archived writes so Host users
-- cannot archive/restore through the broader update permission.
drop policy if exists supplies_update_manager on public.supplies;
create policy supplies_update_manager on public.supplies
for update using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and status <> 'archived'
  and archived_at is null
) with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and status <> 'archived'
  and archived_at is null
);

-- Archive/restore remains restricted to Workspace Owner and Property Manager.
drop policy if exists supplies_archive_owner_manager on public.supplies;
create policy supplies_archive_owner_manager on public.supplies
for update using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
) with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  and (status = 'archived' or archived_at is not null or (status <> 'archived' and archived_at is null))
);

grant all on public.supplies to authenticated, service_role;
