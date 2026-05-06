-- PropFlow direct booking foundation.
-- Public-safe booking page settings and booking request capture.
-- This does not enable real Stripe payments yet.

create extension if not exists "pgcrypto";

create table if not exists public.direct_booking_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  workspace_slug text not null,
  property_slug text not null,
  is_enabled boolean not null default false,
  booking_mode text not null default 'request_only' check (booking_mode in ('request_only','instant_payment')),
  payment_mode text not null default 'full_payment' check (payment_mode in ('full_payment','deposit')),
  deposit_percent numeric(5,2),
  public_title text,
  public_description text,
  house_rules text,
  check_in_instructions text,
  cancellation_policy text,
  public_photo_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_slug, property_slug),
  unique (workspace_id, property_id)
);

create table if not exists public.direct_booking_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  direct_booking_page_id uuid references public.direct_booking_pages(id) on delete set null,
  guest_name text not null,
  guest_email text,
  guest_phone text,
  check_in date not null,
  check_out date not null,
  guest_count integer not null default 1,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','declined','converted','cancelled')),
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check (guest_count > 0)
);

create index if not exists direct_booking_pages_public_idx
  on public.direct_booking_pages (workspace_slug, property_slug, is_enabled);

create index if not exists direct_booking_pages_workspace_idx
  on public.direct_booking_pages (workspace_id, property_id);

create index if not exists direct_booking_requests_workspace_created_idx
  on public.direct_booking_requests (workspace_id, created_at desc);

create index if not exists direct_booking_requests_status_idx
  on public.direct_booking_requests (workspace_id, status);

drop trigger if exists direct_booking_pages_updated_at on public.direct_booking_pages;
create trigger direct_booking_pages_updated_at
before update on public.direct_booking_pages
for each row
execute function public.set_updated_at();

drop trigger if exists direct_booking_requests_updated_at on public.direct_booking_requests;
create trigger direct_booking_requests_updated_at
before update on public.direct_booking_requests
for each row
execute function public.set_updated_at();

alter table public.direct_booking_pages enable row level security;
alter table public.direct_booking_requests enable row level security;

drop policy if exists "direct_booking_pages_public_select_enabled" on public.direct_booking_pages;
create policy "direct_booking_pages_public_select_enabled"
on public.direct_booking_pages
for select
to anon, authenticated
using (is_enabled = true);

drop policy if exists "direct_booking_pages_manager_select" on public.direct_booking_pages;
create policy "direct_booking_pages_manager_select"
on public.direct_booking_pages
for select
to authenticated
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
);

drop policy if exists "direct_booking_pages_manager_manage" on public.direct_booking_pages;
create policy "direct_booking_pages_manager_manage"
on public.direct_booking_pages
for all
to authenticated
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
)
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager'])
);

drop policy if exists "direct_booking_requests_public_insert" on public.direct_booking_requests;
create policy "direct_booking_requests_public_insert"
on public.direct_booking_requests
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.direct_booking_pages page
    where page.id = direct_booking_page_id
      and page.workspace_id = workspace_id
      and page.property_id = property_id
      and page.is_enabled = true
  )
);

drop policy if exists "direct_booking_requests_manager_select" on public.direct_booking_requests;
create policy "direct_booking_requests_manager_select"
on public.direct_booking_requests
for select
to authenticated
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
);

drop policy if exists "direct_booking_requests_manager_update" on public.direct_booking_requests;
create policy "direct_booking_requests_manager_update"
on public.direct_booking_requests
for update
to authenticated
using (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
)
with check (
  public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
);
