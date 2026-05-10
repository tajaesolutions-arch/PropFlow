-- Team / invites / role management hardening.
-- Non-destructive RLS alignment for customer workspace roles, invite acceptance,
-- member lifecycle status changes, and property assignment scoping.

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

create or replace function public.assignment_role_matches_active_member(
  target_workspace_id uuid,
  target_user_id uuid,
  target_assignment_role text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_assignment_role in ('property_owner','cleaner','maintenance','host','accountant')
    and exists (
      select 1
      from public.workspace_members wm
      join public.profiles p on p.id = wm.user_id
      join public.workspaces w on w.id = wm.workspace_id
      where wm.workspace_id = target_workspace_id
        and wm.user_id = target_user_id
        and wm.status = 'active'
        and p.status = 'active'
        and w.status = 'active'
        and wm.roles @> array[target_assignment_role]::text[]
    );
$$;

create or replace function public.active_workspace_owner_count(target_workspace_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.workspace_members wm
  join public.profiles p on p.id = wm.user_id
  join public.workspaces w on w.id = wm.workspace_id
  where wm.workspace_id = target_workspace_id
    and wm.status = 'active'
    and p.status = 'active'
    and w.status = 'active'
    and wm.roles @> array['workspace_owner']::text[];
$$;

create or replace function public.prevent_last_workspace_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'active'
    and old.roles @> array['workspace_owner']::text[]
    and (
      new.status <> 'active'
      or not (new.roles @> array['workspace_owner']::text[])
    )
    and public.active_workspace_owner_count(old.workspace_id) <= 1 then
      raise exception 'Cannot remove, suspend, or revoke the last active Workspace Owner / Company Admin.' using errcode = '23514';
  end if;

  if new.roles && array['propflow_admin']::text[] then
    raise exception 'PropFlow Admin is platform-level only and cannot be assigned as a workspace role.' using errcode = '23514';
  end if;

  if not public.valid_customer_workspace_roles(new.roles) then
    raise exception 'Workspace member roles must be valid customer roles.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_last_workspace_owner_change on public.workspace_members;
create trigger prevent_last_workspace_owner_change
before update on public.workspace_members
for each row execute function public.prevent_last_workspace_owner_change();

create or replace function public.prevent_invalid_property_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.property_belongs_to_workspace(new.workspace_id, new.property_id) then
    raise exception 'Assigned property must belong to the assignment workspace.' using errcode = '23514';
  end if;

  if not public.assignment_role_matches_active_member(new.workspace_id, new.user_id, new.assignment_role) then
    raise exception 'Property assignment role must match an active workspace member role.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_invalid_property_assignment on public.property_assignments;
create trigger prevent_invalid_property_assignment
before insert or update on public.property_assignments
for each row execute function public.prevent_invalid_property_assignment();

-- Workspace member lists are visible only to team managers or the member themself.
drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member
on public.workspace_members
for select
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  or user_id = auth.uid()
);

-- Invites are owner-controlled for creation/revocation; invitees can only read and
-- accept their own pending invite by matching authenticated email.
drop policy if exists workspace_invites_select_owner_or_email on public.workspace_invites;
create policy workspace_invites_select_owner_or_email
on public.workspace_invites
for select
using (
  public.has_workspace_role(workspace_id, array['workspace_owner'])
  or lower(email) = lower((select auth.email()))
);

drop policy if exists workspace_invites_insert_owner on public.workspace_invites;
create policy workspace_invites_insert_owner
on public.workspace_invites
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner'])
  and invited_by = auth.uid()
  and status = 'pending'
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
  public.has_workspace_role(workspace_id, array['workspace_owner'])
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
    public.has_workspace_role(workspace_id, array['workspace_owner'])
    or (
      lower(email) = lower((select auth.email()))
      and status = 'accepted'
      and accepted_by = auth.uid()
      and accepted_at is not null
    )
  )
);

-- Member lifecycle and role updates stay owner-only, customer-role-only, and
-- guarded by the last-owner trigger above.
drop policy if exists workspace_members_update_owner on public.workspace_members;
create policy workspace_members_update_owner
on public.workspace_members
for update
using (public.has_workspace_role(workspace_id, array['workspace_owner']))
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner'])
  and public.valid_customer_workspace_roles(roles)
  and status in ('active','suspended','revoked')
);

-- Property assignments stay workspace-scoped and can only target active members
-- whose actual workspace role matches the assignment role.
drop policy if exists property_assignments_manage on public.property_assignments;
create policy property_assignments_manage
on public.property_assignments
for all
using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']))
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.assignment_role_matches_active_member(workspace_id, user_id, assignment_role)
);
