-- Private file/photo upload foundation hardening.
-- Reuses the existing public.file_uploads table to avoid duplicate upload metadata tables.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-files',
  'workspace-files',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.file_uploads add column if not exists entity_type text;
alter table public.file_uploads add column if not exists entity_id uuid;
alter table public.file_uploads add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'file_uploads_archive_update_guard'
      and tgrelid = 'public.file_uploads'::regclass
  ) then
    alter table public.file_uploads disable trigger file_uploads_archive_update_guard;
  end if;
end $$;
alter table public.file_uploads drop constraint if exists file_uploads_file_category_check;
alter table public.file_uploads drop constraint if exists file_uploads_entity_type_check;
alter table public.file_uploads drop constraint if exists file_uploads_visibility_check;

update public.file_uploads
set file_category = case file_category
  when 'owner_report' then 'report_file'
  when 'property_document' then 'general_document'
  when 'other' then 'general_document'
  when 'maintenance_video' then 'maintenance_issue_photo'
  when 'cleaning_issue_photo' then 'cleaning_before_photo'
  else file_category
end
where file_category in ('owner_report', 'property_document', 'other', 'maintenance_video', 'cleaning_issue_photo');

update public.file_uploads
set category = file_category
where category is distinct from file_category;

update public.file_uploads
set entity_type = case
    when cleaning_task_id is not null then 'cleaning_task'
    when maintenance_work_order_id is not null then 'maintenance_work_order'
    when expense_id is not null then 'expense'
    when report_id is not null then 'owner_report'
    when booking_id is not null then 'booking'
    when property_id is not null then 'property'
    else 'workspace'
  end,
  entity_id = coalesce(cleaning_task_id, maintenance_work_order_id, expense_id, report_id, booking_id, property_id, workspace_id)
where entity_type is null or entity_id is null;

alter table public.file_uploads add constraint file_uploads_file_category_check check (file_category in (
  'property_photo',
  'cleaning_before_photo',
  'cleaning_after_photo',
  'maintenance_issue_photo',
  'maintenance_completion_photo',
  'receipt',
  'invoice',
  'lease',
  'contract',
  'report_file',
  'general_document'
));

alter table public.file_uploads add constraint file_uploads_entity_type_check check (entity_type is null or entity_type in (
  'property',
  'booking',
  'cleaning_task',
  'maintenance_work_order',
  'owner_report',
  'expense',
  'workspace'
));

alter table public.file_uploads add constraint file_uploads_visibility_check check (visibility = 'private');

create index if not exists file_uploads_entity_idx on public.file_uploads (workspace_id, entity_type, entity_id);
create index if not exists file_uploads_metadata_gin_idx on public.file_uploads using gin (metadata);

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'file_uploads_archive_update_guard'
      and tgrelid = 'public.file_uploads'::regclass
  ) then
    alter table public.file_uploads enable trigger file_uploads_archive_update_guard;
  end if;
end $$;

