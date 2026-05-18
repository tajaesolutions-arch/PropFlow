-- Guest CRM / contacts workspace-scoped CRUD alignment.
-- Uses existing public.contacts table (no duplicate guest table).

create index if not exists contacts_workspace_type_status_created_idx
  on public.contacts (workspace_id, contact_type, status, created_at desc);
create index if not exists contacts_workspace_phone_idx
  on public.contacts (workspace_id, phone)
  where phone is not null and phone <> '';
create index if not exists contacts_workspace_email_idx
  on public.contacts (workspace_id, lower(email))
  where email is not null and email <> '';

alter table public.contacts enable row level security;

drop policy if exists contacts_select_workspace_scoped_guest_crm on public.contacts;
create policy contacts_select_workspace_scoped_guest_crm
on public.contacts
for select
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant']));

drop policy if exists contacts_insert_workspace_scoped_guest_crm on public.contacts;
create policy contacts_insert_workspace_scoped_guest_crm
on public.contacts
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and created_by = auth.uid()
);

drop policy if exists contacts_update_workspace_scoped_guest_crm on public.contacts;
create policy contacts_update_workspace_scoped_guest_crm
on public.contacts
for update
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']))
with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']));

-- Remove older generic policy names to keep policy intent aligned.
drop policy if exists contacts_select_authorized on public.contacts;
drop policy if exists contacts_insert_authorized on public.contacts;
drop policy if exists contacts_update_authorized on public.contacts;

-- Booking contact relationship remains workspace-scoped.
drop policy if exists bookings_insert_workspace_scoped_guest_crm on public.bookings;
create policy bookings_insert_workspace_scoped_guest_crm
on public.bookings
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and created_by = auth.uid()
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_contact_belongs_to_workspace(workspace_id, contact_id)
);

drop policy if exists bookings_update_workspace_scoped_guest_crm on public.bookings;
create policy bookings_update_workspace_scoped_guest_crm
on public.bookings
for update
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']))
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_contact_belongs_to_workspace(workspace_id, contact_id)
);

drop policy if exists bookings_insert_authorized on public.bookings;
drop policy if exists bookings_update_authorized on public.bookings;
