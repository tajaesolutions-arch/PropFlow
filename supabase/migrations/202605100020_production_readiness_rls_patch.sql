-- PropFlow production-readiness RLS patch.
-- Non-destructive launch hardening for public direct booking access. This keeps
-- public booking pages available only through safe SECURITY DEFINER RPCs, keeps
-- direct request inserts scoped to published pages, and adds server-side stay
-- rule / availability checks so malicious clients cannot bypass frontend checks.

revoke select on public.direct_booking_pages from anon;

drop policy if exists direct_booking_pages_public_select_published on public.direct_booking_pages;
drop policy if exists direct_booking_requests_public_insert on public.direct_booking_requests;
drop function if exists public.direct_booking_request_is_scoped(uuid, uuid, uuid, text);

create or replace function public.direct_booking_request_is_scoped(
  target_workspace_id uuid,
  target_property_id uuid,
  target_page_id uuid,
  target_inquiry_type text,
  target_check_in date default null,
  target_check_out date default null,
  target_guest_count integer default null
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with page_scope as (
    select
      page.id,
      page.workspace_id,
      page.property_id,
      page.min_nights,
      page.max_nights,
      page.allow_booking_requests,
      page.allow_inquiries
    from public.direct_booking_pages page
    join public.properties property
      on property.id = page.property_id
     and property.workspace_id = page.workspace_id
    where page.id = target_page_id
      and page.workspace_id = target_workspace_id
      and page.property_id = target_property_id
      and page.status = 'published'
      and page.archived_at is null
      and property.archived_at is null
      and (
        (target_inquiry_type = 'booking_request' and page.allow_booking_requests)
        or (target_inquiry_type = 'general_inquiry' and page.allow_inquiries)
      )
  ), validation as (
    select
      page_scope.*,
      case
        when target_inquiry_type = 'general_inquiry' then true
        when target_check_in is null or target_check_out is null then false
        when target_check_out <= target_check_in then false
        when coalesce(target_guest_count, 1) < 1 then false
        when page_scope.min_nights is not null and (target_check_out - target_check_in) < page_scope.min_nights then false
        when page_scope.max_nights is not null and (target_check_out - target_check_in) > page_scope.max_nights then false
        else true
      end as dates_are_valid
    from page_scope
  )
  select exists (
    select 1
    from validation valid
    where valid.dates_are_valid
      and not exists (
        select 1
        from public.bookings booking
        where target_inquiry_type = 'booking_request'
          and booking.workspace_id = valid.workspace_id
          and booking.property_id = valid.property_id
          and booking.status <> 'cancelled'
          and target_check_in < booking.check_out
          and target_check_out > booking.check_in
      )
      and not exists (
        select 1
        from public.direct_booking_requests request
        where target_inquiry_type = 'booking_request'
          and request.workspace_id = valid.workspace_id
          and request.property_id = valid.property_id
          and request.status in ('new','under_review','approved')
          and request.archived_at is null
          and request.check_in is not null
          and request.check_out is not null
          and target_check_in < request.check_out
          and target_check_out > request.check_in
      )
      and not exists (
        select 1
        from public.leases lease
        where target_inquiry_type = 'booking_request'
          and lease.workspace_id = valid.workspace_id
          and lease.property_id = valid.property_id
          and lease.lease_status not in ('ended','terminated','archived')
          and target_check_in < lease.lease_end
          and target_check_out > lease.lease_start
      )
      and not exists (
        select 1
        from public.calendar_import_events imported
        where target_inquiry_type = 'booking_request'
          and imported.workspace_id = valid.workspace_id
          and imported.property_id = valid.property_id
          and imported.archived_at is null
          and imported.status in ('imported','changed','conflict')
          and target_check_in::timestamptz < imported.ends_at
          and target_check_out::timestamptz > imported.starts_at
      )
  );
$$;

create policy direct_booking_requests_public_insert
on public.direct_booking_requests
for insert
to anon, authenticated
with check (
  public.direct_booking_request_is_scoped(
    workspace_id,
    property_id,
    direct_booking_page_id,
    inquiry_type,
    check_in,
    check_out,
    guest_count
  )
  and status = 'new'
  and converted_booking_id is null
  and reviewed_by is null
  and reviewed_at is null
  and decline_reason is null
  and metadata = '{}'::jsonb
  and source = 'direct_booking_page'
);

-- Platform Admin uses dedicated audited RPCs for platform-wide operations; customer
-- workspace RLS helpers must remain membership-based so platform admins do not
-- receive implicit customer workspace access through normal app queries.
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
      and not wm.roles && array['propflow_admin']::text[]
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles text[])
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
      and wm.roles && allowed_roles
      and not wm.roles && array['propflow_admin']::text[]
  );
$$;
