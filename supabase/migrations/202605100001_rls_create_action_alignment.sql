-- PropFlow RLS create-action alignment audit patch.
-- Tightens workspace scoping, invite/property assignment validation, and lower-role
-- operational updates without dropping tables or customer data.

-- -----------------------------------------------------------------------------
-- Shared helpers. All helpers are SECURITY DEFINER so policy checks can safely
-- inspect workspace membership/linkage tables while RLS remains enabled.
-- -----------------------------------------------------------------------------
create or replace function public.valid_customer_workspace_roles(candidate_roles text[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(array_length(candidate_roles, 1), 0) > 0
    and candidate_roles <@ array[
      'workspace_owner',
      'property_manager',
      'host',
      'accountant',
      'property_owner',
      'cleaner',
      'maintenance'
    ]::text[]
    and not candidate_roles && array['propflow_admin']::text[];
$$;

create or replace function public.user_is_active_workspace_member(target_workspace_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.profiles p on p.id = wm.user_id
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = target_user_id
      and wm.status = 'active'
      and p.status = 'active'
      and w.status = 'active'
  );
$$;

create or replace function public.property_belongs_to_workspace(target_workspace_id uuid, target_property_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_property_id is not null
    and exists (
      select 1
      from public.properties p
      where p.id = target_property_id
        and p.workspace_id = target_workspace_id
    );
$$;

create or replace function public.optional_contact_belongs_to_workspace(target_workspace_id uuid, target_contact_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_contact_id is null
    or exists (
      select 1
      from public.contacts c
      where c.id = target_contact_id
        and c.workspace_id = target_workspace_id
    );
$$;

create or replace function public.optional_booking_belongs_to_workspace_property(target_workspace_id uuid, target_property_id uuid, target_booking_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_booking_id is null
    or exists (
      select 1
      from public.bookings b
      where b.id = target_booking_id
        and b.workspace_id = target_workspace_id
        and b.property_id = target_property_id
    );
$$;

create or replace function public.optional_cleaning_task_belongs_to_workspace_property(target_workspace_id uuid, target_property_id uuid, target_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_task_id is null
    or exists (
      select 1
      from public.cleaning_tasks ct
      where ct.id = target_task_id
        and ct.workspace_id = target_workspace_id
        and (target_property_id is null or ct.property_id = target_property_id)
    );
$$;

create or replace function public.optional_work_order_belongs_to_workspace_property(target_workspace_id uuid, target_property_id uuid, target_work_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_work_order_id is null
    or exists (
      select 1
      from public.maintenance_work_orders mw
      where mw.id = target_work_order_id
        and mw.workspace_id = target_workspace_id
        and (target_property_id is null or mw.property_id = target_property_id)
    );
$$;

create or replace function public.invite_assigned_properties_are_scoped(target_workspace_id uuid, target_roles text[], target_property_ids uuid[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select case
    when not public.valid_customer_workspace_roles(target_roles) then false
    when target_roles && array['property_owner','cleaner','maintenance']::text[]
      then coalesce(array_length(target_property_ids, 1), 0) > 0
        and not exists (
          select 1
          from unnest(target_property_ids) assigned_property_id
          where not public.property_belongs_to_workspace(target_workspace_id, assigned_property_id)
        )
    else coalesce(array_length(target_property_ids, 1), 0) = 0
      or not exists (
        select 1
        from unnest(target_property_ids) assigned_property_id
        where not public.property_belongs_to_workspace(target_workspace_id, assigned_property_id)
      )
  end;
$$;

create or replace function public.file_upload_context_is_scoped(
  target_workspace_id uuid,
  target_property_id uuid,
  target_cleaning_task_id uuid,
  target_work_order_id uuid,
  target_bucket text,
  target_path text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_bucket = 'propflow-private'
    and target_path like target_workspace_id::text || '/%'
    and (
      target_property_id is null
      or public.property_belongs_to_workspace(target_workspace_id, target_property_id)
    )
    and public.optional_cleaning_task_belongs_to_workspace_property(
      target_workspace_id,
      target_property_id,
      target_cleaning_task_id
    )
    and public.optional_work_order_belongs_to_workspace_property(
      target_workspace_id,
      target_property_id,
      target_work_order_id
    );
$$;

-- Joining by invite must use only customer roles from a live invite for the same
-- user email. propflow_admin remains profile-backed platform state only.
create or replace function public.can_accept_workspace_member(target_workspace_id uuid, target_user_id uuid, target_roles text[], target_status text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_user_id = auth.uid()
    and target_status = 'active'
    and public.valid_customer_workspace_roles(target_roles)
    and (
      (
        target_roles @> array['workspace_owner']::text[]
        and array['workspace_owner']::text[] @> target_roles
        and exists (
          select 1
          from public.workspaces workspace
          where workspace.id = target_workspace_id
            and workspace.created_by = auth.uid()
        )
        and not exists (
          select 1
          from public.workspace_members existing
          where existing.workspace_id = target_workspace_id
        )
      )
      or exists (
        select 1
        from public.workspace_invites invite
        join public.workspaces workspace on workspace.id = invite.workspace_id
        where invite.workspace_id = target_workspace_id
          and lower(invite.email) = lower((select auth.email()))
          and invite.status = 'pending'
          and (invite.expires_at is null or invite.expires_at > now())
          and invite.workspace_code = workspace.company_code
          and invite.roles @> target_roles
          and target_roles @> invite.roles
          and public.valid_customer_workspace_roles(invite.roles)
          and public.invite_assigned_properties_are_scoped(invite.workspace_id, invite.roles, invite.assigned_property_ids)
      )
    );
$$;

-- Ensure invited property assignments never cross workspace boundaries, even when
-- older invite rows contain malformed assigned_property_ids.
create or replace function public.assign_invited_properties()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
  property_id uuid;
  assignment text;
begin
  select wi.* into invite
  from public.workspace_invites wi
  join public.profiles p on lower(p.email) = lower(wi.email)
  join public.workspaces w on w.id = wi.workspace_id
  where wi.workspace_id = new.workspace_id
    and p.id = new.user_id
    and wi.status = 'pending'
    and (wi.expires_at is null or wi.expires_at > now())
    and wi.workspace_code = w.company_code
    and public.valid_customer_workspace_roles(wi.roles)
    and public.invite_assigned_properties_are_scoped(wi.workspace_id, wi.roles, wi.assigned_property_ids)
  order by wi.created_at desc
  limit 1;

  if invite.id is null or invite.assigned_property_ids is null then
    return new;
  end if;

  foreach property_id in array invite.assigned_property_ids loop
    continue when not public.property_belongs_to_workspace(new.workspace_id, property_id);

    foreach assignment in array new.roles loop
      if assignment in ('property_owner','cleaner','maintenance','host','accountant') then
        insert into public.property_assignments (workspace_id, property_id, user_id, assignment_role, created_by)
        values (new.workspace_id, property_id, new.user_id, assignment, invite.invited_by)
        on conflict (property_id, user_id, assignment_role) do nothing;
      end if;
    end loop;
  end loop;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Policies aligned to the create-action modal/AppContext role map.
-- -----------------------------------------------------------------------------

-- Workspace memberships: workspace owners may manage customer roles only; invited
-- users may insert only the exact active membership from a matching pending invite.
drop policy if exists workspace_members_insert_owner_or_valid_invite on public.workspace_members;
create policy workspace_members_insert_owner_or_valid_invite
on public.workspace_members
for insert
with check (
  (
    public.has_workspace_role(workspace_id, array['workspace_owner'])
    and public.valid_customer_workspace_roles(roles)
    and public.user_is_active_workspace_member(workspace_id, user_id)
  )
  or public.can_accept_workspace_member(workspace_id, user_id, roles, status)
);

-- Existing members can be viewed by active members in the same workspace or by
-- the user themself; helper enforces suspended/revoked/workspace status checks.
drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member
on public.workspace_members
for select
using (public.is_active_workspace_member(workspace_id) or user_id = auth.uid());

drop policy if exists workspace_members_update_owner on public.workspace_members;
create policy workspace_members_update_owner
on public.workspace_members
for update
using (public.has_workspace_role(workspace_id, array['workspace_owner']))
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner'])
  and public.valid_customer_workspace_roles(roles)
);

-- Invites: Workspace Owner and Property Manager match the app's invite action.
-- Roles must be customer roles and scoped property ids must belong to the invite workspace.
drop policy if exists workspace_invites_select_owner_or_email on public.workspace_invites;
create policy workspace_invites_select_owner_or_email
on public.workspace_invites
for select
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  or lower(email) = lower((select auth.email()))
);

drop policy if exists workspace_invites_insert_owner on public.workspace_invites;
create policy workspace_invites_insert_owner
on public.workspace_invites
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  and invited_by = auth.uid()
  and public.valid_customer_workspace_roles(roles)
  and public.invite_assigned_properties_are_scoped(workspace_id, roles, assigned_property_ids)
  and exists (
    select 1
    from public.workspaces workspace
    where workspace.id = workspace_id
      and workspace.company_code = workspace_code
  )
);

drop policy if exists workspace_invites_update_owner_or_accepting_user on public.workspace_invites;
create policy workspace_invites_update_owner_or_accepting_user
on public.workspace_invites
for update
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  or lower(email) = lower((select auth.email()))
)
with check (
  public.valid_customer_workspace_roles(roles)
  and public.invite_assigned_properties_are_scoped(workspace_id, roles, assigned_property_ids)
  and exists (
    select 1
    from public.workspaces workspace
    where workspace.id = workspace_id
      and workspace.company_code = workspace_code
  )
  and (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
    or (
      lower(email) = lower((select auth.email()))
      and status = 'accepted'
      and accepted_by = auth.uid()
    )
  )
);

-- Property records stay workspace-scoped and editable only by Owner/Property Manager.
drop policy if exists properties_insert_manager on public.properties;
create policy properties_insert_manager
on public.properties
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  and created_by = auth.uid()
);

drop policy if exists properties_update_manager on public.properties;
create policy properties_update_manager
on public.properties
for update
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']))
with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));

-- Property assignments can only be managed by Owner/Property Manager and the
-- assigned property/user must belong to the same active workspace.
drop policy if exists property_assignments_select_authorized on public.property_assignments;
create policy property_assignments_select_authorized
on public.property_assignments
for select
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
  or user_id = auth.uid()
);

drop policy if exists property_assignments_manage on public.property_assignments;
create policy property_assignments_manage
on public.property_assignments
for all
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']))
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.user_is_active_workspace_member(workspace_id, user_id)
);

-- Contacts: align with AppContext createOrUpdateContact (Owner/PM/Host). Accountant
-- remains read-only for CRM/contact records.
drop policy if exists contacts_select_authorized on public.contacts;
create policy contacts_select_authorized
on public.contacts
for select
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant']));

drop policy if exists contacts_insert_authorized on public.contacts;
create policy contacts_insert_authorized
on public.contacts
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and created_by = auth.uid()
);

drop policy if exists contacts_update_authorized on public.contacts;
create policy contacts_update_authorized
on public.contacts
for update
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']))
with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']));

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
  if not public.has_workspace_role(p_workspace_id, array['workspace_owner','property_manager','host']) then
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

-- Booking and lease writes must reference properties/contacts in the same workspace.
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
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']))
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_contact_belongs_to_workspace(workspace_id, contact_id)
);

