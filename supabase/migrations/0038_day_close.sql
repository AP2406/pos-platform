-- Phase B: end-of-day close. An immutable Z-report snapshot per business day.
-- Cash plumbing (drawer_sessions, cash_movements) already exists; this adds the
-- finalized day artifact.

create table if not exists public.z_reports (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  business_date     date not null,
  opened_at         timestamptz,
  closed_at         timestamptz not null default now(),
  drawer_session_id uuid references public.drawer_sessions(id),
  totals            jsonb not null,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  unique (business_id, business_date)
);

alter table public.z_reports enable row level security;

drop policy if exists z_reports_select on public.z_reports;
create policy z_reports_select on public.z_reports for select
  using (exists (
    select 1 from public.business_members m
    where m.business_id = z_reports.business_id and m.user_id = auth.uid()
  ));

drop policy if exists z_reports_insert on public.z_reports;
create policy z_reports_insert on public.z_reports for insert
  with check (exists (
    select 1 from public.business_members m
    where m.business_id = z_reports.business_id and m.user_id = auth.uid()
      and m.role in ('owner','manager')
  ));

-- A filed Z-report is immutable: block any UPDATE. (DELETE is left to the
-- business cascade only; Z reports are never edited.)
create or replace function public.guard_z_report_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'z_report_immutable: a filed Z-report cannot be changed';
end;
$$;

drop trigger if exists trg_z_report_no_update on public.z_reports;
create trigger trg_z_report_no_update
  before update on public.z_reports
  for each row execute function public.guard_z_report_immutable();
