-- Demo / sandbox mode: businesses flagged is_demo are fully usable for taking
-- orders but locked against any config change (menu, floor, settings) and can
-- never process real money (no Finix merchant; card path also gated on this).

alter table public.businesses
  add column if not exists is_demo boolean not null default false;

-- A signed-in user whose JWT app_metadata.demo === true auto-joins the shared
-- demo business on first sign-in. SECURITY DEFINER so it can insert past RLS;
-- the app_metadata claim is admin-set (not user-editable), so it can't be
-- abused, and joining only grants access to a locked sandbox anyway.
create or replace function public.join_demo_business()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return null;
  end if;
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'demo', '') <> 'true' then
    return null;
  end if;
  select id into v_biz
    from public.businesses
   where is_demo = true
   order by created_at asc
   limit 1;
  if v_biz is null then
    return null;
  end if;
  insert into public.business_members (business_id, user_id, role)
  values (v_biz, v_uid, 'manager')
  on conflict (business_id, user_id) do nothing;
  return v_biz;
end;
$$;

grant execute on function public.join_demo_business() to authenticated;

-- Admin helper: flag an existing auth user as a demo user. Run from the SQL
-- editor (service role) after creating the login in the dashboard:
--   select public.make_demo_user('prospect@example.com');
-- Not callable by app users.
create or replace function public.make_demo_user(target_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"demo": true}'::jsonb
   where lower(email) = lower(target_email);
end;
$$;

revoke all on function public.make_demo_user(text) from public, anon, authenticated;
