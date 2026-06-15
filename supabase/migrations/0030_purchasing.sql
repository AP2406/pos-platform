-- P3-37a Purchasing: vendors + purchase orders + lines (model + create/send).
-- A PO line orders either an ingredient (recipe stock, P3-36) OR a catalog item
-- (item-level stock) OR free-text; receiving (P3-37b) routes to the matching
-- ledger. business_id is denormalized on children for simple membership RLS.

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists vendors_business_idx on public.vendors(business_id);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  po_number integer not null default 0,        -- per-business display number (PO-0001)
  status text not null default 'draft',         -- draft | sent | received | cancelled
  notes text,
  expected_at date,
  sent_at timestamptz,
  received_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists purchase_orders_business_idx on public.purchase_orders(business_id);
create index if not exists purchase_orders_status_idx on public.purchase_orders(business_id, status);

create table if not exists public.po_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,
  description text not null default '',          -- snapshot label (survives item rename/delete)
  unit text not null default 'unit',
  quantity numeric not null default 0,
  unit_cost numeric not null default 0,          -- cost per unit, dollars
  received_qty numeric not null default 0,       -- filled by receiving (P3-37b)
  created_at timestamptz not null default now()
);
create index if not exists po_lines_po_idx on public.po_lines(po_id);
create index if not exists po_lines_business_idx on public.po_lines(business_id);

-- Per-business PO number: next = max(existing) + 1, assigned on insert if unset.
create or replace function public.next_po_number(p_business_id uuid)
returns integer
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(max(po_number), 0) + 1
    from public.purchase_orders where business_id = p_business_id;
$$;

-- RLS: membership-scoped, mirroring ingredients/reservations/etc.
alter table public.vendors enable row level security;
drop policy if exists ven_select on public.vendors;
create policy ven_select on public.vendors for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ven_insert on public.vendors;
create policy ven_insert on public.vendors for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ven_update on public.vendors;
create policy ven_update on public.vendors for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ven_delete on public.vendors;
create policy ven_delete on public.vendors for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

alter table public.purchase_orders enable row level security;
drop policy if exists po_select on public.purchase_orders;
create policy po_select on public.purchase_orders for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists po_insert on public.purchase_orders;
create policy po_insert on public.purchase_orders for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists po_update on public.purchase_orders;
create policy po_update on public.purchase_orders for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists po_delete on public.purchase_orders;
create policy po_delete on public.purchase_orders for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

alter table public.po_lines enable row level security;
drop policy if exists pol_select on public.po_lines;
create policy pol_select on public.po_lines for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists pol_insert on public.po_lines;
create policy pol_insert on public.po_lines for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists pol_update on public.po_lines;
create policy pol_update on public.po_lines for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists pol_delete on public.po_lines;
create policy pol_delete on public.po_lines for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
