-- P0-8 Reopen a closed check. Money-path-safe: a paid order's financial columns
-- and snapshot are IMMUTABLE forever. Corrections after close are append-only
-- rows in order_adjustments (mirrors the refunds pattern); reporting nets the
-- chain. A trigger enforces the immutability at the database.

create table if not exists public.order_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null references public.orders(id),
  kind text not null,                   -- 'reopen' | 'add_item' | 'tip_adjust' | 'comp' | 'void' | 'charge'
  amount numeric not null default 0,    -- signed delta (dollars), matching orders' unit
  reason_code text not null,
  reason_note text,
  snapshot jsonb,
  created_by uuid,
  approved_by uuid,
  drawer_session_id uuid references public.drawer_sessions(id),
  created_at timestamptz not null default now()
);
create index if not exists order_adjustments_order_idx on public.order_adjustments(order_id);

alter table public.order_adjustments enable row level security;
drop policy if exists oadj_select on public.order_adjustments;
create policy oadj_select on public.order_adjustments for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists oadj_insert on public.order_adjustments;
create policy oadj_insert on public.order_adjustments for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- Immutable settled orders: once an order is settled, its money fields and
-- snapshot can never change. Status transitions (paid -> refunded / voided) and
-- non-financial columns (fulfilled_at) are still allowed.
create or replace function public.guard_paid_order_financials()
returns trigger language plpgsql as $$
begin
  if OLD.status in ('paid','partially_refunded','refunded') then
    if NEW.subtotal is distinct from OLD.subtotal
       or NEW.tax is distinct from OLD.tax
       or NEW.tip is distinct from OLD.tip
       or NEW.discount is distinct from OLD.discount
       or NEW.comp is distinct from OLD.comp
       or NEW.service_charge is distinct from OLD.service_charge
       or NEW.total is distinct from OLD.total
       or NEW.snapshot is distinct from OLD.snapshot then
      raise exception 'immutable_paid_order: financials/snapshot of a settled order cannot change';
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_guard_paid_order on public.orders;
create trigger trg_guard_paid_order before update on public.orders
  for each row execute function public.guard_paid_order_financials();
