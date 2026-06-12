-- P2-34 email marketing (CASL). Express consent + a per-customer unsubscribe
-- token, plus a record of campaigns sent. Only consented customers with an email
-- are ever messaged; every send carries an unsubscribe link that flips consent.
alter table public.customers
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_source text,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists customers_unsub_token_idx on public.customers(unsubscribe_token);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subject text not null,
  body text not null,
  segment_tag uuid references public.tags(id) on delete set null,
  recipient_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists marketing_campaigns_business_idx on public.marketing_campaigns(business_id);

alter table public.marketing_campaigns enable row level security;
drop policy if exists mc_select on public.marketing_campaigns;
create policy mc_select on public.marketing_campaigns for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists mc_insert on public.marketing_campaigns;
create policy mc_insert on public.marketing_campaigns for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- Public unsubscribe: flip marketing consent off given the secret token. No
-- membership check (the token IS the authorization).
create or replace function public.unsubscribe_marketing(p_token uuid)
returns text
language plpgsql security definer set search_path to 'public' as $$
declare v_name text;
begin
  update customers
    set marketing_consent = false,
        marketing_consent_at = now(),
        marketing_consent_source = 'unsubscribe'
    where unsubscribe_token = p_token
    returning name into v_name;
  return v_name;
end $$;
grant execute on function public.unsubscribe_marketing(uuid) to anon, authenticated;
