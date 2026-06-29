-- Surge HQ HQ-3a: merchant onboarding applications pipeline.
-- The table is RLS deny-all (read/managed only via the HQ service-role gate). The
-- PUBLIC "Apply to Surge" intake writes through the anon SECURITY DEFINER RPC below
-- so the table is never directly exposed. No tenant table/behavior is touched;
-- provisioning (Finix sub-merchant + POS tenant) is a separate step (HQ-3b).

create table if not exists public.merchant_applications (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  contact_email text not null,
  contact_phone text,
  industry text,
  plan text,
  referred_by_rep text,            -- rep code from the apply link; HQ-4 formalizes reps
  status text not null default 'new'
    check (status in ('new','kyc','submitted','approved','provisioned','live','rejected')),
  notes text,
  finix_identity_id text,          -- populated by HQ-3b provisioning
  finix_merchant_id text,
  provisioned_business_id uuid references public.businesses(id) on delete set null,
  provisioned_org_id uuid references public.orgs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists merchant_applications_status_idx on public.merchant_applications(status, created_at desc);

alter table public.merchant_applications enable row level security;  -- deny-all: service-role only

-- Public intake. Anyone may submit an application; nothing is readable back.
create or replace function public.submit_application(
  p_business_name text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_industry text,
  p_plan text,
  p_rep text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(p_contact_email, '')));
begin
  if nullif(trim(coalesce(p_business_name, '')), '') is null then raise exception 'missing_business_name'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'bad_email'; end if;

  insert into public.merchant_applications
    (business_name, contact_name, contact_email, contact_phone, industry, plan, referred_by_rep)
  values (
    left(trim(p_business_name), 120),
    nullif(left(trim(coalesce(p_contact_name, '')), 120), ''),
    left(v_email, 200),
    nullif(left(trim(coalesce(p_contact_phone, '')), 40), ''),
    nullif(left(trim(coalesce(p_industry, '')), 40), ''),
    nullif(left(trim(coalesce(p_plan, '')), 40), ''),
    nullif(left(trim(coalesce(p_rep, '')), 60), '')
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
grant execute on function public.submit_application(text, text, text, text, text, text, text) to anon, authenticated;
