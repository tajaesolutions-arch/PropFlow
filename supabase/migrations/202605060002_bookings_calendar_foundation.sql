-- PropFlow Bookings + Calendar foundation.
-- Adds workspace-scoped contacts, short-term bookings, long-term leases,
-- database overlap protection, contact upsert RPC, and checkout cleaning automation.

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  contact_type text not null default 'other' check (contact_type in ('guest','tenant','owner','vendor','cleaner','maintenance','other')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  guest_name text not null,
  guest_email text,
  guest_phone text,
  check_in date not null,
  check_out date not null,
  guest_count integer,
  source text not null default 'manual' check (source in ('manual','direct','airbnb','booking_com','vrbo','ical','csv','other')),
  status text not null default 'confirmed' check (status in ('pending','confirmed','checked_in','checked_out','completed','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partially_paid','paid','refunded','failed')),
  currency text not null default 'USD',
  total_amount numeric(12,2),
  cleaning_fee numeric(12,2),
  taxes_fees numeric(12,2),
  owner_payout numeric(12,2),
  notes text,
  auto_create_cleaning boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (check_out > check_in),
  check (guest_count is null or guest_count > 0)
);

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  tenant_name text not null,
  tenant_email text,
  tenant_phone text,
  lease_start date not null,
  lease_end date,
  monthly_rent numeric(12,2),
  security_deposit numeric(12,2),
  rent_payment_status text not null default 'unknown' check (rent_payment_status in ('current','overdue','partially_paid','paid_ahead','unknown')),
  lease_status text not null default 'active' check (lease_status in ('active','ending_soon','expired','terminated','cancelled')),
  currency text not null default 'USD',
  lease_document_file_id uuid references public.file_uploads(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  terminated_at timestamptz,
  check (lease_end is null or lease_end >= lease_start)
);

alter table public.cleaning_tasks add column if not exists booking_id uuid;
do $$
begin
  alter table public.cleaning_tasks drop constraint if exists cleaning_tasks_booking_id_fkey;
  alter table public.cleaning_tasks
    add constraint cleaning_tasks_booking_id_fkey foreign key (booking_id) references public.bookings(id) on delete set null not valid;
exception when others then
  raise notice 'Skipping cleaning_tasks.booking_id FK validation setup: %', sqlerrm;
end $$;

-- Existing Phase 1 check constraint did not include cancelled. Recreate safely for audit-preserving booking cancellation.
do $$
begin
  alter table public.cleaning_tasks drop constraint if exists cleaning_tasks_status_check;
  alter table public.cleaning_tasks add constraint cleaning_tasks_status_check
    check (status in ('scheduled','in_progress','completed','missed','needs_inspection','guest_ready','cancelled')) not valid;
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- Timestamps and indexes
-- -----------------------------------------------------------------------------
drop trigger if exists contacts_updated_at on public.contacts;
create trigger contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();

drop trigger if exists leases_updated_at on public.leases;
create trigger leases_updated_at before update on public.leases for each row execute function public.set_updated_at();

create unique index if not exists contacts_workspace_email_key on public.contacts (workspace_id, lower(email)) where email is not null and email <> '';
create index if not exists contacts_workspace_type_idx on public.contacts (workspace_id, contact_type, created_at desc);
create index if not exists bookings_workspace_dates_idx on public.bookings (workspace_id, property_id, check_in, check_out, status);
create index if not exists bookings_contact_idx on public.bookings (workspace_id, contact_id);
create index if not exists leases_workspace_dates_idx on public.leases (workspace_id, property_id, lease_start, lease_end, lease_status);
create index if not exists leases_contact_idx on public.leases (workspace_id, contact_id);
create unique index if not exists cleaning_tasks_booking_unique on public.cleaning_tasks (booking_id) where booking_id is not null;

-- -----------------------------------------------------------------------------
-- Contact CRM RPC. Security definer keeps behavior consistent with RLS policies
-- while still checking active workspace membership and manager/host/accountant roles.
-- -----------------------------------------------------------------------------
create or replace function public.create_or_update_contact(
  p_workspace_id uuid,
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_contact_type text default 'other',
  p_notes text default null
)
returns public.contacts
language plpgsql
security definer
set search_path = public
as $$
declare
  contact public.contacts;
  normalized_email text := nullif(lower(trim(p_email)), '');
