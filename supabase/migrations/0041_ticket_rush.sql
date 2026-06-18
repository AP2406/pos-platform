-- Phase 4: Rush/priority flag on a kitchen ticket or online order. Display-only,
-- non-financial (the paid-order guard permits non-financial columns).
alter table public.kitchen_tickets
  add column if not exists rush boolean not null default false;
alter table public.orders
  add column if not exists rush boolean not null default false;
