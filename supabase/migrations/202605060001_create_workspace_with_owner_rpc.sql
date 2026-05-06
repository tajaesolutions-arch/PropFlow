-- PropFlow workspace creation RPC.
-- Safe for Supabase SQL Editor: idempotent, non-destructive, and does not
-- grant broad direct workspace insert access to authenticated clients.

create extension if not exists "pgcrypto";

create or replace function public.create_workspace_with_owner(
  p_name text,
  p_business_type text default null,
  p_country text default 'United States',
  p_default_currency text default 'USD',
  p_business_email text default null,
  p_phone text default null,
  p_website text default null,
  p_property_count_estimate integer default null,
  p_plan_placeholder text default null,
  p_company_code text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := nullif(auth.email(), '');
  v_default_currency text := upper(nullif(btrim(coalesce(p_default_currency, '')), ''));
  v_workspace public.workspaces;
  v_base_code text;
  v_candidate_code text;
  v_suffix text;
  v_attempt integer := 0;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to create a workspace.' using errcode = '28000';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Workspace name is required.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_country, '')), '') is null then
    raise exception 'Workspace country is required.' using errcode = '22023';
  end if;

  if v_default_currency is null then
    v_default_currency := 'USD';
  end if;

  if v_default_currency not in ('USD', 'JMD', 'CAD', 'GBP', 'EUR') then
    raise exception 'Unsupported workspace currency: %', v_default_currency using errcode = '22023';
  end if;

  if p_property_count_estimate is not null and p_property_count_estimate < 0 then
    raise exception 'Property count estimate cannot be negative.' using errcode = '22023';
  end if;

  insert into public.profiles (id, email, full_name, status, is_propflow_admin)
  values (
    v_user_id,
    v_email,
    coalesce(nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'PropFlow user'),
    'active',
    false
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
        updated_at = now();

  v_base_code := upper(regexp_replace(coalesce(nullif(btrim(p_company_code), ''), p_name), '[^A-Za-z0-9]+', '-', 'g'));
  v_base_code := regexp_replace(v_base_code, '(^-+|-+$)', '', 'g');
  v_base_code := left(v_base_code, 12);

  if nullif(v_base_code, '') is null then
    v_base_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  end if;

  v_candidate_code := v_base_code;

  loop
    begin
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
        company_code,
        status,
        created_by
      )
      values (
        btrim(p_name),
        nullif(btrim(p_business_type), ''),
        btrim(p_country),
        v_default_currency,
        nullif(btrim(p_business_email), ''),
        nullif(btrim(p_phone), ''),
        nullif(btrim(p_website), ''),
        p_property_count_estimate,
        nullif(btrim(p_plan_placeholder), ''),
        v_candidate_code,
        'active',
        v_user_id
      )
      returning * into v_workspace;

      exit;
    exception
      when unique_violation then
        v_attempt := v_attempt + 1;
        if v_attempt > 10 then
          raise exception 'Could not generate a unique company code for this workspace.' using errcode = '23505';
        end if;

        v_suffix := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
        v_candidate_code := left(v_base_code, greatest(1, 12 - length(v_suffix) - 1)) || '-' || v_suffix;
    end;
  end loop;

  insert into public.workspace_members (workspace_id, user_id, roles, status, invited_by)
  values (v_workspace.id, v_user_id, array['workspace_owner']::text[], 'active', v_user_id)
  on conflict (workspace_id, user_id) do update
    set roles = array['workspace_owner']::text[],
        status = 'active',
        invited_by = coalesce(public.workspace_members.invited_by, excluded.invited_by),
        updated_at = now()
  where not excluded.roles && array['propflow_admin']::text[];

  if to_regclass('public.activity_logs') is not null then
    execute 'insert into public.activity_logs (workspace_id, actor_user_id, action, metadata) values ($1, $2, $3, $4)'
    using v_workspace.id, v_user_id, 'workspace.created', jsonb_build_object('name', v_workspace.name, 'company_code', v_workspace.company_code);
  end if;

  return v_workspace;
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
  text,
  text
) from public;

grant execute on function public.create_workspace_with_owner(
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
) to authenticated;

-- Workspace rows are now created through public.create_workspace_with_owner().
-- Authenticated users retain read access through membership policies only.
drop policy if exists workspaces_insert_authenticated on public.workspaces;
