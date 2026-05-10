-- Bookings RLS alignment patch.
-- Keeps bookings workspace/property-scoped for list, create, and update flows
-- without broad customer-data policies or service-role assumptions.

-- Reads stay scoped to a valid booking property in the same workspace. Workspace
-- Owner/Company Admin, Property Manager, Host, and Accountant can review
-- workspace bookings; assigned Property Owners can view their property bookings;
-- Cleaner and Maintenance roles only see booking rows linked to their assigned
-- cleaning task or work order context.
drop policy if exists bookings_select_authorized on public.bookings;
create policy bookings_select_authorized
on public.bookings
for select
using (
  public.property_belongs_to_workspace(workspace_id, property_id)
  and (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
    or public.can_access_property(workspace_id, property_id)
    or exists (
      select 1
      from public.cleaning_tasks ct
      where ct.booking_id = bookings.id
        and ct.workspace_id = bookings.workspace_id
        and ct.property_id = bookings.property_id
        and ct.assigned_cleaner_id = auth.uid()
    )
    or exists (
      select 1
      from public.maintenance_work_orders mw
      where mw.workspace_id = bookings.workspace_id
        and mw.property_id = bookings.property_id
        and mw.assigned_maintenance_id = auth.uid()
    )
  )
);

-- Booking writes remain limited to operational roles. The workspace_id is not
-- trusted by itself: property_id and optional contact_id must belong to the same
-- workspace, and created_by must be the authenticated user on insert.
drop policy if exists bookings_insert_authorized on public.bookings;
create policy bookings_insert_authorized
on public.bookings
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and created_by = auth.uid()
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_contact_belongs_to_workspace(workspace_id, contact_id)
);

drop policy if exists bookings_update_authorized on public.bookings;
create policy bookings_update_authorized
on public.bookings
for update
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and public.property_belongs_to_workspace(workspace_id, property_id)
)
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_contact_belongs_to_workspace(workspace_id, contact_id)
);
