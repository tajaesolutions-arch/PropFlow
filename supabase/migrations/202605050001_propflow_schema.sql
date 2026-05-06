-- PropFlow Phase 1 database-first SaaS foundation.
-- Safe for Supabase SQL Editor: this migration is idempotent, avoids table drops,
-- creates tables before RLS policies/indexes/storage, and can be re-run on a project.
-- Required Phase 1 app tables:
--   profiles, workspaces, workspace_members, workspace_invites, properties,
--   property_assignments, cleaning_tasks, maintenance_work_orders,
--   file_uploads, activity_logs, notifications.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables first. These use CREATE TABLE IF NOT EXISTS so applying this file in the
-- Supabase SQL Editor does not fail when the Phase 1 migration was already run.
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text unique,
  is_propflow_admin boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
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

create table if not exists public.workspace_members (
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

create table if not exists public.workspace_invites (
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

create table if not exists public.properties (
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

create table if not exists public.property_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_role text not null check (assignment_role in ('property_owner','cleaner','maintenance','host','accountant')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (property_id, user_id, assignment_role)
);

create table if not exists public.cleaning_tasks (
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

create table if not exists public.maintenance_work_orders (
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

create table if not exists public.file_uploads (
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

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id),
  type text not null,
  message text not null,
  status text not null default 'unread' check (status in ('unread','read','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Repair incomplete Phase 1 attempts by adding any app-required columns that are
-- absent. These statements are non-destructive and do not overwrite data.
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists email text unique;
alter table public.profiles add column if not exists is_propflow_admin boolean not null default false;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.workspaces add column if not exists name text;
alter table public.workspaces add column if not exists business_type text;
alter table public.workspaces add column if not exists country text not null default 'United States';
alter table public.workspaces add column if not exists default_currency text not null default 'USD';
alter table public.workspaces add column if not exists business_email text;
alter table public.workspaces add column if not exists phone text;
alter table public.workspaces add column if not exists website text;
alter table public.workspaces add column if not exists property_count_estimate integer;
alter table public.workspaces add column if not exists plan_placeholder text;
alter table public.workspaces add column if not exists company_code text not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
alter table public.workspaces add column if not exists status text not null default 'active';
alter table public.workspaces add column if not exists created_by uuid references public.profiles(id);
alter table public.workspaces add column if not exists created_at timestamptz not null default now();
alter table public.workspaces add column if not exists updated_at timestamptz not null default now();
create unique index if not exists workspaces_company_code_key on public.workspaces (company_code);

alter table public.workspace_members add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.workspace_members add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.workspace_members add column if not exists roles text[] not null default '{}';
alter table public.workspace_members add column if not exists status text not null default 'active';
alter table public.workspace_members add column if not exists invited_by uuid references public.profiles(id);
alter table public.workspace_members add column if not exists created_at timestamptz not null default now();
alter table public.workspace_members add column if not exists updated_at timestamptz not null default now();
create unique index if not exists workspace_members_workspace_user_key on public.workspace_members (workspace_id, user_id);

alter table public.workspace_invites add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.workspace_invites add column if not exists email text;
alter table public.workspace_invites add column if not exists roles text[] not null default '{}';
alter table public.workspace_invites add column if not exists assigned_property_ids uuid[] not null default '{}';
alter table public.workspace_invites add column if not exists token text;
alter table public.workspace_invites add column if not exists workspace_code text;
alter table public.workspace_invites add column if not exists message text;
alter table public.workspace_invites add column if not exists status text not null default 'pending';
alter table public.workspace_invites add column if not exists expires_at timestamptz;
alter table public.workspace_invites add column if not exists invited_by uuid references public.profiles(id);
alter table public.workspace_invites add column if not exists accepted_by uuid references public.profiles(id);
alter table public.workspace_invites add column if not exists accepted_at timestamptz;
alter table public.workspace_invites add column if not exists created_at timestamptz not null default now();
alter table public.workspace_invites add column if not exists updated_at timestamptz not null default now();
create unique index if not exists workspace_invites_token_key on public.workspace_invites (token);

alter table public.properties add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.properties add column if not exists name text;
alter table public.properties add column if not exists address text;
alter table public.properties add column if not exists city text;
alter table public.properties add column if not exists state text;
alter table public.properties add column if not exists country text;
alter table public.properties add column if not exists property_type text;
alter table public.properties add column if not exists rental_type text;
alter table public.properties add column if not exists currency text not null default 'USD';
alter table public.properties add column if not exists nightly_rate numeric(12,2);
alter table public.properties add column if not exists monthly_rent numeric(12,2);
alter table public.properties add column if not exists status text not null default 'active';
alter table public.properties add column if not exists assigned_owner_id uuid references public.profiles(id);
alter table public.properties add column if not exists bedrooms numeric;
alter table public.properties add column if not exists bathrooms numeric;
alter table public.properties add column if not exists square_feet numeric;
alter table public.properties add column if not exists notes text;
alter table public.properties add column if not exists archived_at timestamptz;
alter table public.properties add column if not exists created_by uuid references public.profiles(id);
alter table public.properties add column if not exists created_at timestamptz not null default now();
alter table public.properties add column if not exists updated_at timestamptz not null default now();

alter table public.property_assignments add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.property_assignments add column if not exists property_id uuid references public.properties(id) on delete cascade;
alter table public.property_assignments add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.property_assignments add column if not exists assignment_role text;
alter table public.property_assignments add column if not exists created_by uuid references public.profiles(id);
alter table public.property_assignments add column if not exists created_at timestamptz not null default now();
create unique index if not exists property_assignments_property_user_role_key on public.property_assignments (property_id, user_id, assignment_role);

alter table public.cleaning_tasks add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.cleaning_tasks add column if not exists property_id uuid references public.properties(id) on delete cascade;
alter table public.cleaning_tasks add column if not exists booking_id uuid;
alter table public.cleaning_tasks add column if not exists assigned_cleaner_id uuid references public.profiles(id);
alter table public.cleaning_tasks add column if not exists scheduled_for timestamptz;
alter table public.cleaning_tasks add column if not exists status text not null default 'scheduled';
alter table public.cleaning_tasks add column if not exists checklist_items jsonb not null default '[]'::jsonb;
alter table public.cleaning_tasks add column if not exists cleaner_notes text;
alter table public.cleaning_tasks add column if not exists supplies_used text;
alter table public.cleaning_tasks add column if not exists low_supplies_reported boolean not null default false;
alter table public.cleaning_tasks add column if not exists issue_reported boolean not null default false;
alter table public.cleaning_tasks add column if not exists started_at timestamptz;
alter table public.cleaning_tasks add column if not exists completed_at timestamptz;
alter table public.cleaning_tasks add column if not exists created_by uuid references public.profiles(id);
alter table public.cleaning_tasks add column if not exists created_at timestamptz not null default now();
alter table public.cleaning_tasks add column if not exists updated_at timestamptz not null default now();

alter table public.maintenance_work_orders add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.maintenance_work_orders add column if not exists property_id uuid references public.properties(id) on delete cascade;
alter table public.maintenance_work_orders add column if not exists reported_by_user_id uuid references public.profiles(id);
alter table public.maintenance_work_orders add column if not exists assigned_maintenance_id uuid references public.profiles(id);
alter table public.maintenance_work_orders add column if not exists title text;
alter table public.maintenance_work_orders add column if not exists description text;
alter table public.maintenance_work_orders add column if not exists priority text not null default 'medium';
alter table public.maintenance_work_orders add column if not exists status text not null default 'reported';
alter table public.maintenance_work_orders add column if not exists estimated_cost numeric(12,2);
alter table public.maintenance_work_orders add column if not exists actual_cost numeric(12,2);
alter table public.maintenance_work_orders add column if not exists parts_needed text;
alter table public.maintenance_work_orders add column if not exists due_date date;
alter table public.maintenance_work_orders add column if not exists notes text;
alter table public.maintenance_work_orders add column if not exists created_by uuid references public.profiles(id);
alter table public.maintenance_work_orders add column if not exists created_at timestamptz not null default now();
alter table public.maintenance_work_orders add column if not exists updated_at timestamptz not null default now();
alter table public.maintenance_work_orders add column if not exists completed_at timestamptz;

alter table public.file_uploads add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.file_uploads add column if not exists property_id uuid references public.properties(id) on delete cascade;
alter table public.file_uploads add column if not exists cleaning_task_id uuid references public.cleaning_tasks(id) on delete cascade;
alter table public.file_uploads add column if not exists maintenance_work_order_id uuid references public.maintenance_work_orders(id) on delete cascade;
alter table public.file_uploads add column if not exists uploaded_by uuid references public.profiles(id);
alter table public.file_uploads add column if not exists bucket text not null default 'propflow-private';
alter table public.file_uploads add column if not exists path text;
alter table public.file_uploads add column if not exists file_name text;
alter table public.file_uploads add column if not exists file_type text;
alter table public.file_uploads add column if not exists file_size bigint;
alter table public.file_uploads add column if not exists category text;
alter table public.file_uploads add column if not exists created_at timestamptz not null default now();

alter table public.activity_logs add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.activity_logs add column if not exists actor_user_id uuid references public.profiles(id);
alter table public.activity_logs add column if not exists action text;
alter table public.activity_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.activity_logs add column if not exists created_at timestamptz not null default now();

alter table public.notifications add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.notifications add column if not exists recipient_user_id uuid references public.profiles(id);
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists status text not null default 'unread';
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists created_at timestamptz not null default now();

-- -----------------------------------------------------------------------------
-- Triggers and helper functions after tables exist.
-- -----------------------------------------------------------------------------

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists workspaces_updated_at on public.workspaces;
create trigger workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();

drop trigger if exists workspace_members_updated_at on public.workspace_members;
create trigger workspace_members_updated_at before update on public.workspace_members for each row execute function public.set_updated_at();

drop trigger if exists workspace_invites_updated_at on public.workspace_invites;
create trigger workspace_invites_updated_at before update on public.workspace_invites for each row execute function public.set_updated_at();

drop trigger if exists properties_updated_at on public.properties;
create trigger properties_updated_at before update on public.properties for each row execute function public.set_updated_at();

drop trigger if exists cleaning_tasks_updated_at on public.cleaning_tasks;
create trigger cleaning_tasks_updated_at before update on public.cleaning_tasks for each row execute function public.set_updated_at();

drop trigger if exists maintenance_work_orders_updated_at on public.maintenance_work_orders;
create trigger maintenance_work_orders_updated_at before update on public.maintenance_work_orders for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'PropFlow user'))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user_profile();

create or replace function public.assign_invited_properties()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
  property_id uuid;
  assignment text;
begin
  select wi.* into invite
  from public.workspace_invites wi
  join public.profiles p on lower(p.email) = lower(wi.email)
  where wi.workspace_id = new.workspace_id
    and p.id = new.user_id
    and wi.status = 'pending'
    and (wi.expires_at is null or wi.expires_at > now())
  order by wi.created_at desc
  limit 1;

  if invite.id is null or invite.assigned_property_ids is null then
    return new;
  end if;

  foreach property_id in array invite.assigned_property_ids loop
    foreach assignment in array new.roles loop
      if assignment in ('property_owner','cleaner','maintenance','host','accountant') then
        insert into public.property_assignments (workspace_id, property_id, user_id, assignment_role, created_by)
        values (new.workspace_id, property_id, new.user_id, assignment, invite.invited_by)
        on conflict (property_id, user_id, assignment_role) do nothing;
      end if;
    end loop;
  end loop;

  return new;
end;
$$;

drop trigger if exists workspace_member_assign_invited_properties on public.workspace_members;
create trigger workspace_member_assign_invited_properties after insert on public.workspace_members for each row execute function public.assign_invited_properties();

create or replace function public.is_propflow_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_propflow_admin = true and status = 'active');
$$;

create or replace function public.is_active_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.profiles p on p.id = wm.user_id
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and p.status = 'active'
      and w.status = 'active'
  ) or public.is_propflow_admin();
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_propflow_admin() or exists (
    select 1
    from public.workspace_members wm
    join public.profiles p on p.id = wm.user_id
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and p.status = 'active'
      and w.status = 'active'
      and wm.roles && allowed_roles
  );
$$;

create or replace function public.can_view_profile(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_profile_id = auth.uid()
  or public.is_propflow_admin()
  or exists (
    select 1
    from public.workspace_members viewer
    join public.workspace_members target on target.workspace_id = viewer.workspace_id
    join public.profiles viewer_profile on viewer_profile.id = viewer.user_id
    join public.profiles target_profile on target_profile.id = target.user_id
    join public.workspaces workspace on workspace.id = viewer.workspace_id
    where viewer.user_id = auth.uid()
      and target.user_id = target_profile_id
      and viewer.status = 'active'
      and target.status = 'active'
      and viewer_profile.status = 'active'
      and target_profile.status = 'active'
      and workspace.status = 'active'
  );
$$;

create or replace function public.can_accept_workspace_member(target_workspace_id uuid, target_user_id uuid, target_roles text[], target_status text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select target_user_id = auth.uid()
    and target_status = 'active'
    and not target_roles && array['propflow_admin']
    and (
      (
        target_roles @> array['workspace_owner']
        and array['workspace_owner'] @> target_roles
        and exists (select 1 from public.workspaces workspace where workspace.id = target_workspace_id and workspace.created_by = auth.uid())
        and not exists (select 1 from public.workspace_members existing where existing.workspace_id = target_workspace_id)
      )
      or exists (
        select 1
        from public.workspace_invites invite
        where invite.workspace_id = target_workspace_id
          and lower(invite.email) = lower((select auth.email()))
          and invite.status = 'pending'
          and (invite.expires_at is null or invite.expires_at > now())
          and invite.roles @> target_roles
          and target_roles @> invite.roles
          and not invite.roles && array['propflow_admin']
      )
    );
$$;

create or replace function public.can_access_property(target_workspace_id uuid, target_property_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host','accountant'])
  or exists (select 1 from public.properties p where p.workspace_id = target_workspace_id and p.id = target_property_id and p.assigned_owner_id = auth.uid())
  or exists (select 1 from public.property_assignments pa where pa.workspace_id = target_workspace_id and pa.property_id = target_property_id and pa.user_id = auth.uid())
  or exists (select 1 from public.cleaning_tasks ct where ct.workspace_id = target_workspace_id and ct.property_id = target_property_id and ct.assigned_cleaner_id = auth.uid())
  or exists (select 1 from public.maintenance_work_orders mw where mw.workspace_id = target_workspace_id and mw.property_id = target_property_id and mw.assigned_maintenance_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- RLS after tables/functions exist.
-- -----------------------------------------------------------------------------

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

drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized on public.profiles for select using (public.can_view_profile(id));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and is_propflow_admin = false);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid() and is_propflow_admin = false);

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces for select using (public.is_active_workspace_member(id));
drop policy if exists workspaces_insert_authenticated on public.workspaces;
create policy workspaces_insert_authenticated on public.workspaces for insert with check (auth.uid() is not null and status = 'active');
drop policy if exists workspaces_update_owner_manager on public.workspaces;
create policy workspaces_update_owner_manager on public.workspaces for update using (public.has_workspace_role(id, array['workspace_owner'])) with check (public.has_workspace_role(id, array['workspace_owner']));

drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member on public.workspace_members for select using (public.is_active_workspace_member(workspace_id) or user_id = auth.uid());
drop policy if exists workspace_members_insert_owner_or_valid_invite on public.workspace_members;
create policy workspace_members_insert_owner_or_valid_invite on public.workspace_members for insert with check (public.has_workspace_role(workspace_id, array['workspace_owner']) or public.can_accept_workspace_member(workspace_id, user_id, roles, status));
drop policy if exists workspace_members_update_owner on public.workspace_members;
create policy workspace_members_update_owner on public.workspace_members for update using (public.has_workspace_role(workspace_id, array['workspace_owner'])) with check (public.has_workspace_role(workspace_id, array['workspace_owner']) and not roles && array['propflow_admin']);

drop policy if exists workspace_invites_select_owner_or_email on public.workspace_invites;
create policy workspace_invites_select_owner_or_email on public.workspace_invites for select using (public.has_workspace_role(workspace_id, array['workspace_owner']) or lower(email) = lower((select auth.email())));
drop policy if exists workspace_invites_insert_owner on public.workspace_invites;
create policy workspace_invites_insert_owner on public.workspace_invites for insert with check (public.has_workspace_role(workspace_id, array['workspace_owner']) and not roles && array['propflow_admin']);
drop policy if exists workspace_invites_update_owner_or_accepting_user on public.workspace_invites;
create policy workspace_invites_update_owner_or_accepting_user on public.workspace_invites for update using (public.has_workspace_role(workspace_id, array['workspace_owner']) or lower(email) = lower((select auth.email()))) with check (not roles && array['propflow_admin']);

drop policy if exists properties_select_authorized on public.properties;
create policy properties_select_authorized on public.properties for select using (public.can_access_property(workspace_id, id));
drop policy if exists properties_insert_manager on public.properties;
create policy properties_insert_manager on public.properties for insert with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));
drop policy if exists properties_update_manager on public.properties;
create policy properties_update_manager on public.properties for update using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])) with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));

