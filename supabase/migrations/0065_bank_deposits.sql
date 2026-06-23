-- F15 daily bank-deposit reconciliation. Records the cash actually deposited to
-- the bank against the expected cash from a day's Z-report, flags variances, and
-- tracks whether it has been matched to the bank statement. Money numeric dollars.

create table if not exists public.bank_deposits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  business_date date not null,
  z_report_id uuid references public.z_reports(id) on delete set null,
  expected_cash numeric not null default 0,        -- counted cash from the Z-report
  deposited_amount numeric not null default 0,     -- what actually went to the bank
  deposit_date date,
  reference text,                                  -- deposit slip / bank reference
  variance numeric not null default 0,             -- deposited - expected
  status text not null default 'recorded',          -- recorded | reconciled
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bank_deposits_business_idx on public.bank_deposits(business_id, business_date desc);
create unique index if not exists bank_deposits_business_date_idx on public.bank_deposits(business_id, business_date);

alter table public.bank_deposits enable row level security;

-- Owner/manager only — cash-handling control.
drop policy if exists bank_deposits_all on public.bank_deposits;
create policy bank_deposits_all on public.bank_deposits for all
  using (exists (select 1 from public.business_members m where m.business_id = bank_deposits.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m where m.business_id = bank_deposits.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));
