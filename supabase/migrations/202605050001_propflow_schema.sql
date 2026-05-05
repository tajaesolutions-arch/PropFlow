-- PropFlow Phase 1 database-first SaaS foundation.
-- All customer-owned records include workspace_id and RLS denies suspended users.
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text unique,
  is_propflow_admin boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text,
  country text not null default 'United States',
  default_currency text not null default 'USD' check (default_currency in ('USD','JMD','CAD','GBP','EUR')),
  business_email text,
  phone text,
  website text,
  property_count_estimate integer,
  plan_placeholder text,
  company_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  status text not null default 'active' check (status in ('active','suspended')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  roles text[] not null default '{}',
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id),
  check (not roles && array['propflow_admin'])
);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  roles text[] not null default '{}',
  assigned_property_ids uuid[] not null default '{}',
  token text not null unique,
  workspace_code text not null,
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  expires_at timestamptz,
  invited_by uuid references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not roles && array['propflow_admin'])
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  address text not null,
  city text,
  state text,
  country text not null,
  property_type text not null check (property_type in ('short_term_rental','long_term_rental','villa','apartment','house','condo','guesthouse','hotel_small_resort','commercial_property','model_unit')),
  rental_type text not null check (rental_type in ('short_term','long_term','both')),
  currency text not null default 'USD' check (currency in ('USD','JMD','CAD','GBP','EUR')),
  nightly_rate numeric(12,2),
  monthly_rent numeric(12,2),
  status text not null default 'active' check (status in ('active','vacant','occupied','maintenance_issue','archived')),
  assigned_owner_id uuid references public.profiles(id),
  bedrooms numeric,
  bathrooms numeric,
  square_feet numeric,
  notes text,
  archived_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_role text not null check (assignment_role in ('property_owner','cleaner','maintenance','host','accountant')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (property_id, user_id, assignment_role)
);

create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid,
  assigned_cleaner_id uuid references public.profiles(id),
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','missed','needs_inspection','guest_ready')),
  checklist_items jsonb not null default '[]'::jsonb,
  cleaner_notes text,
  supplies_used text,
  low_supplies_reported boolean not null default false,
  issue_reported boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maintenance_work_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  reported_by_user_id uuid references public.profiles(id),
  assigned_maintenance_id uuid references public.profiles(id),
  title text not null,
  description text not null,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'reported' check (status in ('reported','assigned','in_progress','waiting_parts','completed','cancelled')),
  estimated_cost numeric(12,2),
  actual_cost numeric(12,2),
  parts_needed text,
  due_date date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.file_uploads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  cleaning_task_id uuid references public.cleaning_tasks(id) on delete cascade,
  maintenance_work_order_id uuid references public.maintenance_work_orders(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  bucket text not null default 'propflow-private',
  path text not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  category text not null check (category in ('property_photo','property_document','lease','contract','receipt','invoice','cleaning_photo','maintenance_photo','repair_completion_photo')),
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id),
  type text not null,
  message text not null,
  status text not null default 'unread' check (status in ('unread','read','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workspace_members_user_idx on public.workspace_members (user_id);
create index workspace_members_roles_idx on public.workspace_members using gin (roles);
create index properties_workspace_status_idx on public.properties (workspace_id, status);
create index property_assignments_user_idx on public.property_assignments (workspace_id, user_id, assignment_role);
create index cleaning_tasks_workspace_idx on public.cleaning_tasks (workspace_id, scheduled_for, status);
create index cleaning_tasks_assignment_idx on public.cleaning_tasks (workspace_id, assigned_cleaner_id);
create index maintenance_workspace_idx on public.maintenance_work_orders (workspace_id, status, priority);
create index maintenance_assignment_idx on public.maintenance_work_orders (workspace_id, assigned_maintenance_id);
create index file_uploads_workspace_idx on public.file_uploads (workspace_id, category);
create index activity_logs_workspace_idx on public.activity_logs (workspace_id, created_at desc);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger workspace_members_updated_at before update on public.workspace_members for each row execute function public.set_updated_at();
create trigger workspace_invites_updated_at before update on public.workspace_invites for each row execute function public.set_updated_at();
create trigger properties_updated_at before update on public.properties for each row execute function public.set_updated_at();
create trigger cleaning_tasks_updated_at before update on public.cleaning_tasks for each row execute function public.set_updated_at();
create trigger maintenance_work_orders_updated_at before update on public.maintenance_work_orders for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user_profile();

create or replace function public.is_propflow_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_propflow_admin = true and status = 'active');
$$;

create or replace function public.is_active_workspace_member(target_workspace_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members wm
    join public.profiles p on p.id = wm.user_id
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id and wm.user_id = auth.uid()
      and wm.status = 'active' and p.status = 'active' and w.status = 'active'
  ) or public.is_propflow_admin();
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean language sql security definer set search_path = public as $$
  select public.is_propflow_admin() or exists (
    select 1 from public.workspace_members wm join public.profiles p on p.id = wm.user_id
    where wm.workspace_id = target_workspace_id and wm.user_id = auth.uid() and wm.status = 'active' and p.status = 'active' and wm.roles && allowed_roles
  );
$$;

create or replace function public.can_access_property(target_workspace_id uuid, target_property_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host','accountant'])
  or exists (select 1 from public.property_assignments pa where pa.workspace_id = target_workspace_id and pa.property_id = target_property_id and pa.user_id = auth.uid())
  or exists (select 1 from public.cleaning_tasks ct where ct.workspace_id = target_workspace_id and ct.property_id = target_property_id and ct.assigned_cleaner_id = auth.uid())
  or exists (select 1 from public.maintenance_work_orders mw where mw.workspace_id = target_workspace_id and mw.property_id = target_property_id and mw.assigned_maintenance_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.properties enable row level security;
alter table public.property_assignments enable row level security;
alter table public.cleaning_tasks enable row level security;
alter table public.maintenance_work_orders enable row level security;
alter table public.file_uploads enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select_own_or_admin on public.profiles for select using (id = auth.uid() or public.is_propflow_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and is_propflow_admin = false);
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid() and is_propflow_admin = false);

create policy workspaces_select_member on public.workspaces for select using (public.is_active_workspace_member(id));
create policy workspaces_insert_authenticated on public.workspaces for insert with check (auth.uid() is not null and status = 'active');
create policy workspaces_update_owner_manager on public.workspaces for update using (public.has_workspace_role(id, array['workspace_owner'])) with check (public.has_workspace_role(id, array['workspace_owner']));

create policy workspace_members_select_member on public.workspace_members for select using (public.is_active_workspace_member(workspace_id) or user_id = auth.uid());
create policy workspace_members_insert_owner_or_self_invite on public.workspace_members for insert with check (public.has_workspace_role(workspace_id, array['workspace_owner']) or user_id = auth.uid());
create policy workspace_members_update_owner on public.workspace_members for update using (public.has_workspace_role(workspace_id, array['workspace_owner'])) with check (public.has_workspace_role(workspace_id, array['workspace_owner']));

create policy workspace_invites_select_owner_or_email on public.workspace_invites for select using (public.has_workspace_role(workspace_id, array['workspace_owner']) or lower(email) = lower((select auth.email())));
create policy workspace_invites_insert_owner on public.workspace_invites for insert with check (public.has_workspace_role(workspace_id, array['workspace_owner']) and not roles && array['propflow_admin']);
create policy workspace_invites_update_owner_or_accepting_user on public.workspace_invites for update using (public.has_workspace_role(workspace_id, array['workspace_owner']) or lower(email) = lower((select auth.email()))) with check (not roles && array['propflow_admin']);

create policy properties_select_authorized on public.properties for select using (public.can_access_property(workspace_id, id));
create policy properties_insert_manager on public.properties for insert with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));
create policy properties_update_manager on public.properties for update using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])) with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));

