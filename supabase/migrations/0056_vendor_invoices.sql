-- C4 Vendor invoice capture (AP). A header-level record of a supplier invoice:
-- vendor, dates, amounts (numeric dollars), a GL account for posting, payment
-- status, an optional link to the originating PO, and an optional attachment
-- reference (a link to the scanned invoice; binary upload / OCR is a follow-up).
-- Per-vendor price history + cost-creep are derived from po_lines, no table.

create table if not exists public.vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  po_id uuid references public.purchase_orders(id) on delete set null,
  invoice_number text not null default '',
  invoice_date date,
  due_date date,
  subtotal numeric not null default 0,        -- dollars
  tax numeric not null default 0,             -- dollars
  total numeric not null default 0,           -- dollars
  gl_account text,                            -- expense account for posting (free text / COA code)
  status text not null default 'open',        -- open | paid | void
  paid_at timestamptz,
  attachment_url text,                        -- optional link to the scanned invoice
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vendor_invoices_business_idx on public.vendor_invoices(business_id);
create index if not exists vendor_invoices_vendor_idx on public.vendor_invoices(business_id, vendor_id);
create index if not exists vendor_invoices_status_idx on public.vendor_invoices(business_id, status);

-- RLS: membership-scoped, mirroring vendors / purchase_orders.
alter table public.vendor_invoices enable row level security;
drop policy if exists vinv_select on public.vendor_invoices;
create policy vinv_select on public.vendor_invoices for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists vinv_insert on public.vendor_invoices;
create policy vinv_insert on public.vendor_invoices for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists vinv_update on public.vendor_invoices;
create policy vinv_update on public.vendor_invoices for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists vinv_delete on public.vendor_invoices;
create policy vinv_delete on public.vendor_invoices for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
