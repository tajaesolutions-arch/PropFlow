-- Secure initial workspace creation RPC for hardened RLS.
-- This migration is non-destructive: it creates/replaces one function and grants
-- execute only to authenticated users. Initial workspace creation should use this
-- RPC instead of broad direct client inserts into workspaces/workspace_members.

-- Remove the older ten-argument overload so PostgREST resolves the hardened
-- nine-argument RPC unambiguously. This drops no tables and deletes no data.
drop function if exists public.create_workspace_with_owner(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text
);

create or replace function public.create_workspace_with_owner(
  p_name text,
  p_business_type text default null,
  p_country text default null,
  p_default_currency text default 'USD',
  p_business_email text default null,
  p_phone text default null,
  p_website text default null,
  p_property_count_estimate integer default null,
  p_plan_placeholder text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text := nullif(lower(btrim(coalesce(auth.email(), ''))), '');
  normalized_name text := nullif(btrim(coalesce(p_name, '')), '');
  normalized_country text := coalesce(nullif(btrim(coalesce(p_country, '')), ''), 'United States');
  normalized_currency text := upper(nullif(btrim(coalesce(p_default_currency, 'USD')), ''));
  created_workspace public.workspaces;
begin
  if current_user_id is null then
    raise exception 'missing_authenticated_session'
      using errcode = '28000';
  end if;

  if normalized_name is null then
    raise exception 'workspace_name_required'
      using errcode = '23502';
  end if;

  if normalized_currency is null or normalized_currency not in ('USD', 'JMD', 'CAD', 'GBP', 'EUR') then
    raise exception 'invalid_default_currency'
      using errcode = '22023';
  end if;

  if p_property_count_estimate is not null and p_property_count_estimate < 0 then
    raise exception 'invalid_property_count_estimate'
      using errcode = '22023';
  end if;

  -- Ensure the authenticated user has a non-admin profile row for FK integrity.
  -- This does not elevate existing users and never sets propflow admin state.
  insert into public.profiles (id, email, full_name, status, is_propflow_admin)
  values (current_user_id, current_user_email, '', 'active', false)
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email),
        updated_at = now();

  insert into public.workspaces (
    name,
    business_type,
    country,
    default_currency,
    business_email,
    phone,
    website,
    property_count_estimate,
    plan_placeholder,
    status,
    created_by
  )
  values (
    normalized_name,
    nullif(btrim(coalesce(p_business_type, '')), ''),
    normalized_country,
    normalized_currency,
    nullif(lower(btrim(coalesce(p_business_email, ''))), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_website, '')), ''),
    p_property_count_estimate,
    nullif(btrim(coalesce(p_plan_placeholder, '')), ''),
    'active',
    current_user_id
  )
  returning * into created_workspace;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    roles,
    status,
    invited_by
  )
  values (
    created_workspace.id,
    current_user_id,
    array['workspace_owner']::text[],
    'active',
    current_user_id
  );

  return created_workspace;
end;
$$;

revoke all on function public.create_workspace_with_owner(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text
) from public;
revoke all on function public.create_workspace_with_owner(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text
) from anon;
grant execute on function public.create_workspace_with_owner(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text
) to authenticated;
