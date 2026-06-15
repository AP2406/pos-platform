-- Round 5: per-line KDS prep state for online/takeout/delivery "order" tickets.
-- (Dine-in already uses kitchen_tickets.items[].ready.) Stores the set of prepared
-- order_item ids. Non-financial + defaulted, so guard_paid_order_financials allows
-- updating it on a settled order; never read by pricing/tax/total/refund logic.
-- `orders` is already in the realtime publication, so two KDS screens stay in sync.
alter table public.orders
  add column if not exists kds_prepared jsonb not null default '[]'::jsonb;
