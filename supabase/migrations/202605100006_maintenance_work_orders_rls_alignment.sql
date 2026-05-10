-- Maintenance work order RLS alignment.
-- Tightens create/update scope without broad true policies or destructive table changes.

create or replace function public.is_active_workspace_member_with_role(
  target_workspace_id uuid,
  target_user_id uuid,
  target_role text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_user_id is not null
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
        and wm.roles @> array[target_role]
    );
$$;

do $$
begin
  alter table public.maintenance_work_orders
    add constraint maintenance_work_orders_estimated_cost_nonnegative
    check (estimated_cost is null or estimated_cost >= 0) not valid;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.maintenance_work_orders
    add constraint maintenance_work_orders_actual_cost_nonnegative
    check (actual_cost is null or actual_cost >= 0) not valid;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.maintenance_work_orders
    add constraint maintenance_work_orders_supported_status
    check (status in ('reported','assigned','in_progress','waiting_parts','completed','cancelled')) not valid;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.maintenance_work_orders
    add constraint maintenance_work_orders_supported_priority
    check (priority in ('low','medium','high','urgent')) not valid;
exception
  when duplicate_object then null;
end $$;

drop policy if exists maintenance_select_authorized on public.maintenance_work_orders;
create policy maintenance_select_authorized
on public.maintenance_work_orders
for select
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  or assigned_maintenance_id = auth.uid()
  or reported_by_user_id = auth.uid()
);

drop policy if exists maintenance_insert_authorized on public.maintenance_work_orders;
create policy maintenance_insert_authorized
on public.maintenance_work_orders
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and created_by = auth.uid()
  and reported_by_user_id = auth.uid()
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and (assigned_maintenance_id is null or public.is_active_workspace_member_with_role(workspace_id, assigned_maintenance_id, 'maintenance'))
  and priority in ('low','medium','high','urgent')
  and status in ('reported','assigned','in_progress','waiting_parts','completed','cancelled')
  and (estimated_cost is null or estimated_cost >= 0)
  and (actual_cost is null or actual_cost >= 0)
);

drop policy if exists maintenance_update_authorized on public.maintenance_work_orders;
create policy maintenance_update_authorized
on public.maintenance_work_orders
for update
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  or (assigned_maintenance_id = auth.uid() and status not in ('completed','cancelled'))
)
with check (
  (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
    or assigned_maintenance_id = auth.uid()
  )
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and (assigned_maintenance_id is null or public.is_active_workspace_member_with_role(workspace_id, assigned_maintenance_id, 'maintenance'))
  and priority in ('low','medium','high','urgent')
  and status in ('reported','assigned','in_progress','waiting_parts','completed','cancelled')
  and (estimated_cost is null or estimated_cost >= 0)
  and (actual_cost is null or actual_cost >= 0)
);

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

  if new.actual_cost is not null and new.actual_cost < 0 then
    raise exception 'Actual cost must be 0 or more.' using errcode = '22023';
  end if;

  return new;
end;
$$;
