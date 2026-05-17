-- Align property create permissions with the Properties Supabase CRUD rollout.
-- Reads remain workspace/property-assignment scoped through can_access_property.
-- Hosts may create property records for their active workspace, while updates stay
-- limited to Workspace Owner / Company Admin and Property Manager roles.

drop policy if exists properties_insert_manager on public.properties;
create policy properties_insert_manager
on public.properties
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and created_by = auth.uid()
  and public.property_assigned_owner_is_workspace_owner_member(workspace_id, assigned_owner_id)
);

drop policy if exists properties_update_manager on public.properties;
create policy properties_update_manager
on public.properties
for update
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']))
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  and public.property_assigned_owner_is_workspace_owner_member(workspace_id, assigned_owner_id)
);

create index if not exists properties_workspace_created_at_idx
on public.properties (workspace_id, created_at desc);

create index if not exists properties_workspace_assigned_owner_idx
on public.properties (workspace_id, assigned_owner_id)
where assigned_owner_id is not null;
