-- v1.1 safe pass: 86, cash movements, ticket type + server. Additive + idempotent.
-- Run once in the Supabase SQL editor. RLS mirrors open_tickets (membership).

-- 1) 86 / out of stock --------------------------------------------------------
alter table public.catalog_items add column if not exists out_of_stock boolean not null default false;

-- 2) Cash movements (No Sale / Pay In / Pay Out) ------------------------------
-- Amounts are numeric dollars, matching drawer_sessions / orders. A No Sale is
-- amount 0 (audit + drawer kick only). Feeds the closeout expected-cash total.
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  drawer_session_id uuid references public.drawer_sessions(id) on delete set null,
  kind text not null,                       -- 'pay_in' | 'pay_out' | 'no_sale'
  amount numeric not null default 0,
  reason_code text,
  reason_note text,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists cash_movements_session_idx on public.cash_movements(drawer_session_id);
create index if not exists cash_movements_business_idx on public.cash_movements(business_id);

alter table public.cash_movements enable row level security;
drop policy if exists cash_movements_select on public.cash_movements;
create policy cash_movements_select on public.cash_movements for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists cash_movements_insert on public.cash_movements;
create policy cash_movements_insert on public.cash_movements for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists cash_movements_update on public.cash_movements;
create policy cash_movements_update on public.cash_movements for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists cash_movements_delete on public.cash_movements;
create policy cash_movements_delete on public.cash_movements for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- 3) Ticket type + assigned server -------------------------------------------
-- 'hold' = legacy held ticket (unchanged), 'table' = table-bound, 'togo' = takeout.
alter table public.open_tickets add column if not exists ticket_type text not null default 'hold';
alter table public.open_tickets add column if not exists staff_id uuid references public.staff_members(id) on delete set null;
