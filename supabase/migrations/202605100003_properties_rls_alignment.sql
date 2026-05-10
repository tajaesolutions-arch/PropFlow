-- Properties RLS alignment patch.
-- Keeps property writes workspace-scoped while preventing assigned_owner_id from
-- referencing a user outside the current workspace or a non-owner workspace role.

create or replace function public.property_assigned_owner_is_workspace_owner_member(
  target_workspace_id uuid,
  target_assigned_owner_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_assigned_owner_id is null
    or exists (
      select 1
      from public.workspace_members wm
      join public.profiles p on p.id = wm.user_id
      join public.workspaces w on w.id = wm.workspace_id
      where wm.workspace_id = target_workspace_id
        and wm.user_id = target_assigned_owner_id
        and wm.status = 'active'
        and p.status = 'active'
        and w.status = 'active'
        and wm.roles @> array['property_owner']::text[]
        and not wm.roles && array['propflow_admin']::text[]
    );
$$;

-- Property records stay workspace-scoped and editable only by Workspace Owner /
-- Property Manager. The assigned owner, when supplied, must be an active
-- property_owner member in the same workspace.
drop policy if exists properties_insert_manager on public.properties;
create policy properties_insert_manager
on public.properties
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
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

-- Keep database currency validation aligned with the shared frontend currency list
-- used by workspace defaults and property-level overrides.
alter table public.workspaces drop constraint if exists workspaces_default_currency_check;
alter table public.workspaces
  add constraint workspaces_default_currency_check
  check (default_currency in ('USD','JMD','CAD','GBP','EUR','AUD','NZD','MXN'));

alter table public.properties drop constraint if exists properties_currency_check;
alter table public.properties
  add constraint properties_currency_check
  check (currency in ('USD','JMD','CAD','GBP','EUR','AUD','NZD','MXN'));