create or replace function public.storage_object_path_workspace_id(target_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  path_parts text[];
  workspace_text text;
begin
  path_parts := storage.foldername(target_name);
  if coalesce(array_length(path_parts, 1), 0) >= 2 and path_parts[1] in ('workspace', 'workspaces') then
    workspace_text := path_parts[2];
  end if;

  return workspace_text::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.file_context_is_scoped(
  target_workspace_id uuid,
  target_property_id uuid default null,
  target_booking_id uuid default null,
  target_cleaning_task_id uuid default null,
  target_maintenance_work_order_id uuid default null,
  target_expense_id uuid default null,
  target_report_id uuid default null,
  target_contact_id uuid default null,
  target_file_path text default null,
  target_bucket_name text default 'workspace-files'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_workspace_id is not null
    and target_bucket_name = 'workspace-files'
    and (
      target_file_path like 'workspaces/' || target_workspace_id::text || '/%'
      or target_file_path like 'workspace/' || target_workspace_id::text || '/%'
    )
    and (
      target_property_id is null
      or exists (
        select 1 from public.properties p
        where p.id = target_property_id and p.workspace_id = target_workspace_id
      )
    )
    and (
      target_booking_id is null
      or exists (
        select 1 from public.bookings b
        where b.id = target_booking_id
          and b.workspace_id = target_workspace_id
          and (target_property_id is null or b.property_id = target_property_id)
      )
    )
    and (
      target_cleaning_task_id is null
      or exists (
        select 1 from public.cleaning_tasks ct
        where ct.id = target_cleaning_task_id
          and ct.workspace_id = target_workspace_id
          and (target_property_id is null or ct.property_id = target_property_id)
          and (target_booking_id is null or ct.booking_id is null or ct.booking_id = target_booking_id)
      )
    )
    and (
      target_maintenance_work_order_id is null
      or exists (
        select 1 from public.maintenance_work_orders mw
        where mw.id = target_maintenance_work_order_id
          and mw.workspace_id = target_workspace_id
          and (target_property_id is null or mw.property_id = target_property_id)
      )
    )
    and (
      target_expense_id is null
      or exists (
        select 1 from public.expenses e
        where e.id = target_expense_id
          and e.workspace_id = target_workspace_id
          and (target_property_id is null or e.property_id is null or e.property_id = target_property_id)
      )
    )
    and (
      target_report_id is null
      or exists (
        select 1 from public.owner_reports r
        where r.id = target_report_id
          and r.workspace_id = target_workspace_id
          and (target_property_id is null or r.property_id is null or r.property_id = target_property_id)
      )
    )
    and (
      target_contact_id is null
      or exists (
        select 1 from public.contacts c
        where c.id = target_contact_id and c.workspace_id = target_workspace_id
      )
    );
$$;

create or replace function public.can_upload_file_category(
  target_workspace_id uuid,
  target_file_category text,
  target_property_id uuid default null,
  target_cleaning_task_id uuid default null,
  target_maintenance_work_order_id uuid default null,
  target_expense_id uuid default null,
  target_report_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_active_workspace_member(target_workspace_id)
    and target_file_category in (
      'property_photo','cleaning_before_photo','cleaning_after_photo',
      'maintenance_issue_photo','maintenance_completion_photo','receipt','lease',
      'contract','report_file','invoice','general_document'
    )
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
      or (
        target_file_category in ('cleaning_before_photo','cleaning_after_photo')
        and exists (
          select 1 from public.cleaning_tasks ct
          where ct.id = target_cleaning_task_id
            and ct.workspace_id = target_workspace_id
            and ct.property_id = target_property_id
            and ct.assigned_cleaner_id = auth.uid()
            and ct.status not in ('completed','guest_ready','cancelled')
        )
      )
      or (
        target_file_category in ('maintenance_issue_photo','maintenance_completion_photo','receipt')
        and exists (
          select 1 from public.maintenance_work_orders mw
          where mw.id = target_maintenance_work_order_id
            and mw.workspace_id = target_workspace_id
            and mw.property_id = target_property_id
            and mw.assigned_maintenance_id = auth.uid()
            and mw.status not in ('completed','cancelled')
        )
      )
    )
    and (
      target_file_category not in ('cleaning_before_photo','cleaning_after_photo')
      or exists (
        select 1 from public.cleaning_tasks ct
        where ct.id = target_cleaning_task_id
          and ct.workspace_id = target_workspace_id
          and ct.property_id = target_property_id
          and ct.status not in ('completed','guest_ready','cancelled')
      )
    )
    and (
      target_file_category not in ('maintenance_issue_photo','maintenance_completion_photo','receipt')
      or exists (
        select 1 from public.maintenance_work_orders mw
        where mw.id = target_maintenance_work_order_id
          and mw.workspace_id = target_workspace_id
          and mw.property_id = target_property_id
          and mw.status not in ('completed','cancelled')
      )
    )
    and (
      target_file_category <> 'receipt'
      or target_expense_id is not null
      or target_maintenance_work_order_id is not null
      or public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','accountant'])
    )
    and (
      target_file_category <> 'report_file'
      or target_report_id is not null
      or public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','accountant'])
    );
$$;

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
            and public.can_access_property(target_workspace_id, target_property_id)
            and (
              target_file_category <> 'report_file'
              or exists (
                select 1 from public.owner_reports r
                where r.id = target_report_id
                  and r.workspace_id = target_workspace_id
                  and r.status in ('released','published','sent','delivered','completed')
              )
            )
          )
        )
      )
    );
$$;

