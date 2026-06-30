-- Surge HQ HQ-2: per-merchant MRR override (null = use the plan tier price).
-- For hand-priced tenants (e.g. Pearson) that don't sit on a standard plan.
alter table public.businesses add column if not exists custom_mrr numeric;