create policy property_assignments_member_access on public.property_assignments for select using (public.is_active_workspace_member(workspace_id));
create policy property_assignments_manage on public.property_assignments for all using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])) with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));

create policy cleaning_select_authorized on public.cleaning_tasks for select using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_cleaner_id = auth.uid());
create policy cleaning_insert_manager on public.cleaning_tasks for insert with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']));
create policy cleaning_update_authorized on public.cleaning_tasks for update using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_cleaner_id = auth.uid()) with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_cleaner_id = auth.uid());

create policy maintenance_select_authorized on public.maintenance_work_orders for select using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_maintenance_id = auth.uid() or reported_by_user_id = auth.uid() or public.can_access_property(workspace_id, property_id));
create policy maintenance_insert_authorized on public.maintenance_work_orders for insert with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or public.can_access_property(workspace_id, property_id));
create policy maintenance_update_authorized on public.maintenance_work_orders for update using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_maintenance_id = auth.uid()) with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_maintenance_id = auth.uid());

create policy file_uploads_select_authorized on public.file_uploads for select using (public.is_active_workspace_member(workspace_id));
create policy file_uploads_insert_authorized on public.file_uploads for insert with check (public.is_active_workspace_member(workspace_id) and uploaded_by = auth.uid());

create policy activity_logs_select_member on public.activity_logs for select using (public.is_active_workspace_member(workspace_id));
create policy activity_logs_insert_member on public.activity_logs for insert with check (public.is_active_workspace_member(workspace_id) and actor_user_id = auth.uid());

create policy notifications_select_recipient_or_manager on public.notifications for select using (recipient_user_id = auth.uid() or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));
create policy notifications_manage_manager on public.notifications for all using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])) with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('propflow-private', 'propflow-private', false, 52428800, null)
on conflict (id) do update set public = false;

create policy storage_private_select on storage.objects for select using (
  bucket_id = 'propflow-private' and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
);
create policy storage_private_insert on storage.objects for insert with check (
  bucket_id = 'propflow-private' and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
);
create policy storage_private_update on storage.objects for update using (
  bucket_id = 'propflow-private' and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id = 'propflow-private' and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
);
