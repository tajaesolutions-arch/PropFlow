-- Calendar + iCal MVP alignment.
-- Keeps the existing calendar_import_* tables, tightens HTTPS-only feed URLs,
-- supports the MVP provider values, and allows assigned property owners to
-- view imported blocks for their assigned properties without granting feed URL access.

alter table public.calendar_import_feeds drop constraint if exists calendar_import_feeds_provider_type_check;
alter table public.calendar_import_feeds add constraint calendar_import_feeds_provider_type_check
  check (provider_type in ('airbnb_ical','booking_ical','booking_com_ical','vrbo_ical','google_ical','google_calendar_ical','other_ical','manual_ical','outlook_ical')) not valid;

alter table public.calendar_import_feeds drop constraint if exists calendar_import_feeds_feed_url_protocol_check;
alter table public.calendar_import_feeds add constraint calendar_import_feeds_feed_url_protocol_check
  check (feed_url ~* '^https://') not valid;

create or replace function public.calendar_import_property_assigned_to_current_user(
  target_workspace_id uuid,
  target_property_id uuid,
  target_assignment_role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_workspace_id is not null
    and target_property_id is not null
    and target_assignment_role is not null
    and public.has_workspace_role(target_workspace_id, array[target_assignment_role])
    and exists (
      select 1
      from public.property_assignments pa
      where pa.workspace_id = target_workspace_id
        and pa.property_id = target_property_id
        and pa.user_id = auth.uid()
        and pa.assignment_role = target_assignment_role
    );
$$;

grant execute on function public.calendar_import_property_assigned_to_current_user(uuid,uuid,text) to authenticated, service_role;

drop policy if exists calendar_import_events_select_owner_assigned_property on public.calendar_import_events;
create policy calendar_import_events_select_owner_assigned_property
on public.calendar_import_events
for select
to authenticated
using (
  archived_at is null
  and public.calendar_import_property_is_scoped(workspace_id, property_id)
  and public.calendar_import_property_assigned_to_current_user(workspace_id, property_id, 'property_owner')
);
