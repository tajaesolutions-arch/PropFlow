-- PropFlow direct booking public request foundation.
-- Non-destructive alignment for public booking pages, public request capture,
-- manager review, and conversion linkage. This migration deliberately does not
-- enable guest payment processing or reuse SaaS billing checkout.

create extension if not exists "pgcrypto";

create table if not exists public.direct_booking_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  slug text not null,
  status text not null default 'draft',
  page_title text,
  headline text,
  description text,
  house_rules text,
  check_in_instructions text,
  cancellation_policy text,
  contact_email text,
  contact_phone text,
  booking_mode text not null default 'manual_approval',
  payment_mode text not null default 'none',
  allow_inquiries boolean not null default true,
  allow_booking_requests boolean not null default true,
  require_guest_phone boolean not null default true,
  require_guest_message boolean not null default false,
  min_nights integer default 1,
  max_nights integer,
  base_rate numeric(12,2),
  cleaning_fee numeric(12,2),
  currency text,
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.direct_booking_pages add column if not exists slug text;
alter table public.direct_booking_pages add column if not exists status text not null default 'draft';
alter table public.direct_booking_pages add column if not exists page_title text;
alter table public.direct_booking_pages add column if not exists headline text;
alter table public.direct_booking_pages add column if not exists description text;
alter table public.direct_booking_pages add column if not exists house_rules text;
alter table public.direct_booking_pages add column if not exists check_in_instructions text;
alter table public.direct_booking_pages add column if not exists cancellation_policy text;
alter table public.direct_booking_pages add column if not exists contact_email text;
alter table public.direct_booking_pages add column if not exists contact_phone text;
alter table public.direct_booking_pages add column if not exists booking_mode text not null default 'manual_approval';
alter table public.direct_booking_pages add column if not exists payment_mode text not null default 'none';
alter table public.direct_booking_pages add column if not exists allow_inquiries boolean not null default true;
alter table public.direct_booking_pages add column if not exists allow_booking_requests boolean not null default true;
alter table public.direct_booking_pages add column if not exists require_guest_phone boolean not null default true;
alter table public.direct_booking_pages add column if not exists require_guest_message boolean not null default false;
alter table public.direct_booking_pages add column if not exists min_nights integer default 1;
alter table public.direct_booking_pages add column if not exists max_nights integer;
alter table public.direct_booking_pages add column if not exists base_rate numeric(12,2);
alter table public.direct_booking_pages add column if not exists cleaning_fee numeric(12,2);
alter table public.direct_booking_pages add column if not exists currency text;
alter table public.direct_booking_pages add column if not exists published_at timestamptz;
alter table public.direct_booking_pages add column if not exists archived_at timestamptz;
alter table public.direct_booking_pages add column if not exists created_by uuid references public.profiles(id);
alter table public.direct_booking_pages add column if not exists created_at timestamptz not null default now();
alter table public.direct_booking_pages add column if not exists updated_at timestamptz not null default now();

alter table public.direct_booking_pages drop constraint if exists direct_booking_pages_booking_mode_check;
alter table public.direct_booking_pages drop constraint if exists direct_booking_pages_payment_mode_check;

update public.direct_booking_pages
set
  slug = coalesce(nullif(slug, ''), nullif(property_slug, ''), lower(replace(id::text, '-', ''))),
  status = case
    when status in ('draft','published','paused','archived') then status
    when coalesce(is_enabled, false) then 'published'
    else 'draft'
  end,
  page_title = coalesce(page_title, public_title),
  description = coalesce(description, public_description),
  booking_mode = case when booking_mode = 'manual_approval' then 'manual_approval' else 'manual_approval' end,
  payment_mode = case when payment_mode in ('none','full_payment_placeholder','deposit_placeholder') then payment_mode else 'none' end,
  published_at = case when coalesce(is_enabled, false) and published_at is null then now() else published_at end
where slug is null
   or status not in ('draft','published','paused','archived')
   or booking_mode not in ('manual_approval','instant_booking_placeholder')
   or payment_mode not in ('none','full_payment_placeholder','deposit_placeholder')
   or page_title is null
   or description is null;

alter table public.direct_booking_pages alter column slug set not null;
alter table public.direct_booking_pages alter column booking_mode set default 'manual_approval';
alter table public.direct_booking_pages alter column payment_mode set default 'none';
alter table public.direct_booking_pages alter column status set default 'draft';

