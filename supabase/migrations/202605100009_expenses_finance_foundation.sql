-- Expenses / Finance foundation.
-- Adds real workspace-scoped manual expense records while keeping exports,
-- accounting automation, tax filing, Stripe, payments, and receipt upload out of scope.

create extension if not exists "pgcrypto";

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  maintenance_work_order_id uuid references public.maintenance_work_orders(id) on delete set null,
  cleaning_task_id uuid references public.cleaning_tasks(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  category text not null,
  description text not null,
  vendor_name text,
  expense_date date not null,
  amount numeric(12,2) not null,
  currency text not null,
  payment_status text not null default 'unpaid',
  expense_status text not null default 'active',
  receipt_file_id uuid references public.file_uploads(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint expenses_amount_non_negative check (amount >= 0),
  constraint expenses_currency_check check (currency in ('USD','JMD','CAD','GBP','EUR')),
  constraint expenses_category_check check (category in ('cleaning','maintenance','supplies','utilities','platform_fee','owner_payout','property_tax','insurance','repairs','other')),
  constraint expenses_payment_status_check check (payment_status in ('unpaid','paid','reimbursed','pending','cancelled')),
  constraint expenses_expense_status_check check (expense_status in ('active','archived','draft'))
);

create index if not exists expenses_workspace_id_idx on public.expenses (workspace_id);
create index if not exists expenses_property_id_idx on public.expenses (property_id);
create index if not exists expenses_category_idx on public.expenses (category);
create index if not exists expenses_expense_date_idx on public.expenses (expense_date desc);
create index if not exists expenses_payment_status_idx on public.expenses (payment_status);
create index if not exists expenses_expense_status_idx on public.expenses (expense_status);
create index if not exists expenses_created_by_idx on public.expenses (created_by);

drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at
before update on public.expenses
for each row
execute function public.set_updated_at();

create or replace function public.expense_property_is_scoped(
  target_workspace_id uuid,
  target_property_id uuid
)
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

create or replace function public.expense_related_records_are_scoped(
  target_workspace_id uuid,
  target_property_id uuid,
  target_booking_id uuid,
  target_maintenance_work_order_id uuid,
  target_cleaning_task_id uuid,
  target_contact_id uuid,
  target_receipt_file_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    (target_booking_id is null or exists (
      select 1 from public.bookings b
      where b.id = target_booking_id
        and b.workspace_id = target_workspace_id
        and (target_property_id is null or b.property_id = target_property_id)
    ))
    and (target_maintenance_work_order_id is null or exists (
      select 1 from public.maintenance_work_orders mw
      where mw.id = target_maintenance_work_order_id
        and mw.workspace_id = target_workspace_id
        and (target_property_id is null or mw.property_id = target_property_id)
    ))
    and (target_cleaning_task_id is null or exists (
      select 1 from public.cleaning_tasks ct
      where ct.id = target_cleaning_task_id
        and ct.workspace_id = target_workspace_id
        and (target_property_id is null or ct.property_id = target_property_id)
    ))
    and (target_contact_id is null or exists (
      select 1 from public.contacts c
      where c.id = target_contact_id
        and c.workspace_id = target_workspace_id
    ))
    and (target_receipt_file_id is null or exists (
      select 1 from public.file_uploads f
      where f.id = target_receipt_file_id
        and f.workspace_id = target_workspace_id
        and f.bucket = 'propflow-private'
        and f.category = 'receipt'
        and (target_property_id is null or f.property_id is null or f.property_id = target_property_id)
    ));
$$;

create or replace function public.can_manage_expenses(
  target_workspace_id uuid,
  target_category text default null
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager']);
$$;

create or replace function public.can_view_expenses(
  target_workspace_id uuid,
  target_category text default null
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','accountant'])
    or (
      public.has_workspace_role(target_workspace_id, array['host'])
      and coalesce(target_category, 'other') not in ('owner_payout','property_tax','insurance')
    );
$$;

grant execute on function public.expense_property_is_scoped(uuid, uuid) to authenticated;
grant execute on function public.expense_related_records_are_scoped(uuid, uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.can_manage_expenses(uuid, text) to authenticated;
grant execute on function public.can_view_expenses(uuid, text) to authenticated;

alter table public.expenses enable row level security;

drop policy if exists expenses_select_authorized on public.expenses;
create policy expenses_select_authorized
on public.expenses
for select
using (
  public.can_view_expenses(workspace_id, category)
  and public.expense_property_is_scoped(workspace_id, property_id)
  and public.expense_related_records_are_scoped(workspace_id, property_id, booking_id, maintenance_work_order_id, cleaning_task_id, contact_id, receipt_file_id)
);

drop policy if exists expenses_insert_authorized on public.expenses;
create policy expenses_insert_authorized
on public.expenses
for insert
with check (
  created_by = auth.uid()
  and public.can_manage_expenses(workspace_id, category)
  and public.expense_property_is_scoped(workspace_id, property_id)
  and public.expense_related_records_are_scoped(workspace_id, property_id, booking_id, maintenance_work_order_id, cleaning_task_id, contact_id, receipt_file_id)
);

drop policy if exists expenses_update_authorized on public.expenses;
create policy expenses_update_authorized
on public.expenses
for update
using (
  public.can_manage_expenses(workspace_id, category)
  and public.expense_property_is_scoped(workspace_id, property_id)
  and public.expense_related_records_are_scoped(workspace_id, property_id, booking_id, maintenance_work_order_id, cleaning_task_id, contact_id, receipt_file_id)
)
with check (
  public.can_manage_expenses(workspace_id, category)
  and public.expense_property_is_scoped(workspace_id, property_id)
  and public.expense_related_records_are_scoped(workspace_id, property_id, booking_id, maintenance_work_order_id, cleaning_task_id, contact_id, receipt_file_id)
  and (
    (expense_status = 'archived' and archived_at is not null)
    or (expense_status in ('active','draft') and archived_at is null)
  )
);
