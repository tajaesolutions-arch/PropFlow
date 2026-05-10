-- PropFlow cleaning task RLS alignment.
-- Non-destructive hardening for assigned cleaner validation, booking/property
-- linkage, cleaner workflow updates, and private cleaning photo inserts.

create or replace function public.user_is_active_workspace_member_with_role(
  target_workspace_id uuid,
  target_user_id uuid,
  target_role text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_user_id is null
    or exists (
      select 1
      from public.workspace_members wm
      join public.profiles p on p.id = wm.user_id
      join public.workspaces w on w.id = wm.workspace_id
      where wm.workspace_id = target_workspace_id
        and wm.user_id = target_user_id
        and wm.status = 'active'
        and p.status = 'active'
        and w.status = 'active'
        and target_role = any(wm.roles)
    );
$$;

drop policy if exists cleaning_insert_manager on public.cleaning_tasks;
create policy cleaning_insert_manager
on public.cleaning_tasks
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and created_by = auth.uid()
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_booking_belongs_to_workspace_property(workspace_id, property_id, booking_id)
  and public.user_is_active_workspace_member_with_role(workspace_id, assigned_cleaner_id, 'cleaner')
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
  and public.user_is_active_workspace_member_with_role(workspace_id, assigned_cleaner_id, 'cleaner')
);

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
    or new.checklist_items is distinct from old.checklist_items
  then
    raise exception 'Assigned cleaners cannot change task assignment, workspace scope, booking link, schedule, or manager checklist.' using errcode = '42501';
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

drop policy if exists file_uploads_insert_authorized on public.file_uploads;
create policy file_uploads_insert_authorized
on public.file_uploads
for insert
with check (
  uploaded_by = auth.uid()
  and public.file_upload_context_is_scoped(workspace_id, property_id, cleaning_task_id, maintenance_work_order_id, bucket, path)
  and (
    (
      public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
      and (
        category <> 'cleaning_photo'
        or exists (
          select 1
          from public.cleaning_tasks ct
          where ct.id = cleaning_task_id
            and ct.workspace_id = workspace_id
            and ct.property_id = property_id
            and ct.status not in ('completed','guest_ready','cancelled')
        )
      )
    )
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
          and ct.property_id = property_id
          and ct.assigned_cleaner_id = auth.uid()
          and ct.status not in ('completed','guest_ready','cancelled')
      )
    )
    or (
      category in ('maintenance_photo','repair_completion_photo')
      and exists (
        select 1
        from public.maintenance_work_orders mw
        where mw.id = maintenance_work_order_id
          and mw.workspace_id = workspace_id
          and mw.property_id = property_id
          and (mw.assigned_maintenance_id = auth.uid() or mw.reported_by_user_id = auth.uid())
      )
    )
  )
);
