-- PropFlow booking persistence hardening.
-- Keeps the bookings foundation idempotent for projects that had a partial table
-- before 202605060002_bookings_calendar_foundation.sql was applied.

-- Ensure the booking, contact, and cleaning columns used by the app exist even
-- when the tables were created by an older/partial migration.
alter table public.contacts add column if not exists full_name text;
alter table public.contacts add column if not exists email text;
alter table public.contacts add column if not exists phone text;
alter table public.contacts add column if not exists contact_type text not null default 'other';
alter table public.contacts add column if not exists notes text;
alter table public.contacts add column if not exists created_by uuid references public.profiles(id);
alter table public.contacts add column if not exists created_at timestamptz not null default now();
alter table public.contacts add column if not exists updated_at timestamptz not null default now();

alter table public.bookings add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.bookings add column if not exists property_id uuid references public.properties(id) on delete cascade;
alter table public.bookings add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.bookings add column if not exists guest_name text;
alter table public.bookings add column if not exists guest_email text;
alter table public.bookings add column if not exists guest_phone text;
alter table public.bookings add column if not exists check_in date;
alter table public.bookings add column if not exists check_out date;
alter table public.bookings add column if not exists guest_count integer;
alter table public.bookings add column if not exists source text not null default 'manual';
alter table public.bookings add column if not exists status text not null default 'confirmed';
alter table public.bookings add column if not exists payment_status text not null default 'unpaid';
alter table public.bookings add column if not exists currency text not null default 'USD';
alter table public.bookings add column if not exists total_amount numeric(12,2);
alter table public.bookings add column if not exists cleaning_fee numeric(12,2);
alter table public.bookings add column if not exists taxes_fees numeric(12,2);
alter table public.bookings add column if not exists owner_payout numeric(12,2);
alter table public.bookings add column if not exists notes text;
alter table public.bookings add column if not exists auto_create_cleaning boolean not null default true;
alter table public.bookings add column if not exists created_by uuid references public.profiles(id);
alter table public.bookings add column if not exists created_at timestamptz not null default now();
alter table public.bookings add column if not exists updated_at timestamptz not null default now();
alter table public.bookings add column if not exists cancelled_at timestamptz;

alter table public.cleaning_tasks add column if not exists booking_id uuid references public.bookings(id) on delete set null;

-- Keep constraints/indexes aligned with the form values and cleaning automation.
do $$
begin
  alter table public.bookings alter column workspace_id set not null;
  alter table public.bookings alter column property_id set not null;
  alter table public.bookings alter column guest_name set not null;
  alter table public.bookings alter column check_in set not null;
  alter table public.bookings alter column check_out set not null;
exception when others then
  raise notice 'Skipping bookings NOT NULL hardening because existing rows need cleanup first: %', sqlerrm;
end $$;

do $$
begin
  alter table public.contacts alter column full_name set not null;
exception when others then
  raise notice 'Skipping contacts.full_name NOT NULL hardening because existing rows need cleanup first: %', sqlerrm;
end $$;

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();

create unique index if not exists contacts_workspace_email_key on public.contacts (workspace_id, lower(email)) where email is not null and email <> '';
create index if not exists bookings_workspace_dates_idx on public.bookings (workspace_id, property_id, check_in, check_out, status);
create unique index if not exists cleaning_tasks_booking_unique on public.cleaning_tasks (booking_id) where booking_id is not null;

-- RLS: active workspace members with text[] roles workspace_owner,
-- property_manager, and host can create/update bookings; suspended users remain
-- blocked by public.has_workspace_role().
alter table public.contacts enable row level security;
alter table public.bookings enable row level security;

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
  and created_by = auth.uid()
);
drop policy if exists bookings_update_authorized on public.bookings;
create policy bookings_update_authorized on public.bookings for update using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
) with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
);

grant all on public.contacts to authenticated, service_role;
grant all on public.bookings to authenticated, service_role;
grant all on public.cleaning_tasks to authenticated, service_role;
