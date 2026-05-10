-- Long-Term Rentals / Leases foundation.
-- Non-destructive alignment for manual lease tracking only. This migration does
-- not add rent collection, tenant portals, e-signature, legal generation, or
-- accounting automation.

create extension if not exists "pgcrypto";

-- Align CRM contact types with tenant contacts without dropping contact data.
do $$
begin
  alter table public.contacts drop constraint if exists contacts_contact_type_check;
  alter table public.contacts add constraint contacts_contact_type_check
    check (contact_type in ('guest','tenant','owner','vendor','cleaner','maintenance','other')) not valid;
exception when undefined_table then
  raise notice 'contacts table is not available yet; skipping tenant contact constraint alignment.';
when duplicate_object then
  null;
end $$;

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_contact_id uuid references public.contacts(id) on delete set null,
  lease_type text not null default 'fixed_term',
  lease_status text not null default 'draft',
  tenant_name text not null,
  tenant_email text,
  tenant_phone text,
  lease_start date not null,
  lease_end date,
  rent_amount numeric(12,2) not null default 0,
  rent_frequency text not null default 'monthly',
  security_deposit_amount numeric(12,2),
  deposit_status text default 'not_tracked',
  payment_status text not null default 'not_tracked',
  currency text not null,
  due_day integer,
  grace_period_days integer default 0,
  late_fee_amount numeric(12,2),
  lease_document_file_id uuid references public.file_uploads(id) on delete set null,
  move_in_notes text,
  move_out_notes text,
  internal_notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Align older lease foundations in place. Legacy columns are retained for
-- backward compatibility until every environment is fully migrated.
alter table public.leases add column if not exists tenant_contact_id uuid references public.contacts(id) on delete set null;
alter table public.leases add column if not exists lease_type text not null default 'fixed_term';
alter table public.leases add column if not exists lease_status text not null default 'draft';
alter table public.leases add column if not exists tenant_name text;
alter table public.leases add column if not exists tenant_email text;
alter table public.leases add column if not exists tenant_phone text;
alter table public.leases add column if not exists lease_start date;
alter table public.leases add column if not exists lease_end date;
alter table public.leases add column if not exists rent_amount numeric(12,2) not null default 0;
alter table public.leases add column if not exists rent_frequency text not null default 'monthly';
alter table public.leases add column if not exists security_deposit_amount numeric(12,2);
alter table public.leases add column if not exists deposit_status text default 'not_tracked';
alter table public.leases add column if not exists payment_status text not null default 'not_tracked';
alter table public.leases add column if not exists currency text;
alter table public.leases add column if not exists due_day integer;
alter table public.leases add column if not exists grace_period_days integer default 0;
alter table public.leases add column if not exists late_fee_amount numeric(12,2);
alter table public.leases add column if not exists lease_document_file_id uuid references public.file_uploads(id) on delete set null;
alter table public.leases add column if not exists move_in_notes text;
alter table public.leases add column if not exists move_out_notes text;
alter table public.leases add column if not exists internal_notes text;
alter table public.leases add column if not exists created_by uuid references public.profiles(id);
alter table public.leases add column if not exists updated_by uuid references public.profiles(id);
alter table public.leases add column if not exists archived_at timestamptz;
alter table public.leases add column if not exists created_at timestamptz not null default now();
alter table public.leases add column if not exists updated_at timestamptz not null default now();

-- Legacy compatibility columns that may already exist from the bookings/calendar
-- foundation. They are not used by the new app workflow, but values are mirrored
-- below so older deployments are not broken by this migration.
alter table public.leases add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.leases add column if not exists monthly_rent numeric(12,2);
alter table public.leases add column if not exists security_deposit numeric(12,2);
alter table public.leases add column if not exists rent_payment_status text;
alter table public.leases add column if not exists notes text;
alter table public.leases add column if not exists terminated_at timestamptz;

