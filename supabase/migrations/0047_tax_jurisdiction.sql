-- P2: tax-by-jurisdiction. Optional jurisdiction label (e.g. province/state) on
-- each tax rate, so accounting can subtotal tax by jurisdiction for remittance.
alter table public.tax_rates add column if not exists jurisdiction text;
