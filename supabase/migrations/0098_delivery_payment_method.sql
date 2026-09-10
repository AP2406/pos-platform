-- Fix: third-party delivery ingest has never worked. inject_delivery_order
-- (0074) records a pre-paid channel order with payment_method / payment.method
-- 'delivery' (so aggregator revenue is reconciled apart from cash/card), but the
-- orders_payment_method_check (0027) and payments_method_check constraints never
-- included 'delivery' — so every DoorDash / Uber Eats / Grubhub / Deliverect order
-- failed with a check-constraint violation before it could reach the KDS.
--
-- Money-independent: 'delivery' is an EXTERNAL tender (the platform already
-- charged the guest); this only widens the allowed enum so the paid record + the
-- kitchen fire can be written. No Finix, no charge path touched.

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method = any (array['cash','card','other','split','gift_card','store_credit','delivery']));

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method = any (array['cash','card','other','gift_card','store_credit','delivery']));