update public.leases
set tenant_contact_id = coalesce(tenant_contact_id, contact_id),
    rent_amount = coalesce(rent_amount, monthly_rent, 0),
    security_deposit_amount = coalesce(security_deposit_amount, security_deposit),
    payment_status = coalesce(
      payment_status,
      case rent_payment_status
        when 'unknown' then 'not_tracked'
        when 'paid_ahead' then 'paid'
        else rent_payment_status
      end,
      'not_tracked'
    ),
    deposit_status = coalesce(deposit_status, 'not_tracked'),
    lease_type = coalesce(lease_type, 'fixed_term'),
    rent_frequency = coalesce(rent_frequency, 'monthly'),
    lease_status = case
      when archived_at is not null then 'archived'
      when lease_status in ('ending_soon') then 'expiring_soon'
      when lease_status in ('expired') then 'ended'
      when lease_status in ('cancelled') then 'terminated'
      when lease_status is null then 'draft'
      else lease_status
    end,
    currency = coalesce(currency, 'USD'),
    internal_notes = coalesce(internal_notes, notes),
    updated_at = coalesce(updated_at, created_at, now())
where tenant_contact_id is null
   or rent_amount is null
   or security_deposit_amount is null and security_deposit is not null
   or payment_status is null
   or deposit_status is null
   or lease_type is null
   or rent_frequency is null
   or lease_status in ('ending_soon','expired','cancelled')
   or lease_status is null
   or currency is null
   or internal_notes is null and notes is not null
   or updated_at is null;

alter table public.leases alter column tenant_name set not null;
alter table public.leases alter column lease_start set not null;
alter table public.leases alter column rent_amount set default 0;
alter table public.leases alter column rent_amount set not null;
alter table public.leases alter column lease_type set default 'fixed_term';
alter table public.leases alter column lease_type set not null;
alter table public.leases alter column lease_status set default 'draft';
alter table public.leases alter column lease_status set not null;
alter table public.leases alter column rent_frequency set default 'monthly';
alter table public.leases alter column rent_frequency set not null;
alter table public.leases alter column payment_status set default 'not_tracked';
alter table public.leases alter column payment_status set not null;
alter table public.leases alter column grace_period_days set default 0;
alter table public.leases alter column currency set not null;

-- Replace legacy checks with canonical MVP constraints.
alter table public.leases drop constraint if exists leases_lease_status_check;
alter table public.leases drop constraint if exists leases_lease_type_check;
alter table public.leases drop constraint if exists leases_rent_frequency_check;
alter table public.leases drop constraint if exists leases_payment_status_check;
alter table public.leases drop constraint if exists leases_deposit_status_check;
alter table public.leases drop constraint if exists leases_rent_amount_check;
alter table public.leases drop constraint if exists leases_security_deposit_amount_check;
alter table public.leases drop constraint if exists leases_late_fee_amount_check;
alter table public.leases drop constraint if exists leases_due_day_check;
alter table public.leases drop constraint if exists leases_grace_period_days_check;
alter table public.leases drop constraint if exists leases_lease_dates_check;
alter table public.leases drop constraint if exists leases_currency_check;
alter table public.leases drop constraint if exists leases_rent_payment_status_check;

alter table public.leases add constraint leases_lease_status_check
  check (lease_status in ('draft','active','month_to_month','expiring_soon','ended','terminated','archived')) not valid;
alter table public.leases add constraint leases_lease_type_check
  check (lease_type in ('fixed_term','month_to_month','renewal','short_term_extension','other')) not valid;
alter table public.leases add constraint leases_rent_frequency_check
  check (rent_frequency in ('weekly','biweekly','monthly','quarterly','yearly')) not valid;
alter table public.leases add constraint leases_payment_status_check
  check (payment_status in ('not_tracked','current','overdue','partially_paid','paid','waived')) not valid;
alter table public.leases add constraint leases_deposit_status_check
  check (deposit_status is null or deposit_status in ('not_tracked','current','overdue','partially_paid','paid','waived')) not valid;
alter table public.leases add constraint leases_rent_amount_check check (rent_amount >= 0) not valid;
alter table public.leases add constraint leases_security_deposit_amount_check
  check (security_deposit_amount is null or security_deposit_amount >= 0) not valid;
alter table public.leases add constraint leases_late_fee_amount_check
  check (late_fee_amount is null or late_fee_amount >= 0) not valid;
alter table public.leases add constraint leases_due_day_check
  check (due_day is null or due_day between 1 and 31) not valid;
alter table public.leases add constraint leases_grace_period_days_check
  check (grace_period_days is null or grace_period_days >= 0) not valid;
alter table public.leases add constraint leases_lease_dates_check
  check (lease_end is null or lease_end > lease_start) not valid;
alter table public.leases add constraint leases_currency_check
  check (currency in ('USD','JMD','CAD','GBP','EUR')) not valid;

