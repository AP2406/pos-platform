-- Phase 5d: per-role comp/discount $ caps. A comp/discount over the cap forces a
-- manager approval at the register. Null = unlimited (= current behavior).
alter table public.roles
  add column if not exists comp_cap numeric,
  add column if not exists discount_cap numeric;
