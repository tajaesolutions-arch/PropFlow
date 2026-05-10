-- Files / Documents / Media Uploads foundation
-- Non-destructive alignment for private workspace-scoped Supabase Storage.

-- Canonical private bucket. Supabase hosted projects allow bucket creation from
-- migrations when the storage schema is available; if a self-hosted/runtime
-- environment has not installed Storage yet, create this bucket manually in the
-- Supabase dashboard with Public = false.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-files', 'workspace-files', false, 104857600, null)
on conflict (id) do update
set public = false,
    file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), 104857600);

create table if not exists public.file_uploads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  cleaning_task_id uuid references public.cleaning_tasks(id) on delete set null,
  maintenance_work_order_id uuid references public.maintenance_work_orders(id) on delete set null,
  expense_id uuid references public.expenses(id) on delete set null,
  report_id uuid references public.owner_reports(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  file_category text not null,
  file_name text not null,
  file_path text not null,
  bucket_name text not null default 'workspace-files',
  mime_type text,
  file_size bigint,
  visibility text not null default 'private',
  uploaded_by uuid references public.profiles(id),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.file_uploads add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.file_uploads add column if not exists property_id uuid references public.properties(id) on delete set null;
alter table public.file_uploads add column if not exists booking_id uuid references public.bookings(id) on delete set null;
alter table public.file_uploads add column if not exists cleaning_task_id uuid references public.cleaning_tasks(id) on delete set null;
alter table public.file_uploads add column if not exists maintenance_work_order_id uuid references public.maintenance_work_orders(id) on delete set null;
alter table public.file_uploads add column if not exists expense_id uuid references public.expenses(id) on delete set null;
alter table public.file_uploads add column if not exists report_id uuid references public.owner_reports(id) on delete set null;
alter table public.file_uploads add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.file_uploads add column if not exists file_category text;
alter table public.file_uploads add column if not exists file_name text;
alter table public.file_uploads add column if not exists file_path text;
alter table public.file_uploads add column if not exists bucket_name text not null default 'workspace-files';
alter table public.file_uploads add column if not exists mime_type text;
alter table public.file_uploads add column if not exists file_size bigint;
alter table public.file_uploads add column if not exists visibility text not null default 'private';
alter table public.file_uploads add column if not exists uploaded_by uuid references public.profiles(id);
alter table public.file_uploads add column if not exists notes text;
alter table public.file_uploads add column if not exists archived_at timestamptz;
alter table public.file_uploads add column if not exists created_at timestamptz not null default now();
alter table public.file_uploads add column if not exists updated_at timestamptz not null default now();

-- Legacy compatibility columns from the original upload foundation are retained
-- and mirrored by the app until all environments are migrated.
alter table public.file_uploads add column if not exists bucket text;
alter table public.file_uploads add column if not exists path text;
alter table public.file_uploads add column if not exists file_type text;
alter table public.file_uploads add column if not exists category text;

update public.file_uploads
set file_category = coalesce(
      file_category,
      case category
        when 'cleaning_photo' then 'cleaning_before_photo'
        when 'maintenance_photo' then 'maintenance_issue_photo'
        when 'repair_completion_photo' then 'maintenance_completion_photo'
        else category
      end,
      'other'
    ),
    file_path = coalesce(file_path, path),
    bucket_name = coalesce(nullif(bucket_name, ''), nullif(bucket, ''), 'workspace-files'),
    mime_type = coalesce(mime_type, file_type),
    visibility = coalesce(nullif(visibility, ''), 'private'),
    updated_at = coalesce(updated_at, created_at, now())
where file_category is null
   or file_path is null
   or bucket_name is null
   or mime_type is null
   or visibility is null
   or updated_at is null;

update public.file_uploads
set bucket = coalesce(bucket, bucket_name),
    path = coalesce(path, file_path),
    file_type = coalesce(file_type, mime_type),
    category = coalesce(category, file_category)
where bucket is null or path is null or file_type is null or category is null;

alter table public.file_uploads alter column file_category set not null;
alter table public.file_uploads alter column file_name set not null;
alter table public.file_uploads alter column file_path set not null;
alter table public.file_uploads alter column bucket_name set default 'workspace-files';
alter table public.file_uploads alter column bucket_name set not null;
alter table public.file_uploads alter column visibility set default 'private';
alter table public.file_uploads alter column visibility set not null;

alter table public.file_uploads drop constraint if exists file_uploads_category_check;
alter table public.file_uploads drop constraint if exists file_uploads_file_category_check;
alter table public.file_uploads add constraint file_uploads_file_category_check
  check (file_category in (
    'property_photo',
    'cleaning_before_photo',
    'cleaning_after_photo',
    'cleaning_issue_photo',
    'maintenance_issue_photo',
    'maintenance_completion_photo',
    'maintenance_video',
    'receipt',
    'lease',
    'contract',
    'owner_report',
    'invoice',
    'property_document',
    'general_document',
    'other'
  ));

alter table public.file_uploads drop constraint if exists file_uploads_visibility_check;
alter table public.file_uploads add constraint file_uploads_visibility_check check (visibility = 'private');

create index if not exists file_uploads_workspace_id_idx on public.file_uploads (workspace_id);
create index if not exists file_uploads_property_id_idx on public.file_uploads (property_id);
create index if not exists file_uploads_cleaning_task_id_idx on public.file_uploads (cleaning_task_id);
create index if not exists file_uploads_maintenance_work_order_id_idx on public.file_uploads (maintenance_work_order_id);
create index if not exists file_uploads_expense_id_idx on public.file_uploads (expense_id);
create index if not exists file_uploads_report_id_idx on public.file_uploads (report_id);
create index if not exists file_uploads_contact_id_idx on public.file_uploads (contact_id);
create index if not exists file_uploads_file_category_idx on public.file_uploads (file_category);
create index if not exists file_uploads_uploaded_by_idx on public.file_uploads (uploaded_by);
create index if not exists file_uploads_archived_at_idx on public.file_uploads (archived_at);
create index if not exists file_uploads_created_at_idx on public.file_uploads (created_at desc);

drop trigger if exists file_uploads_updated_at on public.file_uploads;
create trigger file_uploads_updated_at
before update on public.file_uploads
for each row
execute function public.set_updated_at();

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
  if coalesce(array_length(path_parts, 1), 0) >= 2 and path_parts[1] = 'workspace' then
    workspace_text := path_parts[2];
  elsif coalesce(array_length(path_parts, 1), 0) >= 1 then
    workspace_text := path_parts[1];
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
    and target_file_path like 'workspace/' || target_workspace_id::text || '/%'
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
    target_file_category in (
      'property_photo','cleaning_before_photo','cleaning_after_photo','cleaning_issue_photo',
      'maintenance_issue_photo','maintenance_completion_photo','maintenance_video','receipt','lease',
      'contract','owner_report','invoice','property_document','general_document','other'
    )
    and (
      (
        public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager'])
      )
      or (
        public.has_workspace_role(target_workspace_id, array['host'])
        and target_file_category in (
          'property_photo','cleaning_before_photo','cleaning_after_photo','cleaning_issue_photo',
          'maintenance_issue_photo','maintenance_completion_photo','maintenance_video','property_document','other'
        )
      )
      or (
        public.has_workspace_role(target_workspace_id, array['accountant'])
        and target_file_category in ('receipt','invoice','owner_report','property_document')
      )
      or (
        target_file_category in ('cleaning_before_photo','cleaning_after_photo','cleaning_issue_photo')
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
        target_file_category in ('maintenance_issue_photo','maintenance_completion_photo','maintenance_video')
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
      target_file_category not in ('cleaning_before_photo','cleaning_after_photo','cleaning_issue_photo')
      or exists (
        select 1 from public.cleaning_tasks ct
        where ct.id = target_cleaning_task_id
          and ct.workspace_id = target_workspace_id
          and ct.property_id = target_property_id
          and ct.status not in ('completed','guest_ready','cancelled')
      )
    )
    and (
      target_file_category not in ('maintenance_issue_photo','maintenance_completion_photo','maintenance_video')
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
      or public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','accountant'])
    )
    and (
      target_file_category <> 'owner_report'
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
      public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager'])
      or (
        public.has_workspace_role(target_workspace_id, array['host'])
        and target_file_category in (
          'property_photo','cleaning_before_photo','cleaning_after_photo','cleaning_issue_photo',
          'maintenance_issue_photo','maintenance_completion_photo','maintenance_video','property_document','general_document','other'
        )
      )
      or (
        public.has_workspace_role(target_workspace_id, array['accountant'])
        and target_file_category in ('receipt','invoice','owner_report','property_document')
      )
      or target_uploaded_by = auth.uid()
      or (
        target_file_category in ('cleaning_before_photo','cleaning_after_photo','cleaning_issue_photo')
        and exists (
          select 1 from public.cleaning_tasks ct
          where ct.id = target_cleaning_task_id
            and ct.workspace_id = target_workspace_id
            and ct.assigned_cleaner_id = auth.uid()
        )
      )
      or (
        target_file_category in ('maintenance_issue_photo','maintenance_completion_photo','maintenance_video')
        and exists (
          select 1 from public.maintenance_work_orders mw
          where mw.id = target_maintenance_work_order_id
            and mw.workspace_id = target_workspace_id
            and mw.assigned_maintenance_id = auth.uid()
        )
      )
      or (
        target_file_category in ('property_photo','property_document','lease','owner_report')
        and target_property_id is not null
        and public.can_access_property(target_workspace_id, target_property_id)
        and (
          target_file_category <> 'owner_report'
          or exists (
            select 1 from public.owner_reports r
            where r.id = target_report_id
              and r.workspace_id = target_workspace_id
              and r.status in ('released','published','sent','delivered','completed')
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
      target_uploaded_by = auth.uid()
      and target_created_at >= now() - interval '30 minutes'
      and (
        (
          target_file_category in ('cleaning_before_photo','cleaning_after_photo','cleaning_issue_photo')
          and exists (
            select 1 from public.cleaning_tasks ct
            where ct.id = target_cleaning_task_id
              and ct.workspace_id = target_workspace_id
              and ct.assigned_cleaner_id = auth.uid()
              and ct.status not in ('completed','guest_ready','cancelled')
          )
        )
        or (
          target_file_category in ('maintenance_issue_photo','maintenance_completion_photo','maintenance_video')
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
    or new.created_at is distinct from old.created_at then
    raise exception 'Only file archive status and notes can be updated.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists file_uploads_archive_update_guard on public.file_uploads;
create trigger file_uploads_archive_update_guard
before update on public.file_uploads
for each row
execute function public.guard_file_upload_archive_update();

alter table public.file_uploads enable row level security;

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

drop policy if exists storage_private_select on storage.objects;
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
      and public.can_view_file_upload(
        f.workspace_id, f.property_id, f.booking_id, f.cleaning_task_id,
        f.maintenance_work_order_id, f.expense_id, f.report_id, f.contact_id,
        f.file_category, f.visibility, f.archived_at, f.uploaded_by
      )
  )
);

drop policy if exists storage_private_insert on storage.objects;
drop policy if exists storage_workspace_files_insert on storage.objects;
create policy storage_workspace_files_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'workspace-files'
  and owner = auth.uid()
  and public.is_active_workspace_member(public.storage_object_path_workspace_id(name))
  and (storage.foldername(name))[1] = 'workspace'
);

drop policy if exists storage_private_update on storage.objects;
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
  and (storage.foldername(name))[1] = 'workspace'
);
