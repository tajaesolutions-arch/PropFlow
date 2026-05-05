-- PropFlow MVP schema. All tenant-owned records include workspace_id and simple RLS policies prevent cross-workspace access.
create extension if not exists "pgcrypto";

create type account_status as enum ('active', 'suspended');
create type rental_type as enum ('short-term', 'long-term', 'both');
create type booking_status as enum ('upcoming', 'checked_in', 'checked_out', 'cancelled', 'completed');
create type cleaning_status as enum ('not_started', 'in_progress', 'ready_for_inspection', 'guest_ready', 'blocked_issue_found');
create type maintenance_priority as enum ('low', 'medium', 'high', 'urgent', 'critical');
create type maintenance_status as enum ('open', 'assigned', 'in_progress', 'waiting_on_parts', 'completed', 'cancelled');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique,
  is_propflow_admin boolean not null default false,
  status account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  billing_period text not null default 'monthly',
  price_cents integer,
  property_limit integer,
  user_limit integer,
  is_enterprise boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  default_currency text not null default 'USD' check (default_currency in ('USD','JMD','CAD','GBP','EUR')),
  status account_status not null default 'active',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  roles text[] not null default '{}',
  status account_status not null default 'active',
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  roles text[] not null default '{}',
  token text not null unique,
  status text not null default 'pending',
  expires_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_join_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null unique,
  default_roles text[] not null default '{host}',
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid references public.plans(id),
  status text not null default 'trialing',
  plan_name text not null,
  billing_period text not null default 'monthly',
  property_limit integer,
  user_limit integer,
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id)
);

