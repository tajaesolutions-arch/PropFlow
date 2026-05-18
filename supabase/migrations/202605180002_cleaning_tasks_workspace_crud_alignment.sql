-- Cleaning tasks workspace CRUD/RLS alignment
create index if not exists cleaning_tasks_workspace_id_idx on public.cleaning_tasks(workspace_id);
create index if not exists cleaning_tasks_workspace_property_idx on public.cleaning_tasks(workspace_id, property_id);
create index if not exists cleaning_tasks_workspace_related_booking_idx on public.cleaning_tasks(workspace_id, booking_id);
create index if not exists cleaning_tasks_workspace_assigned_cleaner_idx on public.cleaning_tasks(workspace_id, assigned_cleaner_id);
create index if not exists cleaning_tasks_workspace_status_idx on public.cleaning_tasks(workspace_id, status);
create index if not exists cleaning_tasks_workspace_scheduled_for_idx on public.cleaning_tasks(workspace_id, scheduled_for);

alter table public.cleaning_tasks add column if not exists related_booking_id uuid references public.bookings(id) on delete set null;
update public.cleaning_tasks set related_booking_id = booking_id where related_booking_id is null and booking_id is not null;

create or replace function public.cleaning_tasks_select_workspace_scoped(task public.cleaning_tasks)
returns boolean
language sql
stable
as $$
  select public.has_workspace_role(task.workspace_id, array['workspace_owner','property_manager','host'])
    or task.assigned_cleaner_id = auth.uid();
$$;

drop policy if exists cleaning_select_authorized on public.cleaning_tasks;
create policy cleaning_select_authorized on public.cleaning_tasks
for select using (public.cleaning_tasks_select_workspace_scoped(cleaning_tasks));

drop policy if exists cleaning_insert_manager on public.cleaning_tasks;
create policy cleaning_insert_manager on public.cleaning_tasks
for insert with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and public.optional_booking_belongs_to_workspace_property(workspace_id, property_id, booking_id)
  and public.optional_booking_belongs_to_workspace_property(workspace_id, property_id, related_booking_id)
  and public.user_is_active_workspace_member_with_role(workspace_id, assigned_cleaner_id, 'cleaner')
);

drop policy if exists cleaning_update_authorized on public.cleaning_tasks;
create policy cleaning_update_authorized on public.cleaning_tasks
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
  and public.optional_booking_belongs_to_workspace_property(workspace_id, property_id, related_booking_id)
  and public.user_is_active_workspace_member_with_role(workspace_id, assigned_cleaner_id, 'cleaner')
);