create table if not exists public.direct_booking_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  direct_booking_page_id uuid references public.direct_booking_pages(id) on delete set null,
  inquiry_type text not null default 'booking_request',
  status text not null default 'new',
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  check_in date,
  check_out date,
  guest_count integer default 1,
  message text,
  quoted_rate numeric(12,2),
  quoted_cleaning_fee numeric(12,2),
  quoted_total numeric(12,2),
  currency text,
  source text not null default 'direct_booking_page',
  converted_booking_id uuid references public.bookings(id) on delete set null,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  decline_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.direct_booking_requests add column if not exists inquiry_type text not null default 'booking_request';
alter table public.direct_booking_requests add column if not exists guest_email text;
alter table public.direct_booking_requests add column if not exists quoted_rate numeric(12,2);
alter table public.direct_booking_requests add column if not exists quoted_cleaning_fee numeric(12,2);
alter table public.direct_booking_requests add column if not exists quoted_total numeric(12,2);
alter table public.direct_booking_requests add column if not exists currency text;
alter table public.direct_booking_requests add column if not exists source text not null default 'direct_booking_page';
alter table public.direct_booking_requests add column if not exists converted_booking_id uuid references public.bookings(id) on delete set null;
alter table public.direct_booking_requests add column if not exists reviewed_by uuid references public.profiles(id);
alter table public.direct_booking_requests add column if not exists reviewed_at timestamptz;
alter table public.direct_booking_requests add column if not exists decline_reason text;
alter table public.direct_booking_requests add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.direct_booking_requests add column if not exists archived_at timestamptz;

alter table public.direct_booking_requests drop constraint if exists direct_booking_requests_status_check;

update public.direct_booking_requests
set
  status = case status
    when 'pending' then 'new'
    when 'converted' then 'converted_to_booking'
    when 'approved' then 'approved'
    when 'declined' then 'declined'
    when 'cancelled' then 'cancelled'
    when 'under_review' then 'under_review'
    when 'converted_to_booking' then 'converted_to_booking'
    else 'new'
  end,
  guest_email = coalesce(nullif(guest_email, ''), 'unknown@example.invalid'),
  converted_booking_id = coalesce(converted_booking_id, booking_id)
where status not in ('new','under_review','approved','declined','converted_to_booking','cancelled')
   or guest_email is null
   or converted_booking_id is null;

alter table public.direct_booking_requests alter column guest_email set not null;
alter table public.direct_booking_requests alter column status set default 'new';

create unique index if not exists direct_booking_pages_workspace_slug_key on public.direct_booking_pages (workspace_id, slug);
create unique index if not exists direct_booking_pages_property_id_key on public.direct_booking_pages (property_id);
create index if not exists direct_booking_pages_workspace_idx on public.direct_booking_pages (workspace_id);
create index if not exists direct_booking_pages_property_idx on public.direct_booking_pages (property_id);
create index if not exists direct_booking_pages_status_idx on public.direct_booking_pages (status);

create index if not exists direct_booking_requests_workspace_idx on public.direct_booking_requests (workspace_id);
create index if not exists direct_booking_requests_property_idx on public.direct_booking_requests (property_id);
create index if not exists direct_booking_requests_page_idx on public.direct_booking_requests (direct_booking_page_id);
create index if not exists direct_booking_requests_status_idx on public.direct_booking_requests (status);
create index if not exists direct_booking_requests_guest_email_idx on public.direct_booking_requests (guest_email);
create index if not exists direct_booking_requests_check_in_idx on public.direct_booking_requests (check_in);
create index if not exists direct_booking_requests_check_out_idx on public.direct_booking_requests (check_out);
create index if not exists direct_booking_requests_converted_booking_idx on public.direct_booking_requests (converted_booking_id);
create index if not exists direct_booking_requests_created_at_idx on public.direct_booking_requests (created_at desc);

