-- Finix sandbox certification (#6): ingest dispute webhooks so a chargeback is
-- visible inside Surge, not just the Finix dashboard. The webhook (service role)
-- upserts here keyed by the Finix dispute id; the business is resolved from the
-- disputed transfer via finix_payments. Read-only for members.

create table if not exists public.finix_disputes (
  id text primary key,                       -- Finix dispute id (DI...)
  business_id uuid references public.businesses(id) on delete set null,
  finix_transfer_id text,                    -- the disputed transfer (TR...)
  order_id uuid references public.orders(id) on delete set null,
  amount_cents integer not null default 0,
  currency text not null default 'USD',
  state text,                                -- PENDING | WON | LOST | INQUIRY ...
  reason text,
  respond_by timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finix_disputes_business_idx on public.finix_disputes(business_id, created_at desc);
create index if not exists finix_disputes_transfer_idx on public.finix_disputes(finix_transfer_id);

alter table public.finix_disputes enable row level security;
drop policy if exists finix_disputes_select on public.finix_disputes;
create policy finix_disputes_select on public.finix_disputes for select
  using (exists (select 1 from public.business_members m
                 where m.business_id = finix_disputes.business_id and m.user_id = auth.uid()));