create table public.property_owners (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, email text, phone text, payout_preference text, notes text,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, address text, city text, country text, property_type text, rental_type rental_type not null default 'short-term',
  bedrooms numeric, bathrooms numeric, max_guests integer, owner_id uuid references public.property_owners(id),
  assigned_cleaner_id uuid references public.profiles(id), assigned_maintenance_user_id uuid references public.profiles(id),
  nightly_rate numeric(12,2), monthly_rate numeric(12,2), currency text not null default 'USD', status text not null default 'active', photo_urls text[] default '{}', notes text,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  full_name text not null, email text, phone text, source text, notes text,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade, guest_id uuid references public.guests(id), guest_name text not null,
  check_in date not null, check_out date not null, booking_source text, total_amount numeric(12,2) not null default 0, cleaning_fee numeric(12,2) default 0, platform_fee numeric(12,2) default 0,
  status booking_status not null default 'upcoming', payment_status text not null default 'unpaid', notes text,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade, category text not null, amount numeric(12,2) not null, currency text not null default 'USD', expense_date date not null, vendor text, notes text,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.revenue_records (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade, booking_id uuid references public.bookings(id) on delete set null, source text not null, amount numeric(12,2) not null, currency text not null default 'USD', revenue_date date not null,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.cleaning_checklists (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade, name text not null, is_default boolean not null default false,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.cleaning_checklist_items (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  checklist_id uuid not null references public.cleaning_checklists(id) on delete cascade, label text not null, sort_order integer not null default 0, is_required boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade, booking_id uuid references public.bookings(id) on delete set null, assigned_user_id uuid references public.profiles(id), checklist_id uuid references public.cleaning_checklists(id),
  due_at timestamptz, status cleaning_status not null default 'not_started', issue_report text, checklist_state jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.cleaning_task_photos (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  cleaning_task_id uuid not null references public.cleaning_tasks(id) on delete cascade, photo_url text not null, photo_type text check (photo_type in ('before','after','issue')), uploaded_by uuid references public.profiles(id), created_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, contact_name text, email text, phone text, service_type text, status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.maintenance_work_orders (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade, title text not null, description text, priority maintenance_priority not null default 'medium', status maintenance_status not null default 'open', assigned_user_id uuid references public.profiles(id), vendor_id uuid references public.vendors(id), parts_needed text, estimated_cost numeric(12,2), actual_cost numeric(12,2), due_date date, completed_at timestamptz,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.maintenance_photos (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  work_order_id uuid not null references public.maintenance_work_orders(id) on delete cascade, photo_url text not null, uploaded_by uuid references public.profiles(id), created_at timestamptz not null default now()
);

create table public.owner_reports (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.property_owners(id) on delete cascade, property_id uuid references public.properties(id) on delete set null, report_type text not null, period_start date not null, period_end date not null, status text not null default 'draft', pdf_url text, csv_url text, monthly_email_enabled boolean not null default true, emailed_at timestamptz,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id), type text not null, message text not null, status text not null default 'unread', metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references public.profiles(id), action text not null, entity_type text, entity_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

-- Indexes for tenant scoping, filters, assignment, dates, and statuses.
create index on public.workspace_members (workspace_id, user_id); create index on public.workspace_members (user_id); create index on public.workspace_members using gin (roles);
create index on public.properties (workspace_id); create index on public.properties (workspace_id, owner_id); create index on public.properties (workspace_id, assigned_cleaner_id); create index on public.properties (workspace_id, assigned_maintenance_user_id); create index on public.properties (workspace_id, status); create index on public.properties (workspace_id, city);
create index on public.bookings (workspace_id, property_id); create index on public.bookings (workspace_id, check_in); create index on public.bookings (workspace_id, status); create index on public.bookings (workspace_id, booking_source);
create index on public.cleaning_tasks (workspace_id, property_id); create index on public.cleaning_tasks (workspace_id, assigned_user_id); create index on public.cleaning_tasks (workspace_id, due_at); create index on public.cleaning_tasks (workspace_id, status);
create index on public.maintenance_work_orders (workspace_id, property_id); create index on public.maintenance_work_orders (workspace_id, assigned_user_id); create index on public.maintenance_work_orders (workspace_id, vendor_id); create index on public.maintenance_work_orders (workspace_id, priority); create index on public.maintenance_work_orders (workspace_id, status); create index on public.maintenance_work_orders (workspace_id, due_date);
create index on public.expenses (workspace_id, property_id); create index on public.expenses (workspace_id, expense_date); create index on public.revenue_records (workspace_id, property_id); create index on public.revenue_records (workspace_id, revenue_date);
create index on public.owner_reports (workspace_id, owner_id); create index on public.notifications (workspace_id, recipient_user_id, status); create index on public.activity_log (workspace_id, created_at desc);

-- RLS helpers and policies.
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members wm join public.profiles p on p.id = wm.user_id where wm.workspace_id = target_workspace_id and wm.user_id = auth.uid() and wm.status = 'active' and p.status = 'active')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_propflow_admin = true and p.status = 'active');
$$;

create or replace function public.is_propflow_admin()
returns boolean language sql security definer set search_path = public as $$ select exists (select 1 from public.profiles where id = auth.uid() and is_propflow_admin = true and status = 'active'); $$;

alter table public.profiles enable row level security;
create policy "profiles own or admin" on public.profiles for select using (id = auth.uid() or public.is_propflow_admin());
create policy "profiles update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Apply a simple workspace policy to every workspace-scoped table.
alter table public.workspaces enable row level security; create policy "workspace members can read workspace" on public.workspaces for select using (public.is_workspace_member(id));

-- The loop below is intentionally explicit in generated SQL environments; Supabase applies it at migration time.
do $$ declare tbl text; begin
  foreach tbl in array array['workspace_members','workspace_invites','workspace_join_codes','subscriptions','property_owners','properties','guests','bookings','expenses','revenue_records','cleaning_checklists','cleaning_checklist_items','cleaning_tasks','cleaning_task_photos','vendors','maintenance_work_orders','maintenance_photos','owner_reports','notifications','activity_log'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('create policy %L on public.%I for select using (public.is_workspace_member(workspace_id))', tbl || ' workspace select', tbl);
    execute format('create policy %L on public.%I for insert with check (public.is_workspace_member(workspace_id))', tbl || ' workspace insert', tbl);
    execute format('create policy %L on public.%I for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))', tbl || ' workspace update', tbl);
    execute format('create policy %L on public.%I for delete using (public.is_workspace_member(workspace_id))', tbl || ' workspace delete', tbl);
  end loop;
end $$;

-- Plans are globally readable; writes should be performed by PropFlow admins.
alter table public.plans enable row level security;
create policy "plans readable" on public.plans for select using (true);
create policy "plans admin write" on public.plans for all using (public.is_propflow_admin()) with check (public.is_propflow_admin());

-- Updated-at triggers.
do $$ declare tbl text; begin
  foreach tbl in array array['profiles','plans','workspaces','workspace_members','workspace_invites','workspace_join_codes','subscriptions','property_owners','properties','guests','bookings','expenses','revenue_records','cleaning_checklists','cleaning_checklist_items','cleaning_tasks','vendors','maintenance_work_orders','owner_reports'] loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', tbl, tbl);
  end loop;
end $$;