drop policy if exists leases_insert_authorized on public.leases;
create policy leases_insert_authorized
on public.leases
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and created_by = auth.uid()
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_contact_belongs_to_workspace(workspace_id, contact_id)
);

drop policy if exists leases_update_authorized on public.leases;
create policy leases_update_authorized
on public.leases
for update
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']))
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_contact_belongs_to_workspace(workspace_id, contact_id)
);

-- Cleaning tasks: managers/hosts create; cleaners can update only assigned task
-- workflow fields and cannot mutate completed/guest-ready tasks.
drop policy if exists cleaning_insert_manager on public.cleaning_tasks;
create policy cleaning_insert_manager
on public.cleaning_tasks
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and created_by = auth.uid()
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_booking_belongs_to_workspace_property(workspace_id, property_id, booking_id)
);

drop policy if exists cleaning_update_authorized on public.cleaning_tasks;
create policy cleaning_update_authorized
on public.cleaning_tasks
for update
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  or assigned_cleaner_id = auth.uid()
)
with check (
  (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
    or assigned_cleaner_id = auth.uid()
  )
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_booking_belongs_to_workspace_property(workspace_id, property_id, booking_id)
);

-- Maintenance work orders: managers/hosts create; property-assigned users may
-- report issues only for properties they can access. Updates stay workspace-linked.
drop policy if exists maintenance_insert_authorized on public.maintenance_work_orders;
create policy maintenance_insert_authorized
on public.maintenance_work_orders
for insert
with check (
  (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
    or (reported_by_user_id = auth.uid() and public.can_access_property(workspace_id, property_id))
  )
  and created_by = auth.uid()
  and public.property_belongs_to_workspace(workspace_id, property_id)
);