drop policy if exists property_assignments_select_authorized on public.property_assignments;
create policy property_assignments_select_authorized on public.property_assignments for select using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host','accountant']) or user_id = auth.uid());
drop policy if exists property_assignments_manage on public.property_assignments;
create policy property_assignments_manage on public.property_assignments for all using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])) with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));

drop policy if exists cleaning_select_authorized on public.cleaning_tasks;
create policy cleaning_select_authorized on public.cleaning_tasks for select using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_cleaner_id = auth.uid());
drop policy if exists cleaning_insert_manager on public.cleaning_tasks;
create policy cleaning_insert_manager on public.cleaning_tasks for insert with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']));
drop policy if exists cleaning_update_authorized on public.cleaning_tasks;
create policy cleaning_update_authorized on public.cleaning_tasks for update using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_cleaner_id = auth.uid()) with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_cleaner_id = auth.uid());

drop policy if exists maintenance_select_authorized on public.maintenance_work_orders;
create policy maintenance_select_authorized on public.maintenance_work_orders for select using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_maintenance_id = auth.uid() or reported_by_user_id = auth.uid() or public.can_access_property(workspace_id, property_id));
drop policy if exists maintenance_insert_authorized on public.maintenance_work_orders;
create policy maintenance_insert_authorized on public.maintenance_work_orders for insert with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or (reported_by_user_id = auth.uid() and public.can_access_property(workspace_id, property_id)));
drop policy if exists maintenance_update_authorized on public.maintenance_work_orders;
create policy maintenance_update_authorized on public.maintenance_work_orders for update using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_maintenance_id = auth.uid()) with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host']) or assigned_maintenance_id = auth.uid());

