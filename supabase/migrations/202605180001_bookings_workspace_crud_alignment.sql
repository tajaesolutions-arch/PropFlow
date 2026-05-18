-- Bookings workspace CRUD alignment (forward-only, non-destructive)
create index if not exists bookings_workspace_id_idx on public.bookings(workspace_id);
create index if not exists bookings_workspace_property_idx on public.bookings(workspace_id, property_id);
create index if not exists bookings_workspace_checkin_checkout_idx on public.bookings(workspace_id, check_in, check_out);
create index if not exists bookings_workspace_status_idx on public.bookings(workspace_id, status);
create index if not exists bookings_workspace_payment_status_idx on public.bookings(workspace_id, payment_status);

drop policy if exists bookings_select_workspace_scoped on public.bookings;
create policy bookings_select_workspace_scoped
on public.bookings
for select
to authenticated
using (
  (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
    or public.has_workspace_role(workspace_id, array['property_owner'])
  )
  and (
    not public.has_workspace_role(workspace_id, array['property_owner'])
    or property_id in (
      select assignment.property_id
      from public.property_assignments assignment
      where assignment.workspace_id = bookings.workspace_id
        and assignment.user_id = auth.uid()
        and assignment.status = 'active'
    )
  )
);

drop policy if exists bookings_insert_authorized on public.bookings;
create policy bookings_insert_authorized
on public.bookings
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_contact_belongs_to_workspace(workspace_id, contact_id)
);

drop policy if exists bookings_update_authorized on public.bookings;
create policy bookings_update_authorized
on public.bookings
for update
to authenticated
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']))
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_contact_belongs_to_workspace(workspace_id, contact_id)
);
