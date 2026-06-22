-- D8 waitlist paging — stamp when a "your table is ready" page was sent to a
-- walk-in waitlist guest (SMS behind the flag, email fallback).
alter table public.reservations
  add column if not exists paged_at timestamptz;
