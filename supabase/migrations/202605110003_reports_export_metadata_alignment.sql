-- PropFlow reports/export metadata alignment.
-- Enhances the existing owner_reports table instead of creating duplicate report metadata tables.
-- Keeps CSV/PDF export local/manual for MVP and does not add scheduled sending or public links.

alter table public.owner_reports add column if not exists generated_by uuid references auth.users(id) on delete set null;
alter table public.owner_reports add column if not exists file_id uuid references public.file_uploads(id) on delete set null;
alter table public.owner_reports add column if not exists summary_data jsonb not null default '{}'::jsonb;
alter table public.owner_reports add column if not exists archived_at timestamptz;

update public.owner_reports
set generated_by = created_by
where generated_by is null
  and created_by is not null;

update public.owner_reports
set report_type = 'owner_report'
where report_type = 'owner_statement';

update public.owner_reports
set report_type = 'property_performance_report'
where report_type = 'property_performance';

alter table public.owner_reports drop constraint if exists owner_reports_report_type_check;
alter table public.owner_reports add constraint owner_reports_report_type_check
  check (report_type in (
    'owner_report',
    'owner_statement',
    'revenue_report',
    'expense_report',
    'maintenance_cost_report',
    'cleaning_cost_report',
    'occupancy_report',
    'property_performance_report',
    'property_performance',
    'booking_summary'
  ));

alter table public.owner_reports drop constraint if exists owner_reports_status_check;
alter table public.owner_reports add constraint owner_reports_status_check
  check (status in (
    'draft',
    'ready',
    'exported',
    'archived',
    'released',
    'published',
    'sent',
    'delivered',
    'completed'
  ));

create index if not exists owner_reports_workspace_type_status_idx
  on public.owner_reports (workspace_id, report_type, status, created_at desc);

create index if not exists owner_reports_file_id_idx
  on public.owner_reports (file_id)
  where file_id is not null;

create or replace function public.optional_owner_report_file_is_private_workspace_file(
  target_workspace_id uuid,
  target_file_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_file_id is null
    or exists (
      select 1
      from public.file_uploads f
      where f.id = target_file_id
        and f.workspace_id = target_workspace_id
        and coalesce(f.visibility, 'private') = 'private'
        and coalesce(f.file_category, f.category) = 'report_file'
        and f.archived_at is null
    );
$$;

grant execute on function public.optional_owner_report_file_is_private_workspace_file(uuid, uuid) to authenticated, service_role;

alter table public.owner_reports enable row level security;

drop policy if exists owner_reports_select_authorized on public.owner_reports;
create policy owner_reports_select_authorized
on public.owner_reports
for select
to authenticated
using (
  public.owner_report_context_is_scoped(workspace_id, property_id, owner_id, contact_id)
  and public.optional_owner_report_file_is_private_workspace_file(workspace_id, file_id)
  and archived_at is null
  and (
    (
      public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
      or (report_type in ('maintenance_cost_report','cleaning_cost_report','occupancy_report','property_performance_report','property_performance') and public.has_workspace_role(workspace_id, array['host']))
      or (report_type in ('owner_report','owner_statement','revenue_report','expense_report','property_performance_report','property_performance') and public.has_workspace_role(workspace_id, array['accountant']))
    )
    or (
      status in ('ready','released','published','sent','delivered','completed','exported')
      and (
        owner_id = auth.uid()
        or (
          property_id is not null
          and exists (
            select 1
            from public.properties p
            where p.id = property_id
              and p.workspace_id = workspace_id
              and p.assigned_owner_id = auth.uid()
          )
        )
        or (
          property_id is not null
          and exists (
            select 1
            from public.property_assignments pa
            where pa.workspace_id = workspace_id
              and pa.property_id = property_id
              and pa.user_id = auth.uid()
          )
        )
      )
    )
  )
);

drop policy if exists owner_reports_insert_authorized on public.owner_reports;
create policy owner_reports_insert_authorized
on public.owner_reports
for insert
to authenticated
with check (
  coalesce(generated_by, created_by) = auth.uid()
  and (
    public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
    or (report_type in ('maintenance_cost_report','cleaning_cost_report','occupancy_report','property_performance_report','property_performance') and public.has_workspace_role(workspace_id, array['host']))
    or (report_type in ('owner_report','owner_statement','revenue_report','expense_report','property_performance_report','property_performance') and public.has_workspace_role(workspace_id, array['accountant']))
  )
  and public.owner_report_context_is_scoped(workspace_id, property_id, owner_id, contact_id)
  and public.optional_owner_report_file_is_private_workspace_file(workspace_id, file_id)
);

drop policy if exists owner_reports_update_authorized on public.owner_reports;
create policy owner_reports_update_authorized
on public.owner_reports
for update
to authenticated
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
)
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
  and public.owner_report_context_is_scoped(workspace_id, property_id, owner_id, contact_id)
  and public.optional_owner_report_file_is_private_workspace_file(workspace_id, file_id)
);