drop policy if exists file_uploads_select_authorized on public.file_uploads;
create policy file_uploads_select_authorized on public.file_uploads for select using (public.is_active_workspace_member(workspace_id));
drop policy if exists file_uploads_insert_authorized on public.file_uploads;
create policy file_uploads_insert_authorized on public.file_uploads for insert with check (public.is_active_workspace_member(workspace_id) and uploaded_by = auth.uid());

drop policy if exists activity_logs_select_member on public.activity_logs;
create policy activity_logs_select_member on public.activity_logs for select using (public.is_active_workspace_member(workspace_id));
drop policy if exists activity_logs_insert_member on public.activity_logs;
create policy activity_logs_insert_member on public.activity_logs for insert with check (public.is_active_workspace_member(workspace_id) and actor_user_id = auth.uid());

drop policy if exists notifications_select_recipient_or_manager on public.notifications;
create policy notifications_select_recipient_or_manager on public.notifications for select using (recipient_user_id = auth.uid() or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));
drop policy if exists notifications_manage_manager on public.notifications;
create policy notifications_manage_manager on public.notifications for all using (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])) with check (public.has_workspace_role(workspace_id, array['workspace_owner','property_manager']));

-- -----------------------------------------------------------------------------
-- Indexes after tables exist.
-- -----------------------------------------------------------------------------

