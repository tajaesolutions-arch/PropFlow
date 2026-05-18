-- PropFlow Supplies / Inventory RLS and schema alignment.
-- Non-destructive: keeps existing records, avoids broad public policies, and
-- aligns real supply records with workspace/property scoped frontend actions.

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
  archived_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplies_status_check check (status in ('in_stock','low_stock','out_of_stock','archived')),
  constraint supplies_quantities_nonnegative_check check (current_quantity >= 0 and low_stock_threshold >= 0),
  constraint supplies_estimated_cost_nonnegative_check check (estimated_unit_cost is null or estimated_unit_cost >= 0),
  constraint supplies_currency_check check (currency in ('USD','JMD','CAD','GBP','EUR'))
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
alter table public.supplies add column if not exists archived_at timestamptz;
alter table public.supplies add column if not exists created_by uuid references public.profiles(id);
alter table public.supplies add column if not exists created_at timestamptz not null default now();
alter table public.supplies add column if not exists updated_at timestamptz not null default now();

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

  if not exists (select 1 from pg_constraint where conname = 'supplies_currency_check' and conrelid = 'public.supplies'::regclass) then
    alter table public.supplies add constraint supplies_currency_check check (currency in ('USD','JMD','CAD','GBP','EUR')) not valid;
  end if;
end $$;

drop trigger if exists supplies_updated_at on public.supplies;
create trigger supplies_updated_at before update on public.supplies for each row execute function public.set_updated_at();

create index if not exists supplies_workspace_idx on public.supplies (workspace_id);
create index if not exists supplies_property_idx on public.supplies (property_id);
create index if not exists supplies_workspace_property_idx on public.supplies (workspace_id, property_id);
create index if not exists supplies_category_idx on public.supplies (category);
create index if not exists supplies_workspace_category_idx on public.supplies (workspace_id, category);
create index if not exists supplies_archived_at_idx on public.supplies (archived_at);
create index if not exists supplies_workspace_archived_at_idx on public.supplies (workspace_id, archived_at);
create index if not exists supplies_created_by_idx on public.supplies (created_by);
create index if not exists supplies_status_idx on public.supplies (status);
create index if not exists supplies_workspace_status_idx on public.supplies (workspace_id, status);
create index if not exists supplies_workspace_reorder_idx on public.supplies (workspace_id, current_quantity, low_stock_threshold);

create or replace function public.supply_property_is_scoped(target_workspace_id uuid, target_property_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_property_id is null
    or exists (
      select 1
      from public.properties p
      where p.id = target_property_id
        and p.workspace_id = target_workspace_id
    );
$$;

create or replace function public.can_manage_supplies(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host']);
$$;

create or replace function public.can_view_supplies(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host','accountant']);
$$;

alter table public.supplies enable row level security;

-- Replace earlier broad property-assignment based supply reads. The inventory ledger
-- contains supplier contacts and cost estimates, so lower operational roles do not
-- receive broad table access through RLS.
drop policy if exists supplies_select_authorized on public.supplies;
create policy supplies_select_authorized
on public.supplies
for select
using (public.can_view_supplies(workspace_id));

drop policy if exists supplies_insert_manager on public.supplies;
create policy supplies_insert_manager
on public.supplies
for insert
with check (
  public.can_manage_supplies(workspace_id)
  and created_by = auth.uid()
  and public.supply_property_is_scoped(workspace_id, property_id)
);

drop policy if exists supplies_update_manager on public.supplies;
create policy supplies_update_manager
on public.supplies
for update
using (public.can_manage_supplies(workspace_id))
with check (
  public.can_manage_supplies(workspace_id)
  and public.supply_property_is_scoped(workspace_id, property_id)
);

-- Kept as a named compatibility policy for older deployments that referenced a
-- separate archive policy. It is intentionally aligned with can_manage_supplies
-- and still requires workspace/property scope.
drop policy if exists supplies_archive_owner_manager on public.supplies;
create policy supplies_archive_owner_manager
on public.supplies
for update
using (public.can_manage_supplies(workspace_id))
with check (
  public.can_manage_supplies(workspace_id)
  and public.supply_property_is_scoped(workspace_id, property_id)
);

grant select, insert, update on public.supplies to authenticated;
grant all on public.supplies to service_role;
