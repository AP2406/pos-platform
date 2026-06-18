-- Phase 7: hourly pay rate per staff member, for labor-cost reporting.
alter table public.staff_members
  add column if not exists pay_rate numeric;  -- $/hr, null = unset
