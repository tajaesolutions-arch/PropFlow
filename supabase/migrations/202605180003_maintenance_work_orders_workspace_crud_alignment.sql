-- Maintenance work orders workspace CRUD alignment.

create index if not exists idx_maintenance_work_orders_workspace_id on public.maintenance_work_orders (workspace_id);
create index if not exists idx_maintenance_work_orders_property_id on public.maintenance_work_orders (property_id);
create index if not exists idx_maintenance_work_orders_assigned_maintenance_id on public.maintenance_work_orders (assigned_maintenance_id);
create index if not exists idx_maintenance_work_orders_priority on public.maintenance_work_orders (priority);
create index if not exists idx_maintenance_work_orders_status on public.maintenance_work_orders (status);
create index if not exists idx_maintenance_work_orders_due_date on public.maintenance_work_orders (due_date);

drop policy if exists maintenance_select_authorized on public.maintenance_work_orders;
create policy maintenance_work_orders_select_workspace_scoped
on public.maintenance_work_orders
for select
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  or assigned_maintenance_id = auth.uid()
  or (
    public.has_workspace_role(workspace_id, array['owner'])
    and exists (
      select 1 from public.properties p
      where p.id = maintenance_work_orders.property_id
        and p.workspace_id = maintenance_work_orders.workspace_id
        and p.assigned_owner_id = auth.uid()
    )
  )
);

drop policy if exists maintenance_insert_authorized on public.maintenance_work_orders;
create policy maintenance_work_orders_insert_workspace_scoped
on public.maintenance_work_orders
for insert
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and public.property_belongs_to_workspace(workspace_id, property_id)
);

drop policy if exists maintenance_update_authorized on public.maintenance_work_orders;
create policy maintenance_work_orders_update_workspace_scoped
on public.maintenance_work_orders
for update
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  or assigned_maintenance_id = auth.uid()
)
with check (
  public.property_belongs_to_workspace(workspace_id, property_id)
  and (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
    or assigned_maintenance_id = auth.uid()
  )
);
