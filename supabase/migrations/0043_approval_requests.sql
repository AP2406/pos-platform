-- Phase 5d: async approval queue. A cashier without the permission/cap can send
-- a request to /app/approvals instead of getting an on-the-spot manager PIN
-- (the PIN path is kept). v1 supports 'void'; on approve the void executes.
create table if not exists public.approval_requests (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  kind             text not null,
  order_id         uuid,
  amount           numeric,
  reason_code      text,
  reason_note      text,
  requested_by     uuid,
  requested_by_name text,
  status           text not null default 'pending',
  decided_by       uuid,
  decided_at       timestamptz,
  payload          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

alter table public.approval_requests enable row level security;

drop policy if exists approval_requests_select on public.approval_requests;
create policy approval_requests_select on public.approval_requests for select
  using (exists (select 1 from public.business_members m
    where m.business_id = approval_requests.business_id and m.user_id = auth.uid()));

drop policy if exists approval_requests_insert on public.approval_requests;
create policy approval_requests_insert on public.approval_requests for insert
  with check (exists (select 1 from public.business_members m
    where m.business_id = approval_requests.business_id and m.user_id = auth.uid()));

drop policy if exists approval_requests_update on public.approval_requests;
create policy approval_requests_update on public.approval_requests for update
  using (exists (select 1 from public.business_members m
    where m.business_id = approval_requests.business_id and m.user_id = auth.uid()
      and m.role in ('owner','manager')));

create index if not exists approval_requests_pending_idx
  on public.approval_requests (business_id, status, created_at);
