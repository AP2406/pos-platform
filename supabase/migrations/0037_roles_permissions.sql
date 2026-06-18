-- Granular roles & per-permission toggles, business-scoped, anchored on
-- staff_members (the POS PIN identities). Backward-compatible: the app falls
-- back to the default matrix keyed on the legacy staff_members.role enum until
-- a business customizes a role, so existing behavior is unchanged.

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  key         text,                                  -- stable key for the 6 system roles
  is_system   boolean not null default false,
  permissions jsonb   not null default '[]'::jsonb,  -- array of permission keys
  sort_order  int     not null default 0,
  created_at  timestamptz not null default now(),
  unique (business_id, name)
);

alter table public.roles enable row level security;

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles for select
  using (exists (
    select 1 from public.business_members m
    where m.business_id = roles.business_id and m.user_id = auth.uid()
  ));

drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles for all
  using (exists (
    select 1 from public.business_members m
    where m.business_id = roles.business_id and m.user_id = auth.uid()
      and m.role in ('owner','manager')
  ))
  with check (exists (
    select 1 from public.business_members m
    where m.business_id = roles.business_id and m.user_id = auth.uid()
      and m.role in ('owner','manager')
  ));

alter table public.staff_members
  add column if not exists role_id uuid references public.roles(id);

-- Seed the 6 default system roles per business + backfill staff_members.role_id
-- from the legacy role enum. Idempotent (unique on business_id+name).
do $$
declare
  b record;
  v_owner uuid; v_manager uuid; v_server uuid; v_host uuid;
begin
  for b in select id from public.businesses loop
    insert into public.roles (business_id, name, key, is_system, permissions, sort_order) values
      (b.id, 'Owner', 'owner', true,
       '["void","comp","discount","refund","reopen_closed_check","edit_price","delete_item_prepay","open_drawer","no_sale","access_reports","export_data","edit_menu","edit_staff","change_tax","close_day"]'::jsonb, 0),
      (b.id, 'Manager', 'manager', true,
       '["void","comp","discount","refund","reopen_closed_check","edit_price","delete_item_prepay","open_drawer","no_sale","access_reports","export_data","edit_menu","edit_staff","close_day"]'::jsonb, 1),
      (b.id, 'Shift-lead', 'shift_lead', true,
       '["void","comp","discount","delete_item_prepay","open_drawer","no_sale","access_reports","close_day"]'::jsonb, 2),
      (b.id, 'Server', 'server', true,
       '["delete_item_prepay"]'::jsonb, 3),
      (b.id, 'Host', 'host', true,
       '[]'::jsonb, 4),
      (b.id, 'Bookkeeper', 'bookkeeper', true,
       '["access_reports","export_data"]'::jsonb, 5)
    on conflict (business_id, name) do nothing;

    select id into v_owner   from public.roles where business_id = b.id and key = 'owner'   limit 1;
    select id into v_manager from public.roles where business_id = b.id and key = 'manager' limit 1;
    select id into v_server  from public.roles where business_id = b.id and key = 'server'  limit 1;
    select id into v_host    from public.roles where business_id = b.id and key = 'host'    limit 1;

    update public.staff_members set role_id = case role
        when 'owner'   then v_owner
        when 'manager' then v_manager
        when 'staff'   then v_server
        when 'trainee' then v_host
        else v_server
      end
      where business_id = b.id and role_id is null;
  end loop;
end $$;