create or replace function public.can_archive_file_upload(
  target_workspace_id uuid,
  target_uploaded_by uuid,
  target_created_at timestamptz,
  target_file_category text,
  target_cleaning_task_id uuid,
  target_maintenance_work_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager'])
    or (
      public.is_active_workspace_member(target_workspace_id)
      and target_uploaded_by = auth.uid()
      and target_created_at >= now() - interval '30 minutes'
      and (
        (
          target_file_category in ('cleaning_before_photo','cleaning_after_photo')
          and exists (
            select 1 from public.cleaning_tasks ct
            where ct.id = target_cleaning_task_id
              and ct.workspace_id = target_workspace_id
              and ct.assigned_cleaner_id = auth.uid()
              and ct.status not in ('completed','guest_ready','cancelled')
          )
        )
        or (
          target_file_category in ('maintenance_issue_photo','maintenance_completion_photo','receipt')
          and exists (
            select 1 from public.maintenance_work_orders mw
            where mw.id = target_maintenance_work_order_id
              and mw.workspace_id = target_workspace_id
              and mw.assigned_maintenance_id = auth.uid()
              and mw.status not in ('completed','cancelled')
          )
        )
      )
    );
$$;

create or replace function public.guard_file_upload_archive_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id
    or new.workspace_id is distinct from old.workspace_id
    or new.property_id is distinct from old.property_id
    or new.booking_id is distinct from old.booking_id
    or new.cleaning_task_id is distinct from old.cleaning_task_id
    or new.maintenance_work_order_id is distinct from old.maintenance_work_order_id
    or new.expense_id is distinct from old.expense_id
    or new.report_id is distinct from old.report_id
    or new.contact_id is distinct from old.contact_id
    or new.file_category is distinct from old.file_category
    or new.file_name is distinct from old.file_name
    or new.file_path is distinct from old.file_path
    or new.bucket_name is distinct from old.bucket_name
    or new.mime_type is distinct from old.mime_type
    or new.file_size is distinct from old.file_size
    or new.visibility is distinct from old.visibility
    or new.uploaded_by is distinct from old.uploaded_by
    or new.created_at is distinct from old.created_at
    or new.entity_type is distinct from old.entity_type
    or new.entity_id is distinct from old.entity_id
    or new.metadata is distinct from old.metadata then
    raise exception 'Only file archive status and notes can be updated.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Policies are replaced so they use the hardened helper functions above.
drop policy if exists file_uploads_select_authorized on public.file_uploads;
create policy file_uploads_select_authorized
on public.file_uploads
for select
to authenticated
using (
  public.file_context_is_scoped(
    workspace_id, property_id, booking_id, cleaning_task_id, maintenance_work_order_id,
    expense_id, report_id, contact_id, file_path, bucket_name
  )
  and public.can_view_file_upload(
    workspace_id, property_id, booking_id, cleaning_task_id, maintenance_work_order_id,
    expense_id, report_id, contact_id, file_category, visibility, archived_at, uploaded_by
  )
);

drop policy if exists file_uploads_insert_authorized on public.file_uploads;
create policy file_uploads_insert_authorized
on public.file_uploads
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and visibility = 'private'
  and bucket_name = 'workspace-files'
  and public.file_context_is_scoped(
    workspace_id, property_id, booking_id, cleaning_task_id, maintenance_work_order_id,
    expense_id, report_id, contact_id, file_path, bucket_name
  )
  and public.can_upload_file_category(
    workspace_id, file_category, property_id, cleaning_task_id, maintenance_work_order_id,
    expense_id, report_id
  )
);

drop policy if exists file_uploads_update_authorized on public.file_uploads;
create policy file_uploads_update_authorized
on public.file_uploads
for update
to authenticated
using (
  public.can_archive_file_upload(
    workspace_id, uploaded_by, created_at, file_category, cleaning_task_id, maintenance_work_order_id
  )
)
with check (
  public.can_archive_file_upload(
    workspace_id, uploaded_by, created_at, file_category, cleaning_task_id, maintenance_work_order_id
  )
  and visibility = 'private'
  and bucket_name = 'workspace-files'
  and public.file_context_is_scoped(
    workspace_id, property_id, booking_id, cleaning_task_id, maintenance_work_order_id,
    expense_id, report_id, contact_id, file_path, bucket_name
  )
);

drop policy if exists storage_workspace_files_select on storage.objects;
create policy storage_workspace_files_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'workspace-files'
  and exists (
    select 1
    from public.file_uploads f
    where f.bucket_name = 'workspace-files'
      and f.file_path = storage.objects.name
      and public.file_context_is_scoped(
        f.workspace_id, f.property_id, f.booking_id, f.cleaning_task_id, f.maintenance_work_order_id,
        f.expense_id, f.report_id, f.contact_id, f.file_path, f.bucket_name
      )
      and public.can_view_file_upload(
        f.workspace_id, f.property_id, f.booking_id, f.cleaning_task_id,
        f.maintenance_work_order_id, f.expense_id, f.report_id, f.contact_id,
        f.file_category, f.visibility, f.archived_at, f.uploaded_by
      )
  )
);

drop policy if exists storage_workspace_files_insert on storage.objects;
create policy storage_workspace_files_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'workspace-files'
  and owner = auth.uid()
  and public.is_active_workspace_member(public.storage_object_path_workspace_id(name))
  and (storage.foldername(name))[1] = 'workspaces'
);

drop policy if exists storage_workspace_files_update on storage.objects;
create policy storage_workspace_files_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'workspace-files'
  and owner = auth.uid()
  and public.is_active_workspace_member(public.storage_object_path_workspace_id(name))
)
with check (
  bucket_id = 'workspace-files'
  and owner = auth.uid()
  and public.is_active_workspace_member(public.storage_object_path_workspace_id(name))
  and (storage.foldername(name))[1] = 'workspaces'
);


drop policy if exists storage_workspace_files_delete on storage.objects;
create policy storage_workspace_files_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'workspace-files'
  and owner = auth.uid()
  and public.is_active_workspace_member(public.storage_object_path_workspace_id(name))
  and (storage.foldername(name))[1] = 'workspaces'
);