begin
  if not public.has_workspace_role(p_workspace_id, array['workspace_owner','property_manager','host','accountant']) then
    raise exception 'You do not have permission to manage contacts for this workspace.' using errcode = '42501';
  end if;

  if p_contact_type not in ('guest','tenant','owner','vendor','cleaner','maintenance','other') then
    raise exception 'Unsupported contact type.' using errcode = '22023';
  end if;

  if normalized_email is not null then
    insert into public.contacts (workspace_id, full_name, email, phone, contact_type, notes, created_by)
    values (p_workspace_id, trim(p_full_name), normalized_email, nullif(trim(p_phone), ''), p_contact_type, p_notes, auth.uid())
    on conflict (workspace_id, (lower(email))) where email is not null and email <> ''
    do update set
      full_name = excluded.full_name,
      phone = coalesce(excluded.phone, public.contacts.phone),
      contact_type = excluded.contact_type,
      notes = coalesce(excluded.notes, public.contacts.notes),
      updated_at = now()
    returning * into contact;
  else
    insert into public.contacts (workspace_id, full_name, phone, contact_type, notes, created_by)
    values (p_workspace_id, trim(p_full_name), nullif(trim(p_phone), ''), p_contact_type, p_notes, auth.uid())
    returning * into contact;
  end if;

  return contact;
end;
$$;

-- -----------------------------------------------------------------------------
-- Double-booking and lease overlap prevention.
-- Uses inclusive start / exclusive end for bookings and inclusive lease end dates.
-- -----------------------------------------------------------------------------
create or replace function public.validate_booking_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conflicting_booking text;
  conflicting_lease text;
begin
  if new.status = 'cancelled' then
    if new.cancelled_at is null then new.cancelled_at = now(); end if;
    return new;
  end if;

  if new.check_out <= new.check_in then
    raise exception 'Check-out must be after check-in.' using errcode = '22023';
  end if;

  select b.guest_name into conflicting_booking
  from public.bookings b
  where b.workspace_id = new.workspace_id
    and b.property_id = new.property_id
    and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and b.status in ('pending','confirmed','checked_in')
    and new.status in ('pending','confirmed','checked_in')
    and daterange(b.check_in, b.check_out, '[)') && daterange(new.check_in, new.check_out, '[)')
  limit 1;

  if conflicting_booking is not null then
    raise exception 'This property already has an overlapping booking for %.', conflicting_booking using errcode = '23P01';
  end if;

  select l.tenant_name into conflicting_lease
  from public.leases l
  where l.workspace_id = new.workspace_id
    and l.property_id = new.property_id
    and l.lease_status in ('active','ending_soon')
    and daterange(l.lease_start, coalesce(l.lease_end + 1, 'infinity'::date), '[)') && daterange(new.check_in, new.check_out, '[)')
  limit 1;

  if conflicting_lease is not null then
    raise exception 'This property has an active lease for % during those dates.', conflicting_lease using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_validate_availability on public.bookings;
create trigger bookings_validate_availability before insert or update of property_id, check_in, check_out, status on public.bookings
for each row execute function public.validate_booking_availability();

create or replace function public.validate_lease_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lease_end_exclusive date := coalesce(new.lease_end + 1, 'infinity'::date);
  conflicting_booking text;
  conflicting_lease text;
begin
  if new.lease_status in ('terminated','cancelled') then
    if new.terminated_at is null then new.terminated_at = now(); end if;
    return new;
  end if;

  if new.lease_end is not null and new.lease_end < new.lease_start then
    raise exception 'Lease end must be on or after lease start.' using errcode = '22023';
  end if;

  select l.tenant_name into conflicting_lease
  from public.leases l
  where l.workspace_id = new.workspace_id
    and l.property_id = new.property_id
    and l.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and l.lease_status in ('active','ending_soon')
    and new.lease_status in ('active','ending_soon')
    and daterange(l.lease_start, coalesce(l.lease_end + 1, 'infinity'::date), '[)') && daterange(new.lease_start, lease_end_exclusive, '[)')
  limit 1;

  if conflicting_lease is not null then
    raise exception 'This property already has an overlapping lease for %.', conflicting_lease using errcode = '23P01';
  end if;

  select b.guest_name into conflicting_booking
  from public.bookings b
  where b.workspace_id = new.workspace_id
    and b.property_id = new.property_id
    and b.status in ('pending','confirmed','checked_in')
    and daterange(b.check_in, b.check_out, '[)') && daterange(new.lease_start, lease_end_exclusive, '[)')
  limit 1;

  if conflicting_booking is not null then
    raise exception 'This property has an overlapping booking for % during the lease dates.', conflicting_booking using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists leases_validate_availability on public.leases;