drop policy if exists maintenance_update_authorized on public.maintenance_work_orders;
create policy maintenance_update_authorized
on public.maintenance_work_orders
for update
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  or assigned_maintenance_id = auth.uid()
)
with check (
  (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
    or assigned_maintenance_id = auth.uid()
  )
  and public.property_belongs_to_workspace(workspace_id, property_id)
);

-- Supplies keep existing role shape, with property_id constrained to the workspace.
drop policy if exists supplies_insert_manager on public.supplies;
create policy supplies_insert_manager
on public.supplies
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and created_by = auth.uid()
  and (property_id is null or public.property_belongs_to_workspace(workspace_id, property_id))
);

drop policy if exists supplies_update_manager on public.supplies;
create policy supplies_update_manager
on public.supplies
for update
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and status <> 'archived'
  and archived_at is null
)
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and status <> 'archived'
  and archived_at is null
  and (property_id is null or public.property_belongs_to_workspace(workspace_id, property_id))
);

drop policy if exists supplies_archive_owner_manager on public.supplies;
create policy supplies_archive_owner_manager
on public.supplies
for update
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']))
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  and (property_id is null or public.property_belongs_to_workspace(workspace_id, property_id))
  and (status = 'archived' or archived_at is not null or (status <> 'archived' and archived_at is null))
);

