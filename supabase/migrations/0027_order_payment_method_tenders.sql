-- P2-32b/P2-33: gift_card and store_credit are valid order-level payment methods
-- (when a sale is paid entirely by one of them). Widen the check accordingly.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method = any (array['cash','card','other','split','gift_card','store_credit']));

-- The payments table has its own method check; widen it the same way.
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method = any (array['cash','card','other','gift_card','store_credit']));
