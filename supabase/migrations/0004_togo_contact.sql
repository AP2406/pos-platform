-- Takeout contact: capture the customer's phone (name already rides in
-- open_tickets.label). Additive + idempotent. Run once in the Supabase SQL editor.
alter table public.open_tickets add column if not exists customer_phone text;