-- File uploads stay private and workspace-scoped. Broad workspace-member file
-- reads are replaced with manager/accountant, uploader, or linked context access.
drop policy if exists file_uploads_select_authorized on public.file_uploads;
create policy file_uploads_select_authorized
on public.file_uploads
for select
using (
  public.file_upload_context_is_scoped(workspace_id, property_id, cleaning_task_id, maintenance_work_order_id, bucket, path)
  and (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
    or uploaded_by = auth.uid()
    or (property_id is not null and public.can_access_property(workspace_id, property_id))
    or exists (
      select 1
      from public.cleaning_tasks ct
      where ct.id = cleaning_task_id
        and ct.workspace_id = workspace_id
        and ct.assigned_cleaner_id = auth.uid()
    )
    or exists (
      select 1
      from public.maintenance_work_orders mw
      where mw.id = maintenance_work_order_id
        and mw.workspace_id = workspace_id
        and (mw.assigned_maintenance_id = auth.uid() or mw.reported_by_user_id = auth.uid())
    )
  )
);

drop policy if exists file_uploads_insert_authorized on public.file_uploads;
create policy file_uploads_insert_authorized
on public.file_uploads
for insert
with check (
  uploaded_by = auth.uid()
  and public.file_upload_context_is_scoped(workspace_id, property_id, cleaning_task_id, maintenance_work_order_id, bucket, path)
  and (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
    or (
      public.has_workspace_role(workspace_id, array['accountant'])
      and category in ('receipt','invoice','property_document')
    )
    or (
      category = 'cleaning_photo'
      and exists (
        select 1
        from public.cleaning_tasks ct
        where ct.id = cleaning_task_id
          and ct.workspace_id = workspace_id
          and ct.assigned_cleaner_id = auth.uid()
      )
    )
    or (
      category in ('maintenance_photo','repair_completion_photo')
      and exists (
        select 1
        from public.maintenance_work_orders mw
        where mw.id = maintenance_work_order_id
          and mw.workspace_id = workspace_id
          and mw.assigned_maintenance_id = auth.uid()
      )
    )
    or (
      category in ('property_document','lease','contract')
      and property_id is not null
      and public.can_access_property(workspace_id, property_id)
    )
  )
);

-- Activity logs: workspace managers/hosts can review workspace logs; lower roles
-- only see rows they authored, preventing broad operational/financial log leakage.
drop policy if exists activity_logs_select_member on public.activity_logs;
create policy activity_logs_select_member
on public.activity_logs
for select
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  or actor_user_id = auth.uid()
);

drop policy if exists activity_logs_insert_member on public.activity_logs;
create policy activity_logs_insert_member
on public.activity_logs
for insert
with check (
  public.is_active_workspace_member(workspace_id)
  and actor_user_id = auth.uid()
);