create index if not exists leases_workspace_id_idx on public.leases (workspace_id);
create index if not exists leases_property_id_idx on public.leases (property_id);
create index if not exists leases_tenant_contact_id_idx on public.leases (tenant_contact_id);
create index if not exists leases_lease_status_idx on public.leases (lease_status);
create index if not exists leases_payment_status_idx on public.leases (payment_status);
create index if not exists leases_lease_start_idx on public.leases (lease_start);
create index if not exists leases_lease_end_idx on public.leases (lease_end);
create index if not exists leases_archived_at_idx on public.leases (archived_at);
create index if not exists leases_created_by_idx on public.leases (created_by);

-- Keep legacy columns mirrored for older screens still expecting them.
create or replace function public.sync_lease_legacy_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.contact_id := new.tenant_contact_id;
  new.monthly_rent := case when new.rent_frequency = 'monthly' then new.rent_amount else new.monthly_rent end;
  new.security_deposit := new.security_deposit_amount;
  new.rent_payment_status := case new.payment_status
    when 'not_tracked' then 'unknown'
    when 'paid' then 'paid_ahead'
    else new.payment_status
  end;
  new.notes := coalesce(new.notes, new.internal_notes);
  if new.lease_status = 'terminated' and new.terminated_at is null then
    new.terminated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists leases_sync_legacy_columns on public.leases;
create trigger leases_sync_legacy_columns
before insert or update on public.leases
for each row execute function public.sync_lease_legacy_columns();

drop trigger if exists leases_updated_at on public.leases;
create trigger leases_updated_at before update on public.leases for each row execute function public.set_updated_at();

create or replace function public.can_manage_leases(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager']);
$$;

create or replace function public.can_view_leases(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host','accountant']);
$$;

create or replace function public.lease_property_is_scoped(target_workspace_id uuid, target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.property_belongs_to_workspace(target_workspace_id, target_property_id);
$$;

create or replace function public.lease_contact_is_scoped(target_workspace_id uuid, target_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_contact_id is null
    or exists (
      select 1
      from public.contacts c
      where c.id = target_contact_id
        and c.workspace_id = target_workspace_id
        and c.contact_type in ('tenant','guest','other')
    );
$$;

create or replace function public.lease_file_is_scoped(target_workspace_id uuid, target_property_id uuid, target_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_file_id is null
    or exists (
      select 1
      from public.file_uploads f
      where f.id = target_file_id
        and f.workspace_id = target_workspace_id
        and f.visibility = 'private'
        and coalesce(f.archived_at, 'infinity'::timestamptz) > now()
        and f.file_category in ('lease','contract','property_document')
        and (f.property_id is null or f.property_id = target_property_id)
    );
$$;

grant execute on function public.can_manage_leases(uuid) to authenticated, service_role;
grant execute on function public.can_view_leases(uuid) to authenticated, service_role;
grant execute on function public.lease_property_is_scoped(uuid,uuid) to authenticated, service_role;
grant execute on function public.lease_contact_is_scoped(uuid,uuid) to authenticated, service_role;
grant execute on function public.lease_file_is_scoped(uuid,uuid,uuid) to authenticated, service_role;

alter table public.leases enable row level security;

drop policy if exists leases_select_authorized on public.leases;
create policy leases_select_authorized
on public.leases
for select
to authenticated
using (
  public.can_view_leases(workspace_id)
  and public.lease_property_is_scoped(workspace_id, property_id)
);

drop policy if exists leases_insert_authorized on public.leases;
create policy leases_insert_authorized
on public.leases
for insert
to authenticated
with check (
  public.can_manage_leases(workspace_id)
  and created_by = auth.uid()
  and public.lease_property_is_scoped(workspace_id, property_id)
  and public.lease_contact_is_scoped(workspace_id, tenant_contact_id)
  and public.lease_file_is_scoped(workspace_id, property_id, lease_document_file_id)
);

drop policy if exists leases_update_authorized on public.leases;
create policy leases_update_authorized
on public.leases
for update
to authenticated
using (
  public.can_manage_leases(workspace_id)
  and public.lease_property_is_scoped(workspace_id, property_id)
)
with check (
  public.can_manage_leases(workspace_id)
  and public.lease_property_is_scoped(workspace_id, property_id)
  and public.lease_contact_is_scoped(workspace_id, tenant_contact_id)
  and public.lease_file_is_scoped(workspace_id, property_id, lease_document_file_id)
);
