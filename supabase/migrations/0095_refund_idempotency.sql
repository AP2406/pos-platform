-- Refund concurrency safety: stop a double-submit OR two operators refunding the same
-- sale from moving money twice (store-credit has no processor-level dedup). refundItems
-- claims a row (finalized=false) BEFORE any money moves, then flips it to finalized=true.
-- Additive + nullable; existing rows default finalized=true, so they behave as before and
-- refunds keep working before this is applied (the code degrades to the old single-insert).
alter table public.refunds
  add column if not exists idempotency_key text,
  add column if not exists finalized boolean not null default true;

-- At most one in-flight (not-yet-finalized) refund per sale: a concurrent second refund's
-- claim insert fails, so it can't move money in parallel. Sequential refunds are fine
-- (the first finalizes, freeing the slot).
create unique index if not exists refunds_order_inflight_uniq
  on public.refunds(business_id, order_id)
  where finalized = false;

-- Per-attempt dedup: a network retry of the same refund reuses its key and is rejected,
-- so a completed refund is never processed a second time.
create unique index if not exists refunds_business_idem_uniq
  on public.refunds(business_id, idempotency_key)
  where idempotency_key is not null;