-- Notifications: recipient access remains direct, workspace managers can manage
-- workspace notifications, and all manager paths remain workspace-scoped.
drop policy if exists notifications_select_recipient_or_manager on public.notifications;
create policy notifications_select_recipient_or_manager
on public.notifications
for select
using (
  recipient_user_id = auth.uid()
  or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
);

drop policy if exists notifications_manage_manager on public.notifications;
create policy notifications_manage_manager
on public.notifications
for all
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']))
with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));

-- Report export create permissions match AppContext's report action. This keeps
-- accountant report/export visibility without granting operational creation.
drop policy if exists "report_exports_insert_authorized" on public.report_exports;
create policy "report_exports_insert_authorized"
on public.report_exports
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant'])
);

-- Storage remains private. Path-level workspace scoping mirrors file_uploads and
-- never adds public object access.
drop policy if exists storage_private_select on storage.objects;
create policy storage_private_select
on storage.objects
for select
using (
  bucket_id = 'propflow-private'
  and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists storage_private_insert on storage.objects;
create policy storage_private_insert
on storage.objects
for insert
with check (
  bucket_id = 'propflow-private'
  and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
  and owner = auth.uid()
);

drop policy if exists storage_private_update on storage.objects;
create policy storage_private_update
on storage.objects
for update
using (
  bucket_id = 'propflow-private'
  and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
  and owner = auth.uid()
)
with check (
  bucket_id = 'propflow-private'
  and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
  and owner = auth.uid()
);

-- -----------------------------------------------------------------------------
-- Lower-role update field guards. RLS decides row access; these triggers prevent
-- assigned cleaners/maintenance users from changing assignment/scope/admin fields.
-- -----------------------------------------------------------------------------
create or replace function public.guard_cleaning_task_lower_role_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_workspace_role(old.workspace_id, array['workspace_owner','property_manager','host']) then
    return new;
  end if;

  if old.assigned_cleaner_id is distinct from auth.uid() then
    raise exception 'You can only update assigned cleaning tasks.' using errcode = '42501';
  end if;

  if old.status in ('completed','guest_ready','cancelled') then
    raise exception 'Completed or closed cleaning tasks require a workspace manager.' using errcode = '42501';
  end if;

  if new.workspace_id is distinct from old.workspace_id
    or new.property_id is distinct from old.property_id
    or new.booking_id is distinct from old.booking_id
    or new.assigned_cleaner_id is distinct from old.assigned_cleaner_id
    or new.scheduled_for is distinct from old.scheduled_for
    or new.created_by is distinct from old.created_by
  then
    raise exception 'Assigned cleaners cannot change task assignment or workspace scope.' using errcode = '42501';
  end if;

  if new.status not in ('scheduled','in_progress','needs_inspection','completed','missed','guest_ready') then
    raise exception 'Unsupported cleaner task status.' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists cleaning_task_lower_role_update_guard on public.cleaning_tasks;
create trigger cleaning_task_lower_role_update_guard
before update on public.cleaning_tasks
for each row
execute function public.guard_cleaning_task_lower_role_update();

create or replace function public.guard_maintenance_lower_role_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_workspace_role(old.workspace_id, array['workspace_owner','property_manager','host']) then
    return new;
  end if;

  if old.assigned_maintenance_id is distinct from auth.uid() then
    raise exception 'You can only update assigned maintenance work orders.' using errcode = '42501';
  end if;

  if old.status in ('completed','cancelled') then
    raise exception 'Completed or closed maintenance work orders require a workspace manager.' using errcode = '42501';
  end if;

  if new.workspace_id is distinct from old.workspace_id
    or new.property_id is distinct from old.property_id
    or new.reported_by_user_id is distinct from old.reported_by_user_id
    or new.assigned_maintenance_id is distinct from old.assigned_maintenance_id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.priority is distinct from old.priority
    or new.estimated_cost is distinct from old.estimated_cost
    or new.due_date is distinct from old.due_date
    or new.created_by is distinct from old.created_by
  then
    raise exception 'Assigned maintenance users cannot change work-order assignment, scope, or manager fields.' using errcode = '42501';
  end if;

  if new.status not in ('reported','assigned','in_progress','waiting_parts','completed','cancelled') then
    raise exception 'Unsupported maintenance status.' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists maintenance_lower_role_update_guard on public.maintenance_work_orders;
create trigger maintenance_lower_role_update_guard
before update on public.maintenance_work_orders
for each row
execute function public.guard_maintenance_lower_role_update();
