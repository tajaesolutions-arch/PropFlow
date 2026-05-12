-- Final post-merge production stabilization fixes.
-- Forward-only hardening for direct-booking payment states, owner-report
-- visibility, and private file role scoping after the billing/email/upload/report
-- foundations landed. This migration is non-destructive.

alter table public.direct_booking_requests drop constraint if exists direct_booking_requests_payment_status_check;
alter table public.direct_booking_requests add constraint direct_booking_requests_payment_status_check
  check (payment_status in ('not_required','pending','paid','failed','expired','refunded')) not valid;

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
      and public.has_workspace_role(workspace_id, array['property_owner'])
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
              and pa.assignment_role = 'property_owner'
          )
        )
      )
    )
  )
);

create or replace function public.can_view_file_upload(
  target_workspace_id uuid,
  target_property_id uuid,
  target_booking_id uuid,
  target_cleaning_task_id uuid,
  target_maintenance_work_order_id uuid,
  target_expense_id uuid,
  target_report_id uuid,
  target_contact_id uuid,
  target_file_category text,
  target_visibility text,
  target_archived_at timestamptz,
  target_uploaded_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_visibility = 'private'
    and target_archived_at is null
    and (
      public.is_propflow_admin()
      or (
        public.is_active_workspace_member(target_workspace_id)
        and (
          public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager'])
          or (
            public.has_workspace_role(target_workspace_id, array['host'])
            and target_file_category in (
              'property_photo','cleaning_before_photo','cleaning_after_photo',
              'maintenance_issue_photo','maintenance_completion_photo','general_document'
            )
          )
          or (
            public.has_workspace_role(target_workspace_id, array['accountant'])
            and target_file_category in ('receipt','invoice','report_file','general_document')
          )
          or target_uploaded_by = auth.uid()
          or (
            target_file_category in ('cleaning_before_photo','cleaning_after_photo')
            and exists (
              select 1 from public.cleaning_tasks ct
              where ct.id = target_cleaning_task_id
                and ct.workspace_id = target_workspace_id
                and ct.assigned_cleaner_id = auth.uid()
            )
          )
          or (
            target_file_category in ('maintenance_issue_photo','maintenance_completion_photo','receipt')
            and exists (
              select 1 from public.maintenance_work_orders mw
              where mw.id = target_maintenance_work_order_id
                and mw.workspace_id = target_workspace_id
                and mw.assigned_maintenance_id = auth.uid()
            )
          )
          or (
            target_file_category in ('property_photo','general_document','lease','contract','report_file')
            and target_property_id is not null
            and public.has_workspace_role(target_workspace_id, array['property_owner'])
            and (
              exists (
                select 1 from public.properties p
                where p.id = target_property_id
                  and p.workspace_id = target_workspace_id
                  and p.assigned_owner_id = auth.uid()
              )
              or exists (
                select 1 from public.property_assignments pa
                where pa.workspace_id = target_workspace_id
                  and pa.property_id = target_property_id
                  and pa.user_id = auth.uid()
                  and pa.assignment_role = 'property_owner'
              )
            )
            and (
              target_file_category <> 'report_file'
              or exists (
                select 1 from public.owner_reports r
                where r.id = target_report_id
                  and r.workspace_id = target_workspace_id
                  and r.status in ('ready','released','published','sent','delivered','completed','exported')
              )
            )
          )
        )
      )
    );
$$;

grant execute on function public.can_view_file_upload(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,timestamptz,uuid) to authenticated, service_role;
