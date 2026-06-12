-- P1-18 tip pooling. Stores the tip-out rules + server split method as a jsonb
-- blob on the business (mirrors receipt_settings). The actual pool is computed
-- on demand from paid orders; nothing here changes money on existing orders.
alter table public.businesses
  add column if not exists tip_pool_settings jsonb;