do $$
begin
  alter table public.direct_booking_pages add constraint direct_booking_pages_status_valid check (status in ('draft','published','paused','archived')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_pages add constraint direct_booking_pages_booking_mode_valid check (booking_mode in ('manual_approval','instant_booking_placeholder')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_pages add constraint direct_booking_pages_payment_mode_valid check (payment_mode in ('none','full_payment_placeholder','deposit_placeholder')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_pages add constraint direct_booking_pages_min_nights_valid check (min_nights is null or min_nights >= 1) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_pages add constraint direct_booking_pages_max_nights_valid check (max_nights is null or min_nights is null or max_nights >= min_nights) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_pages add constraint direct_booking_pages_base_rate_valid check (base_rate is null or base_rate >= 0) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_pages add constraint direct_booking_pages_cleaning_fee_valid check (cleaning_fee is null or cleaning_fee >= 0) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_pages add constraint direct_booking_pages_currency_valid check (currency is null or currency in ('USD','JMD','CAD','GBP','EUR','AUD','NZD','MXN')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_requests add constraint direct_booking_requests_inquiry_type_valid check (inquiry_type in ('booking_request','general_inquiry')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_requests add constraint direct_booking_requests_status_valid check (status in ('new','under_review','approved','declined','converted_to_booking','cancelled')) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_requests add constraint direct_booking_requests_guest_count_valid check (guest_count is null or guest_count >= 1) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_requests add constraint direct_booking_requests_dates_valid check (check_in is null or check_out is null or check_out > check_in) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_requests add constraint direct_booking_requests_quote_values_valid check (
    (quoted_rate is null or quoted_rate >= 0)
    and (quoted_cleaning_fee is null or quoted_cleaning_fee >= 0)
    and (quoted_total is null or quoted_total >= 0)
  ) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.direct_booking_requests add constraint direct_booking_requests_currency_valid check (currency is null or currency in ('USD','JMD','CAD','GBP','EUR','AUD','NZD','MXN')) not valid;
exception when duplicate_object then null;
end $$;

drop trigger if exists direct_booking_pages_updated_at on public.direct_booking_pages;
create trigger direct_booking_pages_updated_at
before update on public.direct_booking_pages
for each row execute function public.set_updated_at();

drop trigger if exists direct_booking_requests_updated_at on public.direct_booking_requests;
create trigger direct_booking_requests_updated_at
before update on public.direct_booking_requests
for each row execute function public.set_updated_at();

create or replace function public.can_manage_direct_booking_page(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host']);
$$;

create or replace function public.can_view_direct_booking_request(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host','accountant']);
$$;

create or replace function public.can_review_direct_booking_request(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_workspace_role(target_workspace_id, array['workspace_owner','property_manager','host']);
$$;

create or replace function public.direct_booking_page_is_public(target_page_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.direct_booking_pages page
    where page.id = target_page_id
      and page.status = 'published'
      and page.archived_at is null
      and (page.allow_inquiries or page.allow_booking_requests)
  );
$$;

create or replace function public.direct_booking_request_is_scoped(
  target_workspace_id uuid,
  target_property_id uuid,
  target_page_id uuid,
  target_inquiry_type text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.direct_booking_pages page
    where page.id = target_page_id
      and page.workspace_id = target_workspace_id
      and page.property_id = target_property_id
      and page.status = 'published'
      and page.archived_at is null
      and (
        (target_inquiry_type = 'booking_request' and page.allow_booking_requests)
        or (target_inquiry_type = 'general_inquiry' and page.allow_inquiries)
      )
  );
$$;

alter table public.direct_booking_pages enable row level security;
alter table public.direct_booking_requests enable row level security;

drop policy if exists "direct_booking_pages_public_select_enabled" on public.direct_booking_pages;
drop policy if exists "direct_booking_pages_manager_manage" on public.direct_booking_pages;
drop policy if exists "direct_booking_requests_public_insert" on public.direct_booking_requests;
drop policy if exists "direct_booking_requests_manager_select" on public.direct_booking_requests;
drop policy if exists "direct_booking_requests_manager_update" on public.direct_booking_requests;

drop policy if exists direct_booking_pages_public_select_published on public.direct_booking_pages;
create policy direct_booking_pages_public_select_published
on public.direct_booking_pages
for select
to anon, authenticated
using (status = 'published' and archived_at is null);

drop policy if exists direct_booking_pages_manager_select on public.direct_booking_pages;
create policy direct_booking_pages_manager_select
on public.direct_booking_pages
for select
to authenticated
using (public.can_manage_direct_booking_page(workspace_id));

drop policy if exists direct_booking_pages_manager_insert on public.direct_booking_pages;
create policy direct_booking_pages_manager_insert
on public.direct_booking_pages
for insert
to authenticated
with check (
  public.can_manage_direct_booking_page(workspace_id)
  and public.property_belongs_to_workspace(workspace_id, property_id)
  and created_by = auth.uid()
);

drop policy if exists direct_booking_pages_manager_update on public.direct_booking_pages;
create policy direct_booking_pages_manager_update
on public.direct_booking_pages
for update
to authenticated
using (public.can_manage_direct_booking_page(workspace_id))
with check (
  public.can_manage_direct_booking_page(workspace_id)
  and public.property_belongs_to_workspace(workspace_id, property_id)
);

drop policy if exists direct_booking_requests_public_insert on public.direct_booking_requests;
create policy direct_booking_requests_public_insert
on public.direct_booking_requests
for insert
to anon, authenticated
with check (
  public.direct_booking_request_is_scoped(workspace_id, property_id, direct_booking_page_id, inquiry_type)
  and status = 'new'
  and converted_booking_id is null
  and reviewed_by is null
  and reviewed_at is null
  and decline_reason is null
  and metadata = '{}'::jsonb
  and source = 'direct_booking_page'
);

drop policy if exists direct_booking_requests_manager_select on public.direct_booking_requests;
create policy direct_booking_requests_manager_select
on public.direct_booking_requests
for select
to authenticated
using (public.can_view_direct_booking_request(workspace_id));

drop policy if exists direct_booking_requests_manager_update on public.direct_booking_requests;
create policy direct_booking_requests_manager_update
on public.direct_booking_requests
for update
to authenticated
using (public.can_review_direct_booking_request(workspace_id))
with check (
  public.can_review_direct_booking_request(workspace_id)
  and public.property_belongs_to_workspace(workspace_id, property_id)
);

grant select on public.direct_booking_pages to anon, authenticated;
grant insert on public.direct_booking_requests to anon, authenticated;
grant select, insert, update on public.direct_booking_pages to authenticated;
grant select, update on public.direct_booking_requests to authenticated;

create or replace function public.get_public_direct_booking_page(target_slug text)
returns table (
  id uuid,
  workspace_id uuid,
  property_id uuid,
  slug text,
  status text,
  page_title text,
  headline text,
  description text,
  house_rules text,
  check_in_instructions text,
  cancellation_policy text,
  contact_email text,
  contact_phone text,
  booking_mode text,
  payment_mode text,
  allow_inquiries boolean,
  allow_booking_requests boolean,
  require_guest_phone boolean,
  require_guest_message boolean,
  min_nights integer,
  max_nights integer,
  base_rate numeric,
  cleaning_fee numeric,
  currency text,
  property_name text,
  property_type text,
  city text,
  country text,
  bedrooms numeric,
  bathrooms numeric,
  square_feet numeric
)
language sql
security definer
set search_path = public
as $$
  select
    page.id,
    page.workspace_id,
    page.property_id,
    page.slug,
    page.status,
    page.page_title,
    page.headline,
    page.description,
    page.house_rules,
    page.check_in_instructions,
    page.cancellation_policy,
    page.contact_email,
    page.contact_phone,
    page.booking_mode,
    page.payment_mode,
    page.allow_inquiries,
    page.allow_booking_requests,
    page.require_guest_phone,
    page.require_guest_message,
    page.min_nights,
    page.max_nights,
    page.base_rate,
    page.cleaning_fee,
    coalesce(page.currency, property.currency) as currency,
    property.name as property_name,
    property.property_type,
    property.city,
    property.country,
    property.bedrooms,
    property.bathrooms,
    property.square_feet
  from public.direct_booking_pages page
  join public.properties property on property.id = page.property_id and property.workspace_id = page.workspace_id
  where page.slug = lower(trim(target_slug))
    and page.status = 'published'
    and page.archived_at is null
    and property.archived_at is null
  limit 1;
$$;

create or replace function public.get_public_direct_booking_unavailable_ranges(target_slug text)
returns table (check_in date, check_out date)
language sql
security definer
set search_path = public
as $$
  select booking.check_in, booking.check_out
  from public.direct_booking_pages page
  join public.bookings booking on booking.property_id = page.property_id and booking.workspace_id = page.workspace_id
  where page.slug = lower(trim(target_slug))
    and page.status = 'published'
    and page.archived_at is null
    and booking.status not in ('cancelled')
    and booking.check_out >= current_date
  order by booking.check_in asc;
$$;

grant execute on function public.get_public_direct_booking_page(text) to anon, authenticated;
grant execute on function public.get_public_direct_booking_unavailable_ranges(text) to anon, authenticated;

create or replace function public.notify_direct_booking_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  manager record;
begin
  for manager in
    select wm.user_id
    from public.workspace_members wm
    where wm.workspace_id = new.workspace_id
      and wm.status = 'active'
      and wm.roles && array['workspace_owner','property_manager','host']::text[]
  loop
    insert into public.notifications (
      workspace_id,
      recipient_user_id,
      type,
      message,
      status,
      metadata,
      event_type,
      title,
      body,
      priority,
      related_property_id,
      action_url
    ) values (
      new.workspace_id,
      manager.user_id,
      'workspace_activity',
      'New direct booking request from ' || new.guest_name,
      'unread',
      jsonb_build_object('direct_booking_request_id', new.id),
      'workspace_activity',
      'New direct booking request',
      new.guest_name || ' submitted a direct booking request.',
      'high',
      new.property_id,
      '/direct-bookings'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists direct_booking_request_created_notify on public.direct_booking_requests;
create trigger direct_booking_request_created_notify
after insert on public.direct_booking_requests
for each row execute function public.notify_direct_booking_request_created();
