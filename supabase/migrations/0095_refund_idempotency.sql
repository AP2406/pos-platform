-- Refund idempotency: a per-attempt key + a unique index so a double-submit or two
-- operators refunding the same sale can't move money twice (esp. store-credit, which has
-- no processor-level dedup). refundItems claims the key up front (status 'processing')
-- before any money moves; the unique index makes that claim atomic. Additive + nullable,
-- so refunds recorded before this behave exactly as before.
alter table public.refunds
  add column if not exists idempotency_key text;

create unique index if not exists refunds_business_idem_uniq
  on public.refunds(business_id, idempotency_key)
  where idempotency_key is not null;
