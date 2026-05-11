-- Harden direct booking requests and optional Stripe Checkout metadata.
-- Keeps existing tables/data, removes anonymous request inserts in favor of the
-- validated serverless endpoint, and adds payment fields used by webhooks.

alter table public.direct_booking_requests add column if not exists adults integer not null default 1;
alter table public.direct_booking_requests add column if not exists children integer not null default 0;
alter table public.direct_booking_requests add column if not exists payment_status text not null default 'not_required';
alter table public.direct_booking_requests add column if not exists stripe_checkout_session_id text;
alter table public.direct_booking_requests add column if not exists stripe_payment_intent_id text;

update public.direct_booking_requests
set
  adults = greatest(coalesce(adults, guest_count, 1), 1),
  children = greatest(coalesce(children, 0), 0),
  payment_status = coalesce(payment_status, 'not_required')
where adults is null or children is null or payment_status is null;

alter table public.direct_booking_requests drop constraint if exists direct_booking_requests_status_check;
alter table public.direct_booking_requests add constraint direct_booking_requests_status_check
  check (status in ('new','pending','under_review','approved','declined','rejected','converted_to_booking','cancelled','canceled','archived')) not valid;

alter table public.direct_booking_requests drop constraint if exists direct_booking_requests_payment_status_check;
alter table public.direct_booking_requests add constraint direct_booking_requests_payment_status_check
  check (payment_status in ('not_required','pending','paid','failed','refunded')) not valid;

alter table public.direct_booking_requests drop constraint if exists direct_booking_requests_adults_check;
alter table public.direct_booking_requests add constraint direct_booking_requests_adults_check check (adults >= 1) not valid;

alter table public.direct_booking_requests drop constraint if exists direct_booking_requests_children_check;
alter table public.direct_booking_requests add constraint direct_booking_requests_children_check check (children >= 0) not valid;

alter table public.direct_booking_pages drop constraint if exists direct_booking_pages_booking_mode_check;
alter table public.direct_booking_pages add constraint direct_booking_pages_booking_mode_check
  check (booking_mode in ('manual_approval','instant_booking','instant_booking_placeholder')) not valid;

alter table public.direct_booking_pages drop constraint if exists direct_booking_pages_payment_mode_check;
alter table public.direct_booking_pages add constraint direct_booking_pages_payment_mode_check
  check (payment_mode in ('none','full_payment','full_payment_placeholder','deposit_placeholder')) not valid;

create index if not exists direct_booking_requests_payment_status_idx on public.direct_booking_requests (workspace_id, payment_status);
create index if not exists direct_booking_requests_stripe_checkout_idx on public.direct_booking_requests (stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create index if not exists direct_booking_requests_stripe_payment_intent_idx on public.direct_booking_requests (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

alter table public.direct_booking_requests enable row level security;

-- Public guests must submit through api/create-direct-booking-request.js, which
-- validates page/property scope, stay rules, availability, and Stripe metadata
-- with the service-role key server-side. Anonymous users should not write
-- directly to customer request tables.
drop policy if exists direct_booking_requests_public_insert on public.direct_booking_requests;
drop policy if exists "direct_booking_requests_public_insert" on public.direct_booking_requests;
revoke insert on public.direct_booking_requests from anon;

-- Keep authenticated manager access scoped by existing helpers. Add a read-only
-- owner policy for assigned-property visibility without payment secret exposure.
drop policy if exists direct_booking_requests_property_owner_select on public.direct_booking_requests;
create policy direct_booking_requests_property_owner_select
on public.direct_booking_requests
for select
to authenticated
using (
  public.has_workspace_role(workspace_id, array['property_owner'])
  and exists (
    select 1
    from public.property_assignments assignment
    where assignment.workspace_id = direct_booking_requests.workspace_id
      and assignment.property_id = direct_booking_requests.property_id
      and assignment.user_id = auth.uid()
      and assignment.assignment_role = 'property_owner'
  )
);

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
    and booking.status not in ('cancelled','canceled')
    and booking.check_out >= current_date
  union
  select imported.starts_at::date, imported.ends_at::date
  from public.direct_booking_pages page
  join public.calendar_import_events imported on imported.property_id = page.property_id and imported.workspace_id = page.workspace_id
  where page.slug = lower(trim(target_slug))
    and page.status = 'published'
    and page.archived_at is null
    and imported.archived_at is null
    and imported.status in ('imported','changed','conflict','booked','blocked','unavailable')
    and imported.ends_at::date >= current_date
  union
  select request.check_in, request.check_out
  from public.direct_booking_pages page
  join public.direct_booking_requests request on request.property_id = page.property_id and request.workspace_id = page.workspace_id
  where page.slug = lower(trim(target_slug))
    and page.status = 'published'
    and page.archived_at is null
    and request.archived_at is null
    and (request.status in ('approved','converted_to_booking') or request.payment_status = 'paid')
    and request.check_out >= current_date
  order by check_in asc;
$$;

grant execute on function public.get_public_direct_booking_unavailable_ranges(text) to anon, authenticated;