create trigger leases_validate_availability before insert or update of property_id, lease_start, lease_end, lease_status on public.leases
for each row execute function public.validate_lease_availability();

-- -----------------------------------------------------------------------------
-- Cleaning automation for short-term checkout. One scheduled cleaning is kept per
-- booking and future scheduled cleanings are cancelled when the booking is cancelled.
-- -----------------------------------------------------------------------------
create or replace function public.sync_booking_cleaning_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' then
    update public.cleaning_tasks
      set status = 'cancelled', updated_at = now()
    where booking_id = new.id
      and status in ('scheduled','in_progress','missed','needs_inspection','guest_ready')
      and scheduled_for >= now();
    return new;
  end if;

  if new.auto_create_cleaning then
    insert into public.cleaning_tasks (workspace_id, property_id, booking_id, scheduled_for, status, checklist_items, created_by)
    values (new.workspace_id, new.property_id, new.id, (new.check_out::timestamp + interval '11 hours')::timestamptz, 'scheduled', '[]'::jsonb, new.created_by)
    on conflict do nothing;

    update public.cleaning_tasks
      set property_id = new.property_id,
          scheduled_for = (new.check_out::timestamp + interval '11 hours')::timestamptz,
          status = case when status = 'cancelled' then 'scheduled' else status end,
          updated_at = now()
    where booking_id = new.id
      and status in ('scheduled','cancelled');
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_sync_cleaning_task on public.bookings;
create trigger bookings_sync_cleaning_task after insert or update of property_id, check_out, status, auto_create_cleaning on public.bookings
for each row execute function public.sync_booking_cleaning_task();

-- -----------------------------------------------------------------------------
-- RLS policies
-- -----------------------------------------------------------------------------
alter table public.contacts enable row level security;
alter table public.bookings enable row level security;
alter table public.leases enable row level security;

drop policy if exists contacts_select_authorized on public.contacts;
create policy contacts_select_authorized on public.contacts for select using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
);
drop policy if exists contacts_insert_authorized on public.contacts;
create policy contacts_insert_authorized on public.contacts for insert with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
);
drop policy if exists contacts_update_authorized on public.contacts;
create policy contacts_update_authorized on public.contacts for update using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
) with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
);

drop policy if exists bookings_select_authorized on public.bookings;
create policy bookings_select_authorized on public.bookings for select using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
  or public.can_access_property(workspace_id, property_id)
  or exists (select 1 from public.cleaning_tasks ct where ct.booking_id = bookings.id and ct.assigned_cleaner_id = auth.uid())
  or exists (select 1 from public.maintenance_work_orders mw where mw.workspace_id = bookings.workspace_id and mw.property_id = bookings.property_id and mw.assigned_maintenance_id = auth.uid())
);
drop policy if exists bookings_insert_authorized on public.bookings;
create policy bookings_insert_authorized on public.bookings for insert with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
);
drop policy if exists bookings_update_authorized on public.bookings;
create policy bookings_update_authorized on public.bookings for update using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
) with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
);

drop policy if exists leases_select_authorized on public.leases;
create policy leases_select_authorized on public.leases for select using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
  or public.can_access_property(workspace_id, property_id)
);
drop policy if exists leases_insert_authorized on public.leases;
create policy leases_insert_authorized on public.leases for insert with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
);
drop policy if exists leases_update_authorized on public.leases;
create policy leases_update_authorized on public.leases for update using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
) with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
);

grant all on public.contacts to anon, authenticated, service_role;
grant all on public.bookings to anon, authenticated, service_role;
grant all on public.leases to anon, authenticated, service_role;
grant execute on function public.create_or_update_contact(uuid,text,text,text,text,text) to authenticated, service_role;
