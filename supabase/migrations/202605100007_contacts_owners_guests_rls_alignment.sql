-- Contacts / owners / guests RLS alignment.
-- Keeps CRM records workspace-scoped, keeps hosts able to manage guest CRM,
-- and prevents hosts/accountants/owners/cleaners/maintenance users from creating
-- or converting owner contacts.

create or replace function public.contact_manage_roles_for_type(target_contact_type text)
returns text[]
language sql
stable
set search_path = public
as $$
  select case
    when target_contact_type = 'owner' then array['workspace_owner','property_manager']::text[]
    when target_contact_type in ('guest','tenant','vendor','cleaner','maintenance','other') then array['workspace_owner','property_manager','host']::text[]
    else array['workspace_owner','property_manager','host']::text[]
  end;
$$;

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
  normalized_phone text := nullif(regexp_replace(trim(coalesce(p_phone, '')), '[^+0-9(). -]', '', 'g'), '');
begin
  if p_contact_type not in ('guest','tenant','owner','vendor','cleaner','maintenance','other') then
    raise exception 'Unsupported contact type.' using errcode = '22023';
  end if;

  if not public.has_workspace_role(p_workspace_id, public.contact_manage_roles_for_type(p_contact_type)) then
    raise exception 'You do not have permission to manage this contact type for this workspace.' using errcode = '42501';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception 'Contact name is required.' using errcode = '23502';
  end if;

  if normalized_email is not null then
    insert into public.contacts (workspace_id, full_name, email, phone, contact_type, notes, created_by)
    values (p_workspace_id, trim(p_full_name), normalized_email, normalized_phone, p_contact_type, nullif(trim(coalesce(p_notes, '')), ''), auth.uid())
    on conflict (workspace_id, (lower(email))) where email is not null and email <> ''
    do update set
      full_name = excluded.full_name,
      phone = coalesce(excluded.phone, public.contacts.phone),
      contact_type = excluded.contact_type,
      notes = coalesce(excluded.notes, public.contacts.notes),
      updated_at = now()
    where public.has_workspace_role(public.contacts.workspace_id, public.contact_manage_roles_for_type(public.contacts.contact_type))
    returning * into contact;
  else
    insert into public.contacts (workspace_id, full_name, phone, contact_type, notes, created_by)
    values (p_workspace_id, trim(p_full_name), normalized_phone, p_contact_type, nullif(trim(coalesce(p_notes, '')), ''), auth.uid())
    returning * into contact;
  end if;

  if contact is null then
    raise exception 'You do not have permission to update the existing contact for this workspace.' using errcode = '42501';
  end if;

  return contact;
end;
$$;

grant execute on function public.contact_manage_roles_for_type(text) to authenticated, service_role;
grant execute on function public.create_or_update_contact(uuid,text,text,text,text,text) to authenticated, service_role;
