-- Owners / Property Owner CRM alignment (workspace-scoped, non-destructive).

create index if not exists contacts_workspace_contact_type_idx
  on public.contacts (workspace_id, contact_type);

create index if not exists contacts_workspace_owner_status_idx
  on public.contacts (workspace_id, status)
  where contact_type = 'owner';

create index if not exists contacts_workspace_owner_email_idx
  on public.contacts (workspace_id, lower(email))
  where contact_type = 'owner' and email is not null and email <> '';

drop policy if exists contacts_select_owner_workspace_scoped on public.contacts;
create policy contacts_select_owner_workspace_scoped
on public.contacts
for select
using (
  contact_type <> 'owner'
  or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
  or (
    public.has_workspace_role(workspace_id, array['property_owner'])
    and lower(coalesce(email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
  )
);

-- Keep owner-contact writes manager-scoped.
drop policy if exists contacts_insert_authorized on public.contacts;
create policy contacts_insert_authorized
on public.contacts
for insert
with check (
  public.has_workspace_role(workspace_id, public.contact_manage_roles_for_type(contact_type))
  and created_by = auth.uid()
);

drop policy if exists contacts_update_authorized on public.contacts;
create policy contacts_update_authorized
on public.contacts
for update
using (public.has_workspace_role(workspace_id, public.contact_manage_roles_for_type(contact_type)))
with check (public.has_workspace_role(workspace_id, public.contact_manage_roles_for_type(contact_type)));