create index if not exists workspace_members_user_idx on public.workspace_members (user_id);
create index if not exists workspace_members_roles_idx on public.workspace_members using gin (roles);
create index if not exists workspace_invites_workspace_status_idx on public.workspace_invites (workspace_id, status, created_at desc);
create index if not exists workspace_invites_email_status_idx on public.workspace_invites (lower(email), status);
create index if not exists properties_workspace_status_idx on public.properties (workspace_id, status);
create index if not exists property_assignments_user_idx on public.property_assignments (workspace_id, user_id, assignment_role);
create index if not exists cleaning_tasks_workspace_idx on public.cleaning_tasks (workspace_id, scheduled_for, status);
create index if not exists cleaning_tasks_assignment_idx on public.cleaning_tasks (workspace_id, assigned_cleaner_id);
create index if not exists maintenance_workspace_idx on public.maintenance_work_orders (workspace_id, status, priority);
create index if not exists maintenance_assignment_idx on public.maintenance_work_orders (workspace_id, assigned_maintenance_id);
create index if not exists file_uploads_workspace_idx on public.file_uploads (workspace_id, category);
create index if not exists activity_logs_workspace_idx on public.activity_logs (workspace_id, created_at desc);
create index if not exists notifications_recipient_idx on public.notifications (workspace_id, recipient_user_id, status);

-- Let Supabase API roles reach the tables; RLS still enforces row visibility.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Private storage bucket setup last, after table/RLS dependencies exist.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('propflow-private', 'propflow-private', false, 52428800, null)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists storage_private_select on storage.objects;
create policy storage_private_select on storage.objects for select using (
  bucket_id = 'propflow-private'
  and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists storage_private_insert on storage.objects;
create policy storage_private_insert on storage.objects for insert with check (
  bucket_id = 'propflow-private'
  and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists storage_private_update on storage.objects;
create policy storage_private_update on storage.objects for update using (
  bucket_id = 'propflow-private'
  and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id = 'propflow-private'
  and public.is_active_workspace_member((storage.foldername(name))[1]::uuid)
);
