-- P3: time-clock depth. Unpaid break tracking (break_minutes + an open-break
-- marker), and manager-edit provenance (who/when/why) for missed-punch fixes.
-- The actual edit is also written to audit_events.
alter table public.time_clock_entries
  add column if not exists break_minutes numeric not null default 0,
  add column if not exists on_break_since timestamptz,
  add column if not exists edited_by uuid,
  add column if not exists edited_at timestamptz,
  add column if not exists note text;
