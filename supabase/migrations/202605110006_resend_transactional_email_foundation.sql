-- Resend transactional email delivery-log foundation.
-- Enhances existing notification_delivery_logs without storing email bodies or secrets.

create extension if not exists "pgcrypto";

alter table public.notification_delivery_logs add column if not exists recipient_email text;
alter table public.notification_delivery_logs add column if not exists template_key text;
alter table public.notification_delivery_logs add column if not exists subject text;
alter table public.notification_delivery_logs add column if not exists provider_error_code text;
alter table public.notification_delivery_logs add column if not exists provider_error_message text;
alter table public.notification_delivery_logs add column if not exists failed_at timestamptz;
alter table public.notification_delivery_logs add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.notification_delivery_logs
set recipient_email = recipient_address
where recipient_email is null
  and channel = 'email'
  and recipient_address is not null;

update public.notification_delivery_logs
set template_key = coalesce(template_key, metadata->>'template_key', 'legacy_notification')
where channel = 'email'
  and template_key is null;

update public.notification_delivery_logs
set subject = coalesce(subject, metadata->>'subject', 'PropFlow notification')
where channel = 'email'
  and subject is null;

alter table public.notification_delivery_logs drop constraint if exists notification_delivery_logs_channel_check;
alter table public.notification_delivery_logs drop constraint if exists notification_delivery_logs_provider_check;
alter table public.notification_delivery_logs drop constraint if exists notification_delivery_logs_status_check;
alter table public.notification_delivery_logs drop constraint if exists notification_delivery_logs_email_payload_check;

alter table public.notification_delivery_logs add constraint notification_delivery_logs_channel_check
  check (channel in ('in_app','email','sms','whatsapp'));
alter table public.notification_delivery_logs add constraint notification_delivery_logs_provider_check
  check (provider is null or provider in ('internal','resend','twilio'));
alter table public.notification_delivery_logs add constraint notification_delivery_logs_status_check
  check (status in ('queued','skipped','provider_not_configured','sent','failed'));
alter table public.notification_delivery_logs add constraint notification_delivery_logs_email_payload_check
  check (
    channel <> 'email'
    or (
      provider = 'resend'
      and coalesce(nullif(recipient_address, ''), nullif(recipient_email, '')) is not null
      and template_key is not null
      and subject is not null
    )
  ) not valid;

create index if not exists notification_delivery_logs_email_workspace_idx
  on public.notification_delivery_logs (workspace_id, channel, provider, template_key, created_at desc)
  where channel = 'email';

create index if not exists notification_delivery_logs_email_idempotency_idx
  on public.notification_delivery_logs (workspace_id, template_key, recipient_address, ((metadata->>'idempotency_key')))
  where channel = 'email' and provider = 'resend' and metadata ? 'idempotency_key';

alter table public.notification_delivery_logs enable row level security;

create or replace function public.is_propflow_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_propflow_admin, false) = true
      and coalesce(p.account_status, p.status, 'active') = 'active'
  );
$$;

drop policy if exists "notification_delivery_logs_select_manager_or_recipient" on public.notification_delivery_logs;
drop policy if exists notification_delivery_logs_select_manager_or_recipient on public.notification_delivery_logs;
drop policy if exists "notification_delivery_logs_select_owner_or_recipient" on public.notification_delivery_logs;
drop policy if exists notification_delivery_logs_select_owner_or_recipient on public.notification_delivery_logs;
create policy notification_delivery_logs_select_workspace_ops_or_recipient
on public.notification_delivery_logs
for select
to authenticated
using (
  public.is_propflow_admin_user()
  or public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  or (
    recipient_user_id = auth.uid()
    and public.user_is_active_workspace_member(workspace_id, auth.uid())
  )
  or (
    template_key = 'owner_report_ready'
    and recipient_user_id = auth.uid()
    and public.has_workspace_role(workspace_id, array['property_owner'])
  )
);

drop policy if exists "notification_delivery_logs_insert_manager" on public.notification_delivery_logs;
drop policy if exists notification_delivery_logs_insert_manager on public.notification_delivery_logs;
create policy notification_delivery_logs_insert_in_app_only
on public.notification_delivery_logs
for insert
to authenticated
with check (
  channel = 'in_app'
  and provider = 'internal'
  and public.has_workspace_role(workspace_id, array['workspace_owner','property_manager','host'])
  and (recipient_user_id is null or public.user_is_active_workspace_member(workspace_id, recipient_user_id))
);

drop policy if exists "notification_delivery_logs_update_owner" on public.notification_delivery_logs;
drop policy if exists notification_delivery_logs_update_owner on public.notification_delivery_logs;
create policy notification_delivery_logs_update_internal_in_app_only
on public.notification_delivery_logs
for update
to authenticated
using (
  channel = 'in_app'
  and provider = 'internal'
  and public.has_workspace_role(workspace_id, array['workspace_owner'])
)
with check (
  channel = 'in_app'
  and provider = 'internal'
  and public.has_workspace_role(workspace_id, array['workspace_owner'])
);
